// Смены — планирование работы по конкретным датам.
//
// Экран отдельный от «Графика работы» в настройках: там недельные шаблоны
// (Work Schedule), здесь экземпляры на даты (Shift). Плановые часы табеля и
// зарплаты по сменам НЕ считаются — см. docs/adr/0002.

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { ChevronLeft, ChevronRight, Filter, Plus, X } from "lucide-react";
import { toast } from "sonner";
import PageMeta from "../../components/common/PageMeta";
import Spinner from "../../components/ui/Spinner";
import { Modal } from "../../components/ui/modal";
import {
  PILL_GROUP,
  PILL_ICON_BUTTON,
  PILL_LABEL,
  pillButton,
} from "../../components/common/toolbarPill";
import { useHeaderBreadcrumbItems } from "../../context/HeaderBreadcrumbContext";
import { useEmployeesQuery, type Employee } from "../../api/services/employee.service";
import { usePositionsQuery } from "../../api/services/position.service";
import { useLocationsQuery } from "../../api/services/location.service";
import { useHolidayDaysQuery } from "../../api/services/holidayPolicy.service";
import employeeWorkService from "../../api/services/employeeWork.service";
import reportsService, { type WorkSchedule } from "../../api/services/reports.service";
import {
  isShiftListTruncated,
  useSaveShifts,
  useShiftsQuery,
  type SaveResult,
  type Shift,
  type ShiftInput,
} from "../../api/services/shift.service";
import type { SavePlan } from "./plan";
import {
  DAY_CODE_TO_DOW,
  GROUP_BY_META,
  GROUP_BY_ORDER,
  ITEM_BY_META,
  ITEM_BY_ORDER,
  KIND_META,
  KIND_ORDER,
  LEGEND_ORDER,
  SCALE_META,
  SCALE_ORDER,
  avatarColor,
  datesInRange,
  formatDateRu,
  formatRangeLabel,
  formatShiftTime,
  fromIsoDate,
  getInitials,
  isWeekend,
  normalizeTime,
  rangeForScale,
  shiftAnchor,
  shiftKind,
  toIsoDate,
} from "./constants";
import ShiftModal from "./components/ShiftModal";
import GridView from "./views/GridView";
import type {
  GroupBy,
  ItemBy,
  ShiftEmployee,
  ShiftGroup,
  ShiftsFilters,
  ShiftsScale,
} from "./types";

const BREADCRUMBS = [{ label: "График работы", to: "/shifts" }];

/** Сотрудников на страницу. Столько же, сколько берёт таймлайн табеля. */
const EMPLOYEE_PAGE_SIZE = 50;

const EMPTY_FILTERS: ShiftsFilters = {
  search: "",
  positionId: "",
  locationId: "",
  kind: "",
};

const isScale = (value: string | null): value is ShiftsScale =>
  value === "week" || value === "month";

const isGroupBy = (value: string | null): value is GroupBy =>
  value === "employee" || value === "position" || value === "location" || value === "project";

const isItemBy = (value: string | null): value is ItemBy =>
  value === "employee" || value === "position";

const NO_SHIFTS_KEY = "__none__";

const selectClass =
  "h-[38px] rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";

const employeeName = (employee: Employee): string =>
  [employee.second_name, employee.first_name].filter(Boolean).join(" ").trim() ||
  employee.first_name ||
  "Без имени";

const toShiftEmployee = (employee: Employee): ShiftEmployee => ({
  id: employee.guid,
  name: employeeName(employee),
  photo: employee.photo ?? null,
  positionId: employee.positions_id ?? null,
  position: employee.positions_id_data?.title ?? "",
  departmentId: employee.departments_id ?? null,
  department: employee.departments_id_data?.title ?? "",
  locationId: (employee.locations_id as string | null) ?? null,
  location: (employee.locations_id_data as { title?: string } | null)?.title ?? "",
});

/** Ключ секции для смены — читаем поля смены, а не карточки сотрудника. */
const groupKeyOfShift = (shift: Shift, groupBy: GroupBy): { key: string; label: string } => {
  if (groupBy === "position") {
    return {
      key: shift.positions_id ?? NO_SHIFTS_KEY,
      label: shift.positions_id_data?.title ?? "Без должности",
    };
  }
  if (groupBy === "location") {
    return {
      key: shift.locations_id ?? NO_SHIFTS_KEY,
      label: shift.locations_id_data?.title ?? "Без филиала",
    };
  }
  const project = (shift.project ?? "").trim();
  return { key: project || NO_SHIFTS_KEY, label: project || "Без проекта" };
};

export default function ShiftsPage() {
  useHeaderBreadcrumbItems(BREADCRUMBS);

  const [searchParams, setSearchParams] = useSearchParams();
  const rawScale = searchParams.get("scale");
  const rawAnchor = searchParams.get("date");
  const rawGroupBy = searchParams.get("group");
  const rawItemBy = searchParams.get("rows");

  const scale: ShiftsScale = isScale(rawScale) ? rawScale : "week";
  const groupBy: GroupBy = isGroupBy(rawGroupBy) ? rawGroupBy : "employee";
  // На месяце строка-человек нечитаема: 30 колонок по 44px на каждого. Месяц
  // отвечает на другой вопрос — «сколько людей в смене», а это строка-должность.
  const itemBy: ItemBy =
    scale === "month" ? "position" : isItemBy(rawItemBy) ? rawItemBy : "employee";
  const anchor =
    rawAnchor && /^\d{4}-\d{2}-\d{2}$/.test(rawAnchor) ? rawAnchor : toIsoDate(new Date());

  const patchParams = (patch: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => next.set(key, value));
    setSearchParams(next, { replace: true });
  };

  const [filters, setFilters] = useState<ShiftsFilters>(EMPTY_FILTERS);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [autofillingId, setAutofillingId] = useState<string | null>(null);

  // Разбор свёрнутой строки-должности: кто из неё в этот день работает.
  const [breakdown, setBreakdown] = useState<{
    label: string;
    employees: ShiftEmployee[];
    date: string;
  } | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalShift, setModalShift] = useState<Shift | null>(null);
  const [modalDefaults, setModalDefaults] = useState({
    date: anchor,
    employeeId: null as string | null,
  });
  const [modalError, setModalError] = useState("");

  // Поиск уходит на сервер — печатать по букве в запрос нельзя.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search.trim()), 350);
    return () => clearTimeout(timer);
  }, [filters.search]);

  const range = useMemo(() => rangeForScale(scale, anchor), [scale, anchor]);

  const dates = useMemo(() => datesInRange(range.from, range.to), [range.from, range.to]);

  useEffect(() => {
    setOffset(0);
  }, [range.from, range.to, debouncedSearch]);

  const employeesQuery = useEmployeesQuery({
    limit: EMPLOYEE_PAGE_SIZE,
    offset,
    status: "active",
    search: debouncedSearch || undefined,
  });

  const shiftsQuery = useShiftsQuery(range);
  const positionsQuery = usePositionsQuery({ params: { limit: 200 } });
  const locationsQuery = useLocationsQuery({ params: { limit: 200 } });
  const holidaysQuery = useHolidayDaysQuery();

  /**
   * Нерабочие даты периода и подпись к ним.
   *
   * Выходные берём из календаря, поверх кладём производственный: праздник
   * делает нерабочим будний день, а перенос рабочего дня — наоборот, снимает
   * выходной с субботы. Порядок здесь и есть правило.
   */
  const offDayByDate = useMemo(() => {
    const map = new Map<string, string>();
    dates.forEach((iso) => {
      if (isWeekend(iso)) map.set(iso, "Выходной");
    });
    (holidaysQuery.data?.response ?? []).forEach((day) => {
      const iso = String(day.date ?? "").slice(0, 10);
      if (day.is_workday_transfer) map.delete(iso);
      else map.set(iso, String(day.title || "Праздничный день"));
    });
    return map;
  }, [dates, holidaysQuery.data]);

  const employees = useMemo<ShiftEmployee[]>(() => {
    const raw = (employeesQuery.data as { response?: Employee[] } | undefined)?.response;
    return Array.isArray(raw) ? raw.map(toShiftEmployee) : [];
  }, [employeesQuery.data]);

  const employeesTotal = Number(
    (employeesQuery.data as { count?: number } | undefined)?.count ?? 0
  );

  // Не `?? []` по месту: новая пустая ссылка на каждом рендере сбрасывала бы
  // мемоизацию групп и сетки.
  const allShifts = useMemo(() => shiftsQuery.data?.response ?? [], [shiftsQuery.data]);

  const positions = positionsQuery.data?.response ?? [];
  const locations = locationsQuery.data?.response ?? [];

  /** Смены, прошедшие фильтры по полям самой смены. */
  const visibleShifts = useMemo(
    () =>
      allShifts.filter((shift) => {
        if (filters.positionId && shift.positions_id !== filters.positionId) return false;
        if (filters.locationId && shift.locations_id !== filters.locationId) return false;
        if (filters.kind && shiftKind(shift) !== filters.kind) return false;
        return true;
      }),
    [allShifts, filters.positionId, filters.locationId, filters.kind]
  );

  const shiftByCell = useMemo(() => {
    const map = new Map<string, Shift>();
    visibleShifts.forEach((shift) => {
      if (!shift.user_base_id) return;
      map.set(`${shift.user_base_id}|${shift.date}`, shift);
    });
    return map;
  }, [visibleShifts]);

  const openShifts = useMemo(
    () => visibleShifts.filter((shift) => !shift.user_base_id),
    [visibleShifts]
  );

  const projectSuggestions = useMemo(() => {
    const set = new Set<string>();
    allShifts.forEach((shift) => {
      const project = (shift.project ?? "").trim();
      if (project) set.add(project);
    });
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [allShifts]);

  /** Фильтр по полю смены сужает и список сотрудников: без единой подходящей
   *  смены человек под такой фильтр просто не попадает. */
  const hasShiftFilter = Boolean(filters.positionId || filters.locationId || filters.kind);

  const groups = useMemo<ShiftGroup[]>(() => {
    const shiftsByEmployee = new Map<string, Shift[]>();
    visibleShifts.forEach((shift) => {
      if (!shift.user_base_id) return;
      const list = shiftsByEmployee.get(shift.user_base_id) ?? [];
      list.push(shift);
      shiftsByEmployee.set(shift.user_base_id, list);
    });

    const matching = employees.filter(
      (employee) => !hasShiftFilter || (shiftsByEmployee.get(employee.id)?.length ?? 0) > 0
    );

    if (groupBy === "employee") {
      const openByDate = new Map<string, Shift[]>();
      openShifts.forEach((shift) => {
        const list = openByDate.get(shift.date) ?? [];
        list.push(shift);
        openByDate.set(shift.date, list);
      });
      return [{ key: "all", label: "Все", employees: matching, openByDate }];
    }

    const buckets = new Map<string, ShiftGroup>();
    const ensure = (key: string, label: string): ShiftGroup => {
      const existing = buckets.get(key);
      if (existing) return existing;
      const created: ShiftGroup = { key, label, employees: [], openByDate: new Map() };
      buckets.set(key, created);
      return created;
    };

    matching.forEach((employee) => {
      const employeeShifts = shiftsByEmployee.get(employee.id) ?? [];
      if (employeeShifts.length === 0) {
        // Незапланированный человек не исчезает — он собирается в собственную
        // секцию: «кого забыли поставить» и есть главный вопрос к экрану.
        ensure(NO_SHIFTS_KEY, "Без смен").employees.push(employee);
        return;
      }
      // Сотрудник может попасть в несколько секций за период — если на этой
      // неделе он работал и как QA, и как Backend, это правда, а не ошибка.
      const seen = new Set<string>();
      employeeShifts.forEach((shift) => {
        const { key, label } = groupKeyOfShift(shift, groupBy);
        if (seen.has(key)) return;
        seen.add(key);
        ensure(key, label).employees.push(employee);
      });
    });

    openShifts.forEach((shift) => {
      const { key, label } = groupKeyOfShift(shift, groupBy);
      const group = ensure(key, label);
      const list = group.openByDate.get(shift.date) ?? [];
      list.push(shift);
      group.openByDate.set(shift.date, list);
    });

    return [...buckets.values()].sort((a, b) => {
      // «Без смен» всегда последней: это остаток, а не полноценная секция.
      if (a.key === NO_SHIFTS_KEY) return 1;
      if (b.key === NO_SHIFTS_KEY) return -1;
      return a.label.localeCompare(b.label);
    });
  }, [employees, visibleShifts, openShifts, groupBy, hasShiftFilter]);

  const saveShifts = useSaveShifts();
  // Удаление идёт той же мутацией: одна операция может и править, и снимать.
  const deleteShifts = useSaveShifts();

  const openModal = (employeeId: string | null, date: string, shift: Shift | null) => {
    setModalError("");
    setModalShift(shift);
    setModalDefaults({ date, employeeId });
    setIsModalOpen(true);
  };

  /**
   * Итог сохранения словами.
   *
   * Раздельных «обновлено/создано» больше нет: правки и создания уезжают одним
   * `upsert-many`, а один стейтмент даёт один результат (ADR-0004). Зато запись
   * и снятие различаются словами — это разные запросы и разные последствия:
   * «смены не записались» и «снятые дни остались на месте» требуют разного.
   * Транзакции у `/v2/items` нет, поэтому частичный отказ возможен, и молчать
   * о нём нельзя: человек ушёл бы с экрана, уверенный в другом.
   */
  const saveSummary = (result: SaveResult, skipped: number): string => {
    const parts: string[] = [];
    if (result.saved > 0) parts.push(`сохранено ${result.saved}`);
    if (result.deleted > 0) parts.push(`снято ${result.deleted}`);
    if (skipped > 0) parts.push(`пропущено занятых ${skipped}`);
    if (result.failed > 0) parts.push(`не записалось ${result.failed}`);
    if (result.deleteFailed > 0) parts.push(`не удалилось ${result.deleteFailed}`);
    if (parts.length === 0) return "Изменений не было.";
    // Причина рядом с цифрой: без неё «не записалось 3» нечем объяснить и
    // не с чем идти дальше — подробности отказов лежат в консоли.
    const why = [
      result.writeReason && `запись — ${result.writeReason}`,
      result.deleteReason && `удаление — ${result.deleteReason}`,
    ]
      .filter(Boolean)
      .join("; ");
    return `Смены: ${parts.join(", ")}.${why ? ` Причина: ${why}.` : ""}`;
  };

  const handleSubmit = async (plan: SavePlan) => {
    try {
      setModalError("");
      const result = await saveShifts.mutateAsync({
        rows: [...plan.updates, ...plan.creates],
        deletes: plan.deletes,
      });
      setIsModalOpen(false);
      const summary = saveSummary(result, plan.skipped);
      if (result.failed > 0 || result.deleteFailed > 0) toast.error(summary);
      else toast.success(summary);
    } catch (error) {
      setModalError(
        error instanceof Error ? error.message : "Не удалось сохранить смену."
      );
    }
  };

  const handleDelete = async (guids: string[]) => {
    try {
      const result = await deleteShifts.mutateAsync({ deletes: guids });
      setIsModalOpen(false);
      if (result.deleteFailed > 0) toast.error(saveSummary(result, 0));
      else toast.success(`Удалено смен: ${result.deleted}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось удалить смену.");
    }
  };

  /**
   * Заполнение периода по недельному шаблону самого сотрудника.
   *
   * Уже стоящие смены не трогаем: автозаполнение — помощник на старте месяца,
   * а не кнопка «стереть всё, что я правил руками». Сколько пропущено — видно
   * в тосте, молча расходиться с ожиданием оно не должно.
   */
  const handleAutofill = async (employee: ShiftEmployee) => {
    setAutofillingId(employee.id);
    try {
      const works = await employeeWorkService.getList({ userBaseId: employee.id, limit: 50 });
      const current = [...(works.response ?? [])]
        .filter((work) => work.work_schedule_id)
        .sort((a, b) => String(b.date_from ?? "").localeCompare(String(a.date_from ?? "")))[0];

      if (!current?.work_schedule_id) {
        toast.error(`У сотрудника ${employee.name} не назначен график работы.`);
        return;
      }

      const result = await reportsService.getWorkSchedules({ guid: current.work_schedule_id });
      const schedule: WorkSchedule | undefined = result.schedules?.[0];
      if (!schedule) {
        toast.error("График сотрудника не найден.");
        return;
      }

      const byDow = new Map<number, WorkSchedule["days"][number]>();
      schedule.days.forEach((day) => {
        const dow = DAY_CODE_TO_DOW[day.day];
        if (dow !== undefined) byDow.set(dow, day);
      });

      const rows: ShiftInput[] = [];
      let skipped = 0;
      // Один прогон — один график: автозаполнение и так пишет период в границы
      // видимого, то есть заводит серию из одного человека, просто без имени.
      const seriesId = crypto.randomUUID();

      dates.forEach((iso) => {
        if (shiftByCell.has(`${employee.id}|${iso}`)) {
          skipped += 1;
          return;
        }
        const day = byDow.get(fromIsoDate(iso).getDay());
        if (!day) return;

        const start = normalizeTime(day.work_start_time);
        const end = normalizeTime(day.work_end_time);
        // Нерабочий день шаблона не превращается в запись: «не работает» —
        // это отсутствие смены, пустая клетка и есть выходной.
        if (day.is_day_off || !start || !end) return;

        rows.push({
          date: iso,
          // Автозаполнение — это тоже период: тот, что открыт на экране.
          // Открыв потом любую из этих смен, человек увидит его целиком.
          date_from: range.from,
          date_to: range.to,
          series_id: seriesId,
          user_base_id: employee.id,
          start_time: start,
          end_time: end,
          // Шаблон всегда задаёт конкретные часы, поэтому длительности здесь
          // не бывает — «часов в день» проставляют только руками.
          hours_per_day: null,
          positions_id: employee.positionId,
          locations_id: employee.locationId,
          project: null,
          comment: null,
        });
      });

      if (rows.length === 0) {
        toast.info(
          skipped > 0
            ? "В этом периоде у сотрудника уже расставлены все смены."
            : "График сотрудника не даёт смен на этот период."
        );
        return;
      }

      const saved = await saveShifts.mutateAsync({ rows });
      toast.success(
        skipped > 0
          ? `Создано смен: ${saved.saved}. Пропущено уже занятых дней: ${skipped}.`
          : `Создано смен: ${saved.saved} по графику «${schedule.title}».`
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось заполнить период по графику."
      );
    } finally {
      setAutofillingId(null);
    }
  };

  const toggleGroup = (key: string) => {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const activeFilterCount = [filters.positionId, filters.locationId, filters.kind].filter(
    Boolean
  ).length;

  const periodLabel = useMemo(() => formatRangeLabel(scale, range), [scale, range]);

  const isLoading = employeesQuery.isLoading || shiftsQuery.isLoading;
  const isTruncated = isShiftListTruncated(shiftsQuery.data);

  return (
    <>
      <PageMeta
        title="График работы | HRMS"
        description="Планирование смен сотрудников по датам"
      />

      {/* ── Тулбар ──────────────────────────────────────────────────────── */}
      <div className="-mx-3 -mt-3 md:-mx-4 md:-mt-4">
        <div
          className={`flex flex-wrap items-center gap-3 border-x border-gray-200 bg-white px-4 py-2.5 dark:border-gray-800 dark:bg-gray-900 lg:px-6 ${
            isFiltersOpen ? "" : "border-b"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-gray-400 dark:text-gray-500">Группировать</span>
            <select
              value={groupBy}
              onChange={(event) => patchParams({ group: event.target.value })}
              className={selectClass}
            >
              {GROUP_BY_ORDER.map((item) => (
                <option key={item} value={item}>
                  {GROUP_BY_META[item].label}
                </option>
              ))}
            </select>

            {/* «Строки» — это не второй уровень группировки, а то, чем строка
                вообще является: человеком или свёрнутой в сводку должностью. */}
            <span className="text-[12px] text-gray-400 dark:text-gray-500">Строки</span>
            <select
              value={itemBy}
              onChange={(event) => patchParams({ rows: event.target.value })}
              title={
                scale === "month" ? "На месяце строки всегда по должностям" : undefined
              }
              className={selectClass}
            >
              {ITEM_BY_ORDER.map((item) => (
                <option
                  key={item}
                  value={item}
                  disabled={scale === "month" && item === "employee"}
                >
                  {ITEM_BY_META[item].label}
                </option>
              ))}
            </select>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFiltersOpen((open) => !open)}
              className={`inline-flex h-[38px] items-center gap-2 rounded-xl border px-3.5 text-[13px] font-medium transition ${
                isFiltersOpen || activeFilterCount > 0
                  ? "border-brand-300 bg-brand-50 text-brand-600 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-400"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
              }`}
            >
              <Filter size={16} />
              Фильтры
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-brand-500 px-1.5 text-[11px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => openModal(null, anchor, null)}
              className="inline-flex h-[38px] items-center gap-2 rounded-xl bg-brand-500 px-3.5 text-[13px] font-semibold text-white transition hover:bg-brand-600"
            >
              <Plus size={16} />
              Смена
            </button>
          </div>
        </div>

        {isFiltersOpen && (
          <div className="flex flex-wrap items-center gap-2 border-x border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-white/[0.02] lg:px-6">
            <input
              type="text"
              value={filters.search}
              placeholder="Поиск сотрудника…"
              onChange={(event) =>
                setFilters((current) => ({ ...current, search: event.target.value }))
              }
              className="h-9 w-[200px] rounded-lg border border-gray-200 bg-white px-3 text-[13px] outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            />

            <select
              value={filters.positionId}
              onChange={(event) =>
                setFilters((current) => ({ ...current, positionId: event.target.value }))
              }
              className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-[13px] dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            >
              <option value="">Все должности</option>
              {positions.map((item) => (
                <option key={item.guid} value={item.guid}>
                  {item.title}
                </option>
              ))}
            </select>

            <select
              value={filters.locationId}
              onChange={(event) =>
                setFilters((current) => ({ ...current, locationId: event.target.value }))
              }
              className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-[13px] dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            >
              <option value="">Все филиалы</option>
              {locations.map((item) => (
                <option key={item.guid} value={item.guid}>
                  {item.title}
                </option>
              ))}
            </select>

            <select
              value={filters.kind}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  kind: event.target.value as ShiftsFilters["kind"],
                }))
              }
              className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-[13px] dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            >
              <option value="">Все виды смен</option>
              {KIND_ORDER.map((kind) => (
                <option key={kind} value={kind}>
                  {KIND_META[kind].label}
                </option>
              ))}
            </select>

            {(activeFilterCount > 0 || filters.search) && (
              <button
                type="button"
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-[12px] font-medium text-gray-500 transition hover:bg-white dark:border-gray-700 dark:text-gray-400"
              >
                <X size={13} />
                Сбросить
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Период и легенда ────────────────────────────────────────────── */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className={PILL_GROUP}>
              {SCALE_ORDER.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => patchParams({ scale: item })}
                  className={pillButton(item === scale)}
                >
                  {SCALE_META[item].label}
                </button>
              ))}
            </div>

            {/* Легенда обязательна: в клетках вид смены остался одним цветом. */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {LEGEND_ORDER.map((kind) => (
                <span
                  key={kind}
                  className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: KIND_META[kind].color }}
                  />
                  {KIND_META[kind].label}
                </span>
              ))}
            </div>
          </div>

          {/* Шаг стрелок равен видимому периоду — неделе или месяцу. */}
          <div className={PILL_GROUP}>
            <button
              type="button"
              onClick={() => patchParams({ date: shiftAnchor(scale, anchor, -1) })}
              className={PILL_ICON_BUTTON}
              aria-label="Предыдущий период"
            >
              <ChevronLeft size={16} />
            </button>
            <span className={PILL_LABEL}>{periodLabel}</span>
            <button
              type="button"
              onClick={() => patchParams({ date: shiftAnchor(scale, anchor, 1) })}
              className={PILL_ICON_BUTTON}
              aria-label="Следующий период"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="p-3 md:p-4">
          {isTruncated && (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
              Смен за период больше, чем экран может показать за раз
              ({shiftsQuery.data?.count}). Выберите неделю вместо месяца или сузьте фильтры —
              иначе часть смен не видна.
            </div>
          )}

          {shiftsQuery.isError || employeesQuery.isError ? (
            <div className="rounded-2xl border border-error-200 bg-error-50 px-5 py-8 text-center text-sm text-error-600 dark:border-error-500/30 dark:bg-error-500/10">
              Не удалось загрузить смены.
            </div>
          ) : isLoading ? (
            <div className="flex justify-center rounded-2xl border border-gray-200 bg-white py-20 dark:border-gray-800 dark:bg-white/[0.03]">
              <Spinner />
            </div>
          ) : (
            <GridView
              dates={dates}
              groups={groups}
              shiftByCell={shiftByCell}
              isMonthScale={scale === "month"}
              itemBy={itemBy}
              offDayByDate={offDayByDate}
              collapsedGroups={collapsedGroups}
              showGroupHeaders={groupBy !== "employee"}
              autofillingId={autofillingId}
              onToggleGroup={toggleGroup}
              onCellClick={openModal}
              onOpenShiftsClick={(date, shifts) => openModal(null, date, shifts[0] ?? null)}
              onAutofill={handleAutofill}
              onBreakdownClick={(label, members, date) =>
                setBreakdown({ label, employees: members, date })
              }
            />
          )}
        </div>

        {/* Пагинация сотрудников: строки грида — это люди, и их может быть
            больше страницы. Смены при этом грузятся за весь период сразу. */}
        {employeesTotal > EMPLOYEE_PAGE_SIZE && (
          <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 text-[13px] dark:border-gray-800">
            <span className="text-gray-500 dark:text-gray-400">
              Сотрудники {offset + 1}–{Math.min(offset + EMPLOYEE_PAGE_SIZE, employeesTotal)} из{" "}
              {employeesTotal}
            </span>
            <span className="flex items-center gap-2">
              <button
                type="button"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - EMPLOYEE_PAGE_SIZE))}
                className="rounded-lg border border-gray-200 px-3 py-1.5 font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300"
              >
                Назад
              </button>
              <button
                type="button"
                disabled={offset + EMPLOYEE_PAGE_SIZE >= employeesTotal}
                onClick={() => setOffset(offset + EMPLOYEE_PAGE_SIZE)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300"
              >
                Вперёд
              </button>
            </span>
          </div>
        )}
      </div>

      {/* Свёрнутая строка не должна быть тупиком: сводка «3 из 5» полезна ровно
          до вопроса «а кто эти двое» — ответ здесь же, вместе с правкой. */}
      <Modal
        isOpen={Boolean(breakdown)}
        onClose={() => setBreakdown(null)}
        className="max-w-[520px] p-5 lg:p-6"
      >
        <h4 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
          {breakdown?.label} — {formatDateRu(breakdown?.date ?? "")}
        </h4>
        <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
          {breakdown?.employees.map((employee) => {
            const shift = shiftByCell.get(`${employee.id}|${breakdown.date}`) ?? null;
            const meta = KIND_META[shift ? shiftKind(shift) : "off"];
            const time = shift ? formatShiftTime(shift) : "";
            return (
              <div
                key={employee.id}
                className="flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2 dark:border-gray-800"
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                  style={{ backgroundColor: avatarColor(employee.id) }}
                >
                  {getInitials(employee.name)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-gray-700 dark:text-white/90">
                  {employee.name}
                </span>
                <span
                  className="rounded-lg border px-2 py-1 text-[11px] font-semibold"
                  style={{
                    borderColor: meta.color,
                    backgroundColor: meta.soft,
                    color: meta.color,
                  }}
                >
                  {time || meta.label}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setBreakdown(null);
                    openModal(employee.id, breakdown.date, shift);
                  }}
                  className="text-[12px] font-medium text-brand-500 transition hover:text-brand-600"
                >
                  Изменить
                </button>
              </div>
            );
          })}
        </div>
      </Modal>

      <ShiftModal
        isOpen={isModalOpen}
        onClose={() => {
          if (saveShifts.isLoading || deleteShifts.isLoading) return;
          setIsModalOpen(false);
        }}
        shift={modalShift}
        defaults={modalDefaults}
        employees={employees}
        positions={positions.map((item) => ({ guid: item.guid, title: item.title }))}
        locations={locations.map((item) => ({ guid: item.guid, title: item.title }))}
        projectSuggestions={projectSuggestions}
        isSaving={saveShifts.isLoading}
        isDeleting={deleteShifts.isLoading}
        error={modalError}
        onSubmit={(plan) => void handleSubmit(plan)}
        onDelete={(guids) => void handleDelete(guids)}
      />
    </>
  );
}
