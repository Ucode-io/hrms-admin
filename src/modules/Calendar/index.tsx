import { type ChangeEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { ChevronLeft, ChevronRight, Clock3, Plus, Search } from "lucide-react";
import { useQueryClient } from "react-query";
import { toast } from "sonner";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import { Modal } from "../../components/ui/modal";
import AbsenceRequestModal from "../../components/absences/AbsenceRequestModal";
import {
  type Absence,
  type AbsenceRequestStatus,
  useCalendarAbsencesQuery,
  useCreateAbsence,
  useUpdateAbsence,
} from "../../api/services/absenceRequest.service";
import { type Employee, useEmployeesQuery } from "../../api/services/employee.service";
import { useSettingsDirectoryQuery } from "../../api/services/settingsDirectory.service";
import {
  useAbsenceBalanceTransactionsQuery,
  useCreateAbsenceBalanceTransaction,
} from "../../api/services/absenceBalanceTransaction.service";
import { useUploadFile } from "../../api/services/file-upload.service";

const PAGE_SIZE = 20;
const DAY_MS = 24 * 60 * 60 * 1000;
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

const buildTimelineCells = ({
  absences,
  days,
  monthStart,
  onSegmentClick,
}: {
  absences: NormalizedAbsence[];
  days: DayColumn[];
  monthStart: Date;
  onSegmentClick: (absence: Segment) => void;
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
      cells.push(
        <td
          key={`empty-${day.dateKey}`}
          className={`h-14 min-w-[44px] border-b border-r border-gray-100 ${
            day.isWeekend ? "bg-gray-50/70" : "bg-white"
          }`}
        />
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
          onClick={() => onSegmentClick(segment)}
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
    cells.push(
      <td
        key={`tail-${day.dateKey}`}
        className={`h-14 min-w-[44px] border-b border-r border-gray-100 ${
          day.isWeekend ? "bg-gray-50/70" : "bg-white"
        }`}
      />
    );
  }

  return cells;
};

export default function CalendarModule() {
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createEmployeeId, setCreateEmployeeId] = useState("");
  const [createPolicyId, setCreatePolicyId] = useState("");
  const [createDateFrom, setCreateDateFrom] = useState("");
  const [createDateTo, setCreateDateTo] = useState("");
  const [createNote, setCreateNote] = useState("");
  const [createAttachments, setCreateAttachments] = useState<AttachmentItem[]>([]);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [selectedAbsence, setSelectedAbsence] = useState<SelectedAbsence | null>(null);
  const [reviewStatusInProgress, setReviewStatusInProgress] = useState<AbsenceRequestStatus | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const updateAbsenceMutation = useUpdateAbsence();
  const createAbsenceMutation = useCreateAbsence();
  const createBalanceTransactionMutation = useCreateAbsenceBalanceTransaction();
  const uploadFileMutation = useUploadFile({ folder: "Media" });
  const todayIso = useMemo(() => toIsoDate(new Date()), []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchValue.trim());
      setCurrentPage(1);
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchValue]);

  const monthDays = useMemo(() => buildMonthDays(currentMonth), [currentMonth]);
  const monthStartIso = monthDays[0]?.dateKey || "";
  const monthEndIso = monthDays[monthDays.length - 1]?.dateKey || "";

  const { data: employeesData, isLoading: isEmployeesLoading } = useEmployeesQuery({
    limit: PAGE_SIZE,
    offset: (currentPage - 1) * PAGE_SIZE,
    search: debouncedSearch || undefined,
  });

  const employees = useMemo(() => {
    return ((employeesData?.response || []) as Employee[]).filter(
      (employee) => typeof employee.guid === "string" && Boolean(employee.guid)
    );
  }, [employeesData?.response]);

  const employeeIds = useMemo(() => employees.map((employee) => employee.guid), [employees]);

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

  const { data: createBalanceTransactionsData } = useAbsenceBalanceTransactionsQuery({
    data: {
      user_base_id: createEmployeeId,
      limit: 2000,
      offset: 0,
    },
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
    },
  });

  const normalizedAbsences = useMemo(() => {
    const source = (absencesData?.response || []) as Absence[];
    return source
      .map((item) => normalizeAbsence(item, policiesById))
      .filter((absence): absence is NormalizedAbsence => Boolean(absence));
  }, [absencesData?.response, policiesById]);

  const lastKnownTotalCountRef = useRef(0);
  if (typeof employeesData?.count === "number" && Number.isFinite(employeesData.count)) {
    lastKnownTotalCountRef.current = employeesData.count;
  }

  const totalCount = employeesData?.count ?? lastKnownTotalCountRef.current;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  useEffect(() => {
    if (isEmployeesLoading) return;
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, isEmployeesLoading, totalPages]);

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
  const isLoading = isEmployeesLoading || isAbsencesLoading;
  const companyMainColor = "var(--color-brand-500)";
  const isReviewing = updateAbsenceMutation.isLoading || createBalanceTransactionMutation.isLoading;
  const createBreakdown = useMemo(() => getDateBreakdown(createDateFrom, createDateTo), [createDateFrom, createDateTo]);
  const createRequestedDays = createBreakdown.length;
  const createBalanceByPolicy = useMemo(() => {
    const map = new Map<string, number>();
    const source = (createBalanceTransactionsData?.response || []) as Array<{
      absence_policies_id?: unknown;
      amount?: unknown;
      value?: unknown;
      days?: unknown;
    }>;

    for (const item of source) {
      const policyId = typeof item.absence_policies_id === "string" ? item.absence_policies_id : "";
      if (!policyId) continue;

      const amount = resolveNumericValue(item.amount ?? item.value ?? item.days, 0);
      map.set(policyId, (map.get(policyId) || 0) + amount);
    }

    return map;
  }, [createBalanceTransactionsData?.response]);

  const createSelectedPolicy = useMemo(() => {
    if (!createPolicyId) return null;
    return policiesById.get(createPolicyId) || null;
  }, [createPolicyId, policiesById]);

  const createAvailableDays = useMemo(() => {
    if (!createSelectedPolicy || !createPolicyId) return 0;
    const limit = resolveNumericValue(createSelectedPolicy.value, 0);
    const balance = createBalanceByPolicy.get(createPolicyId) || 0;
    return limit + balance;
  }, [createBalanceByPolicy, createPolicyId, createSelectedPolicy]);

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
      await updateAbsenceMutation.mutateAsync({
        guid: selectedAbsence.guid,
        data: {
          status: [status],
          reviewed_at: new Date().toISOString(),
        },
      });

      if (status === "approved") {
        await createBalanceTransactionMutation.mutateAsync({
          user_base_id: selectedAbsence.userBaseId,
          absence_policies_id: selectedAbsence.absencePolicyId || null,
          absences_id: selectedAbsence.guid,
          amount: -Math.abs(selectedAbsence.requestedDays || 0),
          transaction_type: ["absence_approved"],
          date: selectedAbsence.dateFrom || toIsoDate(new Date()),
        });
      }

      await queryClient.invalidateQueries(["calendar-absences"]);

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

      <div className="flex h-[calc(100vh-96px)] min-h-0 flex-col gap-4 overflow-hidden md:h-[calc(100vh-112px)]">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold text-gray-900">Календарь</h1>

          <Button
            className="h-10 rounded-xl px-3.5 text-sm"
            startIcon={<Plus size={15} />}
            onClick={openCreateModal}
          >
            Запрос на отсутствие
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-gray-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white p-1">
                <button
                  type="button"
                  onClick={() =>
                    setCurrentMonth(
                      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                    )
                  }
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition hover:bg-gray-100"
                  aria-label="Предыдущий месяц"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="px-2 text-sm font-semibold text-gray-700">{monthLabel}</span>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentMonth(
                      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                    )
                  }
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition hover:bg-gray-100"
                  aria-label="Следующий месяц"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <Button
                variant="outline"
                className="h-10 rounded-lg px-4 text-sm"
                onClick={() => {
                  const now = new Date();
                  setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                }}
              >
                Текущий месяц
              </Button>
            </div>

            <label className="relative block w-full max-w-[320px]">
              <Search
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Поиск сотрудника..."
                className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
              />
            </label>
          </div>

          <div className="px-4 py-3 text-sm text-gray-500">
            {totalCount > 0
              ? `Отображение ${(currentPage - 1) * PAGE_SIZE + 1} - ${Math.min(
                  currentPage * PAGE_SIZE,
                  totalCount
                )} из ${totalCount}`
              : "Сотрудники не найдены"}
          </div>

          <div className="min-h-0 flex-1 max-w-full overflow-auto border-t border-gray-100">
            <table
              className="border-separate border-spacing-0"
              style={{ minWidth: 280 + monthDays.length * 44 }}
            >
              <thead>
                <tr>
                  <th className="sticky top-0 left-0 z-40 min-w-[280px] border-b border-r border-gray-100 bg-gray-50 px-4 py-2 text-left text-xs font-semibold text-gray-600">
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
                        <td className="sticky left-0 z-10 h-14 min-w-[280px] border-b border-r border-gray-100 bg-white px-4 py-2">
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
                      const timelineCells = buildTimelineCells({
                        absences: rowAbsences,
                        days: monthDays,
                        monthStart: currentMonth,
                        onSegmentClick: (absence) =>
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
                          }),
                      });

                      return (
                        <tr key={employee.guid} className="group">
                          <td className="sticky left-0 z-10 min-w-[280px] border-b border-r border-gray-100 bg-white px-4 py-2 group-hover:bg-slate-50/70">
                            <div className="flex items-center gap-3">
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
                                <div className="truncate text-sm font-semibold text-gray-900">{fullName}</div>
                                <div className="truncate text-xs text-gray-500">{subtitle || "—"}</div>
                              </div>
                            </div>
                          </td>
                          {timelineCells}
                        </tr>
                      );
                    })
                  : null}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-4 py-3">
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Предыдущая страница"
            >
              <ChevronLeft size={16} />
            </button>

            <span className="min-w-[72px] text-center text-sm font-medium text-gray-700">
              {currentPage} / {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Следующая страница"
            >
              <ChevronRight size={16} />
            </button>
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

      <Modal
        isOpen={Boolean(selectedAbsence)}
        onClose={closeReviewModal}
        className="max-w-[520px] p-0"
      >
        <div className="border-b border-gray-100 px-6 py-4">
          <h3 className="text-xl font-semibold text-gray-900">Рассмотреть отсутствие</h3>
        </div>

        {selectedAbsence ? (
          <div className="space-y-4 px-6 py-5">
            <div className="space-y-1">
              <p className="text-sm text-gray-500">Сотрудник</p>
              <p className="text-base font-semibold text-gray-900">{selectedAbsence.employeeName}</p>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-gray-500">Тип отсутствия</p>
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md"
                  style={{ backgroundColor: withOpacity(selectedAbsence.color, 0.14) }}
                >
                  <Icon icon={selectedAbsence.icon} className="h-4 w-4" color={selectedAbsence.color} />
                </span>
                <span className="text-sm font-semibold text-gray-900">{selectedAbsence.title}</span>
                <span
                  className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                    STATUS_BADGE_CLASSNAME[selectedAbsence.status]
                  }`}
                >
                  {STATUS_LABELS[selectedAbsence.status]}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="text-xs text-gray-500">Дата начала</p>
                <p className="mt-0.5 text-sm font-semibold text-gray-900">
                  {formatDateRu(selectedAbsence.dateFrom)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="text-xs text-gray-500">Дата окончания</p>
                <p className="mt-0.5 text-sm font-semibold text-gray-900">
                  {formatDateRu(selectedAbsence.dateTo)}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-500">Запрошено дней</p>
              <p className="mt-0.5 text-sm font-semibold text-gray-900">{selectedAbsence.requestedDays}</p>
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
          <Button
            variant="outline"
            className="h-10 px-4"
            onClick={closeReviewModal}
            disabled={isReviewing}
          >
            Отмена
          </Button>
          <button
            type="button"
            onClick={() => handleReviewAbsence("rejected")}
            disabled={
              isReviewing ||
              !selectedAbsence ||
              selectedAbsence.status !== "pending"
            }
            className="inline-flex h-10 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {reviewStatusInProgress === "rejected" ? "Отклонение..." : "Отклонить"}
          </button>
          <button
            type="button"
            onClick={() => handleReviewAbsence("approved")}
            disabled={
              isReviewing ||
              !selectedAbsence ||
              selectedAbsence.status !== "pending"
            }
            className="inline-flex h-10 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {reviewStatusInProgress === "approved" ? "Подтверждение..." : "Подтвердить"}
          </button>
        </div>
      </Modal>
    </>
  );
}
