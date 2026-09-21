import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Check, ChevronLeft, ChevronRight, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import Select, { type SingleValue, type StylesConfig } from "react-select";
import PageMeta from "../../../components/common/PageMeta";
import { Modal } from "../../../components/ui/modal";
import EmployeeInfiniteSelect from "../../../components/autocomplete/EmployeeInfiniteSelect";
import EmployeesPaginationFooter from "../../Employees/List/components/EmployeesPaginationFooter";
import companyStore from "../../../store/company.store";
import {
  COMPANY_ID,
  useCreateSettingsDirectoryItem,
  useDeleteSettingsDirectoryItem,
  useSettingsDirectoryQuery,
  useUpdateSettingsDirectoryItem,
} from "../../../api/services/settingsDirectory.service";
import encodeJsonToUrlParam from "../../../utils/encodeJsonToUrlParam";
import ApprovalProcessModal from "../../../components/approvals/ApprovalProcessModal";
import ApprovalProgressBadge from "../../../components/approvals/ApprovalProgressBadge";
import ApprovalProgressButton from "../../../components/approvals/ApprovalProgressButton";
import {
  countApprovedStages,
  isProcessComplete,
} from "../../Settings/Approvals/approvalRuntime";
import {
  findApprovalProcessFor,
  useApprovalProcessesQuery,
  useApproveStage,
  useEntityApprovalsQuery,
} from "../../../api/services/approval.service";
import { syncVegapharmCrmAttendance } from "../../../api/services/vegapharmCrm.service";
import hickvisionService, { type LatenessResult } from "../../../api/services/hickvision.service";
import LocationViewLink from "../../../components/map/LocationViewLink";
import { useOffices } from "../../../components/map/useOffices";
import TimeInput from "../../../components/form/TimeInput";

const ATTENDANCE_ENTITY_TYPE = "attendance";
const VEGAPHARM_COMPANY_ID = "c9a7fee7-e210-477e-bee3-5f18e388e630";

type AttendanceItem = {
  guid: string;
  date?: string | null;
  check_in_time?: string | null;
  check_out_time?: string | null;
  delay_time?: string | null;
  status?: string[] | string | null;
  action_status?: string[] | string | null;
  source_type?: string[] | string | null;
  created_at?: string | null;
  user_base_id?: string | null;
  user_base_id_data?: {
    guid?: string;
    first_name?: string;
    second_name?: string;
    name?: string;
    hikvision_id?: string | null;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

// Raw Hikvision/webapp check events. Only mobile-app ("webapp") events carry
// `map` (a "lat,long" string) — turnstile events have none. `attendance` rows
// don't store geo themselves, so the location column is resolved by matching
// on `user_base_id` + `date`.
type AttendanceRecordItem = {
  user_base_id?: string | null;
  map?: string | null;
  date?: string | null;
  [key: string]: unknown;
};

type AttendanceWorkflowStatus = "accepted" | "rejected" | "requested" | "unknown";
type AttendanceActionStatus = "present" | "late" | "absent" | "unknown";
type AttendanceSourceType = "manual" | "integration" | "absences" | "unknown";

type AttendanceRecord = {
  guid: string;
  date: string;
  checkInTime: string;
  checkOutTime: string;
  delayTime: string;
  requestStatus: AttendanceWorkflowStatus;
  actionStatus: AttendanceActionStatus;
  sourceType: AttendanceSourceType;
  createdAt: string;
  employeeGuid: string;
  officeId: string;
  employeeName: string;
  departmentId: string;
  location: string;
};

type AttendanceDraft = {
  employeeGuid: string;
  date: Date | null;
  checkInTime: string;
  checkOutTime: string;
};

type SelectOption = {
  value: string;
  label: string;
};
type PaginationItem = number | string;

const ATTENDANCE_SLUG = "attendance";
const ATTENDANCE_RECORDS_SLUG = "attendance_records";
const PAGE_SIZE = 20;
const FILTER_SELECT_MAX_WIDTH = 280;

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DELAY_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const getEmployeeSelectStyles = (): StylesConfig<SelectOption, false> => ({
  control: (base, state) => ({
    ...base,
    minHeight: "40px",
    borderColor: state.isFocused ? "#cbd5e1" : "#e2e8f0",
    borderRadius: "0.5rem",
    boxShadow: "none",
    "&:hover": {
      borderColor: "#cbd5e1",
    },
  }),
  valueContainer: (base) => ({ ...base, padding: "0 10px", fontSize: "13px" }),
  input: (base) => ({ ...base, margin: 0, padding: 0, fontSize: "13px" }),
  indicatorsContainer: (base) => ({ ...base, height: "38px" }),
  option: (base, state) => ({
    ...base,
    fontSize: "13px",
    cursor: "pointer",
    backgroundColor: state.isSelected ? "#e2e8f0" : state.isFocused ? "#f8fafc" : "white",
    color: "#111827",
    padding: "8px 10px",
  }),
  menu: (base) => ({
    ...base,
    zIndex: 100000,
    borderRadius: "0.5rem",
    border: "1px solid #e5e7eb",
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 100000,
  }),
  singleValue: (base) => ({ ...base, fontSize: "13px" }),
  placeholder: (base) => ({ ...base, fontSize: "13px", color: "#94a3b8" }),
});

const buildPaginationItems = (currentPage: number, totalPages: number): PaginationItem[] => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);

  if (currentPage <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }

  if (currentPage >= totalPages - 2) {
    pages.add(totalPages - 1);
    pages.add(totalPages - 2);
    pages.add(totalPages - 3);
  }

  const sortedPages = [...pages]
    .filter((pageNumber) => pageNumber >= 1 && pageNumber <= totalPages)
    .sort((left, right) => left - right);

  const result: PaginationItem[] = [];

  for (let i = 0; i < sortedPages.length; i += 1) {
    const pageNumber = sortedPages[i];
    const previousPage = sortedPages[i - 1];

    if (previousPage && pageNumber - previousPage > 1) {
      result.push(`ellipsis-${previousPage}-${pageNumber}`);
    }

    result.push(pageNumber);
  }

  return result;
};

const normalizeDelayTime = (value: string | null | undefined): string => {
  if (typeof value === "string" && DELAY_TIME_PATTERN.test(value.trim())) {
    return value.trim();
  }
  return "";
};

const normalizeDelayTimeForPayload = (value: string | null | undefined): string => {
  if (typeof value === "string" && DELAY_TIME_PATTERN.test(value.trim())) {
    return value.trim();
  }
  return "00:00";
};

const toTimestamp = (value: string | null | undefined): number => {
  if (!value) return 0;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const toIsoDate = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseIsoDate = (value: string): Date | null => {
  if (!ISO_DATE_PATTERN.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  return parsed;
};

const toExactDateRangeFilter = (isoDate: string): { $gte: string; $lte: string } => ({
  $gte: isoDate,
  $lte: isoDate,
});

const normalizeDateKey = (value: string | null | undefined, fallback: string | null | undefined): string => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (ISO_DATE_PATTERN.test(trimmed)) {
      return trimmed;
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return toIsoDate(parsed);
    }
  }

  if (typeof fallback === "string" && fallback.trim()) {
    const parsed = new Date(fallback);
    if (!Number.isNaN(parsed.getTime())) {
      return toIsoDate(parsed);
    }
  }

  return "";
};

const normalizeTime = (value: string | null | undefined): string => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (TIME_PATTERN.test(trimmed)) {
      return trimmed;
    }
  }

  return "";
};

const toSortTimestamp = (item: AttendanceItem): number => {
  const dateValue = typeof item.date === "string" ? item.date.trim() : "";
  const timeValue = normalizeTime(item.check_in_time) || normalizeTime(item.check_out_time) || "00:00";
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  const [hours, minutes] = timeValue.split(":").map(Number);

  if (dateMatch) {
    const year = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const day = Number(dateMatch[3]);
    return Date.UTC(
      year,
      month - 1,
      day,
      Number.isFinite(hours) ? hours : 0,
      Number.isFinite(minutes) ? minutes : 0
    );
  }

  return toTimestamp(item.created_at);
};

const formatDateLabel = (value: string): string => {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (match) {
    return `${match[3]}.${match[2]}.${match[1]}`;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const formatTimeLabel = (value: string): string => {
  return normalizeTime(value) || "—";
};

const hasDelayValue = (value: string): boolean => DELAY_TIME_PATTERN.test(value) && value !== "00:00";

const normalizeAttendanceWorkflowStatus = (value: unknown): AttendanceWorkflowStatus => {
  const normalized = Array.isArray(value)
    ? String(value[0] || "").trim().toLowerCase()
    : String(value || "").trim().toLowerCase();

  if (normalized === "accepted") return "accepted";
  if (normalized === "rejected") return "rejected";
  if (normalized === "requested") return "requested";
  return "unknown";
};

const normalizeAttendanceActionStatus = (value: unknown): AttendanceActionStatus => {
  const normalized = Array.isArray(value)
    ? String(value[0] || "").trim().toLowerCase()
    : String(value || "").trim().toLowerCase();

  if (normalized === "present") return "present";
  if (normalized === "late") return "late";
  if (normalized === "absent") return "absent";
  return "unknown";
};

const normalizeAttendanceSourceType = (value: unknown): AttendanceSourceType => {
  const normalized = Array.isArray(value)
    ? String(value[0] || "").trim().toLowerCase()
    : String(value || "").trim().toLowerCase();

  if (normalized === "manual") return "manual";
  if (normalized === "integration") return "integration";
  if (normalized === "absences") return "absences";
  return "unknown";
};

/**
 * Статус уже сохранённой строки, у которой он почему-то пуст.
 *
 * Читается из её же `delay_time` — он посчитан по графику тем, кто строку
 * записал. Спрашивать сервер заново незачем: ответ уже лежит в строке, а
 * согласование отметки не должно падать из-за недоступности расчёта.
 */
const resolveActionStatusFromDelay = (
  checkInTime: string,
  delayTime: string
): Exclude<AttendanceActionStatus, "unknown"> => {
  if (!normalizeTime(checkInTime)) return "absent";
  return hasDelayValue(normalizeDelayTime(delayTime)) ? "late" : "present";
};

const getActionStatusTag = (
  status: AttendanceActionStatus
): { label: string; className: string } => {
  if (status === "absent") {
    return {
      label: "Отсутствует",
      className: "border-slate-200 bg-slate-100 text-slate-500",
    };
  }

  if (status === "late") {
    return {
      label: "Опоздал",
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }

  if (status === "present") {
    return {
      label: "Присутствует",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  return {
    label: "—",
    className: "border-slate-200 bg-slate-100 text-slate-500",
  };
};

const getWorkflowStatusTag = (
  status: AttendanceWorkflowStatus
): { label: string; className: string } => {
  if (status === "accepted") {
    return {
      label: "Подтверждено",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  if (status === "requested") {
    return {
      label: "Запрошено",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  if (status === "rejected") {
    return {
      label: "Отклонено",
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }

  return {
    label: "—",
    className: "border-slate-200 bg-slate-100 text-slate-500",
  };
};

const getSourceTypeTag = (
  sourceType: AttendanceSourceType
): { label: string; className: string } => {
  if (sourceType === "manual") {
    return {
      label: "HRMS",
      className: "border-blue-200 bg-blue-50 text-blue-700",
    };
  }

  if (sourceType === "integration") {
    // Не «Hikvision»: отметка могла прийти и из мини-аппа, а строка дня знает
    // только тип источника, не устройство. Точный источник — в событиях,
    // Настройки → Интеграции → Записи, там же фото и координаты.
    return {
      label: "Интеграция",
      className: "border-violet-200 bg-violet-50 text-violet-700",
    };
  }

  if (sourceType === "absences") {
    return {
      label: "Отсутствие",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  return {
    label: "—",
    className: "border-slate-200 bg-slate-100 text-slate-500",
  };
};

const getDelayLabel = (delayTime: string, status: AttendanceActionStatus): string => {
  if (status === "late" || hasDelayValue(delayTime)) {
    return hasDelayValue(delayTime) ? delayTime : "00:00";
  }
  return "—";
};

const getEmployeeInfo = (
  item: AttendanceItem
): { employeeGuid: string; employeeName: string; departmentId: string; officeId: string } => {
  const relation =
    item.user_base_id_data && typeof item.user_base_id_data === "object"
      ? (item.user_base_id_data as Record<string, unknown>)
      : null;

  const firstName = typeof relation?.first_name === "string" ? relation.first_name : "";
  const secondName = typeof relation?.second_name === "string" ? relation.second_name : "";
  const fullName = [secondName, firstName].filter(Boolean).join(" ").trim();

  const employeeName =
    fullName ||
    (typeof relation?.name === "string" ? relation.name : "") ||
    "—";

  const employeeGuid =
    (typeof item.user_base_id === "string" && item.user_base_id) ||
    (typeof relation?.guid === "string" ? relation.guid : "");

  // uCode relation expansion returns the full user_base row, so the employee's
  // department is available here (used to resolve the approval process).
  const departmentRelation =
    relation && typeof relation.departments_id_data === "object"
      ? (relation.departments_id_data as Record<string, unknown>)
      : null;
  const departmentId =
    (typeof relation?.departments_id === "string" && relation.departments_id) ||
    (typeof departmentRelation?.guid === "string" ? departmentRelation.guid : "") ||
    "";

  // Филиал сотрудника — `user_base.locations_id`; координаты офиса лежат уже
  // в самом филиале, второй уровень связи ucode не разворачивает.
  const officeId = typeof relation?.locations_id === "string" ? relation.locations_id : "";

  return { employeeGuid, employeeName, departmentId, officeId };
};

const getDefaultDraft = (dateFilter: string): AttendanceDraft => {
  const baseDate = parseIsoDate(dateFilter) || new Date();
  const now = new Date();
  const timeNow = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  return {
    employeeGuid: "",
    officeId: "",
    date: baseDate,
    checkInTime: timeNow,
    checkOutTime: "",
  };
};

export default function TimeAttendancePage({ leftSlot }: { leftSlot?: ReactNode } = {}) {
  const [page, setPage] = useState(1);
  const [dateFilter, setDateFilter] = useState(() => toIsoDate(new Date()));
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<AttendanceActionStatus | "">("");
  const [sourceTypeFilter, setSourceTypeFilter] = useState<AttendanceSourceType | "">("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGuid, setEditingGuid] = useState<string | null>(null);
  const [draft, setDraft] = useState<AttendanceDraft>(() => getDefaultDraft(toIsoDate(new Date())));
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [employeeFallbackLabel, setEmployeeFallbackLabel] = useState("");
  const [toDelete, setToDelete] = useState<AttendanceRecord | null>(null);
  const [approvalRecord, setApprovalRecord] = useState<AttendanceRecord | null>(null);

  const { data: approvalProcesses } = useApprovalProcessesQuery();
  const approveStageMutation = useApproveStage();

  const brandColor = companyStore.mainColor;
  const normalizedDateFilter = useMemo(() => {
    const parsed = parseIsoDate(dateFilter);
    return parsed ? toIsoDate(parsed) : toIsoDate(new Date());
  }, [dateFilter]);
  const menuPortalTarget = typeof document !== "undefined" ? document.body : undefined;
  const filterSelectStyles = useMemo(() => getEmployeeSelectStyles(), []);

  const typeFilterOptions = useMemo<SelectOption[]>(
    () => [
      { value: "present", label: "Присутствует" },
      { value: "late", label: "Опоздал" },
      { value: "absent", label: "Отсутствует" },
    ],
    []
  );

  const sourceTypeFilterOptions = useMemo<SelectOption[]>(
    () => [
      { value: "manual", label: "HRMS" },
      { value: "integration", label: "Hikvision / QuadraSoft" },
      { value: "absences", label: "Отсутствие" },
    ],
    []
  );

  const backendQueryData = useMemo(() => {
    const payload: Record<string, unknown> = {
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      date: toExactDateRangeFilter(normalizedDateFilter),
    };

    if (employeeFilter) {
      payload.user_base_id = employeeFilter;
    }

    if (typeFilter) {
      payload.action_status = [typeFilter];
    }

    if (sourceTypeFilter) {
      payload.source_type = [sourceTypeFilter];
    }

    return payload;
  }, [page, normalizedDateFilter, employeeFilter, typeFilter, sourceTypeFilter]);

  // Unpaginated on purpose — bounded to the one visible day, and the table
  // needs every event for it to find each employee's latest geo-tagged check.
  const attendanceRecordsQueryParams = useMemo(
    () => ({
      data: encodeJsonToUrlParam({
        limit: 500,
        offset: 0,
        date: toExactDateRangeFilter(normalizedDateFilter),
        companies_id: companyStore.company?.guid || COMPANY_ID,
      }),
    }),
    [normalizedDateFilter]
  );
  const { data: attendanceRecordsData } = useSettingsDirectoryQuery({
    slug: ATTENDANCE_RECORDS_SLUG,
    params: attendanceRecordsQueryParams,
  });

  // attendance_records comes back newest-first, so the first match per
  // employee+date is their latest geo-tagged event.
  const locationByEmployeeAndDate = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of (attendanceRecordsData?.response || []) as AttendanceRecordItem[]) {
      const userId = typeof item.user_base_id === "string" ? item.user_base_id : "";
      const geo = typeof item.map === "string" ? item.map.trim() : "";
      if (!userId || !geo) continue;
      const key = `${userId}|${item.date || ""}`;
      if (!map.has(key)) map.set(key, geo);
    }
    return map;
  }, [attendanceRecordsData?.response]);

  const { data, isLoading, isFetching, isError, refetch } = useSettingsDirectoryQuery({
    slug: ATTENDANCE_SLUG,
    params: {
      with_relations: true,
      data: encodeJsonToUrlParam(backendQueryData),
    },
    querySettings: {
      keepPreviousData: true,
    },
  });

  // CRM report is refreshed immediately and every five minutes while the
  // attendance screen is open. Backend also runs the same idempotent sync.
  useEffect(() => {
    if (companyStore.company?.guid !== VEGAPHARM_COMPANY_ID) return;
    let cancelled = false;
    const sync = async () => {
      try {
        await syncVegapharmCrmAttendance(normalizedDateFilter);
        if (!cancelled) void refetch();
      } catch (error) {
        console.error("QuadraSoft CRM attendance sync failed:", error);
      }
    };
    void sync();
    const timer = window.setInterval(sync, 5 * 60 * 1000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [normalizedDateFilter, refetch]);

  // Справочник филиалов — один кешированный запрос на все экраны; из него
  // берутся координаты офиса и его радиус для сверки с отметкой.
  const offices = useOffices();

  const createMutation = useCreateSettingsDirectoryItem(ATTENDANCE_SLUG);
  const updateMutation = useUpdateSettingsDirectoryItem(ATTENDANCE_SLUG);
  const deleteMutation = useDeleteSettingsDirectoryItem(ATTENDANCE_SLUG);
  const isSaving = createMutation.isLoading || updateMutation.isLoading || deleteMutation.isLoading;

  const records = useMemo<AttendanceRecord[]>(() => {
    const rawRows = (data?.response || []) as AttendanceItem[];
    // Show every attendance row as-is: when an employee has both a manual and
    // an integration entry for the same (user, date), both are listed. Source
    // precedence is a display concern handled elsewhere; this listing no longer
    // hides lower-priority rows.
    const rows = rawRows.map((item) => {
      const date = normalizeDateKey(item.date, item.created_at);
      const checkInTime = normalizeTime(item.check_in_time);
      const checkOutTime = normalizeTime(item.check_out_time);
      const delayTime = normalizeDelayTime(item.delay_time);
      const employeeInfo = getEmployeeInfo(item);

      return {
        guid: item.guid,
        date,
        checkInTime,
        checkOutTime,
        delayTime,
        requestStatus: normalizeAttendanceWorkflowStatus(item.status),
        actionStatus: normalizeAttendanceActionStatus(item.action_status),
        sourceType: normalizeAttendanceSourceType(item.source_type),
        createdAt: typeof item.created_at === "string" ? item.created_at : "",
        employeeGuid: employeeInfo.employeeGuid,
        officeId: employeeInfo.officeId,
        employeeName: employeeInfo.employeeName,
        departmentId: employeeInfo.departmentId,
        location: locationByEmployeeAndDate.get(`${employeeInfo.employeeGuid}|${date}`) || "",
      };
    });

    return rows.sort((left, right) => {
      const rightItem: AttendanceItem = {
        date: right.date,
        check_in_time: right.checkInTime,
        check_out_time: right.checkOutTime,
        created_at: right.createdAt,
      };
      const leftItem: AttendanceItem = {
        date: left.date,
        check_in_time: left.checkInTime,
        check_out_time: left.checkOutTime,
        created_at: left.createdAt,
      };

      return toSortTimestamp(rightItem) - toSortTimestamp(leftItem);
    });
  }, [data?.response, locationByEmployeeAndDate]);

  // Resolve the approval process for a row from that employee's department.
  const resolveRecordProcess = (record: AttendanceRecord) =>
    findApprovalProcessFor(
      approvalProcesses ?? [],
      "attendance_change_approval",
      record.departmentId
    );

  // Bulk approval progress for visible rows so finalized rows can still show
  // the clickable audit badge.
  const approvalEntityIds = useMemo(
    () =>
      records
        .filter(
          (record) =>
            findApprovalProcessFor(
              approvalProcesses ?? [],
              "attendance_change_approval",
              record.departmentId
            )
        )
        .map((record) => record.guid),
    [records, approvalProcesses]
  );

  const { data: approvalProgressMap } = useEntityApprovalsQuery(
    ATTENDANCE_ENTITY_TYPE,
    approvalEntityIds
  );

  const activeFiltersCount = [employeeFilter, typeFilter, sourceTypeFilter].filter(Boolean).length;
  const isFilterButtonActive = isFiltersOpen || activeFiltersCount > 0;
  const totalCount = Number(data?.count || 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [dateFilter, employeeFilter, typeFilter, sourceTypeFilter]);

  const dateFilterLabel = useMemo(() => {
    return formatDateLabel(dateFilter);
  }, [dateFilter]);

  const shiftDateFilter = (days: number) => {
    setDateFilter((prev) => {
      const base = parseIsoDate(prev) || new Date();
      base.setDate(base.getDate() + days);
      return toIsoDate(base);
    });
  };

  useEffect(() => {
    if (typeof data?.count !== "number") return;

    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [data?.count, page, totalPages]);

  const pageItems = records;
  const visibleFrom = totalCount > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
  const visibleTo = totalCount > 0 ? Math.min(page * PAGE_SIZE, totalCount) : 0;
  const visibleRangeLabel =
    totalCount > 0
      ? `Отображение ${visibleFrom} - ${visibleTo} из ${totalCount}`
      : "Нет данных";
  const paginationItems = useMemo(() => buildPaginationItems(page, totalPages), [page, totalPages]);
  const editingRecord = useMemo(
    () => records.find((item) => item.guid === editingGuid) || null,
    [records, editingGuid]
  );

  const closeModal = () => {
    if (isSaving) return;

    setIsModalOpen(false);
    setEditingGuid(null);
    setDraft(getDefaultDraft(dateFilter));
    setEmployeeFallbackLabel("");
    setFormError("");
  };

  const openCreate = () => {
    setEditingGuid(null);
    setDraft(getDefaultDraft(dateFilter));
    setEmployeeFallbackLabel("");
    setFormError("");
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    const employeeGuid = String(draft.employeeGuid || "").trim();
    if (!employeeGuid) {
      setFormError("Выберите сотрудника.");
      return;
    }

    if (!draft.date) {
      setFormError("Укажите дату.");
      return;
    }

    const checkInTime = normalizeTime(draft.checkInTime);
    const checkOutTime = normalizeTime(draft.checkOutTime);

    if (!checkInTime && !checkOutTime) {
      setFormError("Укажите хотя бы одно время: приход или уход.");
      return;
    }

    const date = toIsoDate(draft.date);
    const companiesId = companyStore.company?.guid || COMPANY_ID;

    let lateness: LatenessResult;
    try {
      lateness = await hickvisionService.computeLateness({
        user_base_id: employeeGuid,
        companies_id: companiesId,
        date,
        check_in_time: checkInTime,
      });
    } catch (latenessError) {
      console.error("Attendance lateness error:", latenessError);
      setFormError("Не удалось получить график сотрудника — опоздание не посчитано.");
      return;
    }

    const payload = {
      user_base_id: employeeGuid,
      companies_id: companiesId,
      date,
      ...(checkInTime ? { check_in_time: checkInTime } : {}),
      ...(checkOutTime ? { check_out_time: checkOutTime } : {}),
      delay_time: normalizeDelayTimeForPayload(lateness.delay_time),
      status: ["accepted"],
      action_status: [lateness.action_status],
      source_type: [editingRecord?.sourceType === "integration" ? "integration" : "manual"],
    };

    try {
      setActionError("");
      if (editingGuid) {
        await updateMutation.mutateAsync({
          guid: editingGuid,
          data: payload,
        });
      } else {
        await createMutation.mutateAsync(payload);
      }

      closeModal();
    } catch (saveError) {
      console.error("Attendance save error:", saveError);
      setFormError("Не удалось сохранить запись. Попробуйте ещё раз.");
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;

    try {
      setActionError("");
      await deleteMutation.mutateAsync(toDelete.guid);
      setToDelete(null);
    } catch (deleteError) {
      console.error("Attendance delete error:", deleteError);
      setActionError("Не удалось удалить запись. Попробуйте ещё раз.");
    }
  };

  const buildReviewPayload = (
    record: AttendanceRecord,
    status: "accepted" | "rejected"
  ) => ({
    user_base_id: record.employeeGuid,
    companies_id: companyStore.company?.guid || COMPANY_ID,
    date: record.date,
    ...(record.checkInTime ? { check_in_time: record.checkInTime } : {}),
    ...(record.checkOutTime ? { check_out_time: record.checkOutTime } : {}),
    delay_time: normalizeDelayTimeForPayload(record.delayTime),
    status: [status],
    action_status: [
      record.actionStatus === "unknown"
        ? resolveActionStatusFromDelay(record.checkInTime, record.delayTime)
        : record.actionStatus,
    ],
    source_type: [record.sourceType === "integration" ? "integration" : "manual"],
  });

  const confirmRecord = (record: AttendanceRecord) =>
    updateMutation.mutateAsync({
      guid: record.guid,
      data: buildReviewPayload(record, "accepted"),
    });

  // Row "Подтвердить" click. With a configured approval process the change must
  // pass every stage first → open the approval modal instead of confirming.
  const handleConfirmRequested = async (record: AttendanceRecord) => {
    const process = resolveRecordProcess(record);
    if (process) {
      const progress = approvalProgressMap?.[record.guid] ?? null;
      if (!isProcessComplete(process, progress)) {
        setApprovalRecord(record);
        return;
      }
    }
    try {
      setActionError("");
      await confirmRecord(record);
    } catch (confirmError) {
      console.error("Attendance confirm error:", confirmError);
      setActionError("Не удалось подтвердить запись. Попробуйте ещё раз.");
    }
  };

  const approvalRecordProcess = approvalRecord
    ? resolveRecordProcess(approvalRecord)
    : undefined;

  const handleApproveStage = async (stageId: string, comment: string) => {
    if (!approvalRecord || !approvalRecordProcess) return;
    try {
      await approveStageMutation.mutateAsync({
        entityType: ATTENDANCE_ENTITY_TYPE,
        entityId: approvalRecord.guid,
        processId: approvalRecordProcess.id,
        stageId,
        comment,
      });
    } catch (stageError) {
      console.error("Attendance stage approve error:", stageError);
      setActionError("Не удалось одобрить этап.");
    }
  };

  const finalizeApproval = async () => {
    if (!approvalRecord) return;
    try {
      setActionError("");
      await confirmRecord(approvalRecord);
      setApprovalRecord(null);
    } catch (confirmError) {
      console.error("Attendance confirm error:", confirmError);
      setActionError("Не удалось подтвердить запись. Попробуйте ещё раз.");
    }
  };

  const rejectFromApproval = async (_comment: string) => {
    if (!approvalRecord) return;
    try {
      setActionError("");
      await updateMutation.mutateAsync({
        guid: approvalRecord.guid,
        data: buildReviewPayload(approvalRecord, "rejected"),
      });
      setApprovalRecord(null);
    } catch (rejectError) {
      console.error("Attendance reject error:", rejectError);
      setActionError("Не удалось отклонить запись.");
    }
  };

  return (
    <>
      <PageMeta title="Посещаемость | HRMS" description="Таблица посещаемости сотрудников" />

      <div className="-mx-3 md:-mx-4 -mt-3 md:-mt-4">
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
          {leftSlot && <div className="mr-auto flex items-center">{leftSlot}</div>}

          <button
            type="button"
            onClick={() => setIsFiltersOpen((open) => !open)}
            aria-label={`Фильтр${activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ""}`}
            title={`Фильтр${activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ""}`}
            className="relative inline-flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border transition"
            style={{
              color: isFilterButtonActive ? "var(--company-color)" : "#334155",
              backgroundColor: isFilterButtonActive ? "var(--color-brand-50)" : "#fff",
              borderColor: isFilterButtonActive ? "var(--color-brand-200)" : "#e2e8f0",
            }}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {activeFiltersCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white">
                {activeFiltersCount}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-[38px] items-center gap-1.5 rounded-[10px] border border-transparent px-4 text-[13px] font-semibold text-white transition hover:opacity-90"
            style={{ backgroundColor: brandColor }}
          >
            <Plus className="h-3.5 w-3.5" />
            Добавить
          </button>
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
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
            }}
          >
            <div
              style={{
                minWidth: "220px",
                width: "100%",
                maxWidth: `${FILTER_SELECT_MAX_WIDTH}px`,
                flex: `0 1 ${FILTER_SELECT_MAX_WIDTH}px`,
              }}
            >
              <EmployeeInfiniteSelect
                value={employeeFilter}
                onChange={(value) => {
                  setEmployeeFilter(value);
                  setPage(1);
                }}
                placeholder="Сотрудник"
                styles={filterSelectStyles}
                menuPortalTarget={menuPortalTarget}
                classNamePrefix="attendance-filter-employee-select"
              />
            </div>

            <div
              style={{
                minWidth: "180px",
                width: "100%",
                maxWidth: `${FILTER_SELECT_MAX_WIDTH}px`,
                flex: `0 1 ${FILTER_SELECT_MAX_WIDTH}px`,
              }}
            >
              <Select<SelectOption, false>
                inputId="attendance-filter-type"
                value={typeFilterOptions.find((option) => option.value === typeFilter) || null}
                onChange={(option: SingleValue<SelectOption>) => {
                  setTypeFilter((option?.value || "") as AttendanceActionStatus | "");
                  setPage(1);
                }}
                options={typeFilterOptions}
                placeholder="Тип"
                isSearchable={false}
                isClearable
                styles={filterSelectStyles}
                menuPortalTarget={menuPortalTarget}
                menuPosition="fixed"
                noOptionsMessage={() => "Ничего не найдено"}
              />
            </div>

            <div
              style={{
                minWidth: "180px",
                width: "100%",
                maxWidth: `${FILTER_SELECT_MAX_WIDTH}px`,
                flex: `0 1 ${FILTER_SELECT_MAX_WIDTH}px`,
              }}
            >
              <Select<SelectOption, false>
                inputId="attendance-filter-source-type"
                value={sourceTypeFilterOptions.find((option) => option.value === sourceTypeFilter) || null}
                onChange={(option: SingleValue<SelectOption>) => {
                  setSourceTypeFilter((option?.value || "") as AttendanceSourceType | "");
                  setPage(1);
                }}
                options={sourceTypeFilterOptions}
                placeholder="Источник"
                isSearchable={false}
                isClearable
                styles={filterSelectStyles}
                menuPortalTarget={menuPortalTarget}
                menuPosition="fixed"
                noOptionsMessage={() => "Ничего не найдено"}
              />
            </div>

            {activeFiltersCount > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setEmployeeFilter("");
                  setTypeFilter("");
                  setSourceTypeFilter("");
                  setPage(1);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "38px",
                  padding: "0 12px",
                  borderRadius: "10px",
                  border: "1px solid var(--color-brand-200)",
                  backgroundColor: "var(--color-brand-50)",
                  color: "var(--company-color)",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  marginLeft: "auto",
                }}
              >
                Сбросить
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="px-4 lg:px-6 py-5">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-end gap-3 border-b border-slate-100 px-4 py-2.5">
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
                  onClick={() => shiftDateFilter(-1)}
                  className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-transparent text-slate-600 transition hover:bg-white hover:border-slate-200"
                  aria-label="Предыдущий день"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="min-w-[150px] px-3 text-center text-[13px] font-semibold text-slate-700">
                  {dateFilterLabel}
                </span>
                <button
                  type="button"
                  onClick={() => shiftDateFilter(1)}
                  className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-transparent text-slate-600 transition hover:bg-white hover:border-slate-200"
                  aria-label="Следующий день"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            <div className="px-4 py-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200" style={{ borderTopColor: brandColor }} />
                </div>
              ) : isError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 text-[13px] text-rose-600">
                  Не удалось загрузить записи по посещаемости.
                  <button
                    type="button"
                    onClick={() => {
                      void refetch();
                    }}
                    className="ml-2 inline-flex h-8 items-center rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white transition hover:bg-rose-700"
                  >
                    Повторить
                  </button>
                </div>
              ) : records.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center">
                  <p className="m-0 text-[13px] text-slate-500">Записей по посещаемости пока нет</p>
                </div>
              ) : (
                <div className="relative space-y-3">
                  {isFetching ? (
                    <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-end rounded-xl bg-white/45 p-3">
                      <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-600 shadow-sm">
                        <span
                          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300"
                          style={{ borderTopColor: brandColor }}
                        />
                        Загрузка...
                      </div>
                    </div>
                  ) : null}
                  {actionError ? (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-600">
                      {actionError}
                    </div>
                  ) : null}

                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="py-2 text-[12px] font-semibold text-slate-500">Сотрудник</th>
                          <th className="py-2 text-[12px] font-semibold text-slate-500">Дата</th>
                          <th className="py-2 text-[12px] font-semibold text-slate-500">Приход</th>
                          <th className="py-2 text-[12px] font-semibold text-slate-500">Уход</th>
                          <th className="py-2 text-[12px] font-semibold text-slate-500">Опоздание</th>
                          <th className="py-2 text-[12px] font-semibold text-slate-500">Статус действия</th>
                          <th className="py-2 text-[12px] font-semibold text-slate-500">Статус заявки</th>
                          <th className="py-2 text-[12px] font-semibold text-slate-500">Источник</th>
                          <th className="py-2 text-[12px] font-semibold text-slate-500">Филиал</th>
                          <th className="py-2 text-right text-[12px] font-semibold text-slate-500">Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageItems.map((record) => {
                          const actionTag = getActionStatusTag(record.actionStatus);
                          const requestTag = getWorkflowStatusTag(record.requestStatus);
                          const sourceTag = getSourceTypeTag(record.sourceType);

                          const rowProcess = resolveRecordProcess(record);
                          const rowProgress = rowProcess
                            ? approvalProgressMap?.[record.guid] ?? null
                            : null;
                          const hasApprovalHistory =
                            (rowProgress?.approvals?.length ?? 0) > 0;
                          const showApprovalProgress =
                            Boolean(rowProcess) &&
                            (record.requestStatus === "requested" || hasApprovalHistory);
                          const rowApprovedStages = rowProcess
                            ? countApprovedStages(rowProcess, rowProgress)
                            : 0;

                          return (
                            <tr key={record.guid} className="border-b border-slate-100">
                              <td className="py-3 text-[13px] text-slate-800">
                                {record.employeeGuid ? (
                                  <Link
                                    to={`/employees/${record.employeeGuid}`}
                                    className="font-medium text-slate-800 transition hover:text-brand-500"
                                  >
                                    {record.employeeName}
                                  </Link>
                                ) : (
                                  <span>{record.employeeName}</span>
                                )}
                              </td>
                              <td className="py-3 text-[13px] text-slate-800">{formatDateLabel(record.date)}</td>
                              <td className="py-3 text-[13px] font-semibold text-slate-900">
                                {formatTimeLabel(record.checkInTime)}
                              </td>
                              <td className="py-3 text-[13px] font-semibold text-slate-900">
                                {formatTimeLabel(record.checkOutTime)}
                              </td>
                              <td className="py-3 text-[13px] font-semibold text-slate-900">
                                {getDelayLabel(record.delayTime, record.actionStatus)}
                              </td>
                              <td className="py-3 text-[13px] text-slate-700">
                                <span
                                  className={`inline-flex rounded-full border px-2.5 py-1 text-[12px] font-semibold ${actionTag.className}`}
                                >
                                  {actionTag.label}
                                </span>
                              </td>
                              <td className="py-3 text-[13px] text-slate-700">
                                <span
                                  className={`inline-flex rounded-full border px-2.5 py-1 text-[12px] font-semibold ${requestTag.className}`}
                                >
                                  {requestTag.label}
                                </span>
                                {showApprovalProgress && rowProcess ? (
                                  <div className="mt-1.5">
                                    <ApprovalProgressBadge
                                      title={rowProcess.title}
                                      approvedStages={rowApprovedStages}
                                      totalStages={rowProcess.stages.length}
                                      onClick={() => setApprovalRecord(record)}
                                    />
                                  </div>
                                ) : null}
                              </td>
                              <td className="py-3 text-[13px] text-slate-700">
                                <span
                                  className={`inline-flex rounded-full border px-2.5 py-1 text-[12px] font-semibold ${sourceTag.className}`}
                                >
                                  {sourceTag.label}
                                </span>
                              </td>
                              <td className="py-3 text-[13px] text-slate-700">
                                {record.location ? (
                                  <LocationViewLink
                                    value={record.location}
                                    office={offices.get(record.officeId)}
                                  />
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="py-3">
                                <div className="flex justify-end gap-2">
                                  {record.requestStatus === "requested" ? (
                                    rowProcess ? (
                                      <ApprovalProgressButton
                                        approvedStages={rowApprovedStages}
                                        totalStages={rowProcess.stages.length}
                                        onClick={() => setApprovalRecord(record)}
                                        disabled={isSaving}
                                      />
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          void handleConfirmRequested(record);
                                        }}
                                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-[12px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                                        title="Подтвердить"
                                      >
                                        <Check className="h-3.5 w-3.5" />
                                        Подтвердить
                                      </button>
                                    )
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() => setToDelete(record)}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-500 transition-colors hover:bg-rose-50"
                                    title="Удалить"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {totalPages > 1 ? (
                    <EmployeesPaginationFooter
                      visibleRangeLabel={visibleRangeLabel}
                      paginationItems={paginationItems}
                      currentPage={page}
                      totalPages={totalPages}
                      brandColor={brandColor}
                      onPrevious={() => setPage((prev) => Math.max(1, prev - 1))}
                      onNext={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                      onPageChange={(newPage) => setPage(newPage)}
                    />
                  ) : null}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        className="max-w-xl w-full p-0 overflow-visible"
      >
        <div className="border-b border-slate-200 px-6 py-5">
          <h4 className="m-0 text-[22px] font-bold text-slate-900">
            {editingGuid ? "Изменить посещаемость" : "Добавить посещаемость"}
          </h4>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
              Сотрудник
            </label>
            <EmployeeInfiniteSelect
              value={draft.employeeGuid}
              onChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  employeeGuid: value,
                }))
              }
              fallbackLabel={employeeFallbackLabel}
              placeholder="Выберите сотрудника"
              styles={getEmployeeSelectStyles()}
              menuPortalTarget={menuPortalTarget}
              classNamePrefix="attendance-employee-select"
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                Дата
              </label>
              <DatePicker
                selected={draft.date}
                onChange={(date) =>
                  setDraft((prev) => ({
                    ...prev,
                    date,
                  }))
                }
                dateFormat="dd.MM.yyyy"
                placeholderText="дд.мм.гггг"
                showMonthDropdown
                showYearDropdown
                dropdownMode="select"
                wrapperClassName="w-full"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-slate-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                Время прихода
              </label>
              <TimeInput
                value={draft.checkInTime}
                onChange={(next) =>
                  setDraft((prev) => ({
                    ...prev,
                    checkInTime: next,
                  }))
                }
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-slate-300"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                Время ухода
              </label>
              <TimeInput
                value={draft.checkOutTime}
                onChange={(next) =>
                  setDraft((prev) => ({
                    ...prev,
                    checkOutTime: next,
                  }))
                }
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-slate-300"
              />
            </div>
          </div>

          {formError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-600">
              {formError}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={closeModal}
            disabled={isSaving}
            className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="h-9 rounded-lg border border-transparent px-4 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: brandColor }}
          >
            {isSaving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(toDelete)}
        onClose={() => !isSaving && setToDelete(null)}
        className="max-w-md w-full p-6"
        showCloseButton={false}
      >
        <h4 className="m-0 text-[18px] font-bold text-slate-900">
          Удалить запись посещаемости?
        </h4>
        <p className="mb-6 mt-2 text-[13px] text-slate-500">
          Запись будет удалена без возможности восстановления.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setToDelete(null)}
            disabled={isSaving}
            className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isSaving}
            className="h-9 rounded-lg border border-rose-200 bg-rose-50 px-4 text-[13px] font-semibold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Удаление..." : "Удалить"}
          </button>
        </div>
      </Modal>

      <ApprovalProcessModal
        isOpen={Boolean(approvalRecord)}
        onClose={() => setApprovalRecord(null)}
        process={approvalRecordProcess ?? null}
        progress={
          approvalRecord ? approvalProgressMap?.[approvalRecord.guid] ?? null : null
        }
        onApproveStage={(stageId, comment) =>
          void handleApproveStage(stageId, comment)
        }
        isApprovingStage={approveStageMutation.isLoading}
        confirmLabel="Подтвердить запись"
        onConfirm={() => void finalizeApproval()}
        isConfirming={updateMutation.isLoading}
        onReject={(comment) => void rejectFromApproval(comment)}
        isRejecting={updateMutation.isLoading}
        readOnly={approvalRecord?.requestStatus !== "requested"}
      />
    </>
  );
}
