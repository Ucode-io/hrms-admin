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
} from "react";
import DatePicker, { registerLocale } from "react-datepicker";
import { ru } from "date-fns/locale/ru";
import "react-datepicker/dist/react-datepicker.css";
import { observer } from "mobx-react-lite";
import {
  ChevronLeft,
  ChevronRight,
  Minus,
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
import ExpandableSearchInput from "../../components/form/ExpandableSearchInput";
import { Modal } from "../../components/ui/modal";
import { Dropdown } from "../../components/ui/dropdown/Dropdown";
import { DropdownItem } from "../../components/ui/dropdown/DropdownItem";
import companyStore from "../../store/company.store";
import httpRequest from "../../api/httpRequest";
import settingsDirectoryService from "../../api/services/settingsDirectory.service";
import RemoteSingleSelect, { type RemoteSelectOption } from "../../components/autocomplete/RemoteSingleSelect";
import encodeJsonToUrlParam from "../../utils/encodeJsonToUrlParam";
import reportsService, {
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
  startDate: string;
  endDate: string;
  ownPlanValue: number;
  ownActualValue: number;
  planValue: number;
  actualValue: number;
  percentTotal: number;
  hasChildren: boolean;
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
  source: string;
  valueSymbol: string;
  valueSymbolPosition: "prefix" | "suffix";
  name: string;
  description: string;
  periodType: KpiPeriodMode;
  startDate: string;
  endDate: string;
  planValue: string;
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

const getBucketHeaderBgClass = (periodType: KpiPeriodMode): string => {
  switch (periodType) {
    case "daily":
      return "bg-rose-50/60";
    case "weekly":
      return "bg-amber-50/60";
    case "monthly":
      return "bg-sky-50/60";
    case "quarterly":
      return "bg-emerald-50/60";
    case "yearly":
      return "bg-violet-50/60";
    default:
      return "";
  }
};

const getExpandTitleByPeriod = (periodType: KpiPeriodMode): string => {
  if (periodType === "quarterly") return "Развернуть до месяцев";
  if (periodType === "monthly") return "Развернуть до недель";
  if (periodType === "weekly") return "Развернуть до дней";
  return "Развернуть";
};

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
        nextChildren.reduce((sum, child) => sum + child.actualValue, 0)
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
  slotsCount: number
): { name: string; planValue: string } => {
  const planNumber = parsePlanInputValue(parentPlanValue);
  const perChild =
    Number.isFinite(planNumber) && planNumber > 0 && slotsCount > 0
      ? formatPlanInputValue(formatPlanForInput(planNumber / slotsCount))
      : "";
  return {
    name: parentName,
    planValue: perChild,
  };
};

const getDefaultDraft = (periodType: KpiPeriodMode): CreateKpiDraft => {
  const range = getPeriodRange(new Date(), periodType);
  return {
    parentId: "",
    parentTitle: "",
    positionId: "",
    positionTitle: "",
    source: "Вручную",
    valueSymbol: "",
    valueSymbolPosition: "suffix",
    name: "",
    description: "",
    periodType,
    startDate: range.from,
    endDate: range.to,
    planValue: "",
    hasChildren: false,
    children: [],
  };
};

function KpiPage() {
  const [periodMode, setPeriodMode] = useState<KpiPeriodMode>("monthly");
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
  const [actionMenuItemId, setActionMenuItemId] = useState<string | null>(null);
  const [actionMenuAnchorEl, setActionMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [kpiToDelete, setKpiToDelete] = useState<KpiRecord | null>(null);
  const [editingActualCell, setEditingActualCell] = useState<EditingActualCell | null>(null);
  const [draft, setDraft] = useState<CreateKpiDraft>(() => getDefaultDraft("monthly"));
  const [positionFilterOptions, setPositionFilterOptions] = useState<FilterOption[]>([]);
  const [sourceFilterOptions, setSourceFilterOptions] = useState<FilterOption[]>([]);
  const [parentOptions, setParentOptions] = useState<KpiParentOption[]>([]);
  const [expandedColumns, setExpandedColumns] = useState<Set<string>>(() => new Set());
  const skipTableLoaderRef = useRef(false);

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
        backgroundColor: state.hasValue ? "#eff6ff" : "#fff",
        borderColor: state.hasValue ? "#bfdbfe" : state.isFocused ? "#cbd5e1" : "#e2e8f0",
        boxShadow: "none",
        "&:hover": {
          borderColor: state.hasValue ? "#93c5fd" : "#cbd5e1",
        },
      }),
      valueContainer: (base) => ({ ...base, padding: "0 10px" }),
      indicatorsContainer: (base, state) => ({
        ...base,
        color: state.hasValue ? "#2563eb" : "#64748b",
      }),
      dropdownIndicator: (base, state) => ({
        ...base,
        color: state.hasValue ? "#2563eb" : "#64748b",
        padding: 6,
      }),
      clearIndicator: (base) => ({ ...base, color: "#64748b", padding: 6 }),
      indicatorSeparator: () => ({ display: "none" }),
      placeholder: (base) => ({ ...base, color: "#94a3b8", fontSize: 14 }),
      input: (base) => ({ ...base, color: "#1e293b", fontSize: 14, margin: 0, padding: 0 }),
      singleValue: (base, state) => ({
        ...base,
        color: state.hasValue ? "#2563eb" : "#334155",
        fontSize: 14,
        fontWeight: state.hasValue ? 600 : 500,
      }),
      menu: (base) => ({ ...base, borderRadius: 10, overflow: "hidden", zIndex: 100100 }),
      menuPortal: (base) => ({ ...base, zIndex: 100100 }),
      option: (base, state) => ({
        ...base,
        backgroundColor: state.isSelected ? "#dbeafe" : state.isFocused ? "#f8fafc" : "#fff",
        color: state.isSelected ? "#1d4ed8" : "#1e293b",
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

  const hasLevel1 = useMemo(
    () => kpiItems.some((item) => item.children.length > 0),
    [kpiItems]
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
    for (const item of kpiItems) {
      const limit = Math.min(item.children.length, maxLen);
      for (let i = 0; i < limit; i++) {
        if (item.children[i].children.length > 0) result[i] = true;
      }
    }
    return result;
  }, [kpiItems, periodMode]);

  const leafBuckets = useMemo(
    () => buildLeafBuckets(periodMode, cursorDate, expandedColumns, hasLevel1, canExpandByIndex),
    [periodMode, cursorDate, expandedColumns, hasLevel1, canExpandByIndex]
  );

  // Reset expanded columns when tab changes.
  useEffect(() => {
    setExpandedColumns(new Set());
  }, [periodMode]);

  const toggleColumnExpand = useCallback((topKey: string) => {
    setExpandedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(topKey)) next.delete(topKey);
      else next.add(topKey);
      return next;
    });
  }, []);

  const tableMinWidthStyle = useMemo<CSSProperties>(() => {
    const cols = leafBuckets.length;
    const minWidth = 720 + cols * 180;
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
          <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-600">
            {tagLabel}
          </span>
        </div>
      );
    },
    []
  );

  const groupedItems = useMemo(() => {
    const groups = new Map<string, KpiRecord[]>();
    if (kpiGroups.length > 0) {
      for (const group of kpiGroups) {
        groups.set(group.position || "Без должности", []);
      }
    }
    for (const item of kpiItems) {
      if (!groups.has(item.position)) {
        groups.set(item.position, []);
      }
      groups.get(item.position)?.push(item);
    }
    return [...groups.entries()];
  }, [kpiItems, kpiGroups]);

  const rowIndexById = useMemo(() => {
    const map = new Map<string, number>();
    let counter = 1;
    for (const [, items] of groupedItems) {
      for (const item of items) {
        map.set(item.id, counter);
        counter += 1;
      }
    }
    return map;
  }, [groupedItems]);

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
      slots.length
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
      source: item.source || "Вручную",
      valueSymbol: item.valueSymbol || "",
      valueSymbolPosition: item.valueSymbolPosition || "suffix",
      name: item.name,
      description: item.description,
      periodType: item.periodType,
      startDate: startIso,
      endDate: endIso,
      planValue: formatPlanInputValue(String(item.ownPlanValue)),
      hasChildren: item.hasChildren && childrenSupported(item.periodType),
      children,
    });
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
      const defaults = computeChildDefaults(prev.name, prev.planValue, slots.length);
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

    setCreateError("");
    setIsCreateSaving(true);

    try {
      await reportsService.saveKpi({
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
        start_date: draft.startDate,
        end_date: draft.endDate,
        plan_total: planTotal,
        children: draft.hasChildren ? childrenPayload : [],
      });

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

  const renderLeafActualEditor = (item: KpiRecord) => {
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
    // Cells where the underlying child still has its own children are read-only.
    if (child.hasChildren) {
      return (
        <span className="inline-flex h-7 min-w-[70px] items-center justify-center text-[12px] font-semibold text-slate-700">
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

  const renderRow = (item: KpiRecord) => {
    const totalPlan = item.planValue;
    const totalActual = item.actualValue;
    const totalPercent = item.percentTotal;

    return (
      <tr key={`row-${item.id}`} className="group border-b border-slate-100">
        <td className="w-12 min-w-[52px] py-2 pl-3 pr-3 text-[13px] text-slate-500">
          {rowIndexById.get(item.id) ?? "—"}
        </td>
        <td className="py-2 pr-3 text-left">
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
            <div className="mt-1 text-[12px] text-slate-500">{item.description}</div>
          ) : null}
        </td>
        <td className="py-2 pr-3 text-[13px] text-slate-700">{item.source}</td>
        <td className="py-2 pr-3 text-[13px] text-slate-700">
          <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[12px] font-semibold text-blue-600">
            {getGoalTypeBadgeLabel(item.periodType)}
          </span>
        </td>
        <td className="py-2 pr-3 text-[13px] text-slate-600">
          {formatDisplayDate(item.startDate)} <br />
          {formatDisplayDate(item.endDate)}
        </td>

        {leafBuckets.map((leaf) => {
          const node = getChildAtPath(item, leaf.pathIndices);
          const nodePlan = node ? node.planValue : 0;
          const nodeActual = node ? node.actualValue : 0;
          const nodePercent = node ? node.percentTotal : 0;
          const baseBg = getBucketBgClass(leaf.bucketPeriodType);
          const cellBg = leaf.isTotalOfExpanded ? `${baseBg} font-semibold` : baseBg;
          return (
            <Fragment key={`${item.id}-${leaf.key}`}>
              <td className={`px-1 py-1.5 text-center text-[12px] text-slate-500 ${cellBg}`}>
                {node ? (
                  formatValueWithSymbol(nodePlan, item.valueSymbol, item.valueSymbolPosition)
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </td>
              <td className={`px-1 py-1.5 text-center text-[13px] font-semibold text-slate-800 ${cellBg}`}>
                {renderBucketFactCell(item, node)}
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
          className={`${leafBuckets.length > 0 ? "border-l-2 border-blue-100 " : ""}bg-blue-50/50 px-2 py-1.5 text-center text-[13px] font-medium text-slate-700`}
        >
          {formatValueWithSymbol(totalPlan, item.valueSymbol, item.valueSymbolPosition)}
        </td>
        <td className="bg-blue-50/50 px-2 py-1.5 text-center text-[13px] font-semibold text-slate-900">
          {item.hasChildren ? (
            <span>
              {formatValueWithSymbol(totalActual, item.valueSymbol, item.valueSymbolPosition)}
            </span>
          ) : (
            renderLeafActualEditor(item)
          )}
        </td>
        <td className="bg-blue-50/50 px-2 py-1.5 text-center">
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-semibold ${getPercentBadgeClass(totalPercent)}`}
          >
            {totalPercent}%
          </span>
        </td>
      </tr>
    );
  };

  return (
    <>
      <PageMeta title="KPI | HRMS" description="Управление KPI по должностям" />

      <div className="-mx-3 md:-mx-4 -mt-3 md:-mt-4">
        <div
          className="px-4 lg:px-6 py-2"
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
          <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
            {KPI_PERIOD_TABS.map((tab) => {
              const isActive = periodMode === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setPeriodMode(tab.key)}
                  className={`h-9 rounded-xl px-4 text-sm font-semibold transition ${
                    isActive
                      ? "bg-white text-brand-500 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="ml-auto flex min-w-0 items-center justify-end gap-2 flex-wrap">
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
              className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition ${
                isFilterButtonActive
                  ? "border-blue-200 bg-blue-50 text-blue-600"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <SlidersHorizontal size={16} />
              Фильтр{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ""}
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

        <div className="px-4 lg:px-6 py-5">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="px-4 py-4">
              {isLoading ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center">
                  <p className="m-0 text-[13px] text-slate-500">Загрузка KPI...</p>
                </div>
              ) : kpiItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center">
                  <p className="m-0 text-[13px] text-slate-500">KPI не найдены</p>
                </div>
              ) : (
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
                          className="py-2 pr-3 text-left text-[12px] font-semibold text-slate-500"
                        >
                          KPI / Название
                        </th>
                        <th rowSpan={2} className="py-2 pr-3 text-[12px] font-semibold text-slate-500">
                          Источник
                        </th>
                        <th rowSpan={2} className="py-2 pr-3 text-[12px] font-semibold text-slate-500">
                          Тип
                        </th>
                        <th rowSpan={2} className="py-2 pr-3 text-[12px] font-semibold text-slate-500">
                          Период
                        </th>
                        {leafBuckets.map((leaf) => {
                          const isExpanded = leaf.toggleState === "expanded";
                          const bgClass = getBucketHeaderBgClass(leaf.bucketPeriodType);
                          return (
                            <th
                              key={leaf.key}
                              colSpan={3}
                              className={`px-2 py-2 text-center text-[12px] font-semibold text-slate-600 ${bgClass}`}
                            >
                              <span className="inline-flex items-center gap-1.5">
                                <span>{leaf.label}</span>
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
                          const bg = getBucketHeaderBgClass(leaf.bucketPeriodType);
                          return (
                            <Fragment key={`${leaf.key}-sub`}>
                              <th className={`px-1 py-1 text-center text-[11px] font-semibold text-slate-500 ${bg}`}>
                                План
                              </th>
                              <th className={`px-1 py-1 text-center text-[11px] font-semibold text-slate-500 ${bg}`}>
                                Факт
                              </th>
                              <th className={`px-1 py-1 text-center text-[11px] font-semibold text-slate-500 ${bg}`}>
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
                      {groupedItems.map(([position, items]) => (
                        <Fragment key={`group-${position}`}>
                          <tr className="border-b border-slate-100 bg-slate-50/60">
                            <td className="py-1.5 pl-3 pr-3" />
                            <td
                              colSpan={4 + leafBuckets.length * 3 + 3}
                              className="py-1.5 pr-3 text-left text-[13px] font-semibold text-brand-500"
                            >
                              {position}
                            </td>
                          </tr>
                          {items.map((item) => renderRow(item))}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
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
                  <span className="text-xs font-medium text-slate-500">Источник</span>
                  <input
                    type="text"
                    value={draft.source}
                    onChange={(event) => setDraft((prev) => ({ ...prev, source: event.target.value }))}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                    placeholder="Вручную"
                  />
                </label>
              </div>

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
                          const defaults = computeChildDefaults(prev.name, prev.planValue, slots.length);
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
                                <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[12px] font-semibold text-blue-600">
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
        className="w-[160px] p-1"
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
