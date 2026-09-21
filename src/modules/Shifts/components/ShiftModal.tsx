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
// Правка открывает серию целиком (см. CONTEXT.md → Shift Series): в списке
// сотрудников стоят все, у кого есть строка с этим `series_id`, а не один
// человек из открытой строки. Поэтому у второго шага две оси — дни и люди:
// «всем с понедельника с 10:00» и «Иванову весь март с 10:00» одной осью не
// выражаются.
//
// Второй шаг («Применить к…») появляется, когда есть о чём спросить: растянут
// диапазон, в серии не один человек, часть дней занята, кого-то убрали из
// списка или в графике есть пропущенные дни. Что именно уедет в базу, считает
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
  buildDeletePlan,
  buildSavePlan,
  resolveAssignee,
  resolveEditedDate,
  seriesMembers,
  seriesRowsOf,
  takenOn,
  type ConflictPolicy,
  type EmployeeMeta,
  type PeopleScope,
  type RemovalPolicy,
  type SavePlan,
  type SaveScope,
  type ShiftBase,
} from "../plan";
import {
  fetchSeries,
  fetchShifts,
  isShiftListTruncated,
  type Shift,
} from "../../../api/services/shift.service";
import type { Employee } from "../../../api/services/employee.service";
import type { ShiftEmployee } from "../types";
import TimeInput from "../../../components/form/TimeInput";
import DateInput from "../../../components/form/DateInput";

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
  /** Удаление тоже идёт пачкой: у него те же две оси, что у правки. */
  onDelete: (guids: string[]) => void;
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

/**
 * «Только этот день» первым и по умолчанию.
 *
 * Окно правит серию на пятерых за месяц, и дефолт у такого окна обязан быть
 * самым узким: цену «применилось не туда» здесь платят чужими сменами, а не
 * лишним кликом. Тот же принцип уже действует у удаления (ADR-0004).
 */
const SCOPE_ORDER: SaveScope[] = ["single", "following", "all"];

const PEOPLE_LABEL: Record<PeopleScope, string> = {
  all: "Всем в графике",
  single: "Только этому человеку",
};

const PEOPLE_ORDER: PeopleScope[] = ["all", "single"];

const periodLabel = (dates: string[]): string => {
  if (dates.length === 0) return "нет подходящих дней";
  if (dates.length === 1) return formatDateRu(dates[0]);
  return `${formatDateRu(dates[0])} – ${formatDateRu(dates[dates.length - 1])}`;
};

const planLabel = (plan: SavePlan): string => {
  const parts: string[] = [];
  if (plan.updates.length > 0) parts.push(`обновится ${plan.updates.length}`);
  if (plan.creates.length > 0) parts.push(`создастся ${plan.creates.length}`);
  if (plan.deletes.length > 0) parts.push(`снимется ${plan.deletes.length}`);
  return parts.length > 0 ? parts.join(", ") : "изменений нет";
};

const plural = (
  count: number,
  one: string,
  few: string,
  many: string,
): string => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
};

/**
 * Перечисление людей: имена, пока их можно прочесть, иначе счёт.
 *
 * Голая цифра в этих блоках и есть главная жалоба на первую версию экрана:
 * «перезаписать» и «останутся пустыми» ничего не значат, пока неизвестно,
 * кого перезаписывают и у кого пусто.
 */
const listNames = (names: string[]): string => {
  if (names.length === 0) return "";
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} и ещё ${names.length - 2}`;
};

/** Дни недели набора дат — «по воскресеньям», а не «11 дней». */
const listDows = (dates: string[]): string => {
  const dows = [...new Set(dates.map((iso) => fromIsoDate(iso).getDay()))];
  return WEEKDAY_CHIPS.filter((chip) => dows.includes(chip.dow))
    .map((chip) => chip.label)
    .join(", ");
};

/**
 * «График ещё едет».
 *
 * Состав серии и её дни недели приходят отдельным запросом, и до ответа форма
 * показывает одну строку вместо графика. Пустая пауза читается как «в смене
 * один человек» — а это ровно то, что потом снимет остальным смены.
 */
function SeriesLoading() {
  return (
    <span className="ml-2 inline-flex items-center gap-1.5 align-middle text-[11px] font-normal text-gray-400 dark:text-gray-500">
      <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-gray-300 border-t-transparent dark:border-gray-600 dark:border-t-transparent" />
      загружаем график…
    </span>
  );
}

/** Заголовок группы радио: без него две оси читаются одним списком из пяти. */
function AxisGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
        {title}
      </p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

/** Карточка-радио: три блока второго шага различаются только текстом. */
function RadioCard({
  name,
  checked,
  title,
  hint,
  onSelect,
}: {
  name: string;
  checked: boolean;
  title: string;
  hint?: string;
  onSelect: () => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition ${
        checked
          ? "border-brand-300 bg-brand-50 dark:border-brand-500/40 dark:bg-brand-500/10"
          : "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/5"
      }`}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className="mt-0.5 h-4 w-4 accent-brand-500"
      />
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-gray-800 dark:text-white/90">
          {title}
        </span>
        {hint && (
          <span className="mt-0.5 block text-[12px] text-gray-500 dark:text-gray-400">
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}

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
  const [pending, setPending] = useState<{
    base: ShiftBase;
    existing: Shift[];
  } | null>(null);
  // Второй шаг обслуживает и удаление: у него те же две оси, и разводить их по
  // двум окнам значило бы жить по разным правилам в верху и низу одного.
  const [pendingDelete, setPendingDelete] = useState<Shift[] | null>(null);
  const [scope, setScope] = useState<SaveScope>("all");
  const [people, setPeople] = useState<PeopleScope>("all");
  const [conflictPolicy, setConflictPolicy] = useState<ConflictPolicy>("skip");
  const [fillGaps, setFillGaps] = useState(false);
  const [removal, setRemoval] = useState<RemovalPolicy>("delete");
  const [isPreparing, setIsPreparing] = useState(false);

  /**
   * Серия, в которую попадёт сохранение.
   *
   * Минтится один раз на открытие формы, а не внутри планировщика: план
   * пересчитывается на каждый клик радио, и свежий UUID на каждом пересчёте
   * сделал бы цифры несравнимыми. Правка наследует серию правимой строки —
   * редактирование серию не раскалывает.
   */
  const [seriesId, setSeriesId] = useState("");

  /** Строки серии, как их вернул сервер: из них читается состав и дни недели. */
  const [seriesRows, setSeriesRows] = useState<Shift[]>([]);

  /**
   * Серия ещё едет.
   *
   * Не косметика: до ответа в списке сотрудников стоит один человек из
   * открытой строки, а в базе их пятеро. Сохранение в этот момент прочиталось
   * бы как «четверых из графика убрали» и сняло бы им смены. Поэтому загрузка
   * блокирует и кнопку тоже.
   */
  const [isSeriesLoading, setIsSeriesLoading] = useState(false);

  // Карточки сотрудников, которые успел отдать селект: из них берутся
  // должность и локация для новых строк.
  const [loadedMeta, setLoadedMeta] = useState<Record<string, EmployeeMeta>>(
    {},
  );
  const [loadedNames, setLoadedNames] = useState<Record<string, string>>({});

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
    setPendingDelete(null);
    setScope("single");
    setPeople("all");
    setConflictPolicy("skip");
    setFillGaps(false);
    setRemoval("delete");
    setSeriesRows([]);
    setIsSeriesLoading(Boolean(shift?.series_id));
    // Создание и правка строки без серии минтят новую; правка серии её
    // наследует. Соседей задним числом серия не усыновляет.
    setSeriesId(shift?.series_id || crypto.randomUUID());

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
    const employee = employeesRef.current.find(
      (item) => item.id === defaults.employeeId,
    );
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
   * Серия правимой смены — состав и дни недели.
   *
   * Запрос идёт по `series_id` и **без границ по дате**: строки серии за
   * пределами записанного периода заводятся обычным путём (перенос смены,
   * правка «следующие дни»), и фильтр по датам молча потерял бы людей, у
   * которых дни есть (ADR-0003).
   *
   * Состав — это список сотрудников формы: смена, открытая на правку, обязана
   * показывать весь график, а не одного человека из открытой строки.
   *
   * Дни недели в базе не хранятся: без них «полный период» у графика «пн–пт»
   * дорисовал бы субботы и воскресенья. Спрашиваем сами строки — они и есть
   * ответ, какие дни в этом графике рабочие.
   */
  useEffect(() => {
    if (!isOpen || !shift?.series_id) return;

    let cancelled = false;
    setIsSeriesLoading(true);
    void fetchSeries(shift.series_id)
      .then((result) => {
        // Усечённая выборка дала бы неполный состав — молча вывести половину
        // людей из графика хуже, чем не подставить их вовсе.
        if (
          cancelled ||
          isShiftListTruncated(result) ||
          result.response.length === 0
        )
          return;
        setSeriesRows(result.response);

        const members = seriesMembers(result.response);
        if (members.length > 0) setEmployeeIds(members);

        const days = new Set(result.response.map((row) => row.date));
        const dows = [
          ...new Set(
            result.response.map((row) => fromIsoDate(row.date).getDay()),
          ),
        ];
        // Однодневная серия ничего о днях недели не говорит; заняты все семь —
        // отмечать нечего, пустые чипы это и значат.
        if (days.size > 1 && dows.length < 7) setWeekdays(dows);
      })
      .catch(() => {
        // Не смогли — остаёмся на одной строке: цифры в попапе всё равно
        // покажут, что именно уедет.
      })
      .finally(() => {
        if (!cancelled) setIsSeriesLoading(false);
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
    // Имена нужны экрану подтверждения: состав серии может содержать людей со
    // второй страницы грида, а «перезаписать 3» без имён ничего не говорит.
    setLoadedNames((current) => {
      const next = { ...current };
      let changed = false;
      list.forEach((item) => {
        if (next[item.guid]) return;
        next[item.guid] =
          [item.second_name, item.first_name]
            .filter(Boolean)
            .join(" ")
            .trim() ||
          item.first_name ||
          "";
        changed = true;
      });
      return changed ? next : current;
    });
  }, []);

  /** Имя по id — из страницы грида, из селекта, иначе честное «сотрудник». */
  const nameOf = useCallback(
    (id: string | null): string => {
      if (!id) return "открытая смена";
      const fromPage = employees.find((item) => item.id === id);
      return fromPage?.name || loadedNames[id] || "сотрудник";
    },
    [employees, loadedNames],
  );

  // Страница грида уже принесла карточки видимых людей — второй раз их
  // спрашивать незачем; селект дополняет этот набор теми, кого подгрузил сам.
  const employeeMeta = useMemo<Record<string, EmployeeMeta>>(() => {
    const map: Record<string, EmployeeMeta> = {};
    employees.forEach((item) => {
      map[item.id] = {
        positionId: item.positionId,
        locationId: item.locationId,
      };
    });
    return { ...map, ...loadedMeta };
  }, [employees, loadedMeta]);

  const employeeOptions = useMemo<SelectOption[]>(
    () => employees.map((item) => ({ value: item.id, label: item.name })),
    [employees],
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
    datesInRange(dateFrom, rangeTo).forEach((iso) =>
      set.add(fromIsoDate(iso).getDay()),
    );
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
      current.includes(dow)
        ? current.filter((item) => item !== dow)
        : [...current, dow],
    );
  };

  const makePlan = useCallback(
    (
      base: ShiftBase,
      existing: Shift[],
      axes: { scope: SaveScope; people: PeopleScope },
      policy: ConflictPolicy,
      gaps: boolean,
      removalPolicy: RemovalPolicy,
    ) =>
      buildSavePlan({
        original: shift,
        seriesId,
        employeeIds,
        employeeMeta,
        headcount: slots,
        base,
        dateFrom,
        dateTo: rangeTo,
        weekdays,
        scope: axes.scope,
        people: axes.people,
        conflicts: policy,
        fillGaps: gaps,
        removal: removalPolicy,
        existing,
      }),
    [
      shift,
      seriesId,
      employeeIds,
      employeeMeta,
      slots,
      dateFrom,
      rangeTo,
      weekdays,
    ],
  );

  /** Люди серии по тому, что уже загружено, — ось людей есть только у графика. */
  const members = useMemo(() => seriesMembers(seriesRows), [seriesRows]);
  const hasOpenRows = seriesRows.some((row) => !row.user_base_id);
  const showPeopleAxis = isEditing && members.length > 1;

  /** Кого убрали из списка: их дни надо либо снять, либо вывести из графика. */
  const removedNames = useMemo(
    () =>
      isEditing
        ? members.filter((id) => !employeeIds.includes(id)).map(nameOf)
        : [],
    [isEditing, members, employeeIds, nameOf],
  );

  /**
   * Шесть наборов считаются сразу: цифры стоят рядом с каждым вариантом, а не
   * появляются после выбора — иначе выбирать пришлось бы вслепую.
   *
   * Это потолок: `buildSavePlan` проходит по всему `existing`, то есть на
   * пятерых за месяц — шесть проходов по ~150 строкам на каждый клик радио.
   * ponytail: серия на тридцать человек потребует пересчёта только
   * изменившейся оси.
   */
  const previews = useMemo(() => {
    if (!pending) return null;
    const out = {} as Record<SaveScope, Record<PeopleScope, SavePlan>>;
    SCOPE_ORDER.forEach((item) => {
      out[item] = {} as Record<PeopleScope, SavePlan>;
      PEOPLE_ORDER.forEach((who) => {
        out[item][who] = makePlan(
          pending.base,
          pending.existing,
          { scope: item, people: who },
          conflictPolicy,
          fillGaps,
          removal,
        );
      });
    });
    return out;
  }, [pending, conflictPolicy, fillGaps, removal, makePlan]);

  const activeScope = isEditing && isRange ? scope : "all";
  const activePeople = showPeopleAxis ? people : "all";
  const chosenPlan = previews ? previews[activeScope][activePeople] : null;

  /** Те же две оси у удаления — и те же цифры рядом с каждым вариантом. */
  const deletePreviews = useMemo(() => {
    if (!pendingDelete || !shift) return null;
    const out = {} as Record<SaveScope, Record<PeopleScope, string[]>>;
    SCOPE_ORDER.forEach((item) => {
      out[item] = {} as Record<PeopleScope, string[]>;
      PEOPLE_ORDER.forEach((who) => {
        out[item][who] = buildDeletePlan({
          original: shift,
          existing: pendingDelete,
          dateFrom,
          dateTo: rangeTo,
          weekdays,
          scope: item,
          people: who,
        });
      });
    });
    return out;
  }, [pendingDelete, shift, dateFrom, rangeTo, weekdays]);

  const chosenDelete = deletePreviews
    ? deletePreviews[activeScope][activePeople]
    : null;

  const handleSave = async () => {
    setFormError("");

    if (!dateFrom) {
      setFormError("Укажите дату начала.");
      return;
    }
    if (targetDates.length === 0) {
      setFormError(
        "В выбранном диапазоне нет ни одного из отмеченных дней недели.",
      );
      return;
    }
    // Растянутый диапазон в правке — это края серии, и правимый день обязан в
    // них попадать: иначе непонятно, от какой даты считать «следующие дни».
    if (
      isEditing &&
      isRange &&
      shift &&
      (shift.date < dateFrom || shift.date > rangeTo)
    ) {
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

    if (
      usesHours &&
      (!Number.isFinite(hoursValue) || hoursValue <= 0 || hoursValue > 24)
    ) {
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
     * Что уже стоит: период формы плюс вся серия целиком.
     *
     * Два запроса, а не один: грид грузит только видимый период, диапазон
     * формы может уехать за его край, а строки серии — за край и того, и
     * другого. Без периода соврут цифры конфликтов и создание упрётся в
     * `shift_employee_date_uniq`; без серии молча потеряются её участники.
     * У открытых смен уникальности нет, поэтому при создании открытых слотов
     * спрашивать нечего.
     */
    let existing: Shift[] = [];
    if (employeeIds.length > 0 || isEditing) {
      setIsPreparing(true);
      try {
        const [inRange, series] = await Promise.all([
          fetchShifts({ from: dateFrom, to: rangeTo }),
          fetchSeries(shift?.series_id ?? null),
        ]);
        // Усечённая выборка — это молча неверный подсчёт конфликтов и отказ
        // всей пачки по `shift_employee_date_uniq`. Считать неправильно хуже,
        // чем отказаться считать.
        if (isShiftListTruncated(inRange) || isShiftListTruncated(series)) {
          setFormError(
            "Смен в этом диапазоне больше, чем можно проверить за раз. Сузьте период — иначе занятые дни посчитаются неверно.",
          );
          return;
        }
        existing = [
          ...new Map(
            [...inRange.response, ...series.response].map((row) => [
              row.guid,
              row,
            ]),
          ).values(),
        ];
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
    const editedDate = resolveEditedDate(shift, dateFrom, rangeTo);
    const assignee = resolveAssignee(
      shift,
      employeeIds,
      takenOn(existing, editedDate, shift?.guid),
    );
    const occupied =
      assignee &&
      existing.find(
        (row) =>
          row.user_base_id === assignee &&
          row.date === editedDate &&
          row.guid !== shift?.guid,
      );
    if (occupied) {
      setFormError("У этого сотрудника в выбранный день уже есть смена.");
      return;
    }

    const plan = makePlan(
      base,
      existing,
      { scope: "all", people: "all" },
      "skip",
      false,
      removal,
    );
    // Состав серии мог приехать после открытия формы — считаем по свежим
    // строкам, а не по тому, что успел загрузить эффект.
    const loaded = seriesMembers(seriesRowsOf(shift, existing));
    const needsChoice =
      (isEditing && isRange) ||
      (isEditing && loaded.length > 1) ||
      plan.conflicts.length > 0 ||
      plan.gaps.length > 0 ||
      loaded.some((id) => !employeeIds.includes(id));

    // Спрашивать не о чем — сохраняем сразу. Экран подтверждения не должен
    // всплывать задним числом, если сохранение потом упадёт с ошибкой.
    if (!needsChoice) {
      onSubmit(plan);
      return;
    }

    // Самый узкий вариант по оси дней — дефолт; по оси людей его нет, потому
    // что «только этому» без правки соседей чаще всего и не требуется.
    setScope("single");
    setPeople("all");
    setPending({ base, existing });
  };

  /**
   * Удаление тоже спрашивает — и спрашивает тем же экраном.
   *
   * Дефолт сужен до одной строки: поле правит пятерых на месяц, а кнопка,
   * сносящая столько же молча, — это разные правила в одном окне.
   */
  const handleDeleteClick = async () => {
    if (!shift) return;
    setFormError("");

    if (!shift.series_id) {
      onDelete([shift.guid]);
      return;
    }

    setIsPreparing(true);
    try {
      const series = await fetchSeries(shift.series_id);
      if (isShiftListTruncated(series)) {
        setFormError(
          "График слишком большой, чтобы показать, что именно удалится.",
        );
        return;
      }
      // В графике одна строка — спрашивать не о чем, осей у неё нет.
      if (series.response.length <= 1) {
        onDelete([shift.guid]);
        return;
      }
      setSeriesRows(series.response);
      setScope("single");
      setPeople("single");
      setPendingDelete(series.response);
    } catch {
      setFormError("Не удалось прочитать график. Попробуйте ещё раз.");
    } finally {
      setIsPreparing(false);
    }
  };

  const isBusy = isSaving || isDeleting || isPreparing || isSeriesLoading;
  const visibleError = formError || error;
  const isDeleteStep = Boolean(pendingDelete && chosenDelete);
  const showConfirm = Boolean(pending && chosenPlan) || isDeleteStep;
  const conflicts = chosenPlan?.conflicts ?? [];
  const gaps = chosenPlan?.gaps ?? [];

  /** «У Иванова 21.09, 28.09» — кого именно перезаписывают и в какие дни. */
  const conflictLines = useMemo(() => {
    const byEmployee = new Map<string, string[]>();
    conflicts.forEach((item) => {
      byEmployee.set(item.userBaseId, [
        ...(byEmployee.get(item.userBaseId) ?? []),
        item.date,
      ]);
    });
    return [...byEmployee.entries()].map(([id, dates]) => ({
      name: nameOf(id),
      dates,
    }));
    // conflicts — новый массив на каждый пересчёт плана, поэтому зависимость
    // по длине: она меняется ровно тогда, когда меняется состав.
  }, [chosenPlan, nameOf]); // eslint-disable-line react-hooks/exhaustive-deps

  /** «Нет смен по Вс — у Иванова и Петрова». */
  const gapSummary = useMemo(() => {
    if (gaps.length === 0) return "";
    const dows = listDows(gaps.map((item) => item.date));
    const names = listNames([
      ...new Set(gaps.map((item) => nameOf(item.userBaseId))),
    ]);
    return `Нет смен по: ${dows} — ${names} (${gaps.length} ${plural(gaps.length, "день", "дня", "дней")})`;
  }, [chosenPlan, nameOf]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Подпись под вариантом оси: у правки — план, у удаления — сколько снесёт. */
  const axisHint = (item: SaveScope, who: PeopleScope): string => {
    if (isDeleteStep && deletePreviews) {
      const guids = deletePreviews[item][who];
      return `удалится ${guids.length}`;
    }
    if (!previews) return "";
    const preview = previews[item][who];
    return `${periodLabel(preview.dates)} · ${planLabel(preview)}`;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-[560px] p-5 lg:p-6"
    >
      <h4 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
        {isDeleteStep
          ? "Удалить смены"
          : showConfirm
            ? "Применить изменения"
            : isEditing
              ? `Смена — ${formatDateRu(shift?.date ?? "")}`
              : "Новая смена"}
      </h4>

      {showConfirm ? (
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          {/* Две оси — два вопроса, и на экране они обязаны выглядеть двумя:
              без заголовков пять радио читаются одним списком, в котором
              почему-то выбрано два пункта. */}
          {isEditing && isRange && (
            <AxisGroup title="Какие дни менять">
              {SCOPE_ORDER.map((item) => (
                <RadioCard
                  key={item}
                  name="shift-scope"
                  checked={scope === item}
                  title={SCOPE_LABEL[item]}
                  hint={axisHint(item, activePeople)}
                  onSelect={() => setScope(item)}
                />
              ))}
            </AxisGroup>
          )}

          {/* Ось людей — только когда в графике больше одного человека: иначе
              выбирать не из чего, а вопрос сбивает с толку. */}
          {showPeopleAxis && (
            <AxisGroup title={`Кому менять · в графике ${members.length}`}>
              {PEOPLE_ORDER.map((who) => (
                <RadioCard
                  key={who}
                  name="shift-people"
                  checked={people === who}
                  title={
                    who === "single"
                      ? `Только ${nameOf(shift?.user_base_id ?? null)}`
                      : PEOPLE_LABEL[who]
                  }
                  hint={axisHint(activeScope, who)}
                  onSelect={() => setPeople(who)}
                />
              ))}
            </AxisGroup>
          )}

          {!(isEditing && isRange) && !showPeopleAxis && chosenPlan && (
            <p className="text-[13px] text-gray-600 dark:text-gray-300">
              {periodLabel(chosenPlan.dates)} · {planLabel(chosenPlan)}
            </p>
          )}

          {isDeleteStep && chosenDelete && (
            <p className="text-[13px] text-gray-600 dark:text-gray-300">
              Будет удалено смен: {chosenDelete.length}. Отменить это нельзя.
            </p>
          )}

          {/* Убрали человека из списка — что это значит, система не знает.
              «Снять смены» и «оставить дни, но вывести из графика» для неё
              неразличимы, поэтому спрашиваем (ADR-0004). */}
          {!isDeleteStep && removedNames.length > 0 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 dark:border-rose-500/30 dark:bg-rose-500/10">
              <p className="text-[13px] font-medium text-rose-700 dark:text-rose-300">
                Из графика убрали: {removedNames.join(", ")}
              </p>
              <div className="mt-2 space-y-1.5">
                {(
                  [
                    ["delete", "Снять смены в выбранных днях"],
                    ["detach", "Оставить дни, вывести из графика"],
                  ] as const
                ).map(([value, label]) => (
                  <label
                    key={value}
                    className="flex cursor-pointer items-center gap-2 text-[13px] text-rose-700 dark:text-rose-300"
                  >
                    <input
                      type="radio"
                      name="shift-removal"
                      checked={removal === value}
                      onChange={() => setRemoval(value)}
                      className="h-4 w-4 accent-rose-500"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Дыра — не отсутствие данных, а записанное решение: кого-то сняли
              с этого дня, и смена часов его не отменяет. Поэтому заполнение
              отдельным вопросом, а не молча. */}
          {!isDeleteStep && (gaps.length > 0 || fillGaps) && (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 px-3.5 py-3 dark:border-gray-700">
              <input
                type="checkbox"
                checked={fillGaps}
                onChange={(event) => setFillGaps(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-brand-500"
              />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-gray-800 dark:text-white/90">
                  Заполнить пропущенные дни графика
                </span>
                <span className="mt-0.5 block text-[12px] text-gray-500 dark:text-gray-400">
                  {gapSummary || "Пропущенные дни будут заведены заново."}
                  {!fillGaps && gapSummary && ". Останутся пустыми."}
                </span>
              </span>
            </label>
          )}

          {/* Кого перезаписываем — по именам и датам. Цифра «у 3 дней смены
              уже есть» не отвечает на единственный вопрос, который тут
              задают: чью смену затрут. */}
          {!isDeleteStep && conflictLines.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
              <p className="text-[13px] font-medium text-amber-800 dark:text-amber-300">
                Смены уже стоят — {conflicts.length}{" "}
                {plural(conflicts.length, "день", "дня", "дней")}
              </p>
              <ul className="mt-1 space-y-0.5">
                {conflictLines.map((line) => (
                  <li
                    key={line.name}
                    className="text-[12px] text-amber-700 dark:text-amber-400"
                  >
                    <span className="font-medium">{line.name}</span> —{" "}
                    {line.dates.slice(0, 4).map(formatDateRu).join(", ")}
                    {line.dates.length > 4 && ` и ещё ${line.dates.length - 4}`}
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex flex-wrap gap-4">
                {(
                  [
                    ["skip", "Оставить как есть"],
                    ["overwrite", "Перезаписать этими полями"],
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
              <label className={labelClass}>
                Сотрудники
                {isSeriesLoading && <SeriesLoading />}
              </label>
              {/* Пока график едет, список неполон — править его нельзя:
                  убранный «сам собой» человек прочитался бы как снятие. */}
              <div
                className={
                  isSeriesLoading ? "pointer-events-none opacity-50" : undefined
                }
              >
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
              {isEditing && !shift?.series_id && (
                <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                  Смена заведена до графиков: соседние дни с ней не связаны, и
                  правка коснётся только её.
                </p>
              )}
              {hasOpenRows && (
                <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                  В графике есть незакрытые слоты — должность описывает их.
                </p>
              )}
            </div>

            {/* Должность стоит рядом с сотрудником, а не среди прочих полей:
                у открытой смены она — единственное, чем описан нужный человек.
                При выбранных людях гаснет: у каждой строки должность своя, из
                карточки её сотрудника. Но серия бывает смешанной — часть мест
                закрыта людьми, часть нет, — и тогда поле снова нужно: у
                открытой строки должность единственное описание нужного
                человека (ADR-0003). */}
            <div>
              <label className={labelClass}>Должность</label>
              <select
                value={positionId}
                disabled={employeeIds.length > 0 && !hasOpenRows}
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
              value={
                employeeIds.length > 0 ? String(employeeIds.length) : headcount
              }
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
                  <TimeInput
                    value={startTime}
                    onChange={(next) => setStartTime(next)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Окончание</label>
                  <TimeInput
                    value={endTime}
                    onChange={(next) => setEndTime(next)}
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
              <DateInput
                value={dateFrom}
                onChange={(next) => {
                  setDateFrom(next);
                  // Диапазон схлопнут по умолчанию: обычное создание — один день.
                  if (!dateTo || dateTo < next) setDateTo(next);
                }}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Дата окончания</label>
              <DateInput
                value={dateTo}
                min={dateFrom}
                onChange={setDateTo}
                className={inputClass}
              />
            </div>
          </div>

          {/* В правке чипы нужны ровно тогда, когда диапазон растянут: иначе
              «продлить на месяц» выгнало бы человека работать и в выходные. */}
          {(!isEditing || isRange) && (
            <div>
              <label className={labelClass}>
                Повторяется по дням недели
                {isSeriesLoading && <SeriesLoading />}
              </label>
              <div
                className={`flex flex-wrap gap-1.5 ${
                  isSeriesLoading ? "pointer-events-none opacity-50" : ""
                }`}
              >
                {WEEKDAY_CHIPS.map((chip) => {
                  const isActive = weekdays.includes(chip.dow);
                  const isAvailable = availableDows.has(chip.dow);
                  return (
                    <button
                      key={chip.dow}
                      type="button"
                      disabled={!isAvailable || isSeriesLoading}
                      title={
                        isAvailable
                          ? undefined
                          : "В выбранном диапазоне такого дня нет"
                      }
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
              onClick={() => void handleDeleteClick()}
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
            onClick={() => {
              if (!showConfirm) {
                onClose();
                return;
              }
              setPending(null);
              setPendingDelete(null);
            }}
            // Выйти можно всегда, кроме момента самой записи: зависший запрос
            // графика не должен запирать человека в окне.
            disabled={isSaving || isDeleting}
            className="rounded-xl border border-gray-200 px-4 py-2 text-[13px] font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
          >
            {showConfirm ? "Назад" : "Отменить"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (isDeleteStep && chosenDelete) onDelete(chosenDelete);
              else if (showConfirm && chosenPlan) onSubmit(chosenPlan);
              else void handleSave();
            }}
            disabled={isBusy}
            className={`rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition disabled:opacity-60 ${
              isDeleteStep
                ? "bg-rose-500 hover:bg-rose-600"
                : "bg-brand-500 hover:bg-brand-600"
            }`}
          >
            {isSeriesLoading
              ? "Загрузка…"
              : isPreparing
                ? "Проверка…"
                : isDeleting
                  ? "Удаление…"
                  : isSaving
                    ? "Сохранение…"
                    : isDeleteStep
                      ? "Удалить"
                      : showConfirm
                        ? "Применить"
                        : "Сохранить"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
