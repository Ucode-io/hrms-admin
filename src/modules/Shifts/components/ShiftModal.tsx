// Форма смены.
//
// Сотрудников выбирают списком: одна смена — это одна строка на человека и
// дату, поэтому «Количество человек» при выбранных людях не вводят, а читают —
// оно равно длине списка. Пустой список — это Open Shift, заявленная
// потребность без исполнителя, и только тогда количество задаётся руками:
// оно создаёт N одинаковых открытых слотов, а не пишется полем в одну запись.
//
// Повтора-переключателя нет: чипы дней недели видны всегда. Пустые чипы —
// каждый день диапазона; диапазон по умолчанию схлопнут в одну дату, поэтому
// обычное создание остаётся созданием одного дня.
//
// Второй шаг («Применить к…») появляется только когда в правке растянут
// диапазон или когда часть дней уже занята. Что именно уедет в базу, считает
// `../plan.ts` — здесь остаётся ввод и подтверждение.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StylesConfig } from "react-select";
import { Modal } from "../../../components/ui/modal";
import EmployeesInfiniteMultiSelect from "../../../components/autocomplete/EmployeesInfiniteMultiSelect";
import {
  WEEKDAY_CHIPS,
  datesInRange,
  formatDateRu,
  fromIsoDate,
  normalizeTime,
} from "../constants";
import {
  buildSavePlan,
  defaultScope,
  resolveAssignee,
  resolveEditedDate,
  type ConflictPolicy,
  type EmployeeMeta,
  type SavePlan,
  type SaveScope,
  type ShiftBase,
} from "../plan";
import { fetchShifts, type Shift } from "../../../api/services/shift.service";
import type { Employee } from "../../../api/services/employee.service";
import type { ShiftEmployee } from "../types";

type Directory = { guid: string; title: string };

interface ShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Запись в правку; `null` — создание. */
  shift: Shift | null;
  /** Предзаполнение при создании кликом по пустой ячейке. */
  defaults: { date: string; employeeId: string | null };
  employees: ShiftEmployee[];
  positions: Directory[];
  locations: Directory[];
  projectSuggestions: string[];
  isSaving: boolean;
  isDeleting: boolean;
  error: string;
  onSubmit: (plan: SavePlan) => void;
  onDelete: (guid: string) => void;
}

const inputClass =
  "h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-brand-300 disabled:bg-gray-50 disabled:text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:disabled:bg-gray-800";

const labelClass = "mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400";

const MAX_HEADCOUNT = 50;

type SelectOption = { value: string; label: string };

// Под высоту и скругление остальных полей формы: react-select стилизуется
// объектом, классами Tailwind до него не дотянуться.
const employeeSelectStyles: StylesConfig<SelectOption, true> = {
  control: (base, state) => ({
    ...base,
    minHeight: 40,
    borderRadius: 12,
    borderColor: state.isFocused ? "var(--color-brand-300, #9cb9ff)" : "#e5e7eb",
    boxShadow: "none",
    "&:hover": { borderColor: state.isFocused ? "var(--color-brand-300, #9cb9ff)" : "#cbd5e1" },
  }),
  valueContainer: (base) => ({ ...base, padding: "2px 9px", fontSize: 13, gap: 3 }),
  placeholder: (base) => ({ ...base, fontSize: 13, color: "#9ca3af" }),
  input: (base) => ({ ...base, fontSize: 13, margin: 0, padding: 0 }),
  indicatorSeparator: (base) => ({ ...base, display: "none" }),
  dropdownIndicator: (base) => ({ ...base, padding: 7, color: "#667085" }),
  multiValue: (base) => ({ ...base, borderRadius: 6, backgroundColor: "#f2f4f7", margin: 2 }),
  multiValueLabel: (base) => ({ ...base, fontSize: 12, color: "#344054", padding: "2px 5px" }),
  multiValueRemove: (base) => ({
    ...base,
    borderRadius: 6,
    color: "#667085",
    "&:hover": { backgroundColor: "#e4e7ec", color: "#344054" },
  }),
  option: (base, state) => ({
    ...base,
    padding: "7px 10px",
    fontSize: 13,
    cursor: "pointer",
    backgroundColor: state.isSelected ? "#eef2ff" : state.isFocused ? "#f8fafc" : "#fff",
    color: state.isSelected ? "#3446a0" : "#344054",
  }),
  menu: (base) => ({ ...base, zIndex: 100000, borderRadius: 10, overflow: "hidden" }),
  menuList: (base) => ({ ...base, maxHeight: 176, padding: 4 }),
  menuPortal: (base) => ({ ...base, zIndex: 100000 }),
};

const SCOPE_LABEL: Record<SaveScope, string> = {
  all: "Менять полный период",
  following: "Только следующие дни",
  single: "Только этот день",
};

const SCOPE_ORDER: SaveScope[] = ["all", "following", "single"];

const periodLabel = (dates: string[]): string => {
  if (dates.length === 0) return "нет подходящих дней";
  if (dates.length === 1) return formatDateRu(dates[0]);
  return `${formatDateRu(dates[0])} – ${formatDateRu(dates[dates.length - 1])}`;
};

const planLabel = (plan: SavePlan): string => {
  const parts: string[] = [];
  if (plan.updates.length > 0) parts.push(`обновится ${plan.updates.length}`);
  if (plan.creates.length > 0) parts.push(`создастся ${plan.creates.length}`);
  return parts.length > 0 ? parts.join(", ") : "изменений нет";
};

export default function ShiftModal({
  isOpen,
  onClose,
  shift,
  defaults,
  employees,
  positions,
  locations,
  projectSuggestions,
  isSaving,
  isDeleting,
  error,
  onSubmit,
  onDelete,
}: ShiftModalProps) {
  const [employeeIds, setEmployeeIds] = useState<string[]>([]);
  const [headcount, setHeadcount] = useState("1");
  // «Время от–до» или «Часов в день»: второе задаёт длительность, не говоря,
  // когда именно работать. Заполнено всегда ровно одно из двух.
  const [timeMode, setTimeMode] = useState<"range" | "hours">("range");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [hours, setHours] = useState("8");
  const [dateFrom, setDateFrom] = useState(defaults.date);
  const [dateTo, setDateTo] = useState(defaults.date);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [positionId, setPositionId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [project, setProject] = useState("");
  const [comment, setComment] = useState("");
  const [formError, setFormError] = useState("");

  // Второй шаг: что уже посчитано и из чего человек выбирает.
  const [pending, setPending] = useState<{ base: ShiftBase; existing: Shift[] } | null>(null);
  const [scope, setScope] = useState<SaveScope>("all");
  const [conflictPolicy, setConflictPolicy] = useState<ConflictPolicy>("skip");
  const [isPreparing, setIsPreparing] = useState(false);

  // Карточки сотрудников, которые успел отдать селект: из них берутся
  // должность и локация для новых строк.
  const [loadedMeta, setLoadedMeta] = useState<Record<string, EmployeeMeta>>({});

  const isEditing = Boolean(shift?.guid);

  /**
   * Список сотрудников нужен форме ровно один раз — подставить должность и
   * локацию при открытии. В зависимостях эффекта ему делать нечего: react-query
   * отдаёт новый массив на каждом перезапросе (фокус окна, инвалидация после
   * сохранения), и форма сбрасывалась бы прямо под руками у человека.
   */
  const employeesRef = useRef(employees);
  employeesRef.current = employees;

  // Пересобираем при каждом открытии, иначе прошлый черновик всплывает поверх
  // новой записи.
  useEffect(() => {
    if (!isOpen) return;
    setFormError("");
    setHeadcount("1");
    setWeekdays([]);
    setPending(null);
    setScope("all");
    setConflictPolicy("skip");

    if (shift) {
      const savedHours = Number(shift.hours_per_day);
      const hasHours = Number.isFinite(savedHours) && savedHours > 0;
      setEmployeeIds(shift.user_base_id ? [shift.user_base_id] : []);
      setTimeMode(hasHours ? "hours" : "range");
      setHours(hasHours ? String(savedHours) : "8");
      setStartTime(normalizeTime(shift.start_time) || "09:00");
      setEndTime(normalizeTime(shift.end_time) || "18:00");
      // Период, которым смену заводили, а не её единственный день: человек,
      // открывший среду из месячного графика, спрашивает про весь график.
      // У строк без периода (автозаполнение, всё созданное до этих полей)
      // период — это сам день, и форма ведёт себя как раньше.
      setDateFrom(shift.date_from || shift.date);
      setDateTo(shift.date_to || shift.date);
      setPositionId(shift.positions_id ?? "");
      setLocationId(shift.locations_id ?? "");
      setProject(shift.project ?? "");
      setComment(shift.comment ?? "");
      return;
    }

    // Создание: должность и локацию подставляем из карточки сотрудника, но
    // дальше они живут в смене — грид группирует по ним, а не по карточке.
    const employee = employeesRef.current.find((item) => item.id === defaults.employeeId);
    setEmployeeIds(defaults.employeeId ? [defaults.employeeId] : []);
    setTimeMode("range");
    setStartTime("09:00");
    setEndTime("18:00");
    setHours("8");
    setDateFrom(defaults.date);
    setDateTo(defaults.date);
    setPositionId(employee?.positionId ?? "");
    setLocationId(employee?.locationId ?? "");
    setProject("");
    setComment("");
  }, [isOpen, shift, defaults]);

  /**
   * Чипы дней недели по самой серии.
   *
   * Период хранится, а по каким дням недели он занят — нет. Без этого
   * «полный период» у графика «пн–пт» дорисовал бы субботы и воскресенья:
   * пустые чипы означают «каждый день диапазона». Спрашиваем сами смены —
   * они и есть ответ, какие дни в этом периоде рабочие.
   */
  useEffect(() => {
    if (!isOpen || !shift) return;

    const from = shift.date_from || shift.date;
    const to = shift.date_to || shift.date;
    if (to <= from) return;

    let cancelled = false;
    void fetchShifts({ from, to })
      .then((result) => {
        if (cancelled) return;
        const owner = shift.user_base_id;
        const series = result.response.filter((row) =>
          owner
            ? row.user_base_id === owner
            : !row.user_base_id &&
              (row.positions_id ?? null) === (shift.positions_id ?? null)
        );
        const dows = [...new Set(series.map((row) => fromIsoDate(row.date).getDay()))];
        // Заняты все семь дней — отмечать нечего: пустые чипы это и значат.
        if (dows.length > 0 && dows.length < 7) setWeekdays(dows);
      })
      .catch(() => {
        // Не смогли — оставляем чипы пустыми: посчитанные цифры в попапе
        // всё равно покажут, сколько дней прибавится.
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, shift]);

  const handleLoadedEmployees = useCallback((list: Employee[]) => {
    setLoadedMeta((current) => {
      const next = { ...current };
      let changed = false;
      list.forEach((item) => {
        if (next[item.guid]) return;
        next[item.guid] = {
          positionId: item.positions_id ?? null,
          locationId: (item.locations_id as string | null) ?? null,
        };
        changed = true;
      });
      return changed ? next : current;
    });
  }, []);

  // Страница грида уже принесла карточки видимых людей — второй раз их
  // спрашивать незачем; селект дополняет этот набор теми, кого подгрузил сам.
  const employeeMeta = useMemo<Record<string, EmployeeMeta>>(() => {
    const map: Record<string, EmployeeMeta> = {};
    employees.forEach((item) => {
      map[item.id] = { positionId: item.positionId, locationId: item.locationId };
    });
    return { ...map, ...loadedMeta };
  }, [employees, loadedMeta]);

  const employeeOptions = useMemo<SelectOption[]>(
    () => employees.map((item) => ({ value: item.id, label: item.name })),
    [employees]
  );

  const rangeTo = dateTo && dateTo >= dateFrom ? dateTo : dateFrom;
  const isRange = Boolean(dateFrom) && rangeTo > dateFrom;

  /**
   * Дни недели, которые вообще встречаются в выбранном диапазоне.
   *
   * Чипы остальных гасим: иначе получается тупик — диапазон в один день,
   * человек отмечает субботу, и форма отказывается сохраняться, не показывая
   * выхода. Дешевле не пустить в невозможное состояние, чем ругаться на него.
   */
  const availableDows = useMemo(() => {
    const set = new Set<number>();
    if (!dateFrom) return set;
    datesInRange(dateFrom, rangeTo).forEach((iso) => set.add(fromIsoDate(iso).getDay()));
    return set;
  }, [dateFrom, rangeTo]);

  // Сузили диапазон — отметки, которым больше нет соответствия, снимаем сами:
  // иначе они остались бы невидимо выбранными и снова блокировали сохранение.
  useEffect(() => {
    setWeekdays((current) => {
      const next = current.filter((dow) => availableDows.has(dow));
      return next.length === current.length ? current : next;
    });
  }, [availableDows]);

  const targetDates = useMemo(() => {
    if (!dateFrom) return [];
    const all = datesInRange(dateFrom, rangeTo);
    if (weekdays.length === 0) return all;
    return all.filter((iso) => weekdays.includes(fromIsoDate(iso).getDay()));
  }, [dateFrom, rangeTo, weekdays]);

  const slots =
    employeeIds.length > 0
      ? employeeIds.length
      : Math.min(Math.max(Number(headcount) || 1, 1), MAX_HEADCOUNT);
  const plannedCount = targetDates.length * slots;

  const toggleWeekday = (dow: number) => {
    setWeekdays((current) =>
      current.includes(dow) ? current.filter((item) => item !== dow) : [...current, dow]
    );
  };

  const makePlan = useCallback(
    (base: ShiftBase, existing: Shift[], nextScope: SaveScope, policy: ConflictPolicy) =>
      buildSavePlan({
        original: shift,
        employeeIds,
        employeeMeta,
        headcount: slots,
        base,
        dateFrom,
        dateTo: rangeTo,
        weekdays,
        scope: nextScope,
        conflicts: policy,
        existing,
      }),
    [shift, employeeIds, employeeMeta, slots, dateFrom, rangeTo, weekdays]
  );

  // Три набора считаются сразу: цифры стоят рядом с каждым радио, а не
  // появляются после выбора — иначе выбирать пришлось бы вслепую.
  const previews = useMemo(() => {
    if (!pending) return null;
    return {
      all: makePlan(pending.base, pending.existing, "all", conflictPolicy),
      following: makePlan(pending.base, pending.existing, "following", conflictPolicy),
      single: makePlan(pending.base, pending.existing, "single", conflictPolicy),
    };
  }, [pending, conflictPolicy, makePlan]);

  const chosenPlan = previews ? (isEditing && isRange ? previews[scope] : previews.all) : null;

  const handleSave = async () => {
    setFormError("");

    if (!dateFrom) {
      setFormError("Укажите дату начала.");
      return;
    }
    if (targetDates.length === 0) {
      setFormError("В выбранном диапазоне нет ни одного из отмеченных дней недели.");
      return;
    }
    // Растянутый диапазон в правке — это края серии, и правимый день обязан в
    // них попадать: иначе непонятно, от какой даты считать «следующие дни».
    if (isEditing && isRange && shift && (shift.date < dateFrom || shift.date > rangeTo)) {
      setFormError("Дата смены должна попадать в диапазон.");
      return;
    }

    const hoursValue = Number(hours);
    const usesHours = timeMode === "hours";

    if (!usesHours) {
      if (!startTime || !endTime) {
        setFormError("Укажите время начала и окончания.");
        return;
      }
      // Равные концы — это не «сутки», а почти наверняка опечатка: 09:00–09:00
      // прочиталось бы как переход через полночь длиной в 24 часа.
      if (startTime === endTime) {
        setFormError("Начало и окончание совпадают.");
        return;
      }
    }

    if (usesHours && (!Number.isFinite(hoursValue) || hoursValue <= 0 || hoursValue > 24)) {
      setFormError("Часов в день должно быть от 1 до 24.");
      return;
    }

    const base: ShiftBase = {
      // Период пишется в каждую строку одинаковым: серии как отдельной
      // записи нет, и это единственный способ ответить потом на вопрос
      // «частью чего была эта смена».
      date_from: dateFrom,
      date_to: rangeTo,
      // Время суток и длительность взаимоисключающи: смена либо стоит в
      // конкретных часах, либо задана объёмом. Записывать оба значения нельзя —
      // иначе непонятно, какое из них правда.
      start_time: usesHours ? null : startTime,
      end_time: usesHours ? null : endTime,
      hours_per_day: usesHours ? hoursValue : null,
      positions_id: positionId || null,
      locations_id: locationId || null,
      project: project.trim() || null,
      comment: comment.trim() || null,
    };

    /**
     * Что в этих датах уже стоит.
     *
     * Грид грузит только видимый период, а диапазон формы может уехать за его
     * край — там фронт слеп: и цифры соврут, и создание упрётся в
     * `shift_employee_date_uniq`. У открытых смен уникальности нет, поэтому
     * при создании открытых слотов спрашивать нечего.
     */
    let existing: Shift[] = [];
    if (employeeIds.length > 0 || isEditing) {
      setIsPreparing(true);
      try {
        existing = (await fetchShifts({ from: dateFrom, to: rangeTo })).response;
      } catch {
        setFormError("Не удалось проверить занятые дни. Попробуйте ещё раз.");
        return;
      } finally {
        setIsPreparing(false);
      }
    }

    /**
     * Правимая строка — единственная, чей день и исполнитель меняются, и
     * единственная, за которую не отвечает выбор «пропустить/перезаписать».
     * Если её новая клетка занята, `shift_employee_date_uniq` отклонит запись,
     * и человек увидит только «не удалось 1» — сказать, что именно не так,
     * можно здесь и словами.
     */
    const assignee = resolveAssignee(shift, employeeIds);
    const editedDate = resolveEditedDate(shift, dateFrom, rangeTo);
    const occupied =
      assignee &&
      existing.find(
        (row) =>
          row.user_base_id === assignee &&
          row.date === editedDate &&
          row.guid !== shift?.guid
      );
    if (occupied) {
      setFormError("У этого сотрудника в выбранный день уже есть смена.");
      return;
    }

    const plan = makePlan(base, existing, "all", "skip");
    const needsChoice = (isEditing && isRange) || plan.conflicts.length > 0;
    // Спрашивать не о чем — сохраняем сразу. Экран подтверждения не должен
    // всплывать задним числом, если сохранение потом упадёт с ошибкой.
    if (!needsChoice) {
      onSubmit(plan);
      return;
    }

    setScope(defaultScope(shift, base));
    setPending({ base, existing });
  };

  const isBusy = isSaving || isDeleting || isPreparing;
  const visibleError = formError || error;
  const showConfirm = Boolean(pending && chosenPlan);
  const conflicts = chosenPlan?.conflicts.length ?? 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-[560px] p-5 lg:p-6">
      <h4 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
        {showConfirm
          ? "Применить изменения"
          : isEditing
            ? `Смена — ${formatDateRu(shift?.date ?? "")}`
            : "Новая смена"}
      </h4>

      {showConfirm && chosenPlan ? (
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          {isEditing && isRange && previews && (
            <div className="space-y-2">
              {SCOPE_ORDER.map((item) => {
                const preview = previews[item];
                return (
                  <label
                    key={item}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition ${
                      scope === item
                        ? "border-brand-300 bg-brand-50 dark:border-brand-500/40 dark:bg-brand-500/10"
                        : "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/5"
                    }`}
                  >
                    <input
                      type="radio"
                      name="shift-scope"
                      checked={scope === item}
                      onChange={() => setScope(item)}
                      className="mt-0.5 h-4 w-4 accent-brand-500"
                    />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-gray-800 dark:text-white/90">
                        {SCOPE_LABEL[item]}
                      </span>
                      <span className="mt-0.5 block text-[12px] text-gray-500 dark:text-gray-400">
                        {periodLabel(preview.dates)} · {planLabel(preview)}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          {!(isEditing && isRange) && (
            <p className="text-[13px] text-gray-600 dark:text-gray-300">
              {periodLabel(chosenPlan.dates)} · {planLabel(chosenPlan)}
            </p>
          )}

          {conflicts > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
              <p className="text-[13px] font-medium text-amber-800 dark:text-amber-300">
                У {conflicts} дней смены уже есть
              </p>
              <div className="mt-2 flex flex-wrap gap-4">
                {(
                  [
                    ["skip", "Пропустить эти дни"],
                    ["overwrite", "Перезаписать"],
                  ] as const
                ).map(([value, label]) => (
                  <label
                    key={value}
                    className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-amber-800 dark:text-amber-300"
                  >
                    <input
                      type="radio"
                      name="shift-conflicts"
                      checked={conflictPolicy === value}
                      onChange={() => setConflictPolicy(value)}
                      className="h-4 w-4 accent-amber-500"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {visibleError && (
            <div className="rounded-xl border border-error-200 bg-error-50 px-3 py-2 text-[13px] text-error-600 dark:border-error-500/30 dark:bg-error-500/10">
              {visibleError}
            </div>
          )}
        </div>
      ) : (
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Сотрудники</label>
              <EmployeesInfiniteMultiSelect
                value={employeeIds}
                onChange={setEmployeeIds}
                onLoaded={handleLoadedEmployees}
                fallbackOptions={employeeOptions}
                placeholder="— Открытая смена —"
                styles={employeeSelectStyles}
                menuPortalTarget={document.body}
                classNamePrefix="shift-employees-select"
              />
            </div>

            {/* Должность стоит рядом с сотрудником, а не среди прочих полей:
                у открытой смены она — единственное, чем описан нужный человек.
                При выбранных людях гаснет: у каждой строки должность своя, из
                карточки её сотрудника. */}
            <div>
              <label className={labelClass}>Должность</label>
              <select
                value={positionId}
                disabled={employeeIds.length > 0}
                onChange={(event) => setPositionId(event.target.value)}
                className={inputClass}
              >
                <option value="">— Не указана —</option>
                {positions.map((item) => (
                  <option key={item.guid} value={item.guid}>
                    {item.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Количество задают только у открытой смены: у выбранных людей оно
              и есть длина списка, у назначенной смены — всегда один человек. */}
          <div>
            <label className={labelClass}>Количество человек</label>
            <input
              type="number"
              min={1}
              max={MAX_HEADCOUNT}
              value={employeeIds.length > 0 ? String(employeeIds.length) : headcount}
              disabled={employeeIds.length > 0 || isEditing}
              onChange={(event) => setHeadcount(event.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <div className="mb-2.5 inline-flex rounded-xl border border-gray-200 p-[3px] dark:border-gray-700">
              {(
                [
                  ["range", "Время от–до"],
                  ["hours", "Часов в день"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setTimeMode(mode)}
                  className={`h-8 rounded-lg px-3 text-[12px] font-semibold transition ${
                    timeMode === mode
                      ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400"
                      : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-white/5"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {timeMode === "range" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Начало</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Окончание</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                    className={inputClass}
                  />
                  {endTime <= startTime && (
                    <p className="mt-1 text-[11px] font-medium text-violet-600 dark:text-violet-400">
                      Переходит через полночь — смена считается ночной.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label className={labelClass}>Часов в день</label>
                <input
                  type="number"
                  min={1}
                  max={24}
                  step="0.5"
                  value={hours}
                  onChange={(event) => setHours(event.target.value)}
                  className={inputClass}
                />
                {/* Честно предупреждаем: у такой смены нет места на сутках. */}
                <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                  Время суток не задано: в таблице такая смена показана часами в
                  день и ночной считаться не может.
                </p>
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Дата начала</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => {
                  setDateFrom(event.target.value);
                  // Диапазон схлопнут по умолчанию: обычное создание — один день.
                  if (!dateTo || dateTo < event.target.value) setDateTo(event.target.value);
                }}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Дата окончания</label>
              <input
                type="date"
                value={dateTo}
                min={dateFrom}
                onChange={(event) => setDateTo(event.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* В правке чипы нужны ровно тогда, когда диапазон растянут: иначе
              «продлить на месяц» выгнало бы человека работать и в выходные. */}
          {(!isEditing || isRange) && (
            <div>
              <label className={labelClass}>Повторяется по дням недели</label>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAY_CHIPS.map((chip) => {
                  const isActive = weekdays.includes(chip.dow);
                  const isAvailable = availableDows.has(chip.dow);
                  return (
                    <button
                      key={chip.dow}
                      type="button"
                      disabled={!isAvailable}
                      title={isAvailable ? undefined : "В выбранном диапазоне такого дня нет"}
                      onClick={() => toggleWeekday(chip.dow)}
                      className={`h-8 w-11 rounded-lg border text-[12px] font-semibold transition ${
                        !isAvailable
                          ? "cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-600"
                          : isActive
                            ? "border-brand-300 bg-brand-50 text-brand-600 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-400"
                            : "border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5"
                      }`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[11px] text-gray-400 dark:text-gray-500">
                {availableDows.size <= 1
                  ? "Диапазон — один день. Чтобы повторять по дням недели, сдвиньте дату окончания."
                  : weekdays.length === 0
                    ? "Ни один день не отмечен — смена встанет на каждую дату диапазона."
                    : "Смена встанет только на отмеченные дни внутри диапазона."}
              </p>
            </div>
          )}

          <div>
            <label className={labelClass}>Локация</label>
            <select
              value={locationId}
              onChange={(event) => setLocationId(event.target.value)}
              className={inputClass}
            >
              <option value="">— Из карточки сотрудника —</option>
              {locations.map((item) => (
                <option key={item.guid} value={item.guid}>
                  {item.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Проект</label>
            <input
              type="text"
              value={project}
              list="shift-project-suggestions"
              placeholder="Название проекта…"
              onChange={(event) => setProject(event.target.value)}
              className={inputClass}
            />
            {/* Справочника проектов в HRMS нет — подсказки собираем из того, что
                уже вводили в смены этого периода. */}
            <datalist id="shift-project-suggestions">
              {projectSuggestions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>

          <div>
            <label className={labelClass}>Комментарий</label>
            <textarea
              rows={2}
              value={comment}
              placeholder="Необязательно…"
              onChange={(event) => setComment(event.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            />
          </div>

          {visibleError && (
            <div className="rounded-xl border border-error-200 bg-error-50 px-3 py-2 text-[13px] text-error-600 dark:border-error-500/30 dark:bg-error-500/10">
              {visibleError}
            </div>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
        <div>
          {isEditing && !showConfirm && (
            <button
              type="button"
              onClick={() => shift?.guid && onDelete(shift.guid)}
              disabled={isBusy}
              className="rounded-xl border border-rose-200 px-3.5 py-2 text-[13px] font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-60 dark:border-rose-500/30 dark:hover:bg-rose-500/10"
            >
              {isDeleting ? "Удаление…" : "Удалить смену"}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isEditing && !showConfirm && plannedCount > 1 && (
            <span className="text-[12px] text-gray-400 dark:text-gray-500">
              Будет создано: {plannedCount}
            </span>
          )}
          <button
            type="button"
            onClick={() => (showConfirm ? setPending(null) : onClose())}
            disabled={isBusy}
            className="rounded-xl border border-gray-200 px-4 py-2 text-[13px] font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
          >
            {showConfirm ? "Назад" : "Отменить"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (showConfirm && chosenPlan) onSubmit(chosenPlan);
              else void handleSave();
            }}
            disabled={isBusy}
            className="rounded-xl bg-brand-500 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
          >
            {isPreparing
              ? "Проверка…"
              : isSaving
                ? "Сохранение…"
                : showConfirm
                  ? "Применить"
                  : "Сохранить"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
