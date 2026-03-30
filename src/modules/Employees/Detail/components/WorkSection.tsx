import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  BriefcaseBusiness,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Plus,
  SquarePen,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Modal } from "../../../../components/ui/modal";
import { Dropdown } from "../../../../components/ui/dropdown/Dropdown";
import { DropdownItem } from "../../../../components/ui/dropdown/DropdownItem";
import RemoteSingleSelect, {
  type RemoteSelectOption,
} from "../../../../components/autocomplete/RemoteSingleSelect";
import httpRequest from "../../../../api/httpRequest";
import { useDepartmentsSettingsQuery } from "../../../../api/services/department.service";
import { useDepartmentExperienceLevelsSummaryQuery } from "../../../../api/services/departmentExperienceLevel.service";
import {
  type EmployeeWork,
  useCreateEmployeeWork,
  useDeleteEmployeeWork,
  useEmployeeWorksQuery,
  useUpdateEmployeeWork,
} from "../../../../api/services/employeeWork.service";
import encodeJsonToUrlParam from "../../../../utils/encodeJsonToUrlParam";

type WorkSectionProps = {
  employeeGuid: string;
  brandColor: string;
};

type WorkRecord = {
  guid: string;
  employmentTypeTitle: string;
  departmentTitle: string;
  divisionTitle: string;
  locationTitle: string;
  positionTitle: string;
  experienceLevelTitle: string;
  reasonTitle: string;
  salary: number | null;
  dateFrom: string;
  dateTo: string;
};

type WorkFormState = {
  employmentTypeId: string;
  departmentId: string;
  divisionId: string;
  locationId: string;
  positionsId: string;
  experienceLevelId: string;
  employeeWorkReasonId: string;
  salary: string;
  dateFrom: string;
  dateTo: string;
};

type WorkModalMode = "create" | "edit";

const EMPLOYEE_WORK_REASON_SLUG = "employee_work_reason";

const INPUT_CLASSNAME =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-slate-300";

const createEmptyFormState = (): WorkFormState => ({
  employmentTypeId: "",
  departmentId: "",
  divisionId: "",
  locationId: "",
  positionsId: "",
  experienceLevelId: "",
  employeeWorkReasonId: "",
  salary: "",
  dateFrom: "",
  dateTo: "",
});

const toRemoteOptions = (items: Array<{ guid: string; title?: string }>): RemoteSelectOption[] => {
  return items.map((item) => ({
    value: item.guid,
    label: item.title || "Без названия",
  }));
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

  return {
    count: Number(res?.count || 0),
    options: toRemoteOptions(
      Array.isArray(res?.response)
        ? (res.response as Array<{ guid: string; title?: string }>)
        : []
    ),
  };
};

const toIsoDate = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseIsoDate = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return null;
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
};

const getTimeValue = (value: string): number => {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const todayIso = toIsoDate(new Date());

const formatDate = (value: string): string => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = parsed.getFullYear();
  return `${day}.${month}.${year}`;
};

const formatTimelineDate = (dateFrom: string, dateTo: string): string => {
  if (!dateFrom) return "Дата не указана";
  if (!dateTo) return formatDate(dateFrom);
  return `${formatDate(dateFrom)} - ${formatDate(dateTo)}`;
};

const formatMonthYear = (value: string): string => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    month: "short",
    year: "numeric",
  })
    .format(parsed)
    .replace(".", "")
    .replace(/\sг$/u, "")
    .replace(/^\p{L}/u, (char) => char.toUpperCase());
};

const getDurationLabel = (dateFrom: string, dateTo: string): string => {
  const start = parseIsoDate(dateFrom);
  const end = dateTo ? parseIsoDate(dateTo) : new Date();
  if (!start || !end) return "";

  let months =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());

  if (end.getDate() < start.getDate()) {
    months -= 1;
  }

  const safeMonths = Math.max(months, 0);
  const years = Math.floor(safeMonths / 12);
  const restMonths = safeMonths % 12;

  if (years > 0 && restMonths > 0) return `${years} г. ${restMonths} мес.`;
  if (years > 0) return `${years} г.`;
  return `${Math.max(restMonths, 1)} мес.`;
};

const parseSalary = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const formatSalary = (value: number | null): string => {
  if (value === null) return "—";
  return `${new Intl.NumberFormat("ru-RU").format(value)} сум`;
};

const readString = (value: unknown): string => (typeof value === "string" ? value : "");

const buildFallbackOption = (value: string, label: string): RemoteSelectOption | null => {
  if (!value || !label) return null;
  return { value, label };
};

const compareEmployeeWorks = (left: EmployeeWork, right: EmployeeWork): number => {
  const leftIsCurrent = !readString(left.date_to);
  const rightIsCurrent = !readString(right.date_to);

  if (leftIsCurrent && !rightIsCurrent) return -1;
  if (!leftIsCurrent && rightIsCurrent) return 1;

  const byStartDate = getTimeValue(readString(right.date_from)) - getTimeValue(readString(left.date_from));
  if (byStartDate !== 0) return byStartDate;

  return getTimeValue(readString(right.created_at)) - getTimeValue(readString(left.created_at));
};

const normalizeRecord = (row: EmployeeWork): WorkRecord => {
  return {
    guid: row.guid,
    employmentTypeTitle:
      (typeof row.employment_types_id_data?.title === "string" &&
        row.employment_types_id_data.title) ||
      "—",
    departmentTitle:
      (typeof row.departments_id_data?.title === "string" && row.departments_id_data.title) ||
      "—",
    divisionTitle:
      (typeof row.divisions_id_data?.title === "string" && row.divisions_id_data.title) || "—",
    locationTitle:
      (typeof row.locations_id_data?.title === "string" && row.locations_id_data.title) || "—",
    positionTitle:
      (typeof row.positions_id_data?.title === "string" && row.positions_id_data.title) ||
      "Без должности",
    experienceLevelTitle:
      (typeof row.experience_levels_id_data?.title === "string" &&
        row.experience_levels_id_data.title) ||
      "—",
    reasonTitle:
      (typeof row.employee_work_reason_id_data?.title === "string" &&
        row.employee_work_reason_id_data.title) ||
      "—",
    salary: parseSalary(row.salary),
    dateFrom: readString(row.date_from),
    dateTo: readString(row.date_to),
  };
};

const buildFormState = (record: EmployeeWork | null, mode: WorkModalMode): WorkFormState => ({
  employmentTypeId: readString(record?.employment_types_id),
  departmentId: readString(record?.departments_id),
  divisionId: readString(record?.divisions_id),
  locationId: readString(record?.locations_id),
  positionsId: readString(record?.positions_id),
  experienceLevelId: readString(record?.experience_levels_id),
  employeeWorkReasonId: readString(record?.employee_work_reason_id),
  salary:
    record?.salary === null || record?.salary === undefined ? "" : String(record.salary),
  dateFrom:
    mode === "create"
      ? todayIso
      : readString(record?.date_from) || todayIso,
  dateTo: mode === "edit" ? readString(record?.date_to) : "",
});

const getWorkCountLabel = (count: number): string => {
  const lastTwoDigits = count % 100;
  const lastDigit = count % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
    return "записей";
  }

  if (lastDigit === 1) return "запись";
  if (lastDigit >= 2 && lastDigit <= 4) return "записи";
  return "записей";
};

function TimelineTag({
  children,
  tone = "neutral",
  brandColor,
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "success";
  brandColor?: string;
}) {
  const styles =
    tone === "success"
      ? {
          backgroundColor: "#dcfce7",
          color: "#166534",
        }
      : tone === "brand"
        ? {
            backgroundColor: `${brandColor || "#0f172a"}14`,
            color: brandColor || "#0f172a",
          }
        : {
            backgroundColor: "#f1f5f9",
            color: "#475569",
          };

  return (
    <span className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold" style={styles}>
      {children}
    </span>
  );
}

function WorkTimelineCard({
  record,
  brandColor,
  isCurrent,
  onToggleActions,
  actionButtonRef,
}: {
  record: WorkRecord;
  brandColor: string;
  isCurrent: boolean;
  onToggleActions: () => void;
  actionButtonRef: (element: HTMLButtonElement | null) => void;
}) {
  const primaryMeta = [record.departmentTitle, record.divisionTitle, record.locationTitle].filter(
    (item) => item && item !== "—"
  );
  const secondaryMeta = [record.experienceLevelTitle].filter((item) => item && item !== "—");
  const salaryValue = formatSalary(record.salary);
  const durationLabel = getDurationLabel(record.dateFrom, record.dateTo);

  return (
    <div
      className="rounded-[20px] border p-5 shadow-[0_2px_10px_rgba(15,23,42,0.05)] transition hover:border-slate-300 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)] sm:p-6"
      style={
        isCurrent
          ? {
              borderColor: `${brandColor}22`,
              background: `linear-gradient(135deg, ${brandColor}08 0%, #ffffff 35%)`,
            }
          : {
              borderColor: "#e2e8f0",
              backgroundColor: "#ffffff",
            }
      }
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
          style={{
            background: `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}CC 100%)`,
            color: "#ffffff",
          }}
        >
          <BriefcaseBusiness className="h-6 w-6" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="m-0 text-[16px] font-bold leading-6 text-slate-900 sm:text-[18px]">
                  {record.positionTitle}
                </h4>
                {isCurrent ? (
                  <TimelineTag tone="success">
                    Текущая должность
                  </TimelineTag>
                ) : null}
                {record.employmentTypeTitle !== "—" ? (
                  <TimelineTag tone="brand" brandColor={brandColor}>
                    {record.employmentTypeTitle}
                  </TimelineTag>
                ) : null}
              </div>
              <p className="m-0 mt-1 text-[14px] leading-6 text-slate-500">
                {primaryMeta.length > 0 ? primaryMeta.join(" • ") : "Структура не указана"}
              </p>
              {secondaryMeta.length > 0 ? (
                <p className="m-0 mt-1 text-[13px] leading-5 text-slate-400">
                  {secondaryMeta.join(" • ")}
                </p>
              ) : null}
            </div>

            <div className="relative shrink-0">
              <button
                type="button"
                onClick={onToggleActions}
                className="dropdown-toggle inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                aria-label="Открыть действия"
                ref={actionButtonRef}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-5 border-t border-slate-100 pt-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-[15px] text-slate-500">
                  <span className="font-medium">{formatMonthYear(record.dateFrom)}</span>
                  <span className="text-slate-300">-</span>
                  <span className="font-medium">
                    {record.dateTo ? formatMonthYear(record.dateTo) : "Настоящее время"}
                  </span>
                  {durationLabel ? (
                    <span className="ml-1 text-[13px] text-slate-400">({durationLabel})</span>
                  ) : null}
                </div>
              </div>

              <div className="text-left sm:text-right">
                <div className="flex items-center gap-2 sm:justify-end">
                  <Wallet className="h-4 w-4 text-slate-400" />
                  <p className="m-0 text-[18px] font-bold text-slate-900 sm:text-[20px]">
                    {salaryValue}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WorkSection({ employeeGuid, brandColor }: WorkSectionProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [modalMode, setModalMode] = useState<WorkModalMode>("create");
  const [editingRecordGuid, setEditingRecordGuid] = useState<string | null>(null);
  const [recordToDeleteGuid, setRecordToDeleteGuid] = useState<string | null>(null);
  const [modalSourceGuid, setModalSourceGuid] = useState<string | null>(null);
  const [openActionsFor, setOpenActionsFor] = useState<string | null>(null);
  const [form, setForm] = useState<WorkFormState>(createEmptyFormState());

  const actionButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const { data, isLoading } = useEmployeeWorksQuery({
    userBaseId: employeeGuid,
    limit: 100,
    offset: 0,
  });
  const { data: departmentsData } = useDepartmentsSettingsQuery({
    params: { limit: 200, offset: 0 },
  });

  const createEmployeeWork = useCreateEmployeeWork();
  const updateEmployeeWork = useUpdateEmployeeWork();
  const deleteEmployeeWork = useDeleteEmployeeWork();

  const isSaving = createEmployeeWork.isLoading || updateEmployeeWork.isLoading;
  const isDeleting = deleteEmployeeWork.isLoading;

  const sourceRecords = useMemo(() => {
    return Array.isArray(data?.response) ? (data.response as EmployeeWork[]) : [];
  }, [data?.response]);

  const sortedRecords = useMemo(() => {
    return [...sourceRecords].sort(compareEmployeeWorks);
  }, [sourceRecords]);

  const recordByGuid = useMemo(() => {
    return new Map(sortedRecords.map((record) => [record.guid, record]));
  }, [sortedRecords]);

  const currentRaw = useMemo(() => {
    return sortedRecords.find((record) => !readString(record.date_to)) || sortedRecords[0] || null;
  }, [sortedRecords]);

  const currentGuid = currentRaw?.guid || null;

  const timelineRecords = useMemo(() => {
    return sortedRecords.map((rawRecord) => ({
      raw: rawRecord,
      record: normalizeRecord(rawRecord),
      isCurrent: rawRecord.guid === currentGuid,
    }));
  }, [currentGuid, sortedRecords]);

  const currentTimelineRecord = useMemo(() => {
    return timelineRecords.find((item) => item.isCurrent) || timelineRecords[0] || null;
  }, [timelineRecords]);

  const historyTimelineRecords = useMemo(() => {
    if (!currentTimelineRecord) return [];
    return timelineRecords.filter((item) => item.record.guid !== currentTimelineRecord.record.guid);
  }, [currentTimelineRecord, timelineRecords]);

  const visibleTimelineRecords = useMemo(() => {
    if (!currentTimelineRecord) return [];
    if (!isHistoryExpanded) return [currentTimelineRecord];
    return [currentTimelineRecord, ...historyTimelineRecords];
  }, [currentTimelineRecord, historyTimelineRecords, isHistoryExpanded]);

  const editingRaw = useMemo(() => {
    if (!editingRecordGuid) return null;
    return recordByGuid.get(editingRecordGuid) || null;
  }, [editingRecordGuid, recordByGuid]);

  const modalSourceRecord = useMemo(() => {
    if (!modalSourceGuid) return null;
    return recordByGuid.get(modalSourceGuid) || null;
  }, [modalSourceGuid, recordByGuid]);

  const deletingTimelineRecord = useMemo(() => {
    if (!recordToDeleteGuid) return null;
    return timelineRecords.find((item) => item.record.guid === recordToDeleteGuid) || null;
  }, [recordToDeleteGuid, timelineRecords]);

  const departmentOptions = useMemo(() => {
    return Array.isArray(departmentsData?.response) ? departmentsData.response : [];
  }, [departmentsData?.response]);

  const departmentIds = useMemo(() => {
    return departmentOptions.map((department) => department.guid);
  }, [departmentOptions]);

  const { data: departmentExperienceLevelsSummary } = useDepartmentExperienceLevelsSummaryQuery({
    departmentIds,
  });

  const allowedExperienceLevelIds = useMemo(() => {
    if (!form.departmentId) return null;

    const ids = new Set<string>();
    for (const row of departmentExperienceLevelsSummary?.response || []) {
      if (row.departments_id === form.departmentId && row.experience_levels_id) {
        ids.add(row.experience_levels_id);
      }
    }
    return ids;
  }, [departmentExperienceLevelsSummary?.response, form.departmentId]);

  const departmentSelectOptions = useMemo<RemoteSelectOption[]>(() => {
    return departmentOptions.map((item) => ({
      value: item.guid,
      label: item.title,
    }));
  }, [departmentOptions]);

  useEffect(() => {
    if (!form.experienceLevelId) {
      return;
    }

    if (allowedExperienceLevelIds && !allowedExperienceLevelIds.has(form.experienceLevelId)) {
      setForm((prev) => ({ ...prev, experienceLevelId: "" }));
    }
  }, [allowedExperienceLevelIds, form.experienceLevelId]);

  useEffect(() => {
    if (historyTimelineRecords.length === 0 && isHistoryExpanded) {
      setIsHistoryExpanded(false);
    }
  }, [historyTimelineRecords.length, isHistoryExpanded]);

  const menuPortalTarget = typeof document !== "undefined" ? document.body : undefined;

  const employmentTypeFallbackOption = useMemo<RemoteSelectOption | null>(() => {
    return buildFallbackOption(
      form.employmentTypeId,
      typeof modalSourceRecord?.employment_types_id_data?.title === "string"
        ? modalSourceRecord.employment_types_id_data.title
        : ""
    );
  }, [form.employmentTypeId, modalSourceRecord]);

  const departmentFallbackOption = useMemo<RemoteSelectOption | null>(() => {
    if (!form.departmentId) return null;

    const existingOption = departmentSelectOptions.find((option) => option.value === form.departmentId);
    if (existingOption) return existingOption;

    return buildFallbackOption(
      form.departmentId,
      typeof modalSourceRecord?.departments_id_data?.title === "string"
        ? modalSourceRecord.departments_id_data.title
        : ""
    );
  }, [departmentSelectOptions, form.departmentId, modalSourceRecord]);

  const experienceLevelFallbackOption = useMemo<RemoteSelectOption | null>(() => {
    return buildFallbackOption(
      form.experienceLevelId,
      typeof modalSourceRecord?.experience_levels_id_data?.title === "string"
        ? modalSourceRecord.experience_levels_id_data.title
        : ""
    );
  }, [form.experienceLevelId, modalSourceRecord]);

  const divisionFallbackOption = useMemo<RemoteSelectOption | null>(() => {
    return buildFallbackOption(
      form.divisionId,
      typeof modalSourceRecord?.divisions_id_data?.title === "string"
        ? modalSourceRecord.divisions_id_data.title
        : ""
    );
  }, [form.divisionId, modalSourceRecord]);

  const locationFallbackOption = useMemo<RemoteSelectOption | null>(() => {
    return buildFallbackOption(
      form.locationId,
      typeof modalSourceRecord?.locations_id_data?.title === "string"
        ? modalSourceRecord.locations_id_data.title
        : ""
    );
  }, [form.locationId, modalSourceRecord]);

  const positionFallbackOption = useMemo<RemoteSelectOption | null>(() => {
    return buildFallbackOption(
      form.positionsId,
      typeof modalSourceRecord?.positions_id_data?.title === "string"
        ? modalSourceRecord.positions_id_data.title
        : ""
    );
  }, [form.positionsId, modalSourceRecord]);

  const workReasonFallbackOption = useMemo<RemoteSelectOption | null>(() => {
    return buildFallbackOption(
      form.employeeWorkReasonId,
      typeof modalSourceRecord?.employee_work_reason_id_data?.title === "string"
        ? modalSourceRecord.employee_work_reason_id_data.title
        : ""
    );
  }, [form.employeeWorkReasonId, modalSourceRecord]);

  const resetEditModal = () => {
    setIsEditModalOpen(false);
    setModalMode("create");
    setEditingRecordGuid(null);
    setModalSourceGuid(null);
    setForm(createEmptyFormState());
  };

  const openCreateModal = () => {
    setModalMode("create");
    setEditingRecordGuid(null);
    setModalSourceGuid(currentRaw?.guid || null);
    setForm(buildFormState(currentRaw, "create"));
    setIsEditModalOpen(true);
  };

  const openEditModal = (guid: string) => {
    const selectedRecord = recordByGuid.get(guid);
    if (!selectedRecord) return;

    setModalMode("edit");
    setEditingRecordGuid(guid);
    setModalSourceGuid(guid);
    setForm(buildFormState(selectedRecord, "edit"));
    setOpenActionsFor(null);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    if (isSaving) return;
    resetEditModal();
  };

  const toggleActionsMenu = (guid: string) => {
    setOpenActionsFor((prev) => (prev === guid ? null : guid));
  };

  const openDeleteModal = (guid: string) => {
    setRecordToDeleteGuid(guid);
    setOpenActionsFor(null);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    if (isDeleting) return;
    setIsDeleteModalOpen(false);
    setRecordToDeleteGuid(null);
  };

  const handleSave = async () => {
    if (!form.positionsId) {
      toast.error("Выберите должность");
      return;
    }

    if (!form.dateFrom) {
      toast.error("Укажите дату начала");
      return;
    }

    if (modalMode === "edit" && form.dateTo && form.dateTo < form.dateFrom) {
      toast.error("Дата окончания не может быть раньше даты начала");
      return;
    }

    const currentStartDate = readString(currentRaw?.date_from);
    if (modalMode === "create" && currentStartDate && form.dateFrom < currentStartDate) {
      toast.error("Дата начала новой должности не может быть раньше текущей записи");
      return;
    }

    const salaryRaw = form.salary.trim();
    let salaryValue: number | null = null;
    if (salaryRaw) {
      const parsedSalary = Number(salaryRaw.replace(/\s+/g, ""));
      if (!Number.isFinite(parsedSalary) || parsedSalary < 0) {
        toast.error("Оклад указан некорректно");
        return;
      }
      salaryValue = parsedSalary;
    }

    const payload = {
      employment_types_id: form.employmentTypeId || null,
      departments_id: form.departmentId || null,
      divisions_id: form.divisionId || null,
      locations_id: form.locationId || null,
      positions_id: form.positionsId || null,
      experience_levels_id: form.experienceLevelId || null,
      employee_work_reason_id: form.employeeWorkReasonId || null,
      salary: salaryValue,
      date_from: form.dateFrom,
      date_to: modalMode === "edit" ? form.dateTo || null : null,
    };

    try {
      if (modalMode === "edit") {
        if (!editingRaw) {
          toast.error("Не удалось найти запись для редактирования");
          return;
        }

        await updateEmployeeWork.mutateAsync({
          guid: editingRaw.guid,
          data: payload,
        });

        toast.success("Запись о работе обновлена");
        resetEditModal();
        return;
      }

      const previousGuid = currentRaw?.guid || "";
      const previousDateTo = currentRaw ? readString(currentRaw.date_to) || null : null;

      if (previousGuid) {
        await updateEmployeeWork.mutateAsync({
          guid: previousGuid,
          data: {
            date_to: form.dateFrom,
          },
        });
      }

      try {
        await createEmployeeWork.mutateAsync({
          user_base_id: employeeGuid,
          ...payload,
          date_to: null,
        });
      } catch (createError) {
        if (previousGuid) {
          try {
            await updateEmployeeWork.mutateAsync({
              guid: previousGuid,
              data: {
                date_to: previousDateTo,
              },
            });
          } catch {
            // noop rollback fallback
          }
        }
        throw createError;
      }

      toast.success("Новая должность добавлена");
      resetEditModal();
    } catch {
      toast.error(
        modalMode === "edit"
          ? "Не удалось сохранить изменения"
          : "Не удалось добавить должность"
      );
    }
  };

  const confirmDelete = async () => {
    if (!deletingTimelineRecord) return;

    const deleteIndex = timelineRecords.findIndex(
      (item) => item.record.guid === deletingTimelineRecord.record.guid
    );
    const previousRecord = deleteIndex >= 0 ? timelineRecords[deleteIndex + 1] || null : null;

    try {
      await deleteEmployeeWork.mutateAsync(deletingTimelineRecord.record.guid);

      if (deletingTimelineRecord.isCurrent && previousRecord) {
        try {
          await updateEmployeeWork.mutateAsync({
            guid: previousRecord.raw.guid,
            data: {
              date_to: null,
            },
          });
        } catch {
          toast.error("Запись удалена, но предыдущую должность не удалось сделать текущей");
          closeDeleteModal();
          return;
        }
      }

      toast.success("Запись о работе удалена");
      closeDeleteModal();
    } catch {
      toast.error("Не удалось удалить запись");
    }
  };

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span style={{ color: brandColor }}>
                <BriefcaseBusiness className="h-4 w-4" />
              </span>
              <h3 className="m-0 text-[15px] font-bold text-slate-900">Работа</h3>
            </div>
            <p className="m-0 mt-1 text-[13px] text-slate-500">
              {timelineRecords.length > 0
                ? `${timelineRecords.length} ${getWorkCountLabel(timelineRecords.length)} в истории работы`
                : "Добавьте первую должность, чтобы собрать карьерный timeline сотрудника"}
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: brandColor }}
            disabled={isSaving}
          >
            <Plus className="h-4 w-4" />
            Добавить должность
          </button>
        </div>

        <div className="px-5 py-5 sm:px-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <div
                className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200"
                style={{ borderTopColor: brandColor }}
              />
            </div>
          ) : timelineRecords.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center">
              <div
                className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{
                  backgroundColor: `${brandColor}14`,
                  color: brandColor,
                }}
              >
                <BriefcaseBusiness className="h-5 w-5" />
              </div>
              <p className="m-0 mt-4 text-[15px] font-semibold text-slate-900">
                История работы пока пуста
              </p>
              <p className="m-0 mt-1 text-[13px] text-slate-500">
                Добавьте первую должность, и здесь появится удобный timeline по всем изменениям.
              </p>
            </div>
          ) : (
            <div className="relative">
              {visibleTimelineRecords.length > 1 ? (
                <div
                  className="absolute left-4 top-4 bottom-4 w-px rounded-full"
                  style={{
                    background: `linear-gradient(180deg, ${brandColor} 0%, #e2e8f0 100%)`,
                  }}
                />
              ) : null}

              <div className="space-y-4">
                {visibleTimelineRecords.map((item) => (
                  <div key={item.record.guid} className="relative pl-12">
                    <div
                      className="absolute left-[9px] top-8 h-[14px] w-[14px] rounded-full border-[3px] border-white"
                      style={{
                        backgroundColor: item.isCurrent ? brandColor : "#ffffff",
                        boxShadow: item.isCurrent
                          ? `0 0 0 6px ${brandColor}1A`
                          : "0 0 0 1px #cbd5e1",
                      }}
                    />

                    <div className="relative">
                      <div className="mb-2 ml-1 flex flex-wrap items-center gap-2 text-[13px]">
                        <span className="font-medium text-slate-400">
                          {formatTimelineDate(item.record.dateFrom, item.record.dateTo)}
                        </span>
                        {item.record.reasonTitle !== "—" ? (
                          <span
                            className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold"
                            style={{
                              backgroundColor: `${brandColor}14`,
                              color: brandColor,
                            }}
                          >
                            {item.record.reasonTitle}
                          </span>
                        ) : null}
                      </div>

                      <div className="absolute right-0 top-0 z-10">
                        <Dropdown
                          isOpen={openActionsFor === item.record.guid}
                          onClose={() => setOpenActionsFor(null)}
                          className="w-40 p-1"
                          usePortal
                          anchorEl={actionButtonRefs.current[item.record.guid]}
                        >
                          <DropdownItem
                            onClick={() => openEditModal(item.record.guid)}
                            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                          >
                            <SquarePen className="h-4 w-4" />
                            Edit
                          </DropdownItem>
                          <DropdownItem
                            onClick={() => openDeleteModal(item.record.guid)}
                            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-error-600 hover:bg-error-50 hover:text-error-700"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </DropdownItem>
                        </Dropdown>
                      </div>

                      <WorkTimelineCard
                        record={item.record}
                        brandColor={brandColor}
                        isCurrent={item.isCurrent}
                        onToggleActions={() => toggleActionsMenu(item.record.guid)}
                        actionButtonRef={(element) => {
                          actionButtonRefs.current[item.record.guid] = element;
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {historyTimelineRecords.length > 0 ? (
                <div className="mt-4 flex justify-start">
                  <button
                    type="button"
                    onClick={() => {
                      setIsHistoryExpanded((prev) => !prev);
                      setOpenActionsFor(null);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    {isHistoryExpanded ? "Скрыть историю" : `Показать историю (${historyTimelineRecords.length})`}
                    {isHistoryExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={isEditModalOpen}
        onClose={closeEditModal}
        className="relative z-[120000] w-full max-w-[700px] overflow-visible p-0"
      >
        <div className="border-b border-slate-200 px-6 py-5">
          <h4 className="m-0 text-[24px] font-bold text-slate-900">
            {modalMode === "create" ? "Добавить должность" : "Редактировать должность"}
          </h4>
          <p className="m-0 mt-1 text-[13px] text-slate-500">
            {modalMode === "create"
              ? "Новая запись станет текущей, а предыдущая должность завершится выбранной датой."
              : "Обновите данные по выбранной записи в истории работы."}
          </p>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                Тип работы
              </label>
              <RemoteSingleSelect
                value={form.employmentTypeId}
                loadOptions={({ search, limit, offset }) =>
                  loadRemoteOptionsBySlug({
                    slug: "employment_types",
                    search,
                    limit,
                    offset,
                  })
                }
                fallbackOption={employmentTypeFallbackOption}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, employmentTypeId: value }))
                }
                placeholder="Выберите тип"
                disabled={isSaving}
                menuPortalTarget={menuPortalTarget}
                classNamePrefix="work-employment-type-select"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                Департамент
              </label>
              <RemoteSingleSelect
                value={form.departmentId}
                loadOptions={({ search, limit, offset }) =>
                  loadRemoteOptionsBySlug({
                    slug: "departments",
                    search,
                    limit,
                    offset,
                  })
                }
                fallbackOption={departmentFallbackOption}
                onChange={(value) => setForm((prev) => ({ ...prev, departmentId: value }))}
                placeholder="Выберите департамент"
                disabled={isSaving}
                menuPortalTarget={menuPortalTarget}
                classNamePrefix="work-department-select"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                Уровень
              </label>
              <RemoteSingleSelect
                value={form.experienceLevelId}
                loadOptions={async ({ search, limit, offset }) => {
                  const res = await loadRemoteOptionsBySlug({
                    slug: "experience_levels",
                    search,
                    limit,
                    offset,
                  });

                  return {
                    count: res.count,
                    options: res.options.filter(
                      (item) =>
                        !allowedExperienceLevelIds || allowedExperienceLevelIds.has(item.value)
                    ),
                  };
                }}
                fallbackOption={experienceLevelFallbackOption}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, experienceLevelId: value }))
                }
                placeholder={
                  form.departmentId ? "Выберите уровень" : "Сначала выберите департамент"
                }
                disabled={isSaving}
                menuPortalTarget={menuPortalTarget}
                classNamePrefix="work-experience-level-select"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                Подразделение
              </label>
              <RemoteSingleSelect
                value={form.divisionId}
                loadOptions={({ search, limit, offset }) =>
                  loadRemoteOptionsBySlug({
                    slug: "divisions",
                    search,
                    limit,
                    offset,
                  })
                }
                fallbackOption={divisionFallbackOption}
                onChange={(value) => setForm((prev) => ({ ...prev, divisionId: value }))}
                placeholder="Выберите подразделение"
                disabled={isSaving}
                menuPortalTarget={menuPortalTarget}
                classNamePrefix="work-division-select"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                Локация
              </label>
              <RemoteSingleSelect
                value={form.locationId}
                loadOptions={({ search, limit, offset }) =>
                  loadRemoteOptionsBySlug({
                    slug: "locations",
                    search,
                    limit,
                    offset,
                  })
                }
                fallbackOption={locationFallbackOption}
                onChange={(value) => setForm((prev) => ({ ...prev, locationId: value }))}
                placeholder="Выберите локацию"
                disabled={isSaving}
                menuPortalTarget={menuPortalTarget}
                classNamePrefix="work-location-select"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                Должность
              </label>
              <RemoteSingleSelect
                value={form.positionsId}
                loadOptions={({ search, limit, offset }) =>
                  loadRemoteOptionsBySlug({
                    slug: "positions",
                    search,
                    limit,
                    offset,
                  })
                }
                fallbackOption={positionFallbackOption}
                onChange={(value) => setForm((prev) => ({ ...prev, positionsId: value }))}
                placeholder="Выберите должность"
                disabled={isSaving}
                menuPortalTarget={menuPortalTarget}
                classNamePrefix="work-position-select"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
              Причина изменения
            </label>
            <RemoteSingleSelect
              value={form.employeeWorkReasonId}
              loadOptions={({ search, limit, offset }) =>
                loadRemoteOptionsBySlug({
                  slug: EMPLOYEE_WORK_REASON_SLUG,
                  search,
                  limit,
                  offset,
                })
              }
              fallbackOption={workReasonFallbackOption}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, employeeWorkReasonId: value }))
              }
              placeholder="Выберите причину"
              disabled={isSaving}
              menuPortalTarget={menuPortalTarget}
              classNamePrefix="work-reason-select"
            />
          </div>

          <div className={`grid grid-cols-1 gap-4 ${modalMode === "edit" ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                Оклад
              </label>
              <input
                type="number"
                min={0}
                step={1}
                placeholder="Например: 15000000"
                className={INPUT_CLASSNAME}
                value={form.salary}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, salary: event.target.value }))
                }
                disabled={isSaving}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                Дата начала
              </label>
              <DatePicker
                selected={parseIsoDate(form.dateFrom)}
                onChange={(date) =>
                  setForm((prev) => ({
                    ...prev,
                    dateFrom: date ? toIsoDate(date) : "",
                  }))
                }
                dateFormat="dd.MM.yyyy"
                placeholderText="дд.мм.гггг"
                showMonthDropdown
                showYearDropdown
                dropdownMode="select"
                popperClassName="work-date-picker-popper"
                calendarClassName="work-date-picker-calendar"
                wrapperClassName="work-date-picker-wrapper"
                showPopperArrow={false}
                className={INPUT_CLASSNAME}
                disabled={isSaving}
              />
            </div>

            {modalMode === "edit" ? (
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                  Дата окончания
                </label>
                <DatePicker
                  selected={parseIsoDate(form.dateTo)}
                  onChange={(date) =>
                    setForm((prev) => ({
                      ...prev,
                      dateTo: date ? toIsoDate(date) : "",
                    }))
                  }
                  isClearable
                  dateFormat="dd.MM.yyyy"
                  placeholderText="Оставьте пустым для текущей"
                  showMonthDropdown
                  showYearDropdown
                  dropdownMode="select"
                  popperClassName="work-date-picker-popper"
                  calendarClassName="work-date-picker-calendar"
                  wrapperClassName="work-date-picker-wrapper"
                  showPopperArrow={false}
                  className={INPUT_CLASSNAME}
                  disabled={isSaving}
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={closeEditModal}
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
            {isSaving
              ? modalMode === "create"
                ? "Добавление..."
                : "Сохранение..."
              : modalMode === "create"
                ? "Добавить"
                : "Сохранить"}
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        showCloseButton={false}
        className="mx-4 w-full max-w-[360px] overflow-hidden rounded-2xl border border-gray-200 p-0 shadow-xl"
      >
        <div className="border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">Удалить запись</h3>
            <button
              type="button"
              onClick={closeDeleteModal}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              aria-label="Закрыть"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="space-y-3 px-4 py-4 text-center">
          <p className="text-sm text-gray-500">Это действие нельзя отменить.</p>
          <p className="text-sm text-gray-700">
            {deletingTimelineRecord
              ? `Удалить запись "${deletingTimelineRecord.record.positionTitle}" из истории работы?`
              : "Вы уверены, что хотите удалить эту запись?"}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={closeDeleteModal}
              disabled={isDeleting}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={isDeleting}
              className="w-full rounded-lg bg-error-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-error-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDeleting ? "Удаление..." : "Удалить"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
