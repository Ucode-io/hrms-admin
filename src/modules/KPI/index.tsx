import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  MeasuringStrategy,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import DatePicker, { registerLocale } from "react-datepicker";
import { ru } from "date-fns/locale/ru";
import "react-datepicker/dist/react-datepicker.css";
import { observer } from "mobx-react-lite";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  GripVertical,
  LayoutGrid,
  List,
  // Minus, // Временно скрыто вместе с кнопкой сворачивания колонки
  MoreHorizontal,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import Select, { type StylesConfig } from "react-select";
import { toast } from "sonner";
import PageMeta from "../../components/common/PageMeta";
import ViewSwitcher from "../../components/common/ViewSwitcher";
import ExpandableSearchInput from "../../components/form/ExpandableSearchInput";
import { Modal } from "../../components/ui/modal";
import { Dropdown } from "../../components/ui/dropdown/Dropdown";
import { DropdownItem } from "../../components/ui/dropdown/DropdownItem";
import companyStore from "../../store/company.store";
import { useDynamicValues } from "../Settings/CustomFields/useDynamicValues";
import DynamicFieldsBlock from "../Settings/CustomFields/DynamicFieldsBlock";
import httpRequest from "../../api/httpRequest";
import settingsDirectoryService from "../../api/services/settingsDirectory.service";
import RemoteSingleSelect, { type RemoteSelectOption } from "../../components/autocomplete/RemoteSingleSelect";
import EmployeesInfiniteMultiSelect from "../../components/autocomplete/EmployeesInfiniteMultiSelect";
import { KpiSheetSelect, useKpiSheets } from "./sheets";
import { CommentableCell, cellCommentKey, useKpiCellComments } from "./comments";
import encodeJsonToUrlParam from "../../utils/encodeJsonToUrlParam";
import reportsService, {
  type KpiAggregationType,
  type KpiAutoMetricOption,
  type KpiFilterOption,
  type KpiParentOption,
  type KpiPeriodType,
  type KpiTableGroup,
  type KpiTableItem,
} from "../../api/services/reports.service";

registerLocale("ru", ru);

type KpiPeriodMode = KpiPeriodType;

type FilterOption = {
  value: string;
  label: string;
};

type ParentSelectOption = FilterOption & {
  periodType?: KpiPeriodMode | string;
  startDate?: string;
  endDate?: string;
  isRoot?: boolean;
};

type KpiRecord = {
  id: string;
  parentId: string | null;
  positionsId: string | null;
  position: string;
  name: string;
  description: string;
  source: string;
  valueSymbol: string;
  valueSymbolPosition: "prefix" | "suffix";
  periodType: KpiPeriodMode;
  // How this KPI derives its actual from its children (sum | min | max | avg).
  aggregationType: KpiAggregationType;
  startDate: string;
  endDate: string;
  ownPlanValue: number;
  ownActualValue: number;
  planValue: number;
  actualValue: number;
  percentTotal: number;
  hasChildren: boolean;
  // Automatic KPI: actual is computed by the backend from task/project data and
  // is therefore read-only in the UI.
  isAuto: boolean;
  metric: string | null;
  // Сумма вознаграждения за 100% выполнения (null — не задана).
  rewardAmount: number | null;
  /** Контейнер значений динамических полей (строка JSON) — из get_kpi_table. */
  customData: string | null;
  // Привязанные сотрудники (guid из user_base).
  employeeIds: string[];
  children: KpiRecord[];
};

type ChildDraft = {
  uid: string;
  guid?: string;
  name: string;
  periodType: KpiPeriodMode;
  startDate: string;
  endDate: string;
  planValue: string;
};

type ChildSlot = {
  periodType: KpiPeriodMode;
  startDate: string;
  endDate: string;
  label: string;
};

const MONTH_NAMES_FULL = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

const DAY_NAMES_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const dayOfWeekIndex = (date: Date): number => {
  const day = date.getDay();
  return day === 0 ? 6 : day - 1;
};

const buildMondayFridayWeeksForMonth = (monthDate: Date): Array<{ start: Date; end: Date }> => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);

  const cursor = new Date(monthStart);
  cursor.setDate(monthStart.getDate() - dayOfWeekIndex(monthStart));

  const result: Array<{ start: Date; end: Date }> = [];
  while (cursor <= monthEnd) {
    const start = new Date(cursor);
    const end = new Date(cursor);
    end.setDate(start.getDate() + 4);

    let daysInTargetMonth = 0;
    for (let i = 0; i < 5; i += 1) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      if (day.getFullYear() === year && day.getMonth() === month) {
        daysInTargetMonth += 1;
      }
    }

    if (daysInTargetMonth >= 3) {
      result.push({ start, end });
    }

    cursor.setDate(cursor.getDate() + 7);
  }

  return result;
};

const formatPeriodSlotLabel = (periodType: KpiPeriodMode, start: Date, end: Date): string => {
  if (periodType === "daily") {
    return `${DAY_NAMES_SHORT[dayOfWeekIndex(start)]} ${pad(start.getDate())}.${pad(start.getMonth() + 1)}`;
  }
  if (periodType === "monthly") {
    return `${MONTH_NAMES_FULL[start.getMonth()]} ${start.getFullYear()}`;
  }
  if (periodType === "weekly") {
    const s = `${pad(start.getDate())}.${pad(start.getMonth() + 1)}`;
    const e = `${pad(end.getDate())}.${pad(end.getMonth() + 1)}`;
    return `${s} – ${e}`;
  }
  if (periodType === "quarterly") {
    const q = Math.floor(start.getMonth() / 3) + 1;
    return `${q} кв. ${start.getFullYear()}`;
  }
  return `${start.getFullYear()} г.`;
};

const computeChildSlots = (
  parentPeriodType: KpiPeriodMode,
  parentStartIso: string,
  parentEndIso: string
): ChildSlot[] => {
  const parentStart = toDatePickerValue(parentStartIso);
  const parentEnd = toDatePickerValue(parentEndIso);
  if (!parentStart || !parentEnd) return [];

  if (parentPeriodType === "weekly") {
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(parentStart);
      date.setDate(parentStart.getDate() + i);
      return {
        periodType: "daily" as const,
        startDate: toIsoDate(date),
        endDate: toIsoDate(date),
        label: formatPeriodSlotLabel("daily", date, date),
      };
    });
  }

  if (parentPeriodType === "yearly") {
    const year = parentStart.getFullYear();
    return Array.from({ length: 4 }, (_, quarterIndex) => {
      const quarterStartMonth = quarterIndex * 3;
      const start = new Date(year, quarterStartMonth, 1);
      const end = new Date(year, quarterStartMonth + 3, 0);
      return {
        periodType: "quarterly" as const,
        startDate: toIsoDate(start),
        endDate: toIsoDate(end),
        label: formatPeriodSlotLabel("quarterly", start, end),
      };
    });
  }

  if (parentPeriodType === "quarterly") {
    const year = parentStart.getFullYear();
    const firstMonth = Math.floor(parentStart.getMonth() / 3) * 3;
    return Array.from({ length: 3 }, (_, i) => {
      const start = new Date(year, firstMonth + i, 1);
      const end = new Date(year, firstMonth + i + 1, 0);
      return {
        periodType: "monthly" as const,
        startDate: toIsoDate(start),
        endDate: toIsoDate(end),
        label: formatPeriodSlotLabel("monthly", start, end),
      };
    });
  }

  if (parentPeriodType === "monthly") {
    return buildMondayFridayWeeksForMonth(parentStart).map(({ start, end }) => {
      return {
        periodType: "weekly" as const,
        startDate: toIsoDate(start),
        endDate: toIsoDate(end),
        label: formatPeriodSlotLabel("weekly", start, end),
      };
    });
  }

  return [];
};

const childrenSupported = (parentPeriodType: KpiPeriodMode): boolean =>
  parentPeriodType !== "daily";

const computeTopBuckets = (
  periodMode: KpiPeriodMode,
  cursorDate: Date,
  hasLevel1: boolean,
  canExpandByIndex: boolean[]
): TopBucket[] => {
  if (!hasLevel1) return [];

  if (periodMode === "weekly") {
    const weekStart = getWeekStart(cursorDate);
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const dayLabel = DAY_NAMES_SHORT[i];
      return {
        key: `day-${i + 1}`,
        label: `${dayLabel} ${pad(date.getDate())}.${pad(date.getMonth() + 1)}`,
        shortLabel: dayLabel,
        startIso: toIsoDate(date),
        endIso: toIsoDate(date),
        canExpand: false,
        periodType: "daily",
      };
    });
  }

  if (periodMode === "monthly") {
    return buildMondayFridayWeeksForMonth(cursorDate).map(({ start, end }, i) => {
      return {
        key: `wk-${i + 1}`,
        label: formatPeriodSlotLabel("weekly", start, end),
        shortLabel: `Нед ${i + 1}`,
        startIso: toIsoDate(start),
        endIso: toIsoDate(end),
        canExpand: canExpandByIndex[i] || false,
        periodType: "weekly",
      };
    });
  }

  if (periodMode === "quarterly") {
    const quarterStart = getQuarterStart(cursorDate);
    return Array.from({ length: 3 }, (_, i) => {
      const monthDate = new Date(quarterStart.getFullYear(), quarterStart.getMonth() + i, 1);
      const monthEnd = new Date(quarterStart.getFullYear(), quarterStart.getMonth() + i + 1, 0);
      const monthName = new Intl.DateTimeFormat("ru-RU", { month: "short" })
        .format(monthDate)
        .replace(".", "");
      const cap = monthName.charAt(0).toUpperCase() + monthName.slice(1);
      return {
        key: `mo-${i + 1}`,
        label: `${cap} ${monthDate.getFullYear()}`,
        shortLabel: cap,
        startIso: toIsoDate(monthDate),
        endIso: toIsoDate(monthEnd),
        canExpand: canExpandByIndex[i] || false,
        periodType: "monthly",
      };
    });
  }

  return Array.from({ length: 4 }, (_, i) => {
    const quarterStartMonth = i * 3;
    const start = new Date(cursorDate.getFullYear(), quarterStartMonth, 1);
    const end = new Date(cursorDate.getFullYear(), quarterStartMonth + 3, 0);
    return {
      key: `q-${i + 1}`,
      label: `${i + 1} квартал`,
      shortLabel: `${i + 1} кв.`,
      startIso: toIsoDate(start),
      endIso: toIsoDate(end),
      canExpand: canExpandByIndex[i] || false,
      periodType: "quarterly",
    };
  });
};

const computeSubBuckets = (top: TopBucket): SubBucket[] => {
  const start = toDatePickerValue(top.startIso);
  const end = toDatePickerValue(top.endIso);
  if (!start || !end) return [];

  if (top.periodType === "quarterly") {
    const year = start.getFullYear();
    const firstMonth = Math.floor(start.getMonth() / 3) * 3;
    return Array.from({ length: 3 }, (_, i) => {
      const monthStart = new Date(year, firstMonth + i, 1);
      const monthEnd = new Date(year, firstMonth + i + 1, 0);
      const monthName = new Intl.DateTimeFormat("ru-RU", { month: "short" })
        .format(monthStart)
        .replace(".", "");
      const cap = monthName.charAt(0).toUpperCase() + monthName.slice(1);
      return {
        label: `${cap} ${year}`,
        startIso: toIsoDate(monthStart),
        endIso: toIsoDate(monthEnd),
        periodType: "monthly",
      };
    });
  }

  if (top.periodType === "monthly") {
    return buildMondayFridayWeeksForMonth(start).map(({ start: subStart, end: subEnd }) => {
      return {
        label: `${pad(subStart.getDate())}.${pad(subStart.getMonth() + 1)} – ${pad(subEnd.getDate())}.${pad(subEnd.getMonth() + 1)}`,
        startIso: toIsoDate(subStart),
        endIso: toIsoDate(subEnd),
        periodType: "weekly",
      };
    });
  }

  if (top.periodType === "weekly") {
    const days: SubBucket[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      const day = new Date(cursor);
      days.push({
        label: formatPeriodSlotLabel("daily", day, day),
        startIso: toIsoDate(day),
        endIso: toIsoDate(day),
        periodType: "daily",
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }

  return [];
};

const buildLeafBuckets = (
  periodMode: KpiPeriodMode,
  cursorDate: Date,
  expandedColumns: Set<string>,
  hasLevel1: boolean,
  canExpandByIndex: boolean[]
): LeafBucket[] => {
  const tops = computeTopBuckets(periodMode, cursorDate, hasLevel1, canExpandByIndex);
  const leaves: LeafBucket[] = [];
  tops.forEach((top, i) => {
    if (top.canExpand && expandedColumns.has(top.key)) {
      const subs = computeSubBuckets(top);
      subs.forEach((sub, j) => {
        leaves.push({
          key: `${top.key}-sub-${j}`,
          topKey: top.key,
          label: sub.label,
          pathIndices: [i, j],
          isToggle: false,
          toggleState: "expanded",
          isTotalOfExpanded: false,
          bucketPeriodType: sub.periodType,
        });
      });
      leaves.push({
        key: `${top.key}-total`,
        topKey: top.key,
        label: `${top.shortLabel} Итого`,
        pathIndices: [i],
        isToggle: true,
        toggleState: "expanded",
        isTotalOfExpanded: true,
        bucketPeriodType: top.periodType,
      });
    } else {
      leaves.push({
        key: top.key,
        topKey: top.key,
        label: top.label,
        pathIndices: [i],
        isToggle: top.canExpand,
        toggleState: "collapsed",
        isTotalOfExpanded: false,
        bucketPeriodType: top.periodType,
      });
    }
  });
  return leaves;
};

const getChildAtPath = (kpi: KpiRecord, path: number[]): KpiRecord | null => {
  let current: KpiRecord | null = kpi;
  for (const idx of path) {
    if (!current || !current.children[idx]) return null;
    current = current.children[idx];
  }
  return current;
};

type CreateKpiDraft = {
  parentId: string;
  parentTitle: string;
  positionId: string;
  positionTitle: string;
  // Сотрудники, привязанные к KPI (только с должностью positionId).
  // Отправляются в save_kpi (employee_ids), приходят из get_kpi_table.
  employeeIds: string[];
  source: string;
  valueSymbol: string;
  valueSymbolPosition: "prefix" | "suffix";
  name: string;
  description: string;
  periodType: KpiPeriodMode;
  aggregationType: KpiAggregationType;
  startDate: string;
  endDate: string;
  planValue: string;
  // Сумма вознаграждения за 100% выполнения KPI. Выплата пропорциональна
  // проценту достижения (50% → половина суммы). Отправляется в save_kpi
  // (reward_amount), приходит из get_kpi_table.
  rewardAmount: string;
  hasChildren: boolean;
  children: ChildDraft[];
};

type EditingActualCell = {
  // For leaf KPI editing on the row's "Итого" column: itemId = leaf guid, childId = null
  // For bucket cell editing: itemId = row guid, childId = the underlying leaf child guid
  itemId: string;
  childId: string | null;
  draftValue: string;
};

type TopBucket = {
  key: string;
  label: string;
  shortLabel: string;
  startIso: string;
  endIso: string;
  canExpand: boolean;
  periodType: KpiPeriodMode;
};

type SubBucket = {
  label: string;
  startIso: string;
  endIso: string;
  periodType: KpiPeriodMode;
};

type LeafBucket = {
  key: string;
  topKey: string;
  label: string;
  pathIndices: number[];
  isToggle: boolean;
  toggleState: "expanded" | "collapsed";
  isTotalOfExpanded: boolean;
  bucketPeriodType: KpiPeriodMode;
};

const getBucketBgClass = (periodType: KpiPeriodMode): string => {
  switch (periodType) {
    case "daily":
      return "bg-rose-50/40";
    case "weekly":
      return "bg-amber-50/40";
    case "monthly":
      return "bg-sky-50/40";
    case "quarterly":
      return "bg-emerald-50/40";
    case "yearly":
      return "bg-violet-50/40";
    default:
      return "";
  }
};


// Временно скрыто вместе с кнопкой сворачивания/разворачивания колонки
// const getExpandTitleByPeriod = (periodType: KpiPeriodMode): string => {
//   if (periodType === "quarterly") return "Развернуть до месяцев";
//   if (periodType === "monthly") return "Развернуть до недель";
//   if (periodType === "weekly") return "Развернуть до дней";
//   return "Развернуть";
// };

const KPI_PERIOD_TABS: { key: KpiPeriodMode; label: string }[] = [
  { key: "yearly", label: "Годовой KPI" },
  { key: "quarterly", label: "Квартальный KPI" },
  { key: "monthly", label: "Месячный KPI" },
  { key: "weekly", label: "Недельный KPI" },
];

const pad = (value: number): string => String(value).padStart(2, "0");

const toIsoDate = (value: Date): string => {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
};

const calcPercent = (actual: number, plan: number): number => {
  if (!Number.isFinite(actual) || !Number.isFinite(plan) || plan <= 0) return 0;
  return Math.round((actual / plan) * 100);
};

const getPercentBadgeClass = (percent: number): string => {
  if (percent >= 100) return "bg-emerald-100 text-emerald-700";
  if (percent >= 80) return "bg-blue-100 text-blue-700";
  if (percent >= 60) return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
};

const getWeekStart = (value: Date): Date => {
  const day = value.getDay();
  const mondayShift = day === 0 ? -6 : 1 - day;
  const start = new Date(value);
  start.setDate(value.getDate() + mondayShift);
  return start;
};

const getQuarterStart = (value: Date): Date => {
  const quarterStartMonth = Math.floor(value.getMonth() / 3) * 3;
  return new Date(value.getFullYear(), quarterStartMonth, 1);
};

const roundToTwo = (value: number): number => Math.round(value * 100) / 100;

// Кастомный тултип: показывается сразу при наведении и не обрезается
// контейнером с overflow (рендерится в body через портал).
const HoverTooltip = ({
  text,
  children,
}: {
  text: string;
  children: ReactNode;
}) => {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);

  const show = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({ left: rect.left + rect.width / 2, top: rect.bottom + 8 });
  }, []);

  const hide = useCallback(() => setCoords(null), []);

  return (
    <span
      ref={anchorRef}
      className="inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {coords
        ? createPortal(
            <span
              role="tooltip"
              style={{
                position: "fixed",
                left: coords.left,
                top: coords.top,
                transform: "translateX(-50%)",
                zIndex: 70,
              }}
              className="pointer-events-none max-w-xs whitespace-normal rounded-lg bg-slate-800 px-2.5 py-1.5 text-[12px] font-medium leading-snug text-white shadow-lg"
            >
              {text}
            </span>,
            document.body
          )
        : null}
    </span>
  );
};

const formatMetricValue = (value: number): string => {
  if (!Number.isFinite(value)) return "0";
  if (Number.isInteger(value)) return String(value);
  const raw = String(value);
  if (raw.includes("e") || raw.includes("E")) {
    return value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  }
  return raw;
};

const formatMetricDisplayValue = (value: number): string => {
  const normalized = formatMetricValue(value);
  const isNegative = normalized.startsWith("-");
  const unsigned = isNegative ? normalized.slice(1) : normalized;
  const [integerPartRaw, decimalPart] = unsigned.split(".");
  const integerPart = integerPartRaw || "0";
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const withSign = isNegative ? `-${groupedInteger}` : groupedInteger;
  return decimalPart ? `${withSign}.${decimalPart}` : withSign;
};

const sanitizePlanInputValue = (value: string): string => {
  if (!value) return "";
  const normalized = value
    .replace(/\s+/g, "")
    .replace(/,/g, ".")
    .replace(/[^\d.]/g, "");
  const [integerPart = "", ...rest] = normalized.split(".");
  if (rest.length === 0) return integerPart;
  return `${integerPart}.${rest.join("")}`;
};

const formatPlanInputValue = (value: string): string => {
  const normalized = sanitizePlanInputValue(value);
  if (!normalized) return "";
  const hasTrailingDot = normalized.endsWith(".");
  const [integerRaw = "", decimalRaw = ""] = normalized.split(".");
  const integerCleaned = integerRaw.replace(/^0+(?=\d)/, "") || "0";
  const groupedInteger = integerCleaned.replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  if (hasTrailingDot) return `${groupedInteger}.`;
  return decimalRaw ? `${groupedInteger}.${decimalRaw}` : groupedInteger;
};

const parsePlanInputValue = (value: string): number => {
  const normalized = sanitizePlanInputValue(value);
  if (!normalized || normalized === ".") return Number.NaN;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const formatValueWithSymbol = (
  value: number,
  symbol: string,
  position: "prefix" | "suffix"
): string => {
  const formatted = formatMetricDisplayValue(value);
  const normalizedSymbol = symbol.trim();
  if (!normalizedSymbol) return formatted;
  return position === "prefix"
    ? `${normalizedSymbol} ${formatted}`
    : `${formatted} ${normalizedSymbol}`;
};

const formatDisplayDate = (value: string): string => {
  if (!value) return value;
  const normalized = value.slice(0, 10);
  const [year, month, day] = normalized.split("-");
  if (!year || !month || !day) return value;
  return `${day}.${month}.${year}`;
};

const normalizeDateInputValue = (value: string): string => {
  if (!value) return "";
  const normalized = value.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }
  return "";
};

const toDatePickerValue = (value: string): Date | null => {
  const normalized = normalizeDateInputValue(value);
  if (!normalized) return null;
  const [year, month, day] = normalized.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const getPeriodRange = (cursorDate: Date, mode: KpiPeriodMode): { from: string; to: string } => {
  if (mode === "monthly") {
    const start = new Date(cursorDate.getFullYear(), cursorDate.getMonth(), 1);
    const end = new Date(cursorDate.getFullYear(), cursorDate.getMonth() + 1, 0);
    return { from: toIsoDate(start), to: toIsoDate(end) };
  }

  if (mode === "quarterly") {
    const start = getQuarterStart(cursorDate);
    const end = new Date(start.getFullYear(), start.getMonth() + 3, 0);
    return { from: toIsoDate(start), to: toIsoDate(end) };
  }

  if (mode === "yearly") {
    const start = new Date(cursorDate.getFullYear(), 0, 1);
    const end = new Date(cursorDate.getFullYear(), 11, 31);
    return { from: toIsoDate(start), to: toIsoDate(end) };
  }

  const start = getWeekStart(cursorDate);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { from: toIsoDate(start), to: toIsoDate(end) };
};

const formatPeriodLabel = (cursorDate: Date, mode: KpiPeriodMode): string => {
  if (mode === "monthly") {
    const formatted = new Intl.DateTimeFormat("ru-RU", {
      month: "long",
      year: "numeric",
    }).format(cursorDate);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }
  if (mode === "quarterly") {
    const quarter = Math.floor(cursorDate.getMonth() / 3) + 1;
    return `${quarter} квартал ${cursorDate.getFullYear()} г.`;
  }
  if (mode === "yearly") {
    return `${cursorDate.getFullYear()} г.`;
  }
  const day = cursorDate.getDay();
  const mondayShift = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(cursorDate);
  weekStart.setDate(cursorDate.getDate() + mondayShift);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const startLabel = `${pad(weekStart.getDate())}.${pad(weekStart.getMonth() + 1)}`;
  const endLabel = `${pad(weekEnd.getDate())}.${pad(weekEnd.getMonth() + 1)}`;
  return `${startLabel} - ${endLabel} ${weekEnd.getFullYear()}`;
};

const getPickerDateFormatByPeriod = (periodType: KpiPeriodMode): string => {
  if (periodType === "weekly") return "dd.MM.yyyy";
  if (periodType === "monthly") return "MM.yyyy";
  if (periodType === "quarterly") return "QQQ yyyy";
  return "yyyy";
};

const getGoalTypeBadgeLabel = (periodType: KpiPeriodMode): string => {
  if (periodType === "daily") return "Дн.";
  if (periodType === "weekly") return "Нед.";
  if (periodType === "quarterly") return "Кв.";
  if (periodType === "yearly") return "Год.";
  return "Мес.";
};

const getGoalTypeBadgeClass = (periodType: KpiPeriodMode | string | undefined): string => {
  if (periodType === "yearly") return "border-violet-200 bg-violet-50 text-violet-700";
  if (periodType === "quarterly") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (periodType === "monthly") return "border-blue-200 bg-blue-50 text-blue-600";
  if (periodType === "weekly") return "border-amber-200 bg-amber-50 text-amber-700";
  if (periodType === "daily") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
};

const getAllowedParentPeriodTypes = (periodType: KpiPeriodMode): KpiPeriodMode[] => {
  if (periodType === "quarterly") return ["yearly"];
  if (periodType === "monthly") return ["quarterly"];
  if (periodType === "weekly") return ["monthly"];
  if (periodType === "daily") return ["weekly"];
  return [];
};

const getPeriodTypeTagLabel = (option: ParentSelectOption): string => {
  const periodType = typeof option.periodType === "string" ? option.periodType : "";
  const startDate = toDatePickerValue(option.startDate || "");
  const endDate = toDatePickerValue(option.endDate || "");

  if (periodType === "yearly" && startDate) {
    return `Годовой ${startDate.getFullYear()}`;
  }
  if (periodType === "quarterly" && startDate) {
    const quarter = Math.floor(startDate.getMonth() / 3) + 1;
    return `Квартальный ${quarter}`;
  }
  if (periodType === "monthly" && startDate) {
    const monthShort = new Intl.DateTimeFormat("ru-RU", { month: "short" }).format(startDate);
    const monthLabel = monthShort.charAt(0).toUpperCase() + monthShort.slice(1);
    return `Месячный ${monthLabel}`;
  }
  if (periodType === "weekly" && startDate && endDate) {
    return `Недельный ${formatDisplayDate(toIsoDate(startDate)).slice(0, 5)} – ${formatDisplayDate(toIsoDate(endDate)).slice(0, 5)}`;
  }
  if (periodType === "daily" && startDate) {
    return `Дневной ${formatDisplayDate(toIsoDate(startDate)).slice(0, 5)}`;
  }
  if (periodType === "yearly") return "Годовой";
  if (periodType === "quarterly") return "Квартальный";
  if (periodType === "monthly") return "Месячный";
  if (periodType === "weekly") return "Недельный";
  if (periodType === "daily") return "Дневной";
  return "";
};

const formatCompactPeriodLabel = (
  periodType: KpiPeriodMode,
  startDateIso: string,
  endDateIso: string
): string => {
  const start = toDatePickerValue(startDateIso);
  const end = toDatePickerValue(endDateIso);
  if (!start || !end) return "—";

  if (periodType === "yearly") {
    return String(start.getFullYear());
  }
  if (periodType === "quarterly") {
    return `${Math.floor(start.getMonth() / 3) + 1} кв.`;
  }
  if (periodType === "monthly") {
    const monthShort = new Intl.DateTimeFormat("ru-RU", { month: "short" }).format(start);
    return monthShort.charAt(0).toUpperCase() + monthShort.slice(1);
  }
  if (periodType === "weekly") {
    return `${formatDisplayDate(toIsoDate(start)).slice(0, 5)} – ${formatDisplayDate(toIsoDate(end)).slice(0, 5)}`;
  }
  if (periodType === "daily") {
    return formatDisplayDate(toIsoDate(start)).slice(0, 5);
  }
  return `${formatDisplayDate(toIsoDate(start))} – ${formatDisplayDate(toIsoDate(end))}`;
};

const normalizePeriodType = (value: unknown): KpiPeriodMode => {
  if (
    value === "daily" ||
    value === "weekly" ||
    value === "quarterly" ||
    value === "yearly" ||
    value === "monthly"
  ) {
    return value;
  }
  return "monthly";
};

const normalizeAggregationType = (value: unknown): KpiAggregationType => {
  if (value === "min" || value === "max" || value === "avg" || value === "sum") {
    return value;
  }
  return "sum";
};

// Mirror of the backend aggregation so optimistic UI updates match the server.
const aggregateChildActuals = (
  values: number[],
  aggregationType: KpiAggregationType
): number => {
  if (values.length === 0) return 0;
  switch (aggregationType) {
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
    case "avg":
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    case "sum":
    default:
      return values.reduce((sum, value) => sum + value, 0);
  }
};

const AGGREGATION_OPTIONS: { value: KpiAggregationType; label: string; hint: string }[] = [
  { value: "sum", label: "Сумма", hint: "Факт = сумма дочерних" },
  { value: "min", label: "Мин. значение", hint: "Факт = минимум из дочерних" },
  { value: "max", label: "Макс. значение", hint: "Факт = максимум из дочерних" },
  { value: "avg", label: "Среднее", hint: "Факт = среднее дочерних" },
];

const formatDraftPeriodRangeLabel = (
  startDateIso: string,
  endDateIso: string,
  periodType: KpiPeriodMode
): string => {
  const start = toDatePickerValue(startDateIso);
  const end = toDatePickerValue(endDateIso);
  if (!start || !end) return "";
  if (periodType === "monthly") {
    const formatted = new Intl.DateTimeFormat("ru-RU", {
      month: "long",
      year: "numeric",
    }).format(start);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }
  if (periodType === "quarterly") {
    const quarter = Math.floor(start.getMonth() / 3) + 1;
    return `${quarter} квартал ${start.getFullYear()} г.`;
  }
  if (periodType === "yearly") {
    return `${start.getFullYear()} г.`;
  }
  return `${formatDisplayDate(startDateIso)} - ${formatDisplayDate(endDateIso)}`;
};

const mapApiItem = (item: KpiTableItem): KpiRecord => {
  const periodType = normalizePeriodType(item.period_type);
  const children = Array.isArray(item.children) ? item.children.map(mapApiItem) : [];
  return {
    id: item.guid,
    parentId: item.parent_id || null,
    positionsId: item.positions_id || null,
    position: item.position || "Без должности",
    name: item.title || "Без названия",
    description: item.description || "",
    source: item.source || "Вручную",
    valueSymbol: typeof item.value_symbol === "string" ? item.value_symbol : "",
    valueSymbolPosition: item.value_symbol_position === "prefix" ? "prefix" : "suffix",
    periodType,
    aggregationType: normalizeAggregationType(item.aggregation_type),
    startDate: normalizeDateInputValue(item.start_date),
    endDate: normalizeDateInputValue(item.end_date),
    ownPlanValue: roundToTwo(Number(item.own_plan_total) || 0),
    ownActualValue: roundToTwo(Number(item.own_actual_total) || 0),
    planValue: roundToTwo(Number(item.plan_total) || 0),
    actualValue: roundToTwo(Number(item.actual_total) || 0),
    percentTotal: Number.isFinite(item.percent_total)
      ? Number(item.percent_total)
      : calcPercent(Number(item.actual_total) || 0, Number(item.plan_total) || 0),
    hasChildren: Boolean(item.has_children) || children.length > 0,
    isAuto: Boolean(item.is_auto),
    metric: typeof item.metric === "string" ? item.metric : null,
    rewardAmount:
      item.reward_amount === null || item.reward_amount === undefined
        ? null
        : roundToTwo(Number(item.reward_amount) || 0),
    customData: typeof item.custom_data === "string" ? item.custom_data : null,
    employeeIds: Array.isArray(item.employee_ids)
      ? item.employee_ids.filter((id): id is string => typeof id === "string")
      : [],
    children,
  };
};

const applyActualValueToTree = (
  items: KpiRecord[],
  guid: string,
  nextActual: number
): { items: KpiRecord[]; changed: boolean } => {
  let hasChanged = false;

  const updateNode = (node: KpiRecord): KpiRecord => {
    let nodeChanged = false;

    const nextChildren = node.children.map((child) => {
      const updatedChild = updateNode(child);
      if (updatedChild !== child) {
        nodeChanged = true;
      }
      return updatedChild;
    });

    let nextNode: KpiRecord = node;

    if (node.id === guid && node.children.length === 0) {
      const normalizedActual = roundToTwo(nextActual);
      const nextPercent = calcPercent(normalizedActual, node.planValue);
      nextNode = {
        ...nextNode,
        ownActualValue: normalizedActual,
        actualValue: normalizedActual,
        percentTotal: nextPercent,
      };
      nodeChanged = true;
    }

    if (nodeChanged && nextChildren.length > 0) {
      const aggregatedActual = roundToTwo(
        aggregateChildActuals(
          nextChildren.map((child) => child.actualValue),
          nextNode.aggregationType
        )
      );
      nextNode = {
        ...nextNode,
        children: nextChildren,
        hasChildren: true,
        actualValue: aggregatedActual,
        percentTotal: calcPercent(aggregatedActual, nextNode.planValue),
      };
    } else if (nodeChanged) {
      nextNode = {
        ...nextNode,
        children: nextChildren,
      };
    }

    if (nextNode !== node) {
      hasChanged = true;
    }

    return nextNode;
  };

  const nextItems = items.map((item) => updateNode(item));
  return {
    items: hasChanged ? nextItems : items,
    changed: hasChanged,
  };
};

const makeChildUid = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `child-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
};

const loadRemoteOptionsBySlug = async ({
  slug,
  search,
  limit,
  offset,
}: {
  slug: string;
  search: string;
  limit: number;
  offset: number;
}) => {
  const res = await httpRequest.get(`/v2/items/${slug}`, {
    params: {
      data: encodeJsonToUrlParam({
        limit,
        offset,
        ...(search ? { search } : {}),
      }),
    },
  });

  const options = (Array.isArray(res?.response) ? res.response : [])
    .map((item) => ({
      value: typeof item?.guid === "string" ? item.guid : "",
      label: typeof item?.title === "string" ? item.title : "",
    }))
    .filter((item) => item.value && item.label);

  return { count: Number(res?.count || 0), options };
};

const formatPlanForInput = (value: number): string => {
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
};

const buildChildrenFromSlots = (
  slots: ChildSlot[],
  existing: ChildDraft[] = [],
  defaults?: { name: string; planValue: string }
): ChildDraft[] =>
  slots.map((slot, index) => {
    const prior = existing[index];
    return {
      uid: prior?.uid || makeChildUid(),
      guid: prior?.guid,
      name: prior ? prior.name : defaults?.name || "",
      periodType: slot.periodType,
      startDate: slot.startDate,
      endDate: slot.endDate,
      planValue: prior ? prior.planValue : defaults?.planValue || "",
    };
  });

const computeChildDefaults = (
  parentName: string,
  parentPlanValue: string,
  slotsCount: number,
  aggregationType: KpiAggregationType
): { name: string; planValue: string } => {
  const planNumber = parsePlanInputValue(parentPlanValue);
  const hasPlan = Number.isFinite(planNumber) && planNumber > 0;
  // Sum: split the parent plan across children. Min/max/avg: each child targets
  // the same level, so copy the parent value to every child.
  const perChildNumber =
    aggregationType === "sum" && slotsCount > 0 ? planNumber / slotsCount : planNumber;
  const planValue = hasPlan
    ? formatPlanInputValue(formatPlanForInput(perChildNumber))
    : "";
  return {
    name: parentName,
    planValue,
  };
};

const getDefaultDraft = (periodType: KpiPeriodMode): CreateKpiDraft => {
  const range = getPeriodRange(new Date(), periodType);
  return {
    parentId: "",
    parentTitle: "",
    positionId: "",
    positionTitle: "",
    employeeIds: [],
    source: "Вручную",
    valueSymbol: "",
    valueSymbolPosition: "suffix",
    name: "",
    description: "",
    periodType,
    aggregationType: "sum",
    startDate: range.from,
    endDate: range.to,
    planValue: "",
    rewardAmount: "",
    hasChildren: false,
    children: [],
  };
};

type GroupEntry = {
  position: string;
  positionsId: string | null;
  items: KpiRecord[];
};

// Apply the current local order (from drag-n-drop) onto freshly-loaded groups,
// while adopting the fresh row data. Preserves position + row order, refreshes
// values, and appends anything newly added / drops anything removed.
const reconcileGroupOrder = (
  prevGroups: GroupEntry[],
  freshGroups: GroupEntry[]
): GroupEntry[] => {
  if (prevGroups.length === 0) return freshGroups;

  const freshByPosition = new Map(freshGroups.map((group) => [group.position, group]));
  const result: GroupEntry[] = [];
  const usedPositions = new Set<string>();

  for (const prevGroup of prevGroups) {
    const freshGroup = freshByPosition.get(prevGroup.position);
    if (!freshGroup) continue;
    usedPositions.add(prevGroup.position);

    const freshItemById = new Map(freshGroup.items.map((item) => [item.id, item]));
    const items: KpiRecord[] = [];
    const usedIds = new Set<string>();
    for (const prevItem of prevGroup.items) {
      const freshItem = freshItemById.get(prevItem.id);
      if (freshItem) {
        items.push(freshItem);
        usedIds.add(prevItem.id);
      }
    }
    for (const freshItem of freshGroup.items) {
      if (!usedIds.has(freshItem.id)) items.push(freshItem);
    }
    result.push({ ...freshGroup, items });
  }

  for (const freshGroup of freshGroups) {
    if (!usedPositions.has(freshGroup.position)) result.push(freshGroup);
  }

  return result;
};

// Sortable groups (position headers) use a prefixed id so they never collide
// with KPI row ids (uuids).
const positionDndId = (position: string): string => `position::${position}`;

// Drag handle props are spread onto the grip button so only the grip starts a
// drag — the rest of the row stays interactive (menus, inline editing).
type DragHandleProps = {
  attributes: ReturnType<typeof useSortable>["attributes"];
  listeners: ReturnType<typeof useSortable>["listeners"];
  isDragging: boolean;
};

// A KPI table row, reorderable within its position group. The real <tr> stays
// in the table (only translated), so table cell widths are preserved while
// neighbours slide via dnd-kit's transition.
function SortableKpiRow({
  id,
  position,
  className,
  children,
}: {
  id: string;
  position: string;
  className?: string;
  children: (handle: DragHandleProps) => ReactNode;
}) {
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({
    id,
    data: { type: "item", position },
  });

  // CSS.Translate (not CSS.Transform): the sorting strategy also emits scaleY
  // to match the hovered neighbour's height, which visibly squashes rows of
  // uneven height (multi-line descriptions). Translate keeps the row's size.
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    ...(isDragging ? { position: "relative", zIndex: 30 } : {}),
  };

  // The whole row follows the cursor; lift it visually above its neighbours.
  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`${className ?? ""} ${
        isDragging ? "bg-white shadow-lg ring-1 ring-blue-200" : ""
      }`}
    >
      {children({ attributes, listeners, isDragging })}
    </tr>
  );
}

// A position-group header row, reorderable against the other groups.
function SortablePositionRow({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: (handle: DragHandleProps) => ReactNode;
}) {
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({
    id,
    data: { type: "position" },
  });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    ...(isDragging ? { position: "relative", zIndex: 30 } : {}),
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`${className ?? ""} ${
        isDragging ? "bg-white shadow-md ring-1 ring-blue-200" : ""
      }`}
    >
      {children({ attributes, listeners, isDragging })}
    </tr>
  );
}

function KpiPage() {
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [periodMode, setPeriodMode] = useState<KpiPeriodMode>("yearly");
  const [cursorDate, setCursorDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [kpiItems, setKpiItems] = useState<KpiRecord[]>([]);
  const [kpiGroups, setKpiGroups] = useState<KpiTableGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingFilters, setIsLoadingFilters] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [silentReloadToken, setSilentReloadToken] = useState(0);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createError, setCreateError] = useState("");
  const [isCreateSaving, setIsCreateSaving] = useState(false);
  const [editingKpiId, setEditingKpiId] = useState<string | null>(null);
  /** Динамические поля таблицы kpi_items. */
  const dynamic = useDynamicValues("kpi_items");
  const [actionMenuItemId, setActionMenuItemId] = useState<string | null>(null);
  const [actionMenuAnchorEl, setActionMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [kpiToDelete, setKpiToDelete] = useState<KpiRecord | null>(null);
  const [editingActualCell, setEditingActualCell] = useState<EditingActualCell | null>(null);
  const [draft, setDraft] = useState<CreateKpiDraft>(() => getDefaultDraft("yearly"));
  const [positionFilterOptions, setPositionFilterOptions] = useState<FilterOption[]>([]);
  const [sourceFilterOptions, setSourceFilterOptions] = useState<FilterOption[]>([]);
  const [autoMetricOptions, setAutoMetricOptions] = useState<KpiAutoMetricOption[]>([]);
  const [parentOptions, setParentOptions] = useState<KpiParentOption[]>([]);
  const [expandedColumns, setExpandedColumns] = useState<Set<string>>(() => new Set());
  const [expandedTreeNodeIds, setExpandedTreeNodeIds] = useState<Set<string>>(() => new Set());
  const skipTableLoaderRef = useRef(false);

  // Листы KPI (как в Google Sheets). Пока API их не знает, привязка KPI к
  // листам живёт в localStorage per-company — см. ./sheets.tsx.
  const sheetsApi = useKpiSheets(companyStore.company?.guid || "");
  const { activeSheetId, sheetIdOf, isDefaultActive } = sheetsApi;

  // Комментарии к ячейкам План/Факт (в стиле Google Sheets). Пока UI-стадия:
  // хранятся в localStorage per-company — см. ./comments.tsx.
  const commentsApi = useKpiCellComments(companyStore.company?.guid || "");

  const selectPortalTarget = typeof document !== "undefined" ? document.body : undefined;
  const filterSelectPortalTarget = typeof document !== "undefined" ? document.body : null;

  const selectedPositionFallbackOption = useMemo<RemoteSelectOption | null>(() => {
    if (!draft.positionId || !draft.positionTitle) return null;
    return { value: draft.positionId, label: draft.positionTitle };
  }, [draft.positionId, draft.positionTitle]);

  const valueSymbolPositionOptions = useMemo<FilterOption[]>(
    () => [
      { value: "suffix", label: "После значения" },
      { value: "prefix", label: "Перед значением" },
    ],
    []
  );

  const selectedValueSymbolPositionOption = useMemo<FilterOption | null>(
    () =>
      valueSymbolPositionOptions.find((option) => option.value === draft.valueSymbolPosition) ||
      valueSymbolPositionOptions[0] ||
      null,
    [valueSymbolPositionOptions, draft.valueSymbolPosition]
  );

  const filterSelectStyles = useMemo<StylesConfig<FilterOption, false>>(
    () => ({
      control: (base, state) => ({
        ...base,
        minHeight: 40,
        borderRadius: 12,
        backgroundColor: state.hasValue ? "var(--color-brand-50)" : "#fff",
        borderColor: state.hasValue ? "var(--color-brand-200)" : state.isFocused ? "#cbd5e1" : "#e2e8f0",
        boxShadow: "none",
        "&:hover": {
          borderColor: state.hasValue ? "#93c5fd" : "#cbd5e1",
        },
      }),
      valueContainer: (base) => ({ ...base, padding: "0 10px" }),
      indicatorsContainer: (base, state) => ({
        ...base,
        color: state.hasValue ? "var(--company-color)" : "#64748b",
      }),
      dropdownIndicator: (base, state) => ({
        ...base,
        color: state.hasValue ? "var(--company-color)" : "#64748b",
        padding: 6,
      }),
      clearIndicator: (base) => ({ ...base, color: "#64748b", padding: 6 }),
      indicatorSeparator: () => ({ display: "none" }),
      placeholder: (base) => ({ ...base, color: "#94a3b8", fontSize: 14 }),
      input: (base) => ({ ...base, color: "#1e293b", fontSize: 14, margin: 0, padding: 0 }),
      singleValue: (base, state) => ({
        ...base,
        color: state.hasValue ? "var(--company-color)" : "#334155",
        fontSize: 14,
        fontWeight: state.hasValue ? 600 : 500,
      }),
      menu: (base) => ({ ...base, borderRadius: 10, overflow: "hidden", zIndex: 100100 }),
      menuPortal: (base) => ({ ...base, zIndex: 100100 }),
      option: (base, state) => ({
        ...base,
        backgroundColor: state.isSelected ? "var(--color-brand-100)" : state.isFocused ? "#f8fafc" : "#fff",
        color: state.isSelected ? "var(--color-brand-700)" : "#1e293b",
        fontSize: 14,
        padding: "8px 12px",
      }),
      noOptionsMessage: (base) => ({ ...base, color: "#64748b", fontSize: 13 }),
    }),
    []
  );

  const employeeSelectStyles = useMemo<StylesConfig<FilterOption, true>>(
    () => ({
      control: (base, state) => ({
        ...base,
        minHeight: 40,
        borderRadius: 12,
        backgroundColor: state.isDisabled ? "#f8fafc" : "#fff",
        borderColor: state.isFocused ? "#cbd5e1" : "#e2e8f0",
        boxShadow: "none",
        "&:hover": { borderColor: "#cbd5e1" },
      }),
      valueContainer: (base) => ({ ...base, padding: "4px 10px", gap: 4 }),
      placeholder: (base) => ({ ...base, color: "#94a3b8", fontSize: 14 }),
      input: (base) => ({ ...base, color: "#1e293b", fontSize: 14, margin: 0, padding: 0 }),
      multiValue: (base) => ({
        ...base,
        margin: 0,
        borderRadius: 8,
        backgroundColor: "var(--color-brand-50)",
        border: "1px solid var(--color-brand-200)",
      }),
      multiValueLabel: (base) => ({
        ...base,
        color: "var(--color-brand-700)",
        fontSize: 12,
        fontWeight: 600,
        padding: "2px 4px 2px 8px",
      }),
      multiValueRemove: (base) => ({
        ...base,
        color: "#60a5fa",
        borderRadius: "0 7px 7px 0",
        ":hover": { backgroundColor: "var(--color-brand-100)", color: "var(--color-brand-700)" },
      }),
      indicatorsContainer: (base) => ({ ...base, color: "#64748b" }),
      dropdownIndicator: (base) => ({ ...base, color: "#64748b", padding: 6 }),
      clearIndicator: (base) => ({ ...base, color: "#64748b", padding: 6 }),
      indicatorSeparator: () => ({ display: "none" }),
      menu: (base) => ({ ...base, borderRadius: 10, overflow: "hidden", zIndex: 100100 }),
      menuPortal: (base) => ({ ...base, zIndex: 100100 }),
      option: (base, state) => ({
        ...base,
        backgroundColor: state.isSelected ? "var(--color-brand-100)" : state.isFocused ? "#f8fafc" : "#fff",
        color: state.isSelected ? "var(--color-brand-700)" : "#1e293b",
        fontSize: 14,
        padding: "8px 12px",
      }),
      noOptionsMessage: (base) => ({ ...base, color: "#64748b", fontSize: 13 }),
    }),
    []
  );

  const loadPositionOptions = useCallback(
    async ({ search, limit, offset }: { search: string; limit: number; offset: number }) => {
      return loadRemoteOptionsBySlug({
        slug: "positions",
        search,
        limit,
        offset,
      });
    },
    []
  );

  useEffect(() => {
    if (!draft.positionId) return;
    let isCancelled = false;
    void (async () => {
      try {
        const record = await settingsDirectoryService.getByGuid("positions", draft.positionId);
        const title = typeof record?.title === "string" ? record.title : "";
        if (isCancelled || !title) return;
        setDraft((prev) =>
          prev.positionId === draft.positionId && prev.positionTitle !== title
            ? { ...prev, positionTitle: title }
            : prev
        );
      } catch {
        // ignore
      }
    })();
    return () => {
      isCancelled = true;
    };
  }, [draft.positionId]);

  const periodRange = useMemo(() => getPeriodRange(cursorDate, periodMode), [cursorDate, periodMode]);
  const selectedDraftPeriodDate = useMemo<Date | null>(
    () => toDatePickerValue(draft.startDate) || toDatePickerValue(draft.endDate),
    [draft.startDate, draft.endDate]
  );
  const draftPeriodRangeLabel = useMemo(
    () => formatDraftPeriodRangeLabel(draft.startDate, draft.endDate, draft.periodType),
    [draft.startDate, draft.endDate, draft.periodType]
  );

  useEffect(() => {
    let cancelled = false;
    setIsLoadingFilters(true);
    void (async () => {
      try {
        const response = await reportsService.getKpi({
          period_type: periodMode,
          exclude_guid: editingKpiId || undefined,
        });
        if (cancelled) return;

        const filters = response.result?.filters;
        const positions = Array.isArray(filters?.positions) ? filters!.positions! : [];
        const sources = Array.isArray(filters?.sources) ? filters!.sources! : [];
        const autoMetrics = Array.isArray(filters?.auto_metrics) ? filters!.auto_metrics! : [];
        const parents = Array.isArray(filters?.parents) ? filters!.parents! : [];

        setPositionFilterOptions(
          positions
            .map((option: KpiFilterOption) => ({
              value: String(option.value || ""),
              label: String(option.label || ""),
            }))
            .filter((option) => option.value && option.label)
        );
        setSourceFilterOptions(
          sources
            .map((option: KpiFilterOption) => ({
              value: String(option.value || ""),
              label: String(option.label || ""),
            }))
            .filter((option) => option.value && option.label)
        );
        setAutoMetricOptions(
          autoMetrics.filter((option) => option.value && option.label)
        );
        setParentOptions(parents);
      } catch {
        if (!cancelled) toast.error("Не удалось загрузить фильтры KPI");
      } finally {
        if (!cancelled) setIsLoadingFilters(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [periodMode, editingKpiId]);

  useEffect(() => {
    let cancelled = false;
    const shouldShowLoading = !skipTableLoaderRef.current;
    if (shouldShowLoading) {
      setIsLoading(true);
    }
    void (async () => {
      try {
        const response = await reportsService.getKpiTable({
          period_type: periodMode,
          date_from: periodRange.from,
          date_to: periodRange.to,
          search: searchQuery.trim() || undefined,
          position_id: positionFilter || undefined,
          sources: sourceFilter ? [sourceFilter] : undefined,
        });

        if (cancelled) return;

        const items = (response.result?.items || []).map(mapApiItem);
        const groups = response.result?.groups || [];
        setKpiItems(items);
        setKpiGroups(groups);
      } catch {
        if (!cancelled) {
          setKpiItems([]);
          setKpiGroups([]);
          toast.error("Не удалось загрузить KPI");
        }
      } finally {
        skipTableLoaderRef.current = false;
        if (!cancelled && shouldShowLoading) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    periodMode,
    periodRange.from,
    periodRange.to,
    searchQuery,
    positionFilter,
    sourceFilter,
    reloadToken,
    silentReloadToken,
  ]);

  const currentPeriodLabel = useMemo(
    () => formatPeriodLabel(cursorDate, periodMode),
    [cursorDate, periodMode]
  );

  // KPI активного листа: явно привязанные к нему + (для листа по умолчанию)
  // все KPI без привязки.
  const sheetKpiItems = useMemo(
    () => kpiItems.filter((item) => sheetIdOf(item.id) === activeSheetId),
    [kpiItems, sheetIdOf, activeSheetId]
  );

  const hasLevel1 = useMemo(
    () => sheetKpiItems.some((item) => item.children.length > 0),
    [sheetKpiItems]
  );

  // For each top-level bucket column index, true if at least one row's child
  // at that index has its own children (grandchildren = expandable level).
  const canExpandByIndex = useMemo(() => {
    const maxLen =
      periodMode === "yearly"
        ? 4
        : periodMode === "quarterly"
          ? 3
          : periodMode === "monthly"
            ? buildMondayFridayWeeksForMonth(cursorDate).length
            : periodMode === "weekly"
              ? 7
              : 0;
    const result = new Array<boolean>(maxLen).fill(false);
    for (const item of sheetKpiItems) {
      const limit = Math.min(item.children.length, maxLen);
      for (let i = 0; i < limit; i++) {
        if (item.children[i].children.length > 0) result[i] = true;
      }
    }
    return result;
  }, [sheetKpiItems, periodMode]);

  const leafBuckets = useMemo(
    () => buildLeafBuckets(periodMode, cursorDate, expandedColumns, hasLevel1, canExpandByIndex),
    [periodMode, cursorDate, expandedColumns, hasLevel1, canExpandByIndex]
  );

  // Reset expanded columns when tab changes.
  useEffect(() => {
    setExpandedColumns(new Set());
  }, [periodMode]);

  // Временно скрыто вместе с кнопкой сворачивания/разворачивания колонки
  // const toggleColumnExpand = useCallback((topKey: string) => {
  //   setExpandedColumns((prev) => {
  //     const next = new Set(prev);
  //     if (next.has(topKey)) next.delete(topKey);
  //     else next.add(topKey);
  //     return next;
  //   });
  // }, []);

  const toggleTreeNodeExpand = useCallback((nodeId: string) => {
    setExpandedTreeNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const tableMinWidthStyle = useMemo<CSSProperties>(() => {
    const cols = leafBuckets.length;
    const minWidth = 440 + cols * 180;
    return { minWidth: `${minWidth}px` };
  }, [leafBuckets]);

  const selectedPositionFilterOption = useMemo<FilterOption | null>(
    () => positionFilterOptions.find((option) => option.value === positionFilter) || null,
    [positionFilterOptions, positionFilter]
  );
  const selectedSourceFilterOption = useMemo<FilterOption | null>(
    () => sourceFilterOptions.find((option) => option.value === sourceFilter) || null,
    [sourceFilterOptions, sourceFilter]
  );
  const activeFiltersCount = useMemo(
    () => [positionFilter, sourceFilter].filter(Boolean).length,
    [positionFilter, sourceFilter]
  );
  const isFilterButtonActive = isFiltersOpen || activeFiltersCount > 0;

  const allowedParentPeriodTypes = useMemo(
    () => getAllowedParentPeriodTypes(draft.periodType),
    [draft.periodType]
  );

  const parentSelectOptions = useMemo<ParentSelectOption[]>(
    () => [
      { value: "", label: "Не задан (корневой KPI)", isRoot: true },
      ...parentOptions
        .filter((option) =>
          allowedParentPeriodTypes.includes(normalizePeriodType(option.period_type))
        )
        .map((option) => ({
          value: option.value,
          label: option.label,
          periodType: option.period_type,
          startDate: option.start_date,
          endDate: option.end_date,
        })),
    ],
    [parentOptions, allowedParentPeriodTypes]
  );

  const selectedParentOption = useMemo<ParentSelectOption | null>(
    () => parentSelectOptions.find((option) => option.value === draft.parentId) || parentSelectOptions[0] || null,
    [parentSelectOptions, draft.parentId]
  );

  useEffect(() => {
    if (!draft.parentId) return;
    const parentStillAllowed = parentSelectOptions.some(
      (option) => option.value === draft.parentId
    );
    if (parentStillAllowed) return;
    setDraft((prev) =>
      prev.parentId
        ? {
            ...prev,
            parentId: "",
            parentTitle: "",
          }
        : prev
    );
  }, [draft.parentId, parentSelectOptions]);

  const formatParentOptionLabel = useCallback(
    (option: ParentSelectOption, meta: { context: "menu" | "value" }) => {
      if (meta.context !== "menu" || option.isRoot) {
        return option.label;
      }

      const tagLabel = getPeriodTypeTagLabel(option);
      if (!tagLabel) return option.label;

      return (
        <div className="flex items-center justify-between gap-3">
          <span className="truncate">{option.label}</span>
          <span
            className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getGoalTypeBadgeClass(option.periodType)}`}
          >
            {tagLabel}
          </span>
        </div>
      );
    },
    []
  );

  // Server-driven grouping (order reflects the persisted sort). `orderedGroups`
  // below mirrors this but can be mutated optimistically during drag-n-drop.
  const groupEntries = useMemo<GroupEntry[]>(() => {
    const groups = new Map<string, GroupEntry>();
    // Пустые группы-должности с сервера показываем только на листе по
    // умолчанию: на остальных листах группа появляется вместе со своими KPI.
    if (isDefaultActive && kpiGroups.length > 0) {
      for (const group of kpiGroups) {
        const position = group.position || "Без должности";
        if (!groups.has(position)) {
          groups.set(position, { position, positionsId: null, items: [] });
        }
      }
    }
    for (const item of sheetKpiItems) {
      let entry = groups.get(item.position);
      if (!entry) {
        entry = { position: item.position, positionsId: item.positionsId, items: [] };
        groups.set(item.position, entry);
      }
      if (!entry.positionsId) entry.positionsId = item.positionsId;
      entry.items.push(item);
    }
    return [...groups.values()];
  }, [sheetKpiItems, kpiGroups, isDefaultActive]);

  const [orderedGroups, setOrderedGroups] = useState<GroupEntry[]>([]);
  const orderedGroupsRef = useRef<GroupEntry[]>([]);

  // Whenever the server-derived groups change (a reload OR an optimistic value
  // edit), reconcile: keep the current local drag order of positions/rows but
  // always adopt the fresh row data. Reordering by drag mutates `orderedGroups`
  // without touching `groupEntries`, so that order survives; a value change
  // rebuilds `groupEntries`, so this reconcile refreshes the visible numbers.
  const lastGroupEntriesRef = useRef<GroupEntry[] | null>(null);
  if (lastGroupEntriesRef.current !== groupEntries) {
    lastGroupEntriesRef.current = groupEntries;
    setOrderedGroups((prev) => reconcileGroupOrder(prev, groupEntries));
  }
  orderedGroupsRef.current = orderedGroups;

  const rowIndexById = useMemo(() => {
    const map = new Map<string, number>();
    let counter = 1;
    for (const group of orderedGroups) {
      for (const item of group.items) {
        map.set(item.id, counter);
        counter += 1;
      }
    }
    return map;
  }, [orderedGroups]);

  const dndSensors = useSensors(
    // A small activation distance keeps the grip clickable and prevents
    // accidental drags when the user just clicks around the row.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Constrain collisions to the active drag's own kind: a KPI row only targets
  // rows in its own position group, a position header only targets other
  // headers. Keeps drops reliable in the wide, scrollable table.
  const dndCollisionDetection = useCallback<CollisionDetection>((args) => {
    const activeData = args.active.data.current;
    const activeType = activeData?.type;
    let droppableContainers = args.droppableContainers.filter(
      (container) => container.data.current?.type === activeType
    );
    if (activeType === "item") {
      droppableContainers = droppableContainers.filter(
        (container) => container.data.current?.position === activeData?.position
      );
    }
    return closestCenter({ ...args, droppableContainers });
  }, []);

  const persistKpiItemOrder = useCallback((group: GroupEntry) => {
    if (group.items.length === 0) return;
    void reportsService
      .reorderKpi({
        mode: "items",
        positions_id: group.positionsId,
        ordered_ids: group.items.map((item) => item.id),
      })
      .catch(() => toast.error("Не удалось сохранить порядок KPI"));
  }, []);

  const persistPositionOrder = useCallback((groups: GroupEntry[]) => {
    if (groups.length === 0) return;
    void reportsService
      .reorderKpi({
        mode: "positions",
        ordered_position_ids: groups.map((entry) => entry.positionsId),
      })
      .catch(() => toast.error("Не удалось сохранить порядок должностей"));
  }, []);

  // While a position header is being dragged we collapse every KPI row (across
  // all groups) so only the headers remain — the group reorder then reads as a
  // clean, compact list. The collapse is animated in two phases: rows first
  // fade out ("collapsing"), then unmount ("collapsed"); on drop they remount
  // with a fade-in ("expanding") before returning to "idle".
  type PositionDragPhase = "idle" | "collapsing" | "collapsed" | "expanding";
  const [positionDragPhase, setPositionDragPhase] = useState<PositionDragPhase>("idle");
  const positionDragTimerRef = useRef<number | null>(null);

  const clearPositionDragTimer = useCallback(() => {
    if (positionDragTimerRef.current !== null) {
      window.clearTimeout(positionDragTimerRef.current);
      positionDragTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearPositionDragTimer, [clearPositionDragTimer]);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      if (event.active.data.current?.type !== "position") return;
      clearPositionDragTimer();
      setPositionDragPhase("collapsing");
      positionDragTimerRef.current = window.setTimeout(() => {
        setPositionDragPhase("collapsed");
        positionDragTimerRef.current = null;
      }, 140);
    },
    [clearPositionDragTimer]
  );

  const finishPositionDragPhase = useCallback(() => {
    clearPositionDragTimer();
    setPositionDragPhase((phase) => {
      if (phase === "idle") return phase;
      positionDragTimerRef.current = window.setTimeout(() => {
        setPositionDragPhase("idle");
        positionDragTimerRef.current = null;
      }, 260);
      return "expanding";
    });
  }, [clearPositionDragTimer]);

  const handleDragCancel = useCallback(() => {
    finishPositionDragPhase();
  }, [finishPositionDragPhase]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      finishPositionDragPhase();
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const type = active.data.current?.type;
      const current = orderedGroupsRef.current;

      if (type === "position") {
        const from = current.findIndex((g) => positionDndId(g.position) === active.id);
        const to = current.findIndex((g) => positionDndId(g.position) === over.id);
        if (from < 0 || to < 0) return;
        const next = arrayMove(current, from, to);
        orderedGroupsRef.current = next;
        setOrderedGroups(next);
        persistPositionOrder(next);
        return;
      }

      if (type === "item") {
        const position = active.data.current?.position as string | undefined;
        if (!position) return;
        const groupIndex = current.findIndex((g) => g.position === position);
        if (groupIndex < 0) return;
        const group = current[groupIndex];
        const from = group.items.findIndex((item) => item.id === active.id);
        const to = group.items.findIndex((item) => item.id === over.id);
        // Reorder only within the same group; drops elsewhere are ignored.
        if (from < 0 || to < 0) return;
        const nextGroup: GroupEntry = { ...group, items: arrayMove(group.items, from, to) };
        const next = [...current];
        next[groupIndex] = nextGroup;
        orderedGroupsRef.current = next;
        setOrderedGroups(next);
        persistKpiItemOrder(nextGroup);
      }
    },
    [finishPositionDragPhase, persistKpiItemOrder, persistPositionOrder]
  );

  const positionSortableIds = useMemo(
    () => orderedGroups.map((group) => positionDndId(group.position)),
    [orderedGroups]
  );

  // True while a position header is actually being dragged (rows hidden or
  // fading out). "expanding" is the post-drop reveal and doesn't count.
  const isPositionDragActive =
    positionDragPhase === "collapsing" || positionDragPhase === "collapsed";

  const itemRowPhaseClass =
    positionDragPhase === "collapsing"
      ? "kpi-row-exit"
      : positionDragPhase === "expanding"
        ? "kpi-row-enter"
        : "";

  const findItemById = useCallback(
    (items: KpiRecord[], id: string): KpiRecord | null => {
      for (const item of items) {
        if (item.id === id) return item;
        if (item.children.length > 0) {
          const found = findItemById(item.children, id);
          if (found) return found;
        }
      }
      return null;
    },
    []
  );

  const actionMenuItem = useMemo(
    () => (actionMenuItemId ? findItemById(kpiItems, actionMenuItemId) : null),
    [kpiItems, actionMenuItemId, findItemById]
  );

  // Перемещать между листами можно только корневые KPI — дочерние всегда
  // отображаются внутри родителя.
  const actionMenuIsRootItem = useMemo(
    () => Boolean(actionMenuItemId && kpiItems.some((item) => item.id === actionMenuItemId)),
    [kpiItems, actionMenuItemId]
  );

  const handleMovePeriod = (direction: "prev" | "next") => {
    setCursorDate((prev) => {
      const next = new Date(prev);
      if (periodMode === "monthly") next.setMonth(prev.getMonth() + (direction === "prev" ? -1 : 1));
      else if (periodMode === "weekly") next.setDate(prev.getDate() + (direction === "prev" ? -7 : 7));
      else if (periodMode === "quarterly") next.setMonth(prev.getMonth() + (direction === "prev" ? -3 : 3));
      else next.setFullYear(prev.getFullYear() + (direction === "prev" ? -1 : 1));
      return next;
    });
  };

  const handleDraftPeriodChange = (date: Date | null) => {
    setDraft((prev) => {
      if (!date) return { ...prev, startDate: "", endDate: "" };
      const nextRange = getPeriodRange(date, prev.periodType);
      return { ...prev, startDate: nextRange.from, endDate: nextRange.to };
    });
  };

  const openCreateModal = () => {
    setCreateError("");
    setEditingKpiId(null);
    setDraft(getDefaultDraft(periodMode));
    dynamic.reset();
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    setCreateError("");
    setEditingKpiId(null);
  };

  const openEditModal = (item: KpiRecord) => {
    setCreateError("");
    setEditingKpiId(item.id);

    const startIso = normalizeDateInputValue(item.startDate);
    const endIso = normalizeDateInputValue(item.endDate);

    const existingChildren: ChildDraft[] = item.children.map((child) => ({
      uid: child.id,
      guid: child.id,
      name: child.name,
      periodType: child.periodType,
      startDate: normalizeDateInputValue(child.startDate),
      endDate: normalizeDateInputValue(child.endDate),
      planValue: formatPlanInputValue(String(child.ownPlanValue)),
    }));

    const slots = computeChildSlots(item.periodType, startIso, endIso);
    const editDefaults = computeChildDefaults(
      item.name,
      formatPlanInputValue(String(item.ownPlanValue)),
      slots.length,
      item.aggregationType
    );
    const children =
      item.hasChildren && slots.length > 0
        ? buildChildrenFromSlots(slots, existingChildren, editDefaults)
        : existingChildren;

    setDraft({
      parentId: item.parentId || "",
      parentTitle: "",
      positionId: item.positionsId || "",
      positionTitle: item.position,
      // Привязанные сотрудники приходят из get_kpi_table (employee_ids).
      employeeIds: item.employeeIds,
      source: item.source || "Вручную",
      valueSymbol: item.valueSymbol || "",
      valueSymbolPosition: item.valueSymbolPosition || "suffix",
      name: item.name,
      description: item.description,
      periodType: item.periodType,
      aggregationType: item.aggregationType,
      startDate: startIso,
      endDate: endIso,
      planValue: formatPlanInputValue(String(item.ownPlanValue)),
      // Сумма вознаграждения приходит из get_kpi_table (reward_amount).
      rewardAmount:
        item.rewardAmount != null ? formatPlanInputValue(String(item.rewardAmount)) : "",
      hasChildren: item.hasChildren && childrenSupported(item.periodType),
      children,
    });
    dynamic.reset(item.customData);
    setIsCreateModalOpen(true);
  };

  const closeActionMenu = () => {
    setActionMenuItemId(null);
    setActionMenuAnchorEl(null);
  };

  const openActionMenu = (event: MouseEvent<HTMLButtonElement>, itemId: string) => {
    const isSame = actionMenuItemId === itemId;
    if (isSame) {
      closeActionMenu();
      return;
    }
    setActionMenuItemId(itemId);
    setActionMenuAnchorEl(event.currentTarget);
  };

  const closeDeleteModal = () => setKpiToDelete(null);

  const handleDeleteKpi = async () => {
    if (!kpiToDelete) return;
    try {
      await reportsService.deleteKpi({ guid: kpiToDelete.id });
      sheetsApi.clearKpiAssignment(kpiToDelete.id);
      toast.success("KPI удален");
      setReloadToken((prev) => prev + 1);
    } catch {
      toast.error("Не удалось удалить KPI");
    }
    closeDeleteModal();
  };

  const openLeafActualEdit = (item: KpiRecord) => {
    setEditingActualCell({
      itemId: item.id,
      childId: null,
      draftValue: formatMetricValue(item.actualValue),
    });
  };

  const commitActualEdit = (guid: string, rawValue: string) => {
    const normalized = rawValue.trim().replace(",", ".");
    const parsed = Number(normalized);
    const nextActual = !Number.isFinite(parsed) || parsed < 0 ? 0 : roundToTwo(parsed);

    setKpiItems((prev) => applyActualValueToTree(prev, guid, nextActual).items);

    void (async () => {
      try {
        await reportsService.updateKpiValue({ guid, actual_value: nextActual });
        skipTableLoaderRef.current = true;
        setSilentReloadToken((prev) => prev + 1);
      } catch {
        toast.error("Не удалось сохранить фактическое значение");
        skipTableLoaderRef.current = true;
        setSilentReloadToken((prev) => prev + 1);
      }
    })();
  };

  const handleActualCellKeyDown = (event: KeyboardEvent<HTMLInputElement>, guid: string) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitActualEdit(guid, event.currentTarget.value);
      setEditingActualCell(null);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setEditingActualCell(null);
    }
  };

  const updateChildDraft = (uid: string, patch: Partial<ChildDraft>) => {
    setDraft((prev) => ({
      ...prev,
      children: prev.children.map((child) => (child.uid === uid ? { ...child, ...patch } : child)),
    }));
  };

  // Keep children slots in sync with parent's period type and dates.
  useEffect(() => {
    if (!isCreateModalOpen) return;
    if (!draft.hasChildren) return;
    if (!childrenSupported(draft.periodType)) return;

    const slots = computeChildSlots(draft.periodType, draft.startDate, draft.endDate);
    if (slots.length === 0) return;

    setDraft((prev) => {
      if (!prev.hasChildren) return prev;
      const defaults = computeChildDefaults(
        prev.name,
        prev.planValue,
        slots.length,
        prev.aggregationType
      );
      const next = buildChildrenFromSlots(slots, prev.children, defaults);
      const same =
        next.length === prev.children.length &&
        next.every((child, i) => {
          const p = prev.children[i];
          return (
            p &&
            child.periodType === p.periodType &&
            child.startDate === p.startDate &&
            child.endDate === p.endDate
          );
        });
      return same ? prev : { ...prev, children: next };
    });
  }, [
    isCreateModalOpen,
    draft.hasChildren,
    draft.periodType,
    draft.startDate,
    draft.endDate,
  ]);

  // If user switches parent to a period type that doesn't support children,
  // disable the toggle automatically.
  useEffect(() => {
    if (!childrenSupported(draft.periodType) && draft.hasChildren) {
      setDraft((prev) => ({ ...prev, hasChildren: false, children: [] }));
    }
  }, [draft.periodType, draft.hasChildren]);

  const handleSaveKpi = async () => {
    if (isCreateSaving) return;

    const name = draft.name.trim();
    const positionId = draft.positionId.trim();

    if (!positionId) {
      setCreateError("Выберите должность");
      return;
    }
    if (!name) {
      setCreateError("Введите название KPI");
      return;
    }
    if (!draft.startDate || !draft.endDate) {
      setCreateError("Укажите период KPI");
      return;
    }

    const planTotal = parsePlanInputValue(draft.planValue);
    if (!Number.isFinite(planTotal) || planTotal <= 0) {
      setCreateError("Плановое значение должно быть больше 0");
      return;
    }
    // Правила динамических полей проверяем до запроса.
    if (!dynamic.validate()) {
      setCreateError("Проверьте дополнительные поля");
      return;
    }

    const childrenPayload: Array<{
      guid?: string;
      title: string;
      period_type: KpiPeriodMode;
      start_date: string;
      end_date: string;
      plan_total: number;
    }> = [];

    if (draft.hasChildren) {
      if (draft.children.length === 0) {
        setCreateError("Дочерние KPI отсутствуют");
        return;
      }
      for (const child of draft.children) {
        const childName = child.name.trim();
        if (!childName) {
          setCreateError("Заполните название каждого дочернего KPI");
          return;
        }
        const childPlan = parsePlanInputValue(child.planValue);
        if (!Number.isFinite(childPlan) || childPlan < 0) {
          setCreateError("План дочернего KPI не может быть отрицательным");
          return;
        }
        childrenPayload.push({
          guid: child.guid,
          title: childName,
          period_type: child.periodType,
          start_date: child.startDate,
          end_date: child.endDate,
          plan_total: childPlan,
        });
      }

      // The "children plans must sum to the parent plan" rule only makes sense
      // for sum aggregation; min/max/avg have no such invariant.
      if (draft.aggregationType === "sum") {
        const childrenSum = roundToTwo(
          childrenPayload.reduce((sum, child) => sum + child.plan_total, 0)
        );
        if (Math.abs(childrenSum - planTotal) > 0.01) {
          setCreateError(
            `Сумма планов дочерних KPI (${formatMetricDisplayValue(childrenSum)}) должна быть равна плановому значению родителя (${formatMetricDisplayValue(planTotal)})`
          );
          return;
        }
      }
    }

    setCreateError("");
    setIsCreateSaving(true);

    try {
      // Сумма вознаграждения: пустое поле → null (снять выплату).
      const rewardTrimmed = draft.rewardAmount.trim();
      const rewardAmount = rewardTrimmed ? parsePlanInputValue(rewardTrimmed) : null;

      const saveResponse = await reportsService.saveKpi({
        guid: editingKpiId || undefined,
        parent_id: draft.parentId || undefined,
        companies_id: companyStore.company?.guid,
        positions_id: positionId,
        title: name,
        description: draft.description.trim(),
        source: draft.source.trim() || "Вручную",
        value_symbol: draft.valueSymbol.trim() || undefined,
        value_symbol_position: draft.valueSymbolPosition,
        period_type: draft.periodType,
        aggregation_type: draft.aggregationType,
        start_date: draft.startDate,
        end_date: draft.endDate,
        plan_total: planTotal,
        reward_amount: rewardAmount,
        ...dynamic.toPayload(),
        // Сотрудники привязываются к сохраняемому (корневому/дочернему) KPI.
        employee_ids: draft.employeeIds,
        children: draft.hasChildren ? childrenPayload : [],
      });

      // Новый корневой KPI появляется на том листе, где его создали.
      const savedGuid = saveResponse.result?.guid;
      if (!editingKpiId && savedGuid && !draft.parentId) {
        sheetsApi.moveKpiToSheet(savedGuid, activeSheetId);
      }

      setIsCreateModalOpen(false);
      setCreateError("");
      setEditingKpiId(null);
      toast.success(editingKpiId ? "KPI обновлен" : "KPI добавлен");
      setReloadToken((prev) => prev + 1);
      setDraft(getDefaultDraft(periodMode));
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Не удалось сохранить KPI");
    } finally {
      setIsCreateSaving(false);
    }
  };

  // Оборачивает содержимое ячейки План/Факт слоем комментариев (маркер, tooltip,
  // мини-редактор). valueId — id листового/бакетного значения, к которому крепится
  // заметка; column — «план»/«факт»; label — подпись для заголовка редактора.
  const withCellComment = (
    valueId: string,
    column: "plan" | "fact",
    label: string,
    content: ReactNode
  ): ReactNode => {
    const key = cellCommentKey(valueId, column);
    return (
      <CommentableCell
        commentKey={key}
        comment={commentsApi.getComment(key)}
        onSave={commentsApi.setComment}
        label={label}
      >
        {content}
      </CommentableCell>
    );
  };

  const renderLeafActualEditor = (item: KpiRecord) => {
    // Automatic KPIs are computed by the backend — show the value, don't edit it.
    if (item.isAuto) {
      return (
        <span
          title="Автоматический показатель — рассчитывается из данных задач/проектов"
          className="inline-flex h-7 min-w-[90px] items-center justify-center gap-1 rounded-md px-2 text-center text-[13px] font-semibold text-slate-800"
        >
          {formatValueWithSymbol(item.actualValue, item.valueSymbol, item.valueSymbolPosition)}
          <span className="text-[10px] font-medium text-indigo-500">авто</span>
        </span>
      );
    }
    const isEditing =
      editingActualCell?.itemId === item.id && editingActualCell?.childId === null;
    if (isEditing) {
      return (
        <input
          type="number"
          min={0}
          step="0.01"
          autoFocus
          value={editingActualCell?.draftValue ?? ""}
          onChange={(event) =>
            setEditingActualCell((prev) =>
              prev && prev.itemId === item.id && prev.childId === null
                ? { ...prev, draftValue: event.target.value }
                : prev
            )
          }
          onBlur={(event) => {
            commitActualEdit(item.id, event.target.value);
            setEditingActualCell(null);
          }}
          onKeyDown={(event) => handleActualCellKeyDown(event, item.id)}
          className="h-7 w-[110px] rounded-md border border-slate-200 px-2 text-center text-[12px] font-semibold text-slate-800 outline-none transition focus:border-slate-300"
        />
      );
    }
    return (
      <button
        type="button"
        onClick={() => openLeafActualEdit(item)}
        className="inline-flex h-7 min-w-[90px] items-center justify-center rounded-md border border-transparent px-2 text-center text-[13px] font-semibold text-slate-800 transition hover:border-slate-200 hover:bg-slate-50"
      >
        {formatValueWithSymbol(item.actualValue, item.valueSymbol, item.valueSymbolPosition)}
      </button>
    );
  };

  const renderBucketFactCell = (
    parent: KpiRecord,
    child: KpiRecord | null
  ) => {
    if (!child) {
      return <span className="text-[12px] text-slate-300">—</span>;
    }
    // Read-only cells: aggregated (own children) or automatically computed.
    if (child.hasChildren || child.isAuto) {
      return (
        <span
          title={child.isAuto ? "Автоматический показатель — рассчитывается из данных задач/проектов" : undefined}
          className="inline-flex h-7 min-w-[70px] items-center justify-center text-[12px] font-semibold text-slate-700"
        >
          {formatValueWithSymbol(child.actualValue, parent.valueSymbol, parent.valueSymbolPosition)}
        </span>
      );
    }
    const isEditing =
      editingActualCell?.itemId === parent.id && editingActualCell?.childId === child.id;
    if (isEditing) {
      return (
        <input
          type="number"
          min={0}
          step="0.01"
          autoFocus
          value={editingActualCell?.draftValue ?? ""}
          onChange={(event) =>
            setEditingActualCell((prev) =>
              prev && prev.itemId === parent.id && prev.childId === child.id
                ? { ...prev, draftValue: event.target.value }
                : prev
            )
          }
          onBlur={(event) => {
            commitActualEdit(child.id, event.target.value);
            setEditingActualCell(null);
          }}
          onKeyDown={(event) => handleActualCellKeyDown(event, child.id)}
          className="h-7 w-[80px] rounded-md border border-slate-200 px-2 text-center text-[12px] font-semibold text-slate-800 outline-none transition focus:border-slate-300"
        />
      );
    }
    return (
      <button
        type="button"
        onClick={() => {
          setEditingActualCell({
            itemId: parent.id,
            childId: child.id,
            draftValue: formatMetricValue(child.actualValue),
          });
        }}
        className="inline-flex h-7 min-w-[70px] items-center justify-center rounded-md border border-transparent px-2 text-center text-[12px] font-semibold text-slate-800 transition hover:border-slate-200 hover:bg-slate-50"
      >
        {formatValueWithSymbol(child.actualValue, parent.valueSymbol, parent.valueSymbolPosition)}
      </button>
    );
  };

  const renderRow = (item: KpiRecord, position: string) => {
    const totalPlan = item.planValue;
    const totalActual = item.actualValue;
    const totalPercent = item.percentTotal;

    return (
      <SortableKpiRow
        key={`row-${item.id}`}
        id={item.id}
        position={position}
        className={`group border-b border-slate-100 ${itemRowPhaseClass}`}
      >
        {(handle) => (
          <>
        <td className="w-12 min-w-[52px] py-2 pl-2 pr-2 text-[13px] text-slate-500">
          <div className="flex items-center gap-1">
            <button
              type="button"
              {...handle.attributes}
              {...handle.listeners}
              className="cursor-grab touch-none text-slate-300 opacity-0 transition hover:text-slate-500 group-hover:opacity-100 active:cursor-grabbing"
              aria-label="Перетащить KPI"
            >
              <GripVertical size={14} />
            </button>
            <span>{rowIndexById.get(item.id) ?? "—"}</span>
          </div>
        </td>
        <td className="py-2 pl-4 pr-3 text-left">
          <div className="flex items-center gap-1.5">
            {item.description ? (
              <HoverTooltip text={item.description}>
                <span className="cursor-default text-[13px] font-semibold text-slate-900">
                  {item.name}
                </span>
              </HoverTooltip>
            ) : (
              <span className="text-[13px] font-semibold text-slate-900">{item.name}</span>
            )}
            <button
              type="button"
              className={`dropdown-toggle inline-flex h-6 w-6 items-center justify-center rounded-md border transition ${
                actionMenuItemId === item.id
                  ? "border-slate-300 bg-slate-50 text-slate-600 opacity-100"
                  : "border-transparent text-slate-400 opacity-0 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-600 group-hover:opacity-100 focus:opacity-100"
              }`}
              onClick={(event) => openActionMenu(event, item.id)}
              aria-label={`Действия для ${item.name}`}
            >
              <MoreHorizontal size={14} />
            </button>
          </div>
        </td>

        {leafBuckets.map((leaf) => {
          const node = getChildAtPath(item, leaf.pathIndices);
          const nodePlan = node ? node.planValue : 0;
          const nodeActual = node ? node.actualValue : 0;
          const nodePercent = node ? node.percentTotal : 0;
          const cellBg = leaf.isTotalOfExpanded ? "font-semibold" : "";
          return (
            <Fragment key={`${item.id}-${leaf.key}`}>
              <td className={`whitespace-nowrap px-1 py-1.5 text-center text-[12px] text-slate-500 ${cellBg}`}>
                {node ? (
                  withCellComment(
                    node.id,
                    "plan",
                    `План · ${leaf.label}`,
                    formatValueWithSymbol(nodePlan, item.valueSymbol, item.valueSymbolPosition)
                  )
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </td>
              <td className={`whitespace-nowrap px-1 py-1.5 text-center text-[13px] font-semibold text-slate-800 ${cellBg}`}>
                {node
                  ? withCellComment(node.id, "fact", `Факт · ${leaf.label}`, renderBucketFactCell(item, node))
                  : renderBucketFactCell(item, node)}
              </td>
              <td className={`px-1 py-1.5 text-center ${cellBg}`}>
                {node ? (
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-semibold ${getPercentBadgeClass(nodePercent)}`}
                  >
                    {nodeActual === 0 && nodePlan === 0 ? "—" : `${nodePercent}%`}
                  </span>
                ) : (
                  <span className="text-[12px] text-slate-300">—</span>
                )}
              </td>
            </Fragment>
          );
        })}

        <td
          className={`${leafBuckets.length > 0 ? "border-l-2 border-blue-100 " : ""}whitespace-nowrap bg-blue-50/50 px-2 py-1.5 text-center text-[13px] font-medium text-slate-700`}
        >
          {withCellComment(
            item.id,
            "plan",
            "План · Итого",
            formatValueWithSymbol(totalPlan, item.valueSymbol, item.valueSymbolPosition)
          )}
        </td>
        <td className="whitespace-nowrap bg-blue-50/50 px-2 py-1.5 text-center text-[13px] font-semibold text-slate-900">
          {withCellComment(
            item.id,
            "fact",
            "Факт · Итого",
            item.hasChildren ? (
              <span>
                {formatValueWithSymbol(totalActual, item.valueSymbol, item.valueSymbolPosition)}
              </span>
            ) : (
              renderLeafActualEditor(item)
            )
          )}
        </td>
        <td className="bg-blue-50/50 px-2 py-1.5 text-center">
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-semibold ${getPercentBadgeClass(totalPercent)}`}
          >
            {totalPercent}%
          </span>
        </td>
          </>
        )}
      </SortableKpiRow>
    );
  };

  const renderTreeListRows = (
    items: KpiRecord[],
    level = 0,
    position?: string
  ): JSX.Element[] => {
    const rows: JSX.Element[] = [];

    items.forEach((item) => {
      const totalPlan = item.planValue;
      const totalActual = item.actualValue;
      const totalPercent = item.percentTotal;
      const hasChildren = item.children.length > 0;
      const isExpanded = expandedTreeNodeIds.has(item.id);
      const periodLabel = formatCompactPeriodLabel(
        item.periodType,
        item.startDate,
        item.endDate
      );
      const rowBgClass = getBucketBgClass(item.periodType);
      const isDraggableRoot = level === 0 && Boolean(position);

      const rowContent = (handle?: DragHandleProps) => (
        <>
          <td className="w-12 min-w-[52px] py-2 pl-2 pr-2 text-center text-[13px] text-slate-500">
            {level === 0 ? (
              <div className="flex items-center justify-center gap-1">
                {handle ? (
                  <button
                    type="button"
                    {...handle.attributes}
                    {...handle.listeners}
                    className="cursor-grab touch-none text-slate-300 opacity-0 transition hover:text-slate-500 group-hover:opacity-100 active:cursor-grabbing"
                    aria-label="Перетащить KPI"
                  >
                    <GripVertical size={14} />
                  </button>
                ) : null}
                <span>{rowIndexById.get(item.id) ?? "—"}</span>
              </div>
            ) : (
              ""
            )}
          </td>
          <td className="py-2 pl-4 pr-3 text-left">
            <div className="flex items-start gap-2" style={{ paddingLeft: `${level * 18}px` }}>
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => toggleTreeNodeExpand(item.id)}
                  className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
                  aria-label={isExpanded ? "Свернуть KPI" : "Развернуть KPI"}
                >
                  <ChevronDown
                    size={12}
                    className={`transition-transform ${isExpanded ? "rotate-180" : "-rotate-90"}`}
                  />
                </button>
              ) : (
                <span className="mt-2 inline-block h-1.5 w-1.5 rounded-full bg-slate-300" />
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-semibold text-slate-900">{item.name}</span>
                  <button
                    type="button"
                    className={`dropdown-toggle inline-flex h-6 w-6 items-center justify-center rounded-md border transition ${
                      actionMenuItemId === item.id
                        ? "border-slate-300 bg-slate-50 text-slate-600 opacity-100"
                        : "border-transparent text-slate-400 opacity-0 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-600 group-hover:opacity-100 focus:opacity-100"
                    }`}
                    onClick={(event) => openActionMenu(event, item.id)}
                    aria-label={`Действия для ${item.name}`}
                  >
                    <MoreHorizontal size={14} />
                  </button>
                </div>
                {item.description ? (
                  <div className="mt-0.5 text-[12px] text-slate-500">{item.description}</div>
                ) : null}
              </div>
            </div>
          </td>
          <td className="py-2 pr-3 text-center text-[13px] text-slate-700">{item.source || "—"}</td>
          <td className="py-2 pr-3 text-center text-[13px] text-slate-700">
            <span
              className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getGoalTypeBadgeClass(item.periodType)}`}
            >
              {getGoalTypeBadgeLabel(item.periodType)}
            </span>
          </td>
          <td className="py-2 pr-3 text-center text-[13px] text-slate-600">{periodLabel}</td>
          <td className="py-2 pr-3 text-center text-[13px] font-medium text-slate-700">
            {withCellComment(
              item.id,
              "plan",
              "План",
              formatValueWithSymbol(totalPlan, item.valueSymbol, item.valueSymbolPosition)
            )}
          </td>
          <td className="py-2 pr-3 text-center text-[13px] font-semibold text-slate-900">
            {withCellComment(
              item.id,
              "fact",
              "Факт",
              item.hasChildren ? (
                <span>{formatValueWithSymbol(totalActual, item.valueSymbol, item.valueSymbolPosition)}</span>
              ) : (
                renderLeafActualEditor(item)
              )
            )}
          </td>
          <td className="py-2 pr-3 text-center text-[13px]">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-semibold ${getPercentBadgeClass(totalPercent)}`}
            >
              {totalPercent}%
            </span>
          </td>
        </>
      );

      if (isDraggableRoot && position) {
        rows.push(
          <SortableKpiRow
            key={`list-row-${item.id}`}
            id={item.id}
            position={position}
            className={`group border-b border-slate-100 ${rowBgClass} ${itemRowPhaseClass}`}
          >
            {(handle) => rowContent(handle)}
          </SortableKpiRow>
        );
      } else {
        rows.push(
          <tr
            key={`list-row-${item.id}`}
            className={`group border-b border-slate-100 ${rowBgClass} ${itemRowPhaseClass}`}
          >
            {rowContent()}
          </tr>
        );
      }

      if (hasChildren && isExpanded) {
        rows.push(...renderTreeListRows(item.children, level + 1));
      }
    });

    return rows;
  };

  return (
    <>
      <PageMeta title="KPI | HRMS" description="Управление KPI по должностям" />

      <div className="-mx-3 md:-mx-4 -mt-3 md:-mt-4">
        <div
          className="sticky top-0 z-30 px-4 lg:px-6 py-2"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            flexWrap: "wrap",
            backgroundColor: "#fff",
            border: "1px solid #e2e8f0",
            borderTop: "none",
            borderBottom: isFiltersOpen ? "none" : "1px solid #e2e8f0",
          }}
        >
          <ViewSwitcher
            value={viewMode}
            onChange={setViewMode}
            items={[
              { key: "list", label: "Таблица", icon: <List size={16} /> },
              { key: "calendar", label: "Сетка", icon: <LayoutGrid size={16} /> },
            ]}
          />

          <KpiSheetSelect api={sheetsApi} />

          <div className="ml-auto flex min-w-0 items-center justify-end gap-2 flex-wrap">
            <ExpandableSearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              inputId="kpi-search"
              placeholder="Поиск KPI..."
              expandedWidth={300}
              collapsedSize={40}
              brandColor={companyStore.mainColor}
            />

            <button
              type="button"
              onClick={() => setIsFiltersOpen((open) => !open)}
              aria-label={`Фильтр${activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ""}`}
              title={`Фильтр${activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ""}`}
              className={`relative inline-flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                isFilterButtonActive
                  ? "border-brand-200 bg-brand-50 text-brand-500"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <SlidersHorizontal size={16} />
              {activeFiltersCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-semibold text-white">
                  {activeFiltersCount}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white transition hover:bg-brand-600"
            >
              <Plus size={16} />
              Добавить KPI
            </button>
          </div>
        </div>

        {isFiltersOpen ? (
          <div
            className="px-4 lg:px-6 py-2"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
              justifyContent: "flex-start",
              background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
              border: "1px solid #e2e8f0",
              borderTop: "1px solid #dbe4ee",
            }}
          >
            <div style={{ minWidth: "220px", maxWidth: "280px", flex: "0 1 280px" }}>
              <Select
                options={positionFilterOptions}
                value={selectedPositionFilterOption}
                onChange={(option) => setPositionFilter(option?.value || "")}
                placeholder="Все должности"
                isClearable
                isDisabled={isLoadingFilters}
                styles={filterSelectStyles}
                menuPortalTarget={filterSelectPortalTarget}
                menuPosition="fixed"
              />
            </div>

            <div style={{ minWidth: "220px", maxWidth: "280px", flex: "0 1 280px" }}>
              <Select
                options={sourceFilterOptions}
                value={selectedSourceFilterOption}
                onChange={(option) => setSourceFilter(option?.value || "")}
                placeholder="Все типы"
                isClearable
                isDisabled={isLoadingFilters}
                styles={filterSelectStyles}
                menuPortalTarget={filterSelectPortalTarget}
                menuPosition="fixed"
              />
            </div>

            {positionFilter || sourceFilter ? (
              <button
                type="button"
                onClick={() => {
                  setPositionFilter("");
                  setSourceFilter("");
                }}
                className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Сбросить
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="py-5">
          {/* overflow-clip (не hidden): hidden ломает position: sticky у строки с периодами */}
          <div className="overflow-clip border-y border-slate-200 bg-white">
            <div className="sticky top-[56px] z-20 flex items-center justify-between gap-3 flex-wrap border-b border-slate-200 bg-white px-4 py-3">
              <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                {KPI_PERIOD_TABS.map((tab) => {
                  const isActive = periodMode === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setPeriodMode(tab.key)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        height: "30px",
                        padding: "0 12px",
                        border: isActive ? "1px solid var(--color-brand-100)" : "1px solid transparent",
                        borderRadius: "8px",
                        backgroundColor: isActive ? "#fff" : "transparent",
                        color: isActive ? "var(--company-color)" : "#64748b",
                        fontWeight: 600,
                        fontSize: "13px",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        boxShadow: isActive ? "0 1px 2px rgba(15, 23, 42, 0.06)" : "none",
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "3px",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  backgroundColor: "#f8fafc",
                  height: "38px",
                }}
              >
                <button
                  type="button"
                  onClick={() => handleMovePeriod("prev")}
                  className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-transparent text-slate-600 transition hover:bg-white hover:border-slate-200"
                  aria-label="Предыдущий период"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="min-w-[170px] px-3 text-center text-[13px] font-semibold text-slate-700">
                  {currentPeriodLabel}
                </span>
                <button
                  type="button"
                  onClick={() => handleMovePeriod("next")}
                  className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-transparent text-slate-600 transition hover:bg-white hover:border-slate-200"
                  aria-label="Следующий период"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="px-4 py-4">
              {isLoading ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center">
                  <p className="m-0 text-[13px] text-slate-500">Загрузка KPI...</p>
                </div>
              ) : kpiItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center">
                  <p className="m-0 text-[13px] text-slate-500">KPI не найдены</p>
                </div>
              ) : sheetKpiItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-10 text-center">
                  <p className="m-0 text-[13px] font-medium text-slate-600">
                    На этом листе пока нет KPI
                  </p>
                  <p className="mx-auto mt-1 max-w-md text-[12px] text-slate-500">
                    Создайте новый KPI на этом листе или переместите существующий
                    через меню строки «Переместить в лист».
                  </p>
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl bg-brand-500 px-3.5 text-[13px] font-semibold text-white transition hover:bg-brand-600"
                  >
                    <Plus size={14} />
                    Добавить KPI
                  </button>
                </div>
              ) : (
                <DndContext
                  sensors={dndSensors}
                  collisionDetection={dndCollisionDetection}
                  modifiers={[restrictToVerticalAxis]}
                  measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
                  // Collapsing all KPI rows on a position drag shrinks the layout
                  // sharply; leaving auto-scroll on makes it chase the shifting
                  // bottom edge and scroll forever. Headers all fit once collapsed,
                  // so auto-scroll isn't needed for position drags anyway.
                  autoScroll={!isPositionDragActive}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragCancel={handleDragCancel}
                >
                {viewMode === "calendar" ? (
                  <div className="overflow-x-auto">
                    <table
                      style={tableMinWidthStyle}
                      className="w-full text-center [&_th]:align-middle [&_td]:align-middle [&_th]:border-r [&_th]:border-slate-100 [&_td]:border-r [&_td]:border-slate-100 [&_th:last-child]:border-r-0 [&_td:last-child]:border-r-0"
                    >
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/60">
                          <th
                            rowSpan={2}
                            className="w-12 min-w-[52px] py-2 pl-3 pr-3 text-[12px] font-semibold text-slate-500"
                          >
                            #
                          </th>
                          <th
                            rowSpan={2}
                            className="py-2 pl-4 pr-3 text-left text-[12px] font-semibold text-slate-500"
                          >
                            KPI / Название
                          </th>
                          {leafBuckets.map((leaf) => {
                            // const isExpanded = leaf.toggleState === "expanded"; // Временно скрыто вместе с кнопкой сворачивания
                            return (
                              <th
                                key={leaf.key}
                                colSpan={3}
                                className="px-2 py-2 text-center text-[12px] font-semibold text-slate-600"
                              >
                                <span className="inline-flex items-center gap-1.5">
                                  <span>{leaf.label}</span>
                                  {/* Временно скрыто — кнопка сворачивания/разворачивания колонки
                                  {leaf.isToggle ? (
                                    <button
                                      type="button"
                                      onClick={() => toggleColumnExpand(leaf.topKey)}
                                      className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-slate-200 bg-white/80 text-slate-500 transition hover:bg-white"
                                      aria-label={isExpanded ? "Свернуть колонку" : "Развернуть колонку"}
                                      title={isExpanded ? "Свернуть" : getExpandTitleByPeriod(leaf.bucketPeriodType)}
                                    >
                                      {isExpanded ? <Minus size={12} /> : <Plus size={12} />}
                                    </button>
                                  ) : null}
                                  */}
                                </span>
                              </th>
                            );
                          })}
                          <th
                            colSpan={3}
                            className={`${leafBuckets.length > 0 ? "border-l-2 border-blue-100 " : ""}bg-blue-50/60 px-2 py-2 text-center text-[12px] font-semibold text-slate-600`}
                          >
                            Итого
                          </th>
                        </tr>
                        <tr className="border-b border-slate-200">
                          {leafBuckets.map((leaf) => {
                            return (
                              <Fragment key={`${leaf.key}-sub`}>
                                <th className="px-1 py-1 text-center text-[11px] font-semibold text-slate-500">
                                  План
                                </th>
                                <th className="px-1 py-1 text-center text-[11px] font-semibold text-slate-500">
                                  Факт
                                </th>
                                <th className="px-1 py-1 text-center text-[11px] font-semibold text-slate-500">
                                  %
                                </th>
                              </Fragment>
                            );
                          })}
                          <th
                            className={`${leafBuckets.length > 0 ? "border-l-2 border-blue-100 " : ""}bg-blue-50/60 px-1 py-1 text-center text-[11px] font-semibold text-slate-600`}
                          >
                            План
                          </th>
                          <th className="bg-blue-50/60 px-1 py-1 text-center text-[11px] font-semibold text-slate-600">
                            Факт
                          </th>
                          <th className="bg-blue-50/60 px-1 py-1 text-center text-[11px] font-semibold text-slate-600">
                            %
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <SortableContext
                          items={positionSortableIds}
                          strategy={verticalListSortingStrategy}
                        >
                          {orderedGroups.map((group) => (
                            <Fragment key={`group-${group.position}`}>
                              <SortablePositionRow
                                id={positionDndId(group.position)}
                                className="group border-y-2 border-slate-200 bg-slate-100"
                              >
                                {(handle) => (
                                  <>
                                    <td className="py-2.5 pl-2 pr-2">
                                      <button
                                        type="button"
                                        {...handle.attributes}
                                        {...handle.listeners}
                                        className="cursor-grab touch-none text-slate-400 opacity-0 transition hover:text-slate-600 group-hover:opacity-100 active:cursor-grabbing"
                                        aria-label="Перетащить должность"
                                      >
                                        <GripVertical size={14} />
                                      </button>
                                    </td>
                                    <td
                                      colSpan={1 + leafBuckets.length * 3 + 3}
                                      className="py-2.5 pl-4 pr-3 text-left"
                                    >
                                      <div className="flex items-center gap-2.5">
                                        <span
                                          className="h-4 w-1 shrink-0 rounded-full bg-brand-500"
                                          aria-hidden="true"
                                        />
                                        <span className="text-[13px] font-bold uppercase tracking-wide text-slate-800">
                                          {group.position}
                                        </span>
                                        <span className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                                          {group.items.length} KPI
                                        </span>
                                      </div>
                                    </td>
                                  </>
                                )}
                              </SortablePositionRow>
                              {positionDragPhase !== "collapsed" && (
                                <SortableContext
                                  items={group.items.map((item) => item.id)}
                                  strategy={verticalListSortingStrategy}
                                >
                                  {group.items.map((item) => renderRow(item, group.position))}
                                </SortableContext>
                              )}
                            </Fragment>
                          ))}
                        </SortableContext>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[960px] [&_th]:align-middle [&_td]:align-middle [&_th]:border-r [&_th]:border-slate-100 [&_td]:border-r [&_td]:border-slate-100 [&_th:last-child]:border-r-0 [&_td:last-child]:border-r-0">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/60">
                          <th className="w-12 min-w-[52px] py-2 pl-3 pr-3 text-center text-[12px] font-semibold text-slate-500">
                            #
                          </th>
                          <th className="py-2 pl-4 pr-3 text-left text-[12px] font-semibold text-slate-500">
                            KPI / Название
                          </th>
                          <th className="py-2 pr-3 text-center text-[12px] font-semibold text-slate-500">
                            Источник
                          </th>
                          <th className="py-2 pr-3 text-center text-[12px] font-semibold text-slate-500">Тип</th>
                          <th className="py-2 pr-3 text-center text-[12px] font-semibold text-slate-500">Период</th>
                          <th className="py-2 pr-3 text-center text-[12px] font-semibold text-slate-500">План</th>
                          <th className="py-2 pr-3 text-center text-[12px] font-semibold text-slate-500">Факт</th>
                          <th className="py-2 pr-3 text-center text-[12px] font-semibold text-slate-500">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        <SortableContext
                          items={positionSortableIds}
                          strategy={verticalListSortingStrategy}
                        >
                          {orderedGroups.map((group) => (
                            <Fragment key={`group-list-${group.position}`}>
                              <SortablePositionRow
                                id={positionDndId(group.position)}
                                className="group border-y-2 border-slate-200 bg-slate-100"
                              >
                                {(handle) => (
                                  <>
                                    <td className="py-2.5 pl-2 pr-2">
                                      <button
                                        type="button"
                                        {...handle.attributes}
                                        {...handle.listeners}
                                        className="cursor-grab touch-none text-slate-400 opacity-0 transition hover:text-slate-600 group-hover:opacity-100 active:cursor-grabbing"
                                        aria-label="Перетащить должность"
                                      >
                                        <GripVertical size={14} />
                                      </button>
                                    </td>
                                    <td colSpan={7} className="py-2.5 pl-4 pr-3 text-left">
                                      <div className="flex items-center gap-2.5">
                                        <span
                                          className="h-4 w-1 shrink-0 rounded-full bg-brand-500"
                                          aria-hidden="true"
                                        />
                                        <span className="text-[13px] font-bold uppercase tracking-wide text-slate-800">
                                          {group.position}
                                        </span>
                                        <span className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                                          {group.items.length} KPI
                                        </span>
                                      </div>
                                    </td>
                                  </>
                                )}
                              </SortablePositionRow>
                              {positionDragPhase !== "collapsed" && (
                                <SortableContext
                                  items={group.items.map((item) => item.id)}
                                  strategy={verticalListSortingStrategy}
                                >
                                  {renderTreeListRows(group.items, 0, group.position)}
                                </SortableContext>
                              )}
                            </Fragment>
                          ))}
                        </SortableContext>
                      </tbody>
                    </table>
                  </div>
                )}
                </DndContext>
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={closeCreateModal}
        className="mx-4 w-full max-w-4xl p-5 sm:p-6"
        showCloseButton={false}
      >
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {editingKpiId ? "Редактировать KPI" : "Добавить KPI"}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {editingKpiId
                  ? "Обновите поля KPI и сохраните изменения."
                  : "Заполните поля и сохраните KPI."}
              </p>
            </div>
            <button
              type="button"
              onClick={closeCreateModal}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
              aria-label="Закрыть модальное окно"
            >
              <X size={18} />
            </button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-xs font-medium text-slate-500">Родительский KPI</span>
                <Select
                  options={parentSelectOptions}
                  value={selectedParentOption}
                  formatOptionLabel={formatParentOptionLabel}
                  onChange={(option) =>
                    setDraft((prev) => ({
                      ...prev,
                      parentId: option?.value || "",
                      parentTitle: option?.label || "",
                    }))
                  }
                  isDisabled={isLoadingFilters}
                  styles={filterSelectStyles}
                  menuPortalTarget={selectPortalTarget}
                  menuPosition="fixed"
                  isSearchable
                />
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-xs font-medium text-slate-500">Должность *</span>
                  <RemoteSingleSelect
                    value={draft.positionId}
                    onChange={(value) =>
                      setDraft((prev) => ({
                        ...prev,
                        positionId: value,
                        positionTitle: "",
                        // Сотрудники фильтруются по должности — при её смене
                        // прежний выбор становится невалидным.
                        employeeIds: prev.positionId === value ? prev.employeeIds : [],
                      }))
                    }
                    loadOptions={loadPositionOptions}
                    fallbackOption={selectedPositionFallbackOption}
                    placeholder="Выберите должность"
                    classNamePrefix="kpi-position-select"
                    menuPortalTarget={selectPortalTarget}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-medium text-slate-500">Сотрудники</span>
                  <EmployeesInfiniteMultiSelect
                    value={draft.employeeIds}
                    onChange={(ids) => setDraft((prev) => ({ ...prev, employeeIds: ids }))}
                    positionsId={draft.positionId || undefined}
                    isDisabled={!draft.positionId}
                    placeholder={
                      draft.positionId ? "Выберите сотрудников" : "Сначала выберите должность"
                    }
                    styles={employeeSelectStyles}
                    menuPortalTarget={selectPortalTarget}
                    classNamePrefix="kpi-employees-select"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-xs font-medium text-slate-500">Название KPI *</span>
                  <input
                    type="text"
                    value={draft.name}
                    onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Например: Продажи 2025"
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-medium text-slate-500">Источник</span>
                  <input
                    type="text"
                    list="kpi-source-options"
                    value={draft.source}
                    onChange={(event) => {
                      const nextSource = event.target.value;
                      const auto = autoMetricOptions.find((option) => option.value === nextSource.trim());
                      setDraft((prev) => ({
                        ...prev,
                        source: nextSource,
                        // Adopt the metric's default unit when picking an automatic
                        // source and the user hasn't set a symbol yet.
                        valueSymbol:
                          auto && auto.value_symbol && !prev.valueSymbol
                            ? auto.value_symbol
                            : prev.valueSymbol,
                      }));
                    }}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                    placeholder="Вручную"
                  />
                  <datalist id="kpi-source-options">
                    {autoMetricOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label} (авто)
                      </option>
                    ))}
                    {sourceFilterOptions
                      .filter(
                        (option) =>
                          !autoMetricOptions.some((auto) => auto.value === option.value)
                      )
                      .map((option) => (
                        <option key={option.value} value={option.value} />
                      ))}
                  </datalist>
                  {autoMetricOptions.some((option) => option.value === draft.source.trim()) ? (
                    <span className="text-[11px] font-medium text-indigo-500">
                      Автоматический показатель — «Факт» рассчитывается из данных задач/проектов
                    </span>
                  ) : null}
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-xs font-medium text-slate-500">Описание</span>
                <textarea
                  value={draft.description}
                  onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Краткое описание метрики..."
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                />
              </label>

              <div className="space-y-2">
                <div className="text-xs font-medium text-slate-500">Тип KPI *</div>
                <div className="flex flex-wrap gap-4">
                  {KPI_PERIOD_TABS.map((tab) => {
                    const isActive = draft.periodType === tab.key;
                    return (
                      <button
                        key={`goal-type-${tab.key}`}
                        type="button"
                        onClick={() =>
                          setDraft((prev) => {
                            const range = getPeriodRange(new Date(), tab.key);
                            return {
                              ...prev,
                              periodType: tab.key,
                              startDate: range.from,
                              endDate: range.to,
                            };
                          })
                        }
                        className={`inline-flex h-10 items-center rounded-xl border px-4 text-sm font-semibold transition ${
                          isActive
                            ? "border-brand-500 bg-brand-50 text-brand-500"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-xs font-medium text-slate-500">Период *</span>
                  <DatePicker
                    selected={selectedDraftPeriodDate}
                    onChange={handleDraftPeriodChange}
                    locale="ru"
                    dateFormat={getPickerDateFormatByPeriod(draft.periodType)}
                    placeholderText="Выберите период"
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                    popperClassName="kpi-datepicker-popper"
                    calendarClassName={`kpi-period-calendar kpi-period-calendar--${draft.periodType}`}
                    popperProps={{ strategy: "fixed" }}
                    portalId="root"
                    withPortal
                    showPopperArrow={false}
                    calendarStartDay={1}
                    showWeekPicker={draft.periodType === "weekly"}
                    showMonthYearPicker={draft.periodType === "monthly"}
                    showQuarterYearPicker={draft.periodType === "quarterly"}
                    showYearPicker={draft.periodType === "yearly"}
                  />
                  {draftPeriodRangeLabel ? (
                    <span className="text-xs text-slate-500">{draftPeriodRangeLabel}</span>
                  ) : null}
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-medium text-slate-500">Сумма вознаграждения</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={draft.rewardAmount}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        rewardAmount: formatPlanInputValue(event.target.value),
                      }))
                    }
                    placeholder="Например: 1 000 000"
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                  />
                  <span className="text-[11px] text-slate-400">
                    Выплата пропорциональна выполнению KPI: 100% — вся сумма, 50% — половина
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <label className="block space-y-2">
                  <span className="text-xs font-medium text-slate-500">Плановое значение *</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={draft.planValue}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        planValue: formatPlanInputValue(event.target.value),
                      }))
                    }
                    placeholder="100"
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-medium text-slate-500">Символ/текст возле значения</span>
                  <input
                    type="text"
                    value={draft.valueSymbol}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, valueSymbol: event.target.value }))
                    }
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                    placeholder="Например: $, %, сум"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-medium text-slate-500">Позиция символа</span>
                  <Select
                    options={valueSymbolPositionOptions}
                    value={selectedValueSymbolPositionOption}
                    onChange={(option) =>
                      setDraft((prev) => ({
                        ...prev,
                        valueSymbolPosition: option?.value === "prefix" ? "prefix" : "suffix",
                      }))
                    }
                    styles={filterSelectStyles}
                    menuPortalTarget={typeof window !== "undefined" ? window.document.body : null}
                    menuPosition="fixed"
                    isSearchable={false}
                  />
                </label>
              </div>

              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Дочерние KPI</div>
                    <div className="text-xs text-slate-500">
                      {childrenSupported(draft.periodType)
                        ? "Факт родителя автоматически считается из дочерних KPI. Тип и период привязаны к родителю."
                        : "Недельный KPI не поддерживает дочерние KPI"}
                    </div>
                  </div>
                  <label className={`inline-flex items-center gap-2 ${childrenSupported(draft.periodType) ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}>
                    <span className="text-xs font-medium text-slate-600">Есть дочерние KPI</span>
                    <span
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                        draft.hasChildren ? "bg-brand-500" : "bg-slate-300"
                      }`}
                      onClick={() => {
                        if (!childrenSupported(draft.periodType)) return;
                        setDraft((prev) => {
                          if (prev.hasChildren) {
                            return { ...prev, hasChildren: false, children: [] };
                          }
                          const slots = computeChildSlots(prev.periodType, prev.startDate, prev.endDate);
                          const defaults = computeChildDefaults(
                            prev.name,
                            prev.planValue,
                            slots.length,
                            prev.aggregationType
                          );
                          return {
                            ...prev,
                            hasChildren: true,
                            children: buildChildrenFromSlots(slots, prev.children, defaults),
                          };
                        });
                      }}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                          draft.hasChildren ? "translate-x-5" : "translate-x-1"
                        }`}
                      />
                    </span>
                  </label>
                </div>

                {draft.hasChildren && childrenSupported(draft.periodType) ? (
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-slate-600">
                      Как считать факт родителя
                    </span>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {AGGREGATION_OPTIONS.map((option) => {
                        const isActive = draft.aggregationType === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() =>
                              setDraft((prev) => {
                                if (prev.aggregationType === option.value) return prev;
                                // Re-apply the plan default to children: sum splits
                                // the parent plan, min/max/avg copies it to each.
                                const slots = computeChildSlots(
                                  prev.periodType,
                                  prev.startDate,
                                  prev.endDate
                                );
                                const defaults = computeChildDefaults(
                                  prev.name,
                                  prev.planValue,
                                  slots.length,
                                  option.value
                                );
                                return {
                                  ...prev,
                                  aggregationType: option.value,
                                  children: prev.children.map((child) => ({
                                    ...child,
                                    planValue: defaults.planValue,
                                  })),
                                };
                              })
                            }
                            title={option.hint}
                            className={`rounded-lg border px-3 py-2 text-left text-[13px] font-medium transition ${
                              isActive
                                ? "border-brand-300 bg-brand-50 text-brand-600"
                                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {draft.hasChildren && childrenSupported(draft.periodType) ? (
                  <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="px-3 py-2 text-left text-[12px] font-semibold text-slate-500">
                            Название
                          </th>
                          <th className="px-3 py-2 text-left text-[12px] font-semibold text-slate-500">
                            Тип
                          </th>
                          <th className="px-3 py-2 text-left text-[12px] font-semibold text-slate-500">
                            Период
                          </th>
                          <th className="px-3 py-2 text-right text-[12px] font-semibold text-slate-500">
                            План
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {draft.children.map((child) => {
                          const start = toDatePickerValue(child.startDate);
                          const end = toDatePickerValue(child.endDate);
                          const periodLabel =
                            start && end
                              ? formatPeriodSlotLabel(child.periodType, start, end)
                              : "—";
                          return (
                            <tr key={child.uid} className="border-b border-slate-100 last:border-b-0">
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={child.name}
                                  onChange={(event) =>
                                    updateChildDraft(child.uid, { name: event.target.value })
                                  }
                                  placeholder="Название дочернего KPI"
                                  className="h-9 w-full rounded-md border border-slate-200 px-2 text-[13px] text-slate-700 outline-none transition focus:border-slate-300"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <span
                                  className={`inline-flex rounded-full border px-2.5 py-1 text-[12px] font-semibold ${getGoalTypeBadgeClass(child.periodType)}`}
                                >
                                  {getGoalTypeBadgeLabel(child.periodType)}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-[13px] text-slate-700">{periodLabel}</td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={child.planValue}
                                  onChange={(event) =>
                                    updateChildDraft(child.uid, {
                                      planValue: formatPlanInputValue(event.target.value),
                                    })
                                  }
                                  placeholder="0"
                                  className="h-9 w-full rounded-md border border-slate-200 px-2 text-right text-[13px] font-semibold text-slate-700 outline-none transition focus:border-slate-300"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>

              <DynamicFieldsBlock
                fields={dynamic.fields}
                values={dynamic.values}
                errors={dynamic.errors}
                onChange={dynamic.setValue}
                brandColor={companyStore.mainColor}
              />

              {createError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
                  {createError}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-5">
            <button
              type="button"
              onClick={closeCreateModal}
              className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => {
                void handleSaveKpi();
              }}
              disabled={isCreateSaving}
              className="inline-flex h-10 items-center rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreateSaving
                ? "Сохранение..."
                : editingKpiId
                  ? "Сохранить изменения"
                  : "Сохранить KPI"}
            </button>
          </div>
        </div>
      </Modal>

      <Dropdown
        isOpen={Boolean(actionMenuItemId && actionMenuAnchorEl)}
        onClose={closeActionMenu}
        usePortal
        anchorEl={actionMenuAnchorEl}
        className="w-[200px] p-1"
      >
        <DropdownItem
          onClick={() => {
            if (!actionMenuItem) return;
            openEditModal(actionMenuItem);
          }}
          onItemClick={closeActionMenu}
          className="flex items-center gap-2 rounded-lg text-slate-700"
        >
          <Pencil size={14} />
          Редактировать
        </DropdownItem>
        <DropdownItem
          onClick={() => {
            if (!actionMenuItem) return;
            setKpiToDelete(actionMenuItem);
          }}
          onItemClick={closeActionMenu}
          className="flex items-center gap-2 rounded-lg text-rose-600 hover:bg-rose-50 hover:text-rose-700"
        >
          <Trash2 size={14} />
          Удалить
        </DropdownItem>

        {actionMenuIsRootItem && sheetsApi.sheets.length > 1 ? (
          <>
            <div className="my-1 h-px bg-slate-100" aria-hidden="true" />
            <div className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Переместить в лист
            </div>
            {sheetsApi.sheets
              .filter((sheet) => actionMenuItemId && sheet.id !== sheetIdOf(actionMenuItemId))
              .map((sheet) => (
                <DropdownItem
                  key={`move-to-${sheet.id}`}
                  onClick={() => {
                    if (!actionMenuItemId) return;
                    sheetsApi.moveKpiToSheet(actionMenuItemId, sheet.id);
                    toast.success(`KPI перемещён в лист «${sheet.name}»`);
                  }}
                  onItemClick={closeActionMenu}
                  className="flex items-center gap-2 rounded-lg text-slate-700"
                >
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: sheet.color || "#cbd5e1" }}
                  />
                  <span className="truncate">{sheet.name}</span>
                </DropdownItem>
              ))}
          </>
        ) : null}
      </Dropdown>

      <Modal
        isOpen={Boolean(kpiToDelete)}
        onClose={closeDeleteModal}
        className="mx-4 w-full max-w-md p-5 sm:p-6"
        showCloseButton={false}
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-slate-900">Удалить KPI?</h3>
            <p className="text-sm text-slate-500">
              Это действие нельзя отменить. Дочерние KPI также будут удалены.
            </p>
            {kpiToDelete ? (
              <p className="text-sm font-medium text-slate-700">{kpiToDelete.name}</p>
            ) : null}
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeDeleteModal}
              className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleDeleteKpi}
              className="inline-flex h-10 items-center rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700"
            >
              Удалить
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default observer(KpiPage);
