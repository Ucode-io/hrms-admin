import {
  type ChangeEvent,
  type ReactNode,
  type UIEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Icon } from "@iconify/react";
import { Check, ChevronLeft, ChevronRight, Clock3, Loader2, Plus, SlidersHorizontal, X } from "lucide-react";
import { Link } from "react-router";
import { useQueryClient } from "react-query";
import { toast } from "sonner";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import ExpandableSearchInput from "../../components/form/ExpandableSearchInput";
import AbsenceRequestModal from "../../components/absences/AbsenceRequestModal";
import { useHeaderBreadcrumbItems } from "../../context/HeaderBreadcrumbContext";
import {
  type Absence,
  type AbsenceRequestStatus,
  useApproveAbsence,
  useCalendarAbsencesQuery,
  useCreateAbsence,
  useUpdateAbsence,
} from "../../api/services/absenceRequest.service";
import {
  type CalendarAttendanceRow,
  useCalendarAttendanceQuery,
} from "../../api/services/attendanceCalendar.service";
import {
  dedupeAttendanceByPriority,
  getAttendanceSourceKind,
} from "../../utils/attendanceSourcePriority";
import Select, { type StylesConfig } from "react-select";
import { type Employee, useEmployeesQuery } from "../../api/services/employee.service";
import { usePositionsQuery } from "../../api/services/position.service";
import { useDepartmentsSettingsQuery } from "../../api/services/department.service";
import { useSettingsDirectoryQuery } from "../../api/services/settingsDirectory.service";
import { useEmployeeAbsenceSummaryQuery } from "../../api/services/employeeAbsenceSummary.service";
import { useUploadFile } from "../../api/services/file-upload.service";

const PAGE_SIZE = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

type FilterOption = { value: string; label: string };

// Matches the /finance/salary filter selects.
const filterSelectStyles: StylesConfig<FilterOption, true> = {
  control: (base: any, state: any) => ({
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
  valueContainer: (base: any) => ({ ...base, padding: "0 10px" }),
  indicatorsContainer: (base: any, state: any) => ({
    ...base,
    color: state.hasValue ? "var(--company-color)" : "#64748b",
  }),
  dropdownIndicator: (base: any, state: any) => ({
    ...base,
    color: state.hasValue ? "var(--company-color)" : "#64748b",
    padding: 6,
    "&:hover": { color: state.hasValue ? "var(--color-brand-700)" : "#475569" },
  }),
  clearIndicator: (base: any) => ({
    ...base,
    color: "#64748b",
    padding: 6,
    "&:hover": { color: "#475569" },
  }),
  indicatorSeparator: () => ({ display: "none" }),
  placeholder: (base: any) => ({ ...base, color: "#94a3b8", fontSize: 14 }),
  input: (base: any) => ({ ...base, color: "#1e293b", fontSize: 14, margin: 0, padding: 0 }),
  multiValue: (base: any) => ({ ...base, backgroundColor: "var(--color-brand-100)", borderRadius: 8 }),
  multiValueLabel: (base: any) => ({ ...base, color: "var(--color-brand-700)", fontSize: 13, fontWeight: 600 }),
  multiValueRemove: (base: any) => ({
    ...base,
    color: "var(--color-brand-700)",
    borderRadius: 8,
    "&:hover": { backgroundColor: "var(--color-brand-200)", color: "var(--color-brand-900)" },
  }),
  menu: (base: any) => ({ ...base, borderRadius: 10, overflow: "hidden", zIndex: 9999 }),
  menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
  option: (base: any, state: any) => ({
    ...base,
    backgroundColor: state.isSelected ? "var(--color-brand-100)" : state.isFocused ? "#f8fafc" : "#fff",
    color: state.isSelected ? "var(--color-brand-700)" : "#1e293b",
    fontSize: 14,
    padding: "8px 12px",
  }),
  noOptionsMessage: (base: any) => ({ ...base, color: "#64748b", fontSize: 13 }),
};
const WEEKDAY_SHORT_RU = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const MONTH_NAMES_RU = [
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
const MONTH_SHORT_RU = [
  "янв.",
  "фев.",
  "мар.",
  "апр.",
  "май",
  "июн.",
  "июл.",
  "авг.",
  "сен.",
  "окт.",
  "ноя.",
  "дек.",
];
const ABSENCE_POLICIES_SLUG = "absence_policies";
const MAX_ATTACHMENTS = 10;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

type DayColumn = {
  dateKey: string;
  dayNumber: number;
  weekdayShort: string;
  isWeekend: boolean;
};

type NormalizedAbsence = {
  guid: string;
  userBaseId: string;
  absencePolicyId: string;
  title: string;
  color: string;
  icon: string;
  status: "pending" | "approved" | "rejected";
  dateFrom: string;
  dateTo: string;
  requestedDays: number;
};

type Segment = {
  key: string;
  guid: string;
  userBaseId: string;
  absencePolicyId: string;
  requestedDays: number;
  startIndex: number;
  endIndex: number;
  title: string;
  color: string;
  icon: string;
  status: "pending" | "approved" | "rejected";
  dateFrom: string;
  dateTo: string;
};

type SelectedAbsence = NormalizedAbsence & {
  employeeName: string;
  anchorRect?: { left: number; top: number; right: number; bottom: number; width: number };
};

type AttachmentItem = {
  name: string;
  size: number;
  url: string;
};

const getDateOnlyValue = (value: unknown): string => {
  if (typeof value !== "string") return "";
  const match = value.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "";
};

const parseIsoDate = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
};

const toIsoDate = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isHexColor = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value.trim());

const withOpacity = (hexColor: string, alpha: number): string => {
  const normalized = hexColor.replace("#", "");
  const numeric = Number.parseInt(normalized, 16);
  const red = (numeric >> 16) & 255;
  const green = (numeric >> 8) & 255;
  const blue = numeric & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const resolveStatus = (value: unknown): "pending" | "approved" | "rejected" => {
  if (Array.isArray(value)) {
    const first = value[0];
    if (first === "pending" || first === "approved" || first === "rejected") {
      return first;
    }
    return "pending";
  }

  if (value === "pending" || value === "approved" || value === "rejected") {
    return value;
  }

  return "pending";
};

const resolveAbsenceColor = (rawColor: unknown, status: "pending" | "approved" | "rejected"): string => {
  if (isHexColor(rawColor)) return rawColor.trim();

  if (status === "pending") return "#F59E0B";
  if (status === "rejected") return "#EF4444";
  return "#14B8A6";
};

const formatMonthLabel = (value: Date): string => {
  const monthName = MONTH_NAMES_RU[value.getMonth()] || "";
  return `${monthName} ${value.getFullYear()}`;
};

const buildMonthDays = (monthDate: Date): DayColumn[] => {
  const year = monthDate.getFullYear();
  const monthIndex = monthDate.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  return Array.from({ length: daysInMonth }, (_, index) => {
    const dayNumber = index + 1;
    const date = new Date(year, monthIndex, dayNumber);
    const weekdayIndex = date.getDay();

    return {
      dateKey: toIsoDate(date),
      dayNumber,
      weekdayShort: WEEKDAY_SHORT_RU[weekdayIndex] || "",
      isWeekend: weekdayIndex === 0 || weekdayIndex === 6,
    };
  });
};

const dayDiffFromStart = (monthStart: Date, isoDate: string): number => {
  const date = parseIsoDate(isoDate);
  if (!date) return -1;
  return Math.floor((date.getTime() - monthStart.getTime()) / DAY_MS);
};

const resolveNumericValue = (value: unknown, fallback: number): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const countDaysInclusive = (from: string, to: string): number => {
  const start = parseIsoDate(from);
  const end = parseIsoDate(to);
  if (!start || !end || start > end) return 0;
  return Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
};

const getDateBreakdown = (
  from: string,
  to: string
): Array<{
  iso: string;
  day: string;
  month: string;
  weekday: string;
  isWeekend: boolean;
  value: number;
}> => {
  const start = parseIsoDate(from);
  const end = parseIsoDate(to);
  if (!start || !end || start > end) return [];

  const list: Array<{
    iso: string;
    day: string;
    month: string;
    weekday: string;
    isWeekend: boolean;
    value: number;
  }> = [];
  const cursor = new Date(start);
  let guard = 0;

  while (cursor <= end && guard < 400) {
    const dayOfWeek = cursor.getDay();
    list.push({
      iso: toIsoDate(cursor),
      day: String(cursor.getDate()),
      month: MONTH_SHORT_RU[cursor.getMonth()],
      weekday: WEEKDAY_SHORT_RU[dayOfWeek] || "",
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      value: 1,
    });
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }

  return list;
};

const formatDateRu = (value: string): string => {
  const date = parseIsoDate(value);
  if (!date) return value || "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()}`;
};

const STATUS_LABELS: Record<AbsenceRequestStatus, string> = {
  pending: "Ожидает",
  approved: "Подтвержден",
  rejected: "Отклонен",
};

const STATUS_BADGE_CLASSNAME: Record<AbsenceRequestStatus, string> = {
  pending: "bg-gray-100 text-gray-600",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
};

const buildEmployeeSubtitle = (employee: Employee): string => {
  const positionTitle = employee.positions_id_data?.title || "";
  const levelTitle = employee.experience_levels_id_data?.title || "";
  const departmentTitle = employee.departments_id_data?.title || "";
  return [positionTitle, levelTitle, departmentTitle].filter(Boolean).join(" ");
};

const buildEmployeeName = (employee: Employee): string => {
  const fullName = [employee.second_name, employee.first_name, employee.middle_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (fullName) return fullName;
  return employee.email || employee.phone || "Сотрудник";
};

const buildInitials = (employee: Employee): string => {
  const first = employee.first_name?.charAt(0) || "";
  const second = employee.second_name?.charAt(0) || "";
  const combined = `${second}${first}`.trim();
  return combined || "U";
};

const normalizeAbsence = (
  item: Absence,
  policyById: Map<string, { title: string; icon: string; color: string; value?: number | string }>
): NormalizedAbsence | null => {
  const userBaseId = typeof item.user_base_id === "string" ? item.user_base_id : "";
  const dateFrom = getDateOnlyValue(item.date_from);
  const dateTo = getDateOnlyValue(item.date_to) || dateFrom;
  const status = resolveStatus(item.status);
  const policyId = typeof item.absence_policies_id === "string" ? item.absence_policies_id : "";

  if (!userBaseId || !dateFrom || !dateTo) return null;
  if (status === "rejected") return null;

  const relationTitle =
    item.absence_policies_id_data && typeof item.absence_policies_id_data.title === "string"
      ? item.absence_policies_id_data.title
      : "";

  const relationIcon =
    item.absence_policies_id_data && typeof item.absence_policies_id_data.icon === "string"
      ? item.absence_policies_id_data.icon
      : "";

  const relationColor = item.absence_policies_id_data?.color;
  const aggregatedTitle = typeof item.absence_policy_title === "string" ? item.absence_policy_title : "";
  const aggregatedIcon = typeof item.absence_policy_icon === "string" ? item.absence_policy_icon : "";
  const aggregatedColor = item.absence_policy_color;
  const policy = policyById.get(policyId);
  const requestedDaysFromApi = resolveNumericValue(item.requested_days, 0);
  const requestedDays = requestedDaysFromApi > 0 ? requestedDaysFromApi : countDaysInclusive(dateFrom, dateTo);

  return {
    guid: item.guid,
    userBaseId,
    absencePolicyId: policyId,
    title: relationTitle || aggregatedTitle || policy?.title || "Отсутствие",
    color: resolveAbsenceColor(relationColor || aggregatedColor || policy?.color, status),
    icon: relationIcon || aggregatedIcon || policy?.icon || "mdi:airplane",
    status,
    dateFrom,
    dateTo,
    requestedDays,
  };
};

type AttendanceDotKind = "present" | "late" | "absent";

// Base brand colour per attendance type. Pill uses this colour for the icon
// and as a low-opacity background, matching the visual language of absence
// segments (e.g. "Vocation" cell).
const ATTENDANCE_PILL_COLOR: Record<AttendanceDotKind, string> = {
  present: "#10B981",
  late: "#F59E0B",
  absent: "#EF4444",
};

const ATTENDANCE_CELL_BG: Record<AttendanceDotKind, string> = {
  present: "#D1FAE5",
  late: "#FEF3C7",
  absent: "#FEE2E2",
};

const ATTENDANCE_DOT_LABEL: Record<AttendanceDotKind, string> = {
  present: "Присутствует",
  late: "Опоздание",
  absent: "Отсутствует",
};

const AttendanceIcon = ({ kind, className }: { kind: AttendanceDotKind; className?: string }) => {
  if (kind === "late") return <Clock3 className={className} />;
  if (kind === "absent") return <X className={className} />;
  return <Check className={className} />;
};

type AttendanceCellInfo = {
  kind: AttendanceDotKind;
  guid: string;
  checkInTime: string;
  checkOutTime: string;
  delayTime: string;
  sourceLabel: string;
};

const normalizeAttendanceDotKind = (value: unknown): AttendanceDotKind | null => {
  const candidates: string[] = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string") candidates.push(item.trim().toLowerCase());
    }
  } else if (typeof value === "string") {
    candidates.push(value.trim().toLowerCase());
  }
  if (candidates.includes("present")) return "present";
  if (candidates.includes("late")) return "late";
  if (candidates.includes("absent")) return "absent";
  return null;
};

type AttendanceClickPayload = AttendanceCellInfo & {
  dateKey: string;
  employeeGuid: string;
  anchorRect: { left: number; top: number; right: number; bottom: number; width: number };
};

const renderEmptyOrAttendanceCell = ({
  day,
  info,
  employeeGuid,
  onAttendanceClick,
  keyPrefix,
}: {
  day: DayColumn;
  info: AttendanceCellInfo | null;
  employeeGuid: string;
  onAttendanceClick: (payload: AttendanceClickPayload) => void;
  keyPrefix: string;
}): ReactNode => {
  if (!info) {
    return (
      <td
        key={`${keyPrefix}-${day.dateKey}`}
        className={`h-14 min-w-[44px] border-b border-r border-gray-100 ${
          day.isWeekend ? "bg-gray-50/70" : "bg-white"
        }`}
      />
    );
  }

  const pillColor = ATTENDANCE_PILL_COLOR[info.kind];
  const pillBg = ATTENDANCE_CELL_BG[info.kind];
  const tooltip = ATTENDANCE_DOT_LABEL[info.kind];

  return (
    <td
      key={`${keyPrefix}-${day.dateKey}`}
      className={`h-14 min-w-[44px] border-b border-r border-gray-100 px-1 ${
        day.isWeekend ? "bg-gray-50/70" : "bg-white"
      }`}
      title={tooltip}
    >
      <button
        type="button"
        aria-label={tooltip}
        title={tooltip}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          onAttendanceClick({
            ...info,
            dateKey: day.dateKey,
            employeeGuid,
            anchorRect: {
              left: rect.left,
              top: rect.top,
              right: rect.right,
              bottom: rect.bottom,
              width: rect.width,
            },
          });
        }}
        className="flex h-8 w-full cursor-pointer items-center justify-center rounded-md text-[12px] font-semibold transition hover:ring-2 hover:ring-brand-500/20"
        style={{ color: pillColor, backgroundColor: pillBg }}
      >
        <AttendanceIcon kind={info.kind} className="h-[18px] w-[18px]" />
      </button>
    </td>
  );
};

const buildTimelineCells = ({
  absences,
  attendanceByDate,
  days,
  monthStart,
  employeeGuid,
  onSegmentClick,
  onAttendanceClick,
}: {
  absences: NormalizedAbsence[];
  attendanceByDate: Map<string, AttendanceCellInfo>;
  days: DayColumn[];
  monthStart: Date;
  employeeGuid: string;
  onSegmentClick: (
    absence: Segment,
    anchorRect: { left: number; top: number; right: number; bottom: number; width: number }
  ) => void;
  onAttendanceClick: (payload: AttendanceClickPayload) => void;
}): ReactNode[] => {
  const lastDayIndex = days.length - 1;
  const segments: Segment[] = absences
    .map((absence) => {
      const rawStart = dayDiffFromStart(monthStart, absence.dateFrom);
      const rawEnd = dayDiffFromStart(monthStart, absence.dateTo);
      const startIndex = Math.max(0, rawStart);
      const endIndex = Math.min(lastDayIndex, rawEnd);

      if (rawEnd < 0 || rawStart > lastDayIndex || startIndex > endIndex) {
        return null;
      }

      return {
        key: absence.guid,
        guid: absence.guid,
        userBaseId: absence.userBaseId,
        absencePolicyId: absence.absencePolicyId,
        requestedDays: absence.requestedDays,
        startIndex,
        endIndex,
        title: absence.title,
        color: absence.color,
        icon: absence.icon,
        status: absence.status,
        dateFrom: absence.dateFrom,
        dateTo: absence.dateTo,
      };
    })
    .filter((segment): segment is Segment => Boolean(segment))
    .sort((first, second) => first.startIndex - second.startIndex);

  const cells: ReactNode[] = [];
  let cursor = 0;

  for (const segment of segments) {
    const startIndex = Math.max(segment.startIndex, cursor);
    const endIndex = segment.endIndex;

    if (startIndex > endIndex) continue;

    for (let dayIndex = cursor; dayIndex < startIndex; dayIndex += 1) {
      const day = days[dayIndex];
      const info = attendanceByDate.get(day.dateKey) || null;
      cells.push(
        renderEmptyOrAttendanceCell({
          day,
          info,
          employeeGuid,
          onAttendanceClick,
          keyPrefix: "empty",
        })
      );
    }

    const span = endIndex - startIndex + 1;
    const segmentColor = segment.color;
    const isPending = segment.status === "pending";
    const isOneDayAbsence = segment.dateFrom === segment.dateTo;
    const showIconOnly = isOneDayAbsence || span === 1;
    const isRejected = segment.status === "rejected";
    const canReview = segment.status === "pending";
    const segmentLabel = `${segment.title} • ${segment.dateFrom} - ${segment.dateTo}${
      isPending ? " • ожидает согласования" : ""
    }`;

    cells.push(
      <td
        key={`segment-${segment.key}-${startIndex}`}
        colSpan={span}
        className="h-14 min-w-[44px] border-b border-r border-gray-100 bg-white px-1"
        title={segmentLabel}
      >
        <button
          type="button"
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            onSegmentClick(segment, {
              left: rect.left,
              top: rect.top,
              right: rect.right,
              bottom: rect.bottom,
              width: rect.width,
            });
          }}
          className={`flex h-8 w-full rounded-md text-[12px] font-semibold ${
            canReview ? "cursor-pointer" : "cursor-default"
          } ${showIconOnly ? "items-center justify-center px-0" : "items-center gap-1 px-2"} ${
            isPending ? "border border-dashed" : ""
          } ${canReview ? "transition hover:ring-2 hover:ring-brand-500/20" : ""}`}
          aria-label={`Отсутствие: ${segment.title}`}
          title={segmentLabel}
          style={{
            color: isPending ? "#4B5563" : segmentColor,
            backgroundColor: isPending ? "#F3F4F6" : withOpacity(segmentColor, 0.17),
            borderColor: isPending ? "#D1D5DB" : "transparent",
            backgroundImage: "none",
          }}
        >
          {isPending && !showIconOnly ? <Clock3 size={13} className="shrink-0" /> : null}
          <Icon
            icon={segment.icon}
            className={`shrink-0 ${showIconOnly ? "h-[18px] w-[18px]" : "h-4 w-4"}`}
          />
          {!showIconOnly ? <span className="truncate">{segment.title}</span> : null}
          {isRejected && !showIconOnly ? <span className="ml-1 text-[10px] font-medium">• отклонен</span> : null}
        </button>
      </td>
    );

    cursor = endIndex + 1;
  }

  for (let dayIndex = cursor; dayIndex < days.length; dayIndex += 1) {
    const day = days[dayIndex];
    const info = attendanceByDate.get(day.dateKey) || null;
    cells.push(
      renderEmptyOrAttendanceCell({
        day,
        info,
        employeeGuid,
        onAttendanceClick,
        keyPrefix: "tail",
      })
    );
  }

  return cells;
};

export default function CalendarModule({ leftSlot }: { leftSlot?: ReactNode } = {}) {
  const queryClient = useQueryClient();
  const [employeesPage, setEmployeesPage] = useState(1);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedPositionIds, setSelectedPositionIds] = useState<string[]>([]);
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([]);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createEmployeeId, setCreateEmployeeId] = useState("");
  const [createPolicyId, setCreatePolicyId] = useState("");
  const [createDateFrom, setCreateDateFrom] = useState("");
  const [createDateTo, setCreateDateTo] = useState("");
  const [createNote, setCreateNote] = useState("");
  const [createAttachments, setCreateAttachments] = useState<AttachmentItem[]>([]);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [selectedAbsence, setSelectedAbsence] = useState<SelectedAbsence | null>(null);
  const [selectedAttendance, setSelectedAttendance] = useState<
    (AttendanceClickPayload & { employeeName: string }) | null
  >(null);
  const [reviewStatusInProgress, setReviewStatusInProgress] = useState<AbsenceRequestStatus | null>(null);
  const breadcrumbItems = useMemo(
    () => [
      { label: "Время", to: "/time/attendance" },
      { label: "Отсутствие", to: "/calendar" },
    ],
    []
  );
  useHeaderBreadcrumbItems(breadcrumbItems);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const updateAbsenceMutation = useUpdateAbsence();
  const approveAbsenceMutation = useApproveAbsence();
  const createAbsenceMutation = useCreateAbsence();
  const uploadFileMutation = useUploadFile({ folder: "Media" });
  const todayIso = useMemo(() => toIsoDate(new Date()), []);
  const isNextPageRequestedRef = useRef(false);
  const lastKnownTotalCountRef = useRef(0);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const nextSearch = searchValue.trim();
      setDebouncedSearch((prevSearch) => {
        if (prevSearch === nextSearch) return prevSearch;

        setEmployeesPage(1);
        setEmployees([]);
        isNextPageRequestedRef.current = false;
        lastKnownTotalCountRef.current = 0;
        return nextSearch;
      });
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchValue]);

  const monthDays = useMemo(() => buildMonthDays(currentMonth), [currentMonth]);
  const monthStartIso = monthDays[0]?.dateKey || "";
  const monthEndIso = monthDays[monthDays.length - 1]?.dateKey || "";

  const {
    data: employeesData,
    isLoading: isEmployeesLoading,
    isFetching: isEmployeesFetching,
  } = useEmployeesQuery({
    limit: PAGE_SIZE,
    offset: (employeesPage - 1) * PAGE_SIZE,
    search: debouncedSearch || undefined,
    status: "active",
    positions_id: selectedPositionIds.length > 0 ? selectedPositionIds : undefined,
    departments_id: selectedDepartmentIds.length > 0 ? selectedDepartmentIds : undefined,
  });

  // Reset the paginated employee list whenever the position/department filters
  // change, mirroring the search reset so pages don't mix filtered/unfiltered data.
  const isFirstFilterRun = useRef(true);
  useEffect(() => {
    if (isFirstFilterRun.current) {
      isFirstFilterRun.current = false;
      return;
    }
    setEmployeesPage(1);
    setEmployees([]);
    isNextPageRequestedRef.current = false;
    lastKnownTotalCountRef.current = 0;
  }, [selectedPositionIds, selectedDepartmentIds]);

  const { data: positionsData } = usePositionsQuery({ params: { all: true } });
  const positionFilterOptions = useMemo(
    () =>
      (positionsData?.response ?? [])
        .filter((item) => item?.guid && item?.title)
        .map((item) => ({ value: item.guid, label: item.title })),
    [positionsData?.response]
  );

  const { data: departmentsData } = useDepartmentsSettingsQuery({
    params: { limit: 1000 },
  });
  const departmentFilterOptions = useMemo(
    () =>
      (departmentsData?.response ?? [])
        .filter((item) => item?.guid && item?.title)
        .map((item) => ({ value: item.guid, label: item.title })),
    [departmentsData?.response]
  );

  const activeFiltersCount =
    (selectedDepartmentIds.length > 0 ? 1 : 0) + (selectedPositionIds.length > 0 ? 1 : 0);
  const isFilterButtonActive = isFiltersOpen || activeFiltersCount > 0;
  const selectPortalTarget = typeof document !== "undefined" ? document.body : null;

  const employeesChunk = useMemo(() => {
    return ((employeesData?.response || []) as Employee[]).filter(
      (employee) => typeof employee.guid === "string" && Boolean(employee.guid)
    );
  }, [employeesData?.response]);

  useEffect(() => {
    if (!employeesData) return;

    setEmployees((prev) => {
      if (employeesPage === 1) return employeesChunk;

      const existingIds = new Set(prev.map((item) => item.guid));
      const merged = [...prev];
      for (const employee of employeesChunk) {
        if (existingIds.has(employee.guid)) continue;
        merged.push(employee);
        existingIds.add(employee.guid);
      }
      return merged;
    });
  }, [employeesData, employeesChunk, employeesPage]);

  const employeeIds = useMemo(() => employees.map((employee) => employee.guid), [employees]);
  const employeesWithHikvisionId = useMemo(
    () =>
      new Set(
        employees
          .filter(
            (employee) =>
              typeof employee.hikvision_id === "string" &&
              Boolean(employee.hikvision_id.trim())
          )
          .map((employee) => employee.guid)
      ),
    [employees]
  );

  const { data: policiesData } = useSettingsDirectoryQuery({
    slug: ABSENCE_POLICIES_SLUG,
    params: {
      limit: 1000,
      offset: 0,
    },
  });

  const policiesById = useMemo(() => {
    const map = new Map<string, { title: string; icon: string; color: string; value?: number | string }>();
    const source = Array.isArray(policiesData?.response) ? policiesData.response : [];

    for (const item of source) {
      const guid = typeof item.guid === "string" ? item.guid : "";
      if (!guid) continue;

      const title = typeof item.title === "string" ? item.title : "";
      const icon = typeof item.icon === "string" ? item.icon : "mdi:airplane";
      const color = isHexColor(item.color) ? item.color : "#14B8A6";
      map.set(guid, {
        title,
        icon,
        color,
        value: typeof item.value === "number" || typeof item.value === "string" ? item.value : undefined,
      });
    }

    return map;
  }, [policiesData?.response]);

  const policyOptions = useMemo(() => {
    const source = Array.isArray(policiesData?.response) ? policiesData.response : [];
    return source
      .map((item) => {
        const guid = typeof item.guid === "string" ? item.guid : "";
        const title = typeof item.title === "string" ? item.title : "";
        if (!guid || !title) return null;
        return { guid, title };
      })
      .filter((item): item is { guid: string; title: string } => Boolean(item));
  }, [policiesData?.response]);

  const { data: createEmployeeSummary } = useEmployeeAbsenceSummaryQuery({
    userBaseId: createEmployeeId,
    asOfDate: todayIso,
    querySettings: {
      enabled: Boolean(createEmployeeId) && isCreateModalOpen,
    },
  });

  const { data: absencesData, isLoading: isAbsencesLoading } = useCalendarAbsencesQuery({
    params: {
      employeeIds,
      dateFrom: monthStartIso,
      dateTo: monthEndIso,
    },
    querySettings: {
      enabled: employeeIds.length > 0 && Boolean(monthStartIso) && Boolean(monthEndIso),
      keepPreviousData: true,
    },
  });

  const normalizedAbsences = useMemo(() => {
    const source = (absencesData?.response || []) as Absence[];
    return source
      .map((item) => normalizeAbsence(item, policiesById))
      .filter((absence): absence is NormalizedAbsence => Boolean(absence));
  }, [absencesData?.response, policiesById]);

  const { data: attendanceData } = useCalendarAttendanceQuery({
    params: {
      employeeIds,
      dateFrom: monthStartIso,
      dateTo: monthEndIso,
    },
    querySettings: {
      enabled: employeeIds.length > 0 && Boolean(monthStartIso) && Boolean(monthEndIso),
      keepPreviousData: true,
    },
  });

  // Map<userBaseId, Map<dateKey, AttendanceCellInfo>> with priority-based dedup
  // (absences > manual > integration) applied per (user, date). Absences-source
  // rows are skipped — those days are already drawn as coloured absence segments.
  const attendanceByEmployee = useMemo(() => {
    const rows = (attendanceData?.response || []) as CalendarAttendanceRow[];
    const deduped = dedupeAttendanceByPriority(rows);
    const map = new Map<string, Map<string, AttendanceCellInfo>>();

    for (const row of deduped) {
      const userId = typeof row.user_base_id === "string" ? row.user_base_id : "";
      const dateKey =
        typeof row.date === "string" ? row.date.slice(0, 10) : "";
      if (!userId || !dateKey) continue;

      const sourceKind = getAttendanceSourceKind(row.source_type);
      if (sourceKind === "absences") continue;

      const kind = normalizeAttendanceDotKind(row.action_status);
      if (!kind) continue;

      const sourceLabel =
        sourceKind === "manual"
          ? "HRMS"
          : sourceKind === "integration"
            ? employeesWithHikvisionId.has(userId)
              ? "Hikvision"
              : "QuadraSoft"
            : "Источник не указан";

      const info: AttendanceCellInfo = {
        kind,
        guid: row.guid,
        checkInTime: typeof row.check_in_time === "string" ? row.check_in_time : "",
        checkOutTime:
          typeof row.check_out_time === "string" ? row.check_out_time : "",
        delayTime: typeof row.delay_time === "string" ? row.delay_time : "",
        sourceLabel,
      };

      let userMap = map.get(userId);
      if (!userMap) {
        userMap = new Map();
        map.set(userId, userMap);
      }
      userMap.set(dateKey, info);
    }

    return map;
  }, [attendanceData?.response, employeesWithHikvisionId]);

  if (typeof employeesData?.count === "number" && Number.isFinite(employeesData.count)) {
    lastKnownTotalCountRef.current = employeesData.count;
  }

  const totalCount = employeesData?.count ?? lastKnownTotalCountRef.current;
  const hasMoreEmployees = employees.length < totalCount;
  const isInitialEmployeesLoading = isEmployeesLoading && employees.length === 0;
  // useEmployeesQuery uses keepPreviousData, so paginating keeps isLoading false
  // and only flips isFetching. Drive the "load more" indicator off isFetching so
  // it actually shows while the next page streams in.
  const isLoadingMoreEmployees = isEmployeesFetching && employees.length > 0;
  const isInitialLoading = (isInitialEmployeesLoading || isAbsencesLoading) && employees.length === 0;

  useEffect(() => {
    if (!isEmployeesFetching) {
      isNextPageRequestedRef.current = false;
    }
  }, [isEmployeesFetching]);

  const handleEmployeesScroll = (event: UIEvent<HTMLDivElement>) => {
    if (isInitialEmployeesLoading) return;
    if (!hasMoreEmployees) return;
    if (isNextPageRequestedRef.current) return;

    const container = event.currentTarget;
    const reachedBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 120;
    if (!reachedBottom) return;

    isNextPageRequestedRef.current = true;
    setEmployeesPage((prev) => prev + 1);
  };

  const visibleEmployeeIds = useMemo(() => {
    return new Set(employees.map((employee) => employee.guid));
  }, [employees]);

  const absencesByEmployee = useMemo(() => {
    const map = new Map<string, NormalizedAbsence[]>();

    for (const absence of normalizedAbsences) {
      if (!visibleEmployeeIds.has(absence.userBaseId)) continue;
      if (monthStartIso && absence.dateTo < monthStartIso) continue;
      if (monthEndIso && absence.dateFrom > monthEndIso) continue;

      const list = map.get(absence.userBaseId) || [];
      list.push(absence);
      map.set(absence.userBaseId, list);
    }

    for (const [userBaseId, list] of map) {
      list.sort((first, second) => {
        if (first.dateFrom === second.dateFrom) return first.dateTo.localeCompare(second.dateTo);
        return first.dateFrom.localeCompare(second.dateFrom);
      });
      map.set(userBaseId, list);
    }

    return map;
  }, [monthEndIso, monthStartIso, normalizedAbsences, visibleEmployeeIds]);

  const monthLabel = useMemo(() => formatMonthLabel(currentMonth), [currentMonth]);
  const isLoading = isInitialLoading;
  const companyMainColor = "var(--color-brand-500)";
  const isReviewing = updateAbsenceMutation.isLoading || approveAbsenceMutation.isLoading;
  const createBreakdown = useMemo(() => getDateBreakdown(createDateFrom, createDateTo), [createDateFrom, createDateTo]);
  const createRequestedDays = createBreakdown.length;

  const createAvailableDays = useMemo(() => {
    if (!createPolicyId || !createEmployeeSummary) return 0;
    const policy = createEmployeeSummary.policies.find(
      (item) => item.guid === createPolicyId
    );
    return policy ? policy.available : 0;
  }, [createEmployeeSummary, createPolicyId]);

  const createForecastDays = createAvailableDays - createRequestedDays;
  const selectedCreateEmployeeName = useMemo(() => {
    if (!createEmployeeId) return "";
    const employee = employees.find((item) => item.guid === createEmployeeId);
    return employee ? buildEmployeeName(employee) : "";
  }, [createEmployeeId, employees]);

  const closeReviewModal = () => {
    if (isReviewing) return;
    setSelectedAbsence(null);
    setReviewStatusInProgress(null);
  };

  const openCreateModal = () => {
    const fallbackEmployeeId = employees[0]?.guid || "";
    const fallbackPolicyId = policyOptions[0]?.guid || "";
    setCreateEmployeeId(fallbackEmployeeId);
    setCreatePolicyId(fallbackPolicyId);
    setCreateDateFrom(todayIso);
    setCreateDateTo(todayIso);
    setCreateNote("");
    setCreateAttachments([]);
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    if (createAbsenceMutation.isLoading || isUploadingAttachments) return;
    setIsCreateModalOpen(false);
    setCreateNote("");
    setCreateAttachments([]);
  };

  const handleCreateDateFromChange = (value: string) => {
    setCreateDateFrom(value);
    if (createDateTo && value && createDateTo < value) {
      setCreateDateTo(value);
    }
  };

  const handleAttachmentFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    event.target.value = "";
    if (!files || files.length === 0) return;

    const remainingSlots = MAX_ATTACHMENTS - createAttachments.length;
    if (remainingSlots <= 0) {
      toast.error(`Можно добавить максимум ${MAX_ATTACHMENTS} файлов.`);
      return;
    }

    const queue = Array.from(files).slice(0, remainingSlots);
    const rejectedBySize = queue.filter((file) => file.size > MAX_FILE_SIZE_BYTES);
    if (rejectedBySize.length > 0) {
      toast.error("Размер каждого файла должен быть не больше 50MB.");
    }

    const accepted = queue.filter((file) => file.size <= MAX_FILE_SIZE_BYTES);
    if (accepted.length === 0) return;

    try {
      setIsUploadingAttachments(true);
      const uploadedItems: AttachmentItem[] = [];
      for (const file of accepted) {
        const url = await uploadFileMutation.mutateAsync(file);
        uploadedItems.push({
          name: file.name,
          size: file.size,
          url,
        });
      }
      setCreateAttachments((prev) => [...prev, ...uploadedItems]);
      toast.success("Файлы успешно загружены.");
    } catch (error) {
      console.error("Failed to upload calendar absence attachments:", error);
      toast.error("Не удалось загрузить вложения.");
    } finally {
      setIsUploadingAttachments(false);
    }
  };

  const removeAttachment = (url: string) => {
    setCreateAttachments((prev) => prev.filter((item) => item.url !== url));
  };

  const submitCreateRequest = async () => {
    if (!createEmployeeId) {
      toast.error("Выберите сотрудника.");
      return;
    }

    if (!createPolicyId) {
      toast.error("Выберите тип отсутствия.");
      return;
    }

    if (!createDateFrom || !createDateTo) {
      toast.error("Укажите диапазон дат.");
      return;
    }

    if (createDateFrom > createDateTo) {
      toast.error("Дата начала не может быть позже даты окончания.");
      return;
    }

    if (createRequestedDays <= 0) {
      toast.error("В запросе должен быть хотя бы один день.");
      return;
    }

    try {
      await createAbsenceMutation.mutateAsync({
        user_base_id: createEmployeeId,
        absence_policies_id: createPolicyId,
        date_from: createDateFrom,
        date_to: createDateTo,
        requested_days: createRequestedDays,
        requested_breakdown: JSON.stringify(
          createBreakdown.map((item) => ({
            date: item.iso,
            value: item.value,
          }))
        ),
        note: createNote.trim() || null,
        attachments: JSON.stringify(createAttachments.map((item) => item.url)),
        status: ["pending"],
      });

      await queryClient.invalidateQueries(["calendar-absences"]);
      await queryClient.invalidateQueries(["employee-absence-summary"]);
      toast.success("Запрос на отсутствие создан.");
      closeCreateModal();
    } catch (error) {
      console.error("Failed to create absence from calendar:", error);
      toast.error("Не удалось создать запрос.");
    }
  };

  const handleReviewAbsence = async (status: AbsenceRequestStatus) => {
    if (!selectedAbsence) return;
    if (selectedAbsence.status !== "pending") {
      toast.info("Эта заявка уже обработана.");
      return;
    }

    try {
      setReviewStatusInProgress(status);
      if (status === "approved") {
        await approveAbsenceMutation.mutateAsync({ guid: selectedAbsence.guid });
      } else {
        await updateAbsenceMutation.mutateAsync({
          guid: selectedAbsence.guid,
          data: {
            status: [status],
            reviewed_at: new Date().toISOString(),
          },
        });
      }

      await queryClient.invalidateQueries(["calendar-absences"]);
      await queryClient.invalidateQueries(["employee-absence-summary"]);

      toast.success(status === "approved" ? "Запрос подтвержден." : "Запрос отклонен.");
      closeReviewModal();
    } catch (error) {
      console.error("Failed to review absence from calendar:", error);
      toast.error("Не удалось изменить статус запроса.");
    } finally {
      setReviewStatusInProgress(null);
    }
  };

  return (
    <>
      <PageMeta title="Календарь | HRMS" description="Календарь отсутствий сотрудников" />

      <div className="-mx-3 md:-mx-4 -mt-3 md:-mt-4 flex h-[calc(100vh-88px)] min-h-0 flex-col">
        <div
          className="px-4 lg:px-6 py-2"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "10px",
            flexWrap: "wrap",
            backgroundColor: "#fff",
            border: "1px solid #e2e8f0",
            borderTop: "none",
          }}
        >
          {leftSlot}
          <div className="ml-auto flex min-w-0 items-center gap-2">
            <ExpandableSearchInput
              value={searchValue}
              onChange={setSearchValue}
              inputId="calendar-search"
              placeholder="Поиск сотрудника..."
              expandedWidth={320}
              collapsedSize={40}
              brandColor="var(--color-brand-500)"
            />

            <button
              type="button"
              onClick={() => setIsFiltersOpen((open) => !open)}
              aria-label={`Фильтр${activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ""}`}
              title={`Фильтр${activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ""}`}
              className={`relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${
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

            <Button
              className="h-10 shrink-0 rounded-xl px-3.5 text-sm whitespace-nowrap"
              startIcon={<Plus size={15} />}
              onClick={openCreateModal}
            >
              Запрос на отсутствие
            </Button>
          </div>
        </div>

        {isFiltersOpen ? (
          <div
            className="px-4 py-2 lg:px-6"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
              justifyContent: "flex-start",
              background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
              border: "1px solid #e2e8f0",
              borderTop: "1px solid #dbe4ee",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
            }}
          >
            <div style={{ minWidth: "200px", maxWidth: "280px", flex: "0 1 280px" }}>
              <Select<FilterOption, true>
                isMulti
                inputId="calendar-filter-department"
                options={departmentFilterOptions}
                value={departmentFilterOptions.filter((option) =>
                  selectedDepartmentIds.includes(option.value)
                )}
                onChange={(value) =>
                  setSelectedDepartmentIds(value.map((option) => option.value))
                }
                placeholder="Департамент"
                noOptionsMessage={() => "Ничего не найдено"}
                styles={filterSelectStyles}
                menuPortalTarget={selectPortalTarget}
                menuPosition="fixed"
              />
            </div>

            <div style={{ minWidth: "200px", maxWidth: "280px", flex: "0 1 280px" }}>
              <Select<FilterOption, true>
                isMulti
                inputId="calendar-filter-position"
                options={positionFilterOptions}
                value={positionFilterOptions.filter((option) =>
                  selectedPositionIds.includes(option.value)
                )}
                onChange={(value) =>
                  setSelectedPositionIds(value.map((option) => option.value))
                }
                placeholder="Должность"
                noOptionsMessage={() => "Ничего не найдено"}
                styles={filterSelectStyles}
                menuPortalTarget={selectPortalTarget}
                menuPosition="fixed"
              />
            </div>

            {activeFiltersCount > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedDepartmentIds([]);
                  setSelectedPositionIds([]);
                }}
                className="ml-auto inline-flex h-10 items-center rounded-xl border border-brand-200 bg-brand-50 px-3 text-sm font-medium text-brand-500 transition hover:bg-brand-100"
              >
                Сбросить
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 px-4 py-4 lg:px-6">
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-slate-50/70 px-4 py-2.5">
              <span className="text-sm text-gray-500">
                {totalCount > 0
                  ? ""
                  : isInitialEmployeesLoading
                    ? "Загружаем сотрудников..."
                    : "Сотрудники не найдены"}
              </span>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "3px",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  backgroundColor: "#fff",
                  height: "38px",
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setCurrentMonth(
                      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                    )
                  }
                  className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-transparent text-slate-600 transition hover:bg-slate-50 hover:border-slate-200"
                  aria-label="Предыдущий месяц"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="min-w-[170px] px-3 text-center text-[13px] font-semibold text-slate-700">
                  {monthLabel}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentMonth(
                      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                    )
                  }
                  className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-transparent text-slate-600 transition hover:bg-slate-50 hover:border-slate-200"
                  aria-label="Следующий месяц"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div
              className="min-h-0 max-w-full flex-1 overflow-auto border-t border-gray-100"
              onScroll={handleEmployeesScroll}
            >
              <table
                className="border-separate border-spacing-0"
                style={{ minWidth: 320 + monthDays.length * 44 }}
              >
                <thead>
                  <tr>
                    <th className="sticky top-0 left-0 z-40 min-w-[320px] border-b border-r border-gray-100 bg-gray-50 px-4 py-2 text-left text-xs font-semibold text-gray-600">
                      Сотрудник
                    </th>
                    {monthDays.map((day) => (
                      <th
                        key={day.dateKey}
                        className={`sticky top-0 z-30 min-w-[44px] border-b border-r border-gray-100 px-0.5 py-1 text-center ${
                          day.isWeekend ? "bg-gray-50" : "bg-white"
                        }`}
                      >
                        <div className="text-[14px] font-semibold text-gray-700">{day.dayNumber}</div>
                        <div className="text-[11px] font-medium text-gray-400">{day.weekdayShort}</div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {isLoading
                    ? Array.from({ length: 8 }).map((_, rowIndex) => (
                        <tr key={`calendar-skeleton-${rowIndex}`}>
                          <td className="sticky left-0 z-10 h-14 min-w-[320px] border-b border-r border-gray-100 bg-white px-4 py-2">
                            <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
                          </td>
                          {monthDays.map((day) => (
                            <td
                              key={`calendar-skeleton-day-${rowIndex}-${day.dateKey}`}
                              className="h-14 min-w-[44px] border-b border-r border-gray-100 bg-white"
                            />
                          ))}
                        </tr>
                      ))
                    : null}

                  {!isLoading && employees.length === 0 ? (
                    <tr>
                      <td
                        colSpan={monthDays.length + 1}
                        className="px-4 py-12 text-center text-sm text-gray-500"
                      >
                        Нет сотрудников для отображения.
                      </td>
                    </tr>
                  ) : null}

                  {!isLoading
                    ? employees.map((employee) => {
                        const fullName = buildEmployeeName(employee);
                        const subtitle = buildEmployeeSubtitle(employee);
                        const rowAbsences = absencesByEmployee.get(employee.guid) || [];
                        const rowAttendance =
                          attendanceByEmployee.get(employee.guid) ||
                          new Map<string, AttendanceCellInfo>();
                        const timelineCells = buildTimelineCells({
                          absences: rowAbsences,
                          attendanceByDate: rowAttendance,
                          days: monthDays,
                          monthStart: currentMonth,
                          employeeGuid: employee.guid,
                          onAttendanceClick: (payload) =>
                            setSelectedAttendance({
                              ...payload,
                              employeeName: buildEmployeeName(employee),
                            }),
                          onSegmentClick: (absence, anchorRect) =>
                            setSelectedAbsence({
                              guid: absence.guid,
                              userBaseId: absence.userBaseId,
                              absencePolicyId: absence.absencePolicyId,
                              title: absence.title,
                              color: absence.color,
                              icon: absence.icon,
                              status: absence.status,
                              dateFrom: absence.dateFrom,
                              dateTo: absence.dateTo,
                              requestedDays: absence.requestedDays,
                              employeeName: fullName,
                              anchorRect,
                            }),
                        });

                        return (
                          <tr key={employee.guid} className="group">
                            <td className="sticky left-0 z-20 min-w-[320px] border-b border-r border-gray-100 bg-white px-4 py-2 transition-colors group-hover:bg-slate-50">
                              <Link
                                to={`/employees/${employee.guid}`}
                                className="group/employee-link flex items-center gap-3 rounded-lg"
                              >
                                {employee.photo ? (
                                  <img
                                    src={employee.photo}
                                    alt={fullName}
                                    className="h-9 w-9 shrink-0 rounded-full border border-gray-200 object-cover"
                                  />
                                ) : (
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-brand-50 text-sm font-semibold text-brand-600">
                                    {buildInitials(employee)}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold text-gray-900 transition-colors group-hover/employee-link:text-brand-600">
                                    {fullName}
                                  </div>
                                  <div className="truncate text-xs text-gray-500">{subtitle || "—"}</div>
                                </div>
                              </Link>
                            </td>
                            {timelineCells}
                          </tr>
                        );
                      })
                    : null}

                  {!isLoading && isLoadingMoreEmployees ? (
                    <tr>
                      <td
                        colSpan={monthDays.length + 1}
                        className="px-4 py-5 text-center text-sm text-gray-500"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Загружаем ещё сотрудников...
                        </span>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm">
              <span className="text-gray-500">
                {totalCount > 0 && !hasMoreEmployees
                  ? "Все сотрудники загружены"
                  : totalCount === 0
                    ? "Сотрудники не найдены"
                    : ""}
              </span>
              {isLoadingMoreEmployees ? (
                <span className="inline-flex items-center gap-2 text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Загрузка...
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <AbsenceRequestModal
        isOpen={isCreateModalOpen}
        onClose={closeCreateModal}
        policies={policyOptions}
        policyId={createPolicyId}
        onPolicyIdChange={setCreatePolicyId}
        dateFrom={createDateFrom}
        onDateFromChange={handleCreateDateFromChange}
        dateTo={createDateTo}
        onDateToChange={setCreateDateTo}
        note={createNote}
        onNoteChange={setCreateNote}
        attachmentInputId="calendar-absence-attachments"
        attachments={createAttachments}
        onAttachmentFiles={(event) => void handleAttachmentFiles(event)}
        onRemoveAttachment={removeAttachment}
        isUploadingAttachments={isUploadingAttachments}
        maxAttachments={MAX_ATTACHMENTS}
        breakdown={createBreakdown}
        availableDays={createAvailableDays}
        requestedDays={createRequestedDays}
        forecastDays={createForecastDays}
        brandColor={companyMainColor}
        isSubmitting={createAbsenceMutation.isLoading}
        submitDisabled={
          createAbsenceMutation.isLoading ||
          isUploadingAttachments ||
          !createEmployeeId ||
          !createPolicyId ||
          createRequestedDays <= 0
        }
        onSubmit={() => void submitCreateRequest()}
        employeeField={{
          value: createEmployeeId,
          onChange: setCreateEmployeeId,
          fallbackLabel: selectedCreateEmployeeName,
          placeholder: "Выберите сотрудника",
        }}
      />

      <AbsenceTooltip
        data={selectedAbsence}
        onClose={closeReviewModal}
        onReject={() => void handleReviewAbsence("rejected")}
        onApprove={() => void handleReviewAbsence("approved")}
        isReviewing={isReviewing}
        reviewStatusInProgress={reviewStatusInProgress}
      />

      <AttendanceTooltip
        data={selectedAttendance}
        onClose={() => setSelectedAttendance(null)}
      />
    </>
  );
}

const TOOLTIP_WIDTH = 280;
const TOOLTIP_GAP = 8;

type AnchorRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
};

/**
 * Resolve the {left, top} of a floating popover so it sits directly below the
 * anchor when possible, flipping above when below would overflow the viewport.
 * Measures the actual tooltip height via a ref instead of guessing.
 */
function useTooltipPosition(
  anchor: AnchorRect | undefined | null,
  tooltipRef: React.RefObject<HTMLDivElement | null>,
  width: number
): { left: number; top: number; ready: boolean } {
  const [position, setPosition] = useState<{ left: number; top: number; ready: boolean }>({
    left: 0,
    top: 0,
    ready: false,
  });

  useLayoutEffect(() => {
    if (!anchor || !tooltipRef.current) {
      setPosition((prev) => ({ ...prev, ready: false }));
      return undefined;
    }

    const compute = () => {
      const el = tooltipRef.current;
      if (!el) return;
      const height = el.offsetHeight;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let left = anchor.left + anchor.width / 2 - width / 2;
      left = Math.max(8, Math.min(left, viewportWidth - width - 8));

      let top = anchor.bottom + TOOLTIP_GAP;
      const overflowsBelow = top + height > viewportHeight - 8;
      if (overflowsBelow) {
        const aboveTop = anchor.top - TOOLTIP_GAP - height;
        if (aboveTop >= 8) {
          top = aboveTop;
        } else {
          // Neither full fits — pick whichever side has more room.
          const roomBelow = viewportHeight - anchor.bottom - TOOLTIP_GAP - 8;
          const roomAbove = anchor.top - TOOLTIP_GAP - 8;
          top = roomAbove > roomBelow ? Math.max(8, aboveTop) : top;
        }
      }

      setPosition({ left, top, ready: true });
    };

    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [anchor, tooltipRef, width]);

  return position;
}

function AttendanceTooltip({
  data,
  onClose,
}: {
  data: (AttendanceClickPayload & { employeeName: string }) | null;
  onClose: () => void;
}) {
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!data) return undefined;

    const handleClickOutside = (event: MouseEvent) => {
      if (!tooltipRef.current) return;
      if (!tooltipRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    // Defer to next tick so the click that opened the tooltip doesn't close it.
    const id = window.setTimeout(() => {
      window.addEventListener("mousedown", handleClickOutside);
    }, 0);
    window.addEventListener("keydown", handleKey);

    return () => {
      window.clearTimeout(id);
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKey);
    };
  }, [data, onClose]);

  const position = useTooltipPosition(data?.anchorRect, tooltipRef, TOOLTIP_WIDTH);

  if (!data) return null;

  const statusColor =
    data.kind === "present"
      ? "#047857"
      : data.kind === "late"
        ? "#B45309"
        : "#B91C1C";

  return (
    <div
      ref={tooltipRef}
      role="dialog"
      aria-label="Детали посещаемости"
      className="fixed z-50 rounded-xl border border-gray-200 bg-white shadow-xl"
      style={{
        left: position.left,
        top: position.top,
        width: TOOLTIP_WIDTH,
        visibility: position.ready ? "visible" : "hidden",
      }}
    >
      <div className="flex items-start justify-between gap-2 border-b border-gray-100 px-4 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">
            {data.employeeName}
          </p>
          <p className="text-xs text-gray-500">{formatDateRu(data.dateKey)}</p>
        </div>
        <span
          className="inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[11px] font-semibold"
          style={{ backgroundColor: ATTENDANCE_CELL_BG[data.kind], color: statusColor }}
        >
          {ATTENDANCE_DOT_LABEL[data.kind]}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 px-4 py-3 text-sm">
        <div>
          <dt className="text-[11px] text-gray-500">Приход</dt>
          <dd className="font-semibold text-gray-900">{data.checkInTime || "—"}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-gray-500">Уход</dt>
          <dd className="font-semibold text-gray-900">{data.checkOutTime || "—"}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-gray-500">Опоздание</dt>
          <dd className="font-semibold text-gray-900">{data.delayTime || "—"}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-gray-500">Источник</dt>
          <dd className="font-semibold text-gray-900">{data.sourceLabel}</dd>
        </div>
      </dl>
    </div>
  );
}

const ABSENCE_TOOLTIP_WIDTH = 360;

function AbsenceTooltip({
  data,
  onClose,
  onReject,
  onApprove,
  isReviewing,
  reviewStatusInProgress,
}: {
  data: SelectedAbsence | null;
  onClose: () => void;
  onReject: () => void;
  onApprove: () => void;
  isReviewing: boolean;
  reviewStatusInProgress: AbsenceRequestStatus | null;
}) {
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!data) return undefined;

    const handleClickOutside = (event: MouseEvent) => {
      if (!tooltipRef.current) return;
      if (!tooltipRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    // Defer subscription so the click that opened the tooltip doesn't close it.
    const id = window.setTimeout(() => {
      window.addEventListener("mousedown", handleClickOutside);
    }, 0);
    window.addEventListener("keydown", handleKey);

    return () => {
      window.clearTimeout(id);
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKey);
    };
  }, [data, onClose]);

  const position = useTooltipPosition(data?.anchorRect, tooltipRef, ABSENCE_TOOLTIP_WIDTH);

  if (!data) return null;

  const canReview = data.status === "pending";

  return (
    <div
      ref={tooltipRef}
      role="dialog"
      aria-label="Детали отсутствия"
      className="fixed z-50 rounded-xl border border-gray-200 bg-white shadow-xl"
      style={{
        left: position.left,
        top: position.top,
        width: ABSENCE_TOOLTIP_WIDTH,
        visibility: position.ready ? "visible" : "hidden",
      }}
    >
      <div className="flex items-start justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{data.employeeName}</p>
          <p className="text-xs text-gray-500">
            {formatDateRu(data.dateFrom)} – {formatDateRu(data.dateTo)} • {data.requestedDays} дн.
          </p>
        </div>
        <span
          className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-semibold ${
            STATUS_BADGE_CLASSNAME[data.status]
          }`}
        >
          {STATUS_LABELS[data.status]}
        </span>
      </div>

      <div className="space-y-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-md"
            style={{ backgroundColor: withOpacity(data.color, 0.14) }}
          >
            <Icon icon={data.icon} className="h-4 w-4" color={data.color} />
          </span>
          <span className="text-sm font-semibold text-gray-900">{data.title}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5">
            <p className="text-[11px] text-gray-500">Дата начала</p>
            <p className="text-sm font-semibold text-gray-900">{formatDateRu(data.dateFrom)}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5">
            <p className="text-[11px] text-gray-500">Дата окончания</p>
            <p className="text-sm font-semibold text-gray-900">{formatDateRu(data.dateTo)}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          disabled={isReviewing}
          className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Отмена
        </button>
        {canReview ? (
          <>
            <button
              type="button"
              onClick={onReject}
              disabled={isReviewing}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {reviewStatusInProgress === "rejected" ? "Отклонение..." : "Отклонить"}
            </button>
            <button
              type="button"
              onClick={onApprove}
              disabled={isReviewing}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {reviewStatusInProgress === "approved" ? "Подтверждение..." : "Подтвердить"}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
