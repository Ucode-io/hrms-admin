import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BriefcaseBusiness,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  MoreHorizontal,
  Plus,
  RotateCcw,
  SquarePen,
  Trash2,
  TriangleAlert,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import "react-datepicker/dist/react-datepicker.css";
import { Modal } from "../../../../components/ui/modal";
import { Dropdown } from "../../../../components/ui/dropdown/Dropdown";
import { DropdownItem } from "../../../../components/ui/dropdown/DropdownItem";
import type { RemoteSelectOption } from "../../../../components/autocomplete/RemoteSingleSelect";
import httpRequest from "../../../../api/httpRequest";
import { useDepartmentsSettingsQuery } from "../../../../api/services/department.service";
import { usePositionsQuery } from "../../../../api/services/position.service";
import { useExperienceLevelsQuery } from "../../../../api/services/experienceLevel.service";
import { onboardingTasksService } from "../../../../api/services/onboardingTasks.service";
import {
  default as employeeWorkService,
  type EmployeeWork,
  useCreateEmployeeWork,
  useDeleteEmployeeWork,
  useEmployeeWorksQuery,
  useUpdateEmployeeWork,
} from "../../../../api/services/employeeWork.service";
import {
  useEmployeeQuery,
  useUpdateEmployee,
} from "../../../../api/services/employee.service";
import {
  EMPLOYEE_WORK_ENTITY_TYPE,
  EMPLOYEE_WORK_PROCESS_TYPE,
  type EmployeeWorkRequest,
  type EmployeeWorkRequestPayload,
  useDeleteEmployeeWorkRequest,
  useEmployeeWorkRequestsQuery,
  useReviewEmployeeWorkRequest,
  useSaveEmployeeWorkRequest,
} from "../../../../api/services/employeeWorkRequest.service";
import {
  findApprovalProcessFor,
  useApprovalProcessesQuery,
  useApproveStage,
  useEntityApprovalsQuery,
} from "../../../../api/services/approval.service";
import {
  countApprovedStages,
  isProcessComplete,
} from "../../../Settings/Approvals/approvalRuntime";
import ApprovalProcessModal from "../../../../components/approvals/ApprovalProcessModal";
import ApprovalProgressButton from "../../../../components/approvals/ApprovalProgressButton";
import { useGradeMatrixQuery } from "../../../../api/services/gradeMatrix.service";
import { formatTenure } from "../../../Settings/GradeMatrix/constants";
import { useSalaryPolicy } from "../../../Settings/GradeMatrix/useSalaryPolicy";
import encodeJsonToUrlParam from "../../../../utils/encodeJsonToUrlParam";
import { useCustomFieldsSchema } from "../../../Settings/CustomFields/useCustomFieldsSchema";
import { formatDynamicValue } from "../../../Settings/CustomFields/formatValue";
import {
  dynamicFieldDefault,
  validateDynamicValue,
} from "../../Form/layout/DynamicFieldControl";
import { useFormLayout } from "../../Form/layout/useEmployeeFormLayout";
import WorkFieldsArea from "./work-layout/WorkFieldsArea";
import { createDefaultWorkLayout } from "./work-layout/defaultWorkLayout";
import {
  WORK_FIELDS,
  type WorkFieldContext,
  type WorkFormState,
  type WorkModalMode,
} from "./work-layout/workFields";

type WorkSectionProps = {
  employeeGuid: string;
  brandColor: string;
  /** Департамент сотрудника — от него зависит процесс согласования изменений. */
  departmentId?: string | null;
  returnRequestKey?: number;
  onEmployeeReturned?: () => Promise<void> | void;
};

type WorkRecord = {
  guid: string;
  /** Нужны для сверки записи с матрицей грейдов — по названиям её не сделать. */
  positionId: string;
  experienceLevelId: string;
  employmentTypeTitle: string;
  departmentTitle: string;
  divisionTitle: string;
  locationTitle: string;
  positionTitle: string;
  experienceLevelTitle: string;
  reasonTitle: string;
  workScheduleTitle: string;
  salary: number | null;
  dateFrom: string;
  dateTo: string;
};


const EMPLOYEE_WORK_REASON_SLUG = "employee_work_reason";

/** Таблица динамических полей и раскладки, к которой относится эта модалка. */
const CUSTOM_FIELDS_ENTITY = "employee_works";

const WORK_LAYOUT_REGISTRY = {
  createDefault: createDefaultWorkLayout,
  staticFields: WORK_FIELDS,
};

/** Значения динамических полей хранятся в контейнере — поле JSON, приходит строкой. */
const parseCustomData = (raw: unknown): Record<string, unknown> => {
  if (!raw) return {};

  if (typeof raw !== "string") {
    return typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    console.error("Failed to parse custom_data:", error);
    return {};
  }
};
const RETURN_WORK_REASON_TITLE = "Обратный прием";

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
  workScheduleId: "",
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
    positionId: readString(row.positions_id),
    experienceLevelId: readString(row.experience_levels_id),
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
    workScheduleTitle:
      (typeof row.work_schedule_id_data?.title === "string" &&
        row.work_schedule_id_data.title) ||
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
  workScheduleId: readString(record?.work_schedule_id),
  salary:
    record?.salary === null || record?.salary === undefined ? "" : String(record.salary),
  dateFrom:
    mode === "edit"
      ? readString(record?.date_from) || todayIso
      : todayIso,
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
  tone?: "neutral" | "brand" | "success" | "warning" | "error";
  brandColor?: string;
}) {
  const styles =
    tone === "success"
      ? {
          backgroundColor: "#dcfce7",
          color: "#166534",
        }
      : tone === "warning"
        ? {
            backgroundColor: "#fef3c7",
            color: "#b45309",
          }
        : tone === "error"
          ? {
              backgroundColor: "#fee2e2",
              color: "#b91c1c",
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
  customValues,
  gradeMismatch,
  onToggleActions,
  actionButtonRef,
}: {
  record: WorkRecord;
  brandColor: string;
  isCurrent: boolean;
  /** Заполненные динамические поля записи: подпись → значение. */
  customValues: Array<{ key: string; label: string; text: string }>;
  /** Расхождение с матрицей грейдов: цвет задаёт настройка компании. */
  gradeMismatch: { tone: "warning" | "error"; messages: string[] } | null;
  onToggleActions: () => void;
  actionButtonRef: (element: HTMLButtonElement | null) => void;
}) {
  const primaryMeta = [record.departmentTitle, record.divisionTitle, record.locationTitle].filter(
    (item) => item && item !== "—"
  );
  const secondaryMeta = [
    record.experienceLevelTitle,
    record.workScheduleTitle !== "—" ? `График: ${record.workScheduleTitle}` : "",
  ].filter((item) => item && item !== "—");
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
                {gradeMismatch ? (
                  <TimelineTag tone={gradeMismatch.tone}>
                    <TriangleAlert size={12} className="mr-1" />
                    Не по матрице грейдов
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

          {/* Что именно разошлось — рядом с меткой, а не в подсказке: иначе
              «не по матрице» приходится расшифровывать, открывая форму. */}
          {gradeMismatch ? (
            <div
              className={`mt-3 rounded-xl border px-3 py-2 text-[13px] leading-5 ${
                gradeMismatch.tone === "error"
                  ? "border-error-200 bg-error-50 text-error-600"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              {gradeMismatch.messages.map((message) => (
                <p key={message} className="m-0">
                  {message}
                </p>
              ))}
            </div>
          ) : null}

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

            {/* Динамические поля записи — только заполненные, чтобы не разду­вать карточку */}
            {customValues.length > 0 ? (
              <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                {customValues.map((item) => (
                  <div key={item.key} className="flex items-baseline gap-2">
                    <span className="text-[13px] text-slate-400">{item.label}</span>
                    <span className="text-[13px] font-medium text-slate-700">{item.text}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WorkSection({
  employeeGuid,
  brandColor,
  departmentId,
  returnRequestKey = 0,
  onEmployeeReturned,
}: WorkSectionProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [modalMode, setModalMode] = useState<WorkModalMode>("create");
  const [editingRecordGuid, setEditingRecordGuid] = useState<string | null>(null);
  const [recordToDeleteGuid, setRecordToDeleteGuid] = useState<string | null>(null);
  const [modalSourceGuid, setModalSourceGuid] = useState<string | null>(null);
  const [openActionsFor, setOpenActionsFor] = useState<string | null>(null);
  const [form, setForm] = useState<WorkFormState>(createEmptyFormState());
  const [customData, setCustomData] = useState<Record<string, unknown>>({});
  const [customErrors, setCustomErrors] = useState<Record<string, string>>({});
  const [returnWorkReasonId, setReturnWorkReasonId] = useState("");
  /** Непустой список открывает модал-предупреждение перед сохранением. */
  const [dateWarnings, setDateWarnings] = useState<string[]>([]);
  /** Расхождения с матрицей грейдов в строгом режиме — запрет, а не вопрос. */
  const [gradeErrors, setGradeErrors] = useState<string[]>([]);

  const actionButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const lastReturnRequestKeyRef = useRef(0);

  const { data, isLoading } = useEmployeeWorksQuery({
    userBaseId: employeeGuid,
    limit: 100,
    offset: 0,
  });
  // Дата приёма живёт в карточке сотрудника, а не в записях о работе — сверять
  // с ней даты должностей можно только вытащив её отдельно.
  const { data: employeeData } = useEmployeeQuery(employeeGuid);
  // Грейды нужны ради минимального стажа уровня: он выводится из матрицы
  // грейдов (стаж задаёт колонка), а проверять его надо здесь, при назначении
  // уровня сотруднику.
  const { data: gradeData } = useGradeMatrixQuery();
  // Насколько строго оклад обязан укладываться в матрицу грейдов — настройка
  // компании на странице «Главная».
  const salaryPolicy = useSalaryPolicy();
  const { check: checkGrades, tone: gradeTone } = salaryPolicy;
  const { data: departmentsData } = useDepartmentsSettingsQuery({
    params: { limit: 200, offset: 0 },
  });
  const { data: positionsData } = usePositionsQuery({ params: { all: true } });
  const { data: experienceLevelsData } = useExperienceLevelsQuery({
    params: { limit: 1000, offset: 0 },
  });

  /* ── Динамические поля таблицы employee_works ── */
  const { schema, getFields } = useCustomFieldsSchema();
  const dynamicFields = useMemo(
    () => getFields(CUSTOM_FIELDS_ENTITY).filter((field) => !field.system),
    [getFields]
  );
  /** Контейнер под значения появляется, только когда он заведён в u-code. */
  const valuesField = useMemo(
    () =>
      schema.entities.find((entity) => entity.id === CUSTOM_FIELDS_ENTITY)?.valuesField ??
      null,
    [schema.entities]
  );

  const workLayout = useFormLayout(
    CUSTOM_FIELDS_ENTITY,
    useMemo(() => dynamicFields.map((field) => field.id), [dynamicFields]),
    WORK_LAYOUT_REGISTRY
  );
  const [builderMode, setBuilderMode] = useState(false);

  /**
   * Правки раскладки копятся локально и уходят одним запросом по «Готово» —
   * из конструктора выходим только после успешного сохранения.
   */
  const handleToggleBuilder = async () => {
    if (!builderMode) {
      setBuilderMode(true);
      return;
    }

    try {
      await workLayout.save();
      setBuilderMode(false);
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Не удалось сохранить раскладку формы."
      );
    }
  };

  /** Значения записи + дефолты для полей, которых в ней ещё нет. */
  const buildCustomData = useCallback(
    (record: EmployeeWork | null): Record<string, unknown> => {
      const stored = parseCustomData(record?.custom_data);
      const next: Record<string, unknown> = { ...stored };

      dynamicFields.forEach((field) => {
        if (next[field.key] === undefined) next[field.key] = dynamicFieldDefault(field);
      });

      return next;
    },
    [dynamicFields]
  );

  const createEmployeeWork = useCreateEmployeeWork();
  const updateEmployeeWork = useUpdateEmployeeWork();
  const deleteEmployeeWork = useDeleteEmployeeWork();
  const updateEmployee = useUpdateEmployee();

  // --- Согласование изменений в работе -------------------------------------
  // Если на департамент сотрудника настроен процесс `employee_work_approval`,
  // добавление и правка должности уходят в заявку и применяются к
  // `employee_works` только после всех этапов. Процесса нет — пишем напрямую,
  // как раньше: иначе фича сломала бы всех, у кого согласование не настроено.
  const { data: approvalProcesses } = useApprovalProcessesQuery();
  const workApprovalProcess = useMemo(
    () => findApprovalProcessFor(approvalProcesses ?? [], EMPLOYEE_WORK_PROCESS_TYPE, departmentId),
    [approvalProcesses, departmentId]
  );

  const { data: workRequests } = useEmployeeWorkRequestsQuery(
    employeeGuid,
    Boolean(workApprovalProcess)
  );
  const saveWorkRequest = useSaveEmployeeWorkRequest();
  const reviewWorkRequest = useReviewEmployeeWorkRequest();
  const deleteWorkRequest = useDeleteEmployeeWorkRequest();
  const approveStage = useApproveStage();

  const [approvalRequest, setApprovalRequest] = useState<EmployeeWorkRequest | null>(null);

  const pendingRequests = useMemo(
    () => (workRequests ?? []).filter((request) => request.status === "pending"),
    [workRequests]
  );

  const pendingRequestIds = useMemo(
    () => pendingRequests.map((request) => request.guid),
    [pendingRequests]
  );

  const { data: approvalProgressMap } = useEntityApprovalsQuery(
    EMPLOYEE_WORK_ENTITY_TYPE,
    pendingRequestIds
  );

  const isSaving =
    createEmployeeWork.isLoading || updateEmployeeWork.isLoading || saveWorkRequest.isLoading;
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
    return sortedRecords.map((rawRecord) => {
      const stored = parseCustomData(rawRecord.custom_data);
      const record = normalizeRecord(rawRecord);

      // Сверяем каждую запись, а не только текущую: расхождение в истории
      // видно там же, где его завели, и не приходится открывать форму.
      const gradeCheck = checkGrades({
        positionId: record.positionId,
        levelId: record.experienceLevelId,
        salary: record.salary,
      });

      return {
        raw: rawRecord,
        record,
        isCurrent: rawRecord.guid === currentGuid,
        gradeMismatch:
          gradeCheck.status === "mismatch"
            ? { tone: gradeTone, messages: gradeCheck.issues.map((issue) => issue.message) }
            : null,
        // В карточке показываем только заполненные поля: пустые строки её бы
        // растянули без пользы (в отличие от списка полей на детальной).
        customValues: dynamicFields
          .map((field) => ({
            key: field.key,
            label: field.label,
            text: formatDynamicValue(field, stored[field.key]).text,
          }))
          .filter((item) => item.text),
      };
    });
  }, [checkGrades, currentGuid, dynamicFields, gradeTone, sortedRecords]);

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

  const hireDate = readString(employeeData?.date_hire);

  const gradeByLevelId = useMemo(
    () =>
      new Map(
        (gradeData?.levels ?? []).map((level) => [
          level.id,
          { title: level.title, minMonths: level.minMonths },
        ])
      ),
    [gradeData]
  );

  /**
   * Форма против матрицы грейдов: уровень должен быть в лестнице должности, а
   * оклад — не выше потолка его ступени. Нечисловой оклад здесь игнорируем:
   * его ловит отдельная проверка при сохранении.
   */
  const checkFormAgainstGrades = () => {
    const parsed = Number(form.salary.trim().replace(/\s+/g, ""));
    return salaryPolicy.check({
      positionId: form.positionsId,
      levelId: form.experienceLevelId,
      salary: Number.isFinite(parsed) && parsed > 0 ? parsed : null,
    });
  };

  /** Полных месяцев между датами; отрицательный результат обрезается до нуля. */
  const monthsBetween = (fromIso: string, toIso: string): number => {
    const from = new Date(fromIso);
    const to = new Date(toIso);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;

    let months =
      (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
    // Неполный последний месяц не засчитывается: 01.01 → 02.08 это 7 месяцев,
    // а не 8.
    if (to.getDate() < from.getDate()) months -= 1;
    return Math.max(0, months);
  };

  /**
   * Расхождения между датой приёма на работу и датой начала должности.
   *
   * Это предупреждение, а не запрет: в жизни бывают и задним числом
   * оформленные переводы, и исправления даты приёма. Задача — чтобы человек
   * увидел несостыковку и подтвердил её осознанно, а не наткнулся на неё через
   * полгода в отчёте по стажу.
   *
   * Проверяем два случая. Начало раньше приёма — противоречие в любой записи.
   * Первая запись в истории — это и есть приём на работу, и её дата обязана
   * совпадать с `date_hire`; у последующих переводов дата законно другая, и
   * ругаться на них было бы шумом.
   */
  const collectDateWarnings = (): string[] => {
    const warnings: string[] = [];

    if (hireDate && form.dateFrom) {
      if (form.dateFrom < hireDate) {
        warnings.push(
          `Должность начинается ${formatDate(form.dateFrom)}, а сотрудник принят на работу ${formatDate(hireDate)} — должность не может начаться раньше приёма.`
        );
      } else {
        const otherStartDates = sortedRecords
          .filter((record) => record.guid !== editingRaw?.guid)
          .map((record) => readString(record.date_from))
          .filter(Boolean);

        const isEarliest =
          otherStartDates.length === 0 ||
          form.dateFrom <= otherStartDates.reduce((min, date) => (date < min ? date : min));

        if (isEarliest && form.dateFrom !== hireDate) {
          warnings.push(
            `Это первая запись в истории работы, значит она и есть приём на работу. Но начинается она ${formatDate(form.dateFrom)}, а в карточке сотрудника дата приёма — ${formatDate(hireDate)}.`
          );
        }
      }
    }

    // Стаж против требования грейда: ступени задан минимальный стаж в
    // настройках зарплат, и назначать её человеку, который столько не
    // отработал, — повод переспросить.
    const grade = form.experienceLevelId ? gradeByLevelId.get(form.experienceLevelId) : null;
    if (grade?.minMonths && hireDate && form.dateFrom) {
      const tenure = monthsBetween(hireDate, form.dateFrom);
      if (tenure < grade.minMonths) {
        warnings.push(
          `Для уровня ${grade.title} нужен стаж ${formatTenure(grade.minMonths)}, а на ${formatDate(form.dateFrom)} у сотрудника будет ${formatTenure(tenure)} (принят ${formatDate(hireDate)}).`
        );
      }
    }

    // Расхождения с матрицей грейдов — в мягком режиме это предупреждение, в
    // строгом запись до сюда не доходит (её останавливает проверка в submit).
    checkFormAgainstGrades().issues.forEach((issue) => warnings.push(issue.message));

    return warnings;
  };

  const deletingTimelineRecord = useMemo(() => {
    if (!recordToDeleteGuid) return null;
    return timelineRecords.find((item) => item.record.guid === recordToDeleteGuid) || null;
  }, [recordToDeleteGuid, timelineRecords]);

  const departmentOptions = useMemo(() => {
    return Array.isArray(departmentsData?.response) ? departmentsData.response : [];
  }, [departmentsData?.response]);

  const positionsList = useMemo(() => {
    return Array.isArray(positionsData?.response) ? positionsData.response : [];
  }, [positionsData?.response]);

  const experienceLevelsList = useMemo(() => {
    return Array.isArray(experienceLevelsData?.response) ? experienceLevelsData.response : [];
  }, [experienceLevelsData?.response]);

  const selectedPositionGroupId = useMemo(() => {
    if (!form.positionsId) return null;
    const position = positionsList.find((item) => item.guid === form.positionsId);
    return typeof position?.experience_level_groups_id === "string"
      ? position.experience_level_groups_id
      : null;
  }, [positionsList, form.positionsId]);

  /**
   * Уровни, доступные выбранной должности.
   *
   * Пустое множество, а не `null`, когда должность не выбрана или не привязана
   * к лестнице: раньше в этом случае фильтр выключался и в списке оказывались
   * все уровни компании разом — у должности Backend предлагались и PM1…PM6.
   * Показывать заведомо неподходящие ступени хуже, чем не показывать ничего:
   * выбранный «не тот» уровень уезжает в employee_works и ломает отчёты.
   */
  const allowedExperienceLevelIds = useMemo(() => {
    const ids = new Set<string>();
    if (!selectedPositionGroupId) return ids;

    for (const level of experienceLevelsList) {
      if (level.experience_level_groups_id === selectedPositionGroupId) {
        ids.add(level.guid);
      }
    }
    return ids;
  }, [experienceLevelsList, selectedPositionGroupId]);

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

    if (!allowedExperienceLevelIds.has(form.experienceLevelId)) {
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

  const workScheduleFallbackOption = useMemo<RemoteSelectOption | null>(() => {
    return buildFallbackOption(
      form.workScheduleId,
      typeof modalSourceRecord?.work_schedule_id_data?.title === "string"
        ? modalSourceRecord.work_schedule_id_data.title
        : ""
    );
  }, [form.workScheduleId, modalSourceRecord]);

  /** Всё, что нужно реестру полей модалки для рендера контролов. */
  const workFieldContext: WorkFieldContext = {
    form,
    setForm,
    mode: modalMode,
    disabled: isSaving,
    inputClassName: INPUT_CLASSNAME,
    menuPortalTarget,
    loadOptionsBySlug: loadRemoteOptionsBySlug,
    fallbackOptions: {
      employmentType: employmentTypeFallbackOption,
      department: departmentFallbackOption,
      division: divisionFallbackOption,
      location: locationFallbackOption,
      position: positionFallbackOption,
      experienceLevel: experienceLevelFallbackOption,
      workReason: workReasonFallbackOption,
      workSchedule: workScheduleFallbackOption,
    },
    allowedExperienceLevelIds,
    hasPositionGroup: Boolean(selectedPositionGroupId),
    parseIsoDate,
    toIsoDate,
    employeeWorkReasonSlug: EMPLOYEE_WORK_REASON_SLUG,
  };

  const handleCustomChange = (key: string, value: unknown) => {
    setCustomData((prev) => ({ ...prev, [key]: value }));
    // Ошибку убираем сразу, как только поле тронули.
    setCustomErrors((prev) => {
      if (!prev[key]) return prev;
      const rest = { ...prev };
      delete rest[key];
      return rest;
    });
  };

  const resetEditModal = () => {
    setIsEditModalOpen(false);
    setDateWarnings([]);
    setBuilderMode(false);
    setModalMode("create");
    setEditingRecordGuid(null);
    setModalSourceGuid(null);
    setForm(createEmptyFormState());
    setCustomData({});
    setCustomErrors({});
  };

  const openCreateModal = () => {
    setModalMode("create");
    setEditingRecordGuid(null);
    setModalSourceGuid(currentRaw?.guid || null);
    setForm(buildFormState(currentRaw, "create"));
    // Новая запись о должности — значения динамических полей начинаются с нуля.
    setCustomData(buildCustomData(null));
    setCustomErrors({});
    setIsEditModalOpen(true);
  };

  const openReturnModal = useCallback(() => {
    setModalMode("return");
    setEditingRecordGuid(null);
    setModalSourceGuid(currentRaw?.guid || null);
    setForm(buildFormState(currentRaw, "return"));
    setCustomData(buildCustomData(null));
    setCustomErrors({});
    setOpenActionsFor(null);
    setIsEditModalOpen(true);
  }, [buildCustomData, currentRaw]);

  const openEditModal = (guid: string) => {
    const selectedRecord = recordByGuid.get(guid);
    if (!selectedRecord) return;

    setModalMode("edit");
    setEditingRecordGuid(guid);
    setModalSourceGuid(guid);
    setForm(buildFormState(selectedRecord, "edit"));
    setCustomData(buildCustomData(selectedRecord));
    setCustomErrors({});
    setOpenActionsFor(null);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    if (isSaving) return;
    resetEditModal();
  };

  useEffect(() => {
    if (!returnRequestKey || returnRequestKey <= lastReturnRequestKeyRef.current) {
      return;
    }

    lastReturnRequestKeyRef.current = returnRequestKey;
    openReturnModal();
  }, [returnRequestKey, openReturnModal]);

  useEffect(() => {
    if (!isEditModalOpen || modalMode !== "return" || returnWorkReasonId) {
      return;
    }

    let isCancelled = false;

    void loadRemoteOptionsBySlug({
      slug: EMPLOYEE_WORK_REASON_SLUG,
      search: RETURN_WORK_REASON_TITLE,
      limit: 20,
      offset: 0,
    })
      .then((result) => {
        if (isCancelled) return;

        const exactMatch = result.options.find(
          (option) =>
            option.label.trim().toLowerCase() === RETURN_WORK_REASON_TITLE.toLowerCase()
        );
        const nextReason = exactMatch || result.options[0] || null;
        setReturnWorkReasonId(nextReason?.value || "");
      })
      .catch((error) => {
        if (!isCancelled) {
          console.error("Load return work reason error:", error);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [isEditModalOpen, modalMode, returnWorkReasonId]);

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

  const syncUserBaseFromCurrentWork = async () => {
    const works = await employeeWorkService.getList({
      userBaseId: employeeGuid,
      limit: 200,
      offset: 0,
    });

    const rows = Array.isArray(works.response) ? works.response : [];
    const sorted = [...rows].sort(compareEmployeeWorks);
    const current = sorted.find((item) => !readString(item.date_to)) || sorted[0] || null;

    const toNullable = (value: unknown): string | null => {
      const normalized = readString(value);
      return normalized || null;
    };

    await updateEmployee.mutateAsync({
      guid: employeeGuid,
      employment_types_id: toNullable(current?.employment_types_id),
      departments_id: toNullable(current?.departments_id),
      divisions_id: toNullable(current?.divisions_id),
      locations_id: toNullable(current?.locations_id),
      positions_id: toNullable(current?.positions_id),
      experience_levels_id: toNullable(current?.experience_levels_id),
    });
  };

  const handleSave = async (skipDateWarnings = false) => {
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
    if (modalMode !== "edit" && currentStartDate && form.dateFrom < currentStartDate) {
      toast.error("Дата начала новой должности не может быть раньше текущей записи");
      return;
    }

    // Строгий режим сверки с матрицей грейдов: расхождение не сохраняем и
    // показываем его отдельным окном — тост тут проходит мимо внимания, а
    // человеку надо вернуться в форму и поправить уровень или оклад. В мягком
    // режиме то же расхождение уходит в предупреждения ниже, и решает он сам.
    if (salaryPolicy.isBlocking) {
      const gradeCheck = checkFormAgainstGrades();
      if (gradeCheck.status === "mismatch") {
        setGradeErrors(gradeCheck.issues.map((issue) => issue.message));
        return;
      }
    }

    // Гейт стоит после жёстких проверок: сначала форма должна быть валидной,
    // и только потом есть смысл спрашивать про даты.
    if (!skipDateWarnings) {
      const warnings = collectDateWarnings();
      if (warnings.length > 0) {
        setDateWarnings(warnings);
        return;
      }
    }

    const employeeWorkReasonId =
      modalMode === "return" ? returnWorkReasonId : form.employeeWorkReasonId;

    if (modalMode === "return" && !employeeWorkReasonId) {
      toast.error(`Не найдена причина "${RETURN_WORK_REASON_TITLE}"`);
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

    // Правила динамических полей проверяем до запроса — иначе сервер молча
    // сохранит запись с незаполненным обязательным полем.
    const nextCustomErrors: Record<string, string> = {};
    dynamicFields.forEach((field) => {
      const message = validateDynamicValue(field, customData[field.key]);
      if (message) nextCustomErrors[field.key] = message;
    });
    setCustomErrors(nextCustomErrors);

    if (Object.keys(nextCustomErrors).length > 0) {
      toast.error("Проверьте дополнительные поля");
      return;
    }

    const payload: Record<string, unknown> = {
      employment_types_id: form.employmentTypeId || null,
      departments_id: form.departmentId || null,
      divisions_id: form.divisionId || null,
      locations_id: form.locationId || null,
      positions_id: form.positionsId || null,
      experience_levels_id: form.experienceLevelId || null,
      employee_work_reason_id: employeeWorkReasonId || null,
      work_schedule_id: form.workScheduleId || null,
      salary: salaryValue,
      date_from: form.dateFrom,
      date_to: modalMode === "edit" ? form.dateTo || null : null,
    };

    // Значения кладём только если контейнер заведён в u-code: иначе items API
    // всё равно вырежет незнакомый ключ.
    if (valuesField) {
      const collected: Record<string, unknown> = {};
      dynamicFields.forEach((field) => {
        const value = customData[field.key];
        if (value === undefined || value === null || value === "") return;
        if (Array.isArray(value) && value.length === 0) return;
        collected[field.key] = value;
      });
      payload.custom_data = JSON.stringify(collected);
    }

    // Возврат сотрудника идёт мимо согласования: он меняет ещё и статус
    // сотрудника (`onEmployeeReturned`), а отложить это до одобрения нельзя —
    // уволенный остался бы уволенным с висящей заявкой на должность.
    if (workApprovalProcess && modalMode !== "return") {
      if (modalMode === "edit" && !editingRaw) {
        toast.error("Не удалось найти запись для редактирования");
        return;
      }

      try {
        await saveWorkRequest.mutateAsync({
          userBaseId: employeeGuid,
          action: modalMode === "edit" ? "update" : "create",
          employeeWorksId: modalMode === "edit" ? editingRaw!.guid : null,
          payload: payload as EmployeeWorkRequestPayload,
        });
        toast.success(
          modalMode === "edit"
            ? "Заявка на изменение отправлена на согласование"
            : "Заявка на добавление должности отправлена на согласование"
        );
        resetEditModal();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Не удалось отправить заявку"
        );
      }
      return;
    }

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

        try {
          await syncUserBaseFromCurrentWork();
        } catch (syncError) {
          console.error("Work updated but user_base sync failed:", syncError);
          toast.error("Запись сохранена, но профиль сотрудника не синхронизирован.");
        }

        try {
          const onboardingResult = await onboardingTasksService.createForEmployee(employeeGuid);
          if (onboardingResult.status === "created") {
            toast.success(
              `Onboarding yaratildi: ${onboardingResult.createdParents} ta task, ${onboardingResult.createdSubtasks} ta subtask`
            );
          } else if (onboardingResult.reason === "manager_not_configured") {
            toast.warning("Onboarding uchun departament rahbari belgilanmagan.");
          }
        } catch (onboardingError) {
          console.error("Failed to create onboarding tasks after work update:", onboardingError);
          toast.warning("Ish ma’lumoti saqlandi, lekin onboarding vazifalarini yaratib bo‘lmadi.");
        }

        toast.success("Запись о работе обновлена");
        resetEditModal();
        return;
      }

      const previousGuid = currentRaw?.guid || "";
      const previousDateTo = currentRaw ? readString(currentRaw.date_to) || null : null;
      const shouldClosePrevious = Boolean(previousGuid && !previousDateTo);

      if (shouldClosePrevious) {
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
        if (shouldClosePrevious) {
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

      try {
        await syncUserBaseFromCurrentWork();
      } catch (syncError) {
        console.error("Work created but user_base sync failed:", syncError);
        toast.error("Должность добавлена, но профиль сотрудника не синхронизирован.");
      }

      try {
        const onboardingResult = await onboardingTasksService.createForEmployee(employeeGuid);
        if (onboardingResult.status === "created") {
          toast.success(
            `Onboarding yaratildi: ${onboardingResult.createdParents} ta task, ${onboardingResult.createdSubtasks} ta subtask`
          );
        } else if (onboardingResult.reason === "manager_not_configured") {
          toast.warning("Onboarding uchun departament rahbari belgilanmagan.");
        }
      } catch (onboardingError) {
        console.error("Failed to create onboarding tasks after work creation:", onboardingError);
        toast.warning("Ish ma’lumoti saqlandi, lekin onboarding vazifalarini yaratib bo‘lmadi.");
      }

      if (modalMode === "return" && onEmployeeReturned) {
        await onEmployeeReturned();
      }

      toast.success(
        modalMode === "return" ? "Сотрудник возвращен" : "Новая должность добавлена"
      );
      resetEditModal();
    } catch {
      toast.error(
        modalMode === "edit"
          ? "Не удалось сохранить изменения"
          : modalMode === "return"
            ? "Не удалось вернуть сотрудника"
            : "Не удалось добавить должность"
      );
    }
  };

  /**
   * Что именно предлагает заявка — человеческим языком.
   *
   * Разрешаем только справочники, уже загруженные секцией (должность, отдел,
   * уровень): тянуть ради подписи ещё пять справочников незачем, а поля без
   * подписи в сводку просто не попадают.
   */
  const describeRequest = (request: EmployeeWorkRequest): { label: string; value: string }[] => {
    const payload = request.payload;
    const rows: { label: string; value: string }[] = [];

    const titleOf = (list: { guid: string; title?: string }[], id: unknown): string => {
      if (typeof id !== "string" || !id) return "";
      return list.find((item) => item.guid === id)?.title || "";
    };

    if ("positions_id" in payload) {
      rows.push({ label: "Должность", value: titleOf(positionsList, payload.positions_id) || "—" });
    }
    if ("departments_id" in payload) {
      rows.push({
        label: "Отдел",
        value: titleOf(departmentOptions, payload.departments_id) || "—",
      });
    }
    if ("experience_levels_id" in payload) {
      rows.push({
        label: "Уровень",
        value: titleOf(experienceLevelsList, payload.experience_levels_id) || "—",
      });
    }
    if ("salary" in payload) {
      rows.push({
        label: "Оклад",
        value: formatSalary(typeof payload.salary === "number" ? payload.salary : null),
      });
    }
    if ("date_from" in payload) {
      rows.push({ label: "Дата начала", value: formatDate(payload.date_from || "") });
    }
    if ("date_to" in payload && payload.date_to) {
      rows.push({ label: "Дата окончания", value: formatDate(payload.date_to) });
    }

    return rows;
  };

  /** Итог по заявке: применение к `employee_works` делает сервер. */
  const reviewRequest = async (
    request: EmployeeWorkRequest,
    status: "approved" | "rejected",
    comment = ""
  ) => {
    try {
      await reviewWorkRequest.mutateAsync({ guid: request.guid, status, comment });
      setApprovalRequest(null);

      if (status === "approved") {
        try {
          await syncUserBaseFromCurrentWork();
        } catch (syncError) {
          console.error("Request applied but user_base sync failed:", syncError);
          toast.error("Изменения применены, но профиль сотрудника не синхронизирован.");
        }
      }

      toast.success(status === "approved" ? "Изменения применены" : "Заявка отклонена");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось изменить статус заявки");
    }
  };

  const withdrawRequest = async (request: EmployeeWorkRequest) => {
    try {
      await deleteWorkRequest.mutateAsync(request.guid);
      setApprovalRequest(null);
      toast.success("Заявка отозвана");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось отозвать заявку");
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

      try {
        await syncUserBaseFromCurrentWork();
      } catch (syncError) {
        console.error("Work deleted but user_base sync failed:", syncError);
        toast.error("Запись удалена, но профиль сотрудника не синхронизирован.");
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

        {/* Заявки на согласовании — история работы до одобрения не меняется. */}
        {workApprovalProcess && pendingRequests.length > 0 ? (
          <div className="border-b border-slate-100 bg-amber-50/50 px-5 py-4 sm:px-6">
            <p className="m-0 text-[13px] font-semibold text-amber-800">
              На согласовании: {pendingRequests.length}
            </p>
            <div className="mt-3 space-y-2">
              {pendingRequests.map((request) => {
                const progress = approvalProgressMap?.[request.guid] ?? null;
                const approvedStages = countApprovedStages(workApprovalProcess, progress);

                return (
                  <div
                    key={request.guid}
                    className="rounded-xl border border-amber-200 bg-white px-4 py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="m-0 text-[13px] font-semibold text-slate-900">
                          {request.action === "create"
                            ? "Добавление должности"
                            : "Изменение должности"}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                          {describeRequest(request).map((row) => (
                            <span key={row.label} className="text-[12px] text-slate-500">
                              {row.label}:{" "}
                              <span className="font-medium text-slate-700">{row.value}</span>
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <ApprovalProgressButton
                          approvedStages={approvedStages}
                          totalStages={workApprovalProcess.stages.length}
                          onClick={() => setApprovalRequest(request)}
                          disabled={reviewWorkRequest.isLoading}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            void withdrawRequest(request);
                          }}
                          disabled={deleteWorkRequest.isLoading}
                          className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                          title="Отозвать заявку"
                        >
                          Отозвать
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

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
                        customValues={item.customValues}
                        gradeMismatch={item.gradeMismatch}
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
          <div className="min-w-0">
            <h4 className="m-0 text-[24px] font-bold text-slate-900">
              {builderMode
                ? "Настройка формы"
                : modalMode === "return"
                  ? "Вернуть сотрудника"
                  : modalMode === "create"
                    ? "Добавить должность"
                    : "Редактировать должность"}
            </h4>
            <p className="m-0 mt-1 text-[13px] text-slate-500">
              {builderMode
                ? "Порядок и ширина полей. Изменения сохранятся по кнопке «Готово»."
                : modalMode === "return"
                  ? "Новая запись станет текущей, а статус сотрудника изменится на активный."
                  : modalMode === "create"
                    ? "Новая запись станет текущей, а предыдущая должность завершится выбранной датой."
                    : "Обновите данные по выбранной записи в истории работы."}
            </p>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          <WorkFieldsArea
            layoutApi={workLayout}
            fieldContext={workFieldContext}
            dynamicFields={dynamicFields}
            customData={customData}
            customErrors={customErrors}
            onCustomChange={handleCustomChange}
            builderMode={builderMode}
            brandColor={brandColor}
          />
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-6 py-4">
          {/* Слева — тихое второстепенное действие: в шапке кнопка спорила с заголовком и крестиком */}
          {builderMode ? (
            <button
              type="button"
              onClick={workLayout.resetLayout}
              disabled={workLayout.isSaving}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Сбросить раскладку
            </button>
          ) : (
            <button
              type="button"
              onClick={handleToggleBuilder}
              disabled={isSaving}
              title="Настроить расположение полей"
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Настроить форму
            </button>
          )}

          <div className="flex items-center gap-2">
            {builderMode ? null : (
              <button
                type="button"
                onClick={closeEditModal}
                disabled={isSaving}
                className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Отмена
              </button>
            )}
            <button
              type="button"
              onClick={builderMode ? handleToggleBuilder : () => handleSave()}
              disabled={builderMode ? workLayout.isSaving : isSaving}
              className="h-9 rounded-lg border border-transparent px-4 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: brandColor }}
            >
              {builderMode
                ? workLayout.isSaving
                  ? "Сохраняем..."
                  : "Готово"
                : isSaving
                  ? modalMode === "return"
                    ? "Возврат..."
                    : modalMode === "create"
                      ? "Добавление..."
                      : "Сохранение..."
                  : modalMode === "return"
                    ? "Вернуть"
                    : modalMode === "create"
                      ? "Добавить"
                      : "Сохранить"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Расхождение с матрицей грейдов в строгом режиме — запрет: сохранить
          нельзя, форма остаётся открытой, чтобы поправить уровень или оклад. */}
      <Modal
        isOpen={gradeErrors.length > 0}
        onClose={() => setGradeErrors([])}
        showCloseButton={false}
        className="mx-4 w-full max-w-[420px] overflow-hidden rounded-2xl border border-gray-200 p-0 shadow-xl"
      >
        <div className="border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-error-50 text-error-500">
              <TriangleAlert size={16} />
            </span>
            <h3 className="text-base font-semibold text-gray-900">
              Не соответствует матрице грейдов
            </h3>
          </div>
        </div>

        <div className="space-y-2 px-4 py-4">
          {gradeErrors.map((message) => (
            <p key={message} className="text-sm leading-relaxed text-gray-700">
              {message}
            </p>
          ))}
          <p className="text-sm text-gray-500">
            В настройках компании оклад обязан соответствовать матрице грейдов — сохранить
            такую запись нельзя.
          </p>
        </div>

        <div className="flex justify-end border-t border-gray-200 px-4 py-3">
          <button
            type="button"
            onClick={() => setGradeErrors([])}
            className="inline-flex h-10 items-center rounded-lg bg-error-500 px-4 text-sm font-semibold text-white transition hover:bg-error-600"
          >
            Исправить
          </button>
        </div>
      </Modal>

      {/* Предупреждение о датах и грейдах — не запрет: подтверждение продолжает
          сохранение с тем же payload, повторно валидировать форму не нужно. */}
      <Modal
        isOpen={dateWarnings.length > 0}
        onClose={() => setDateWarnings([])}
        showCloseButton={false}
        className="mx-4 w-full max-w-[420px] overflow-hidden rounded-2xl border border-gray-200 p-0 shadow-xl"
      >
        <div className="border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <TriangleAlert size={16} />
            </span>
            <h3 className="text-base font-semibold text-gray-900">Проверьте данные</h3>
          </div>
        </div>

        <div className="space-y-2 px-4 py-4">
          {dateWarnings.map((warning) => (
            <p key={warning} className="text-sm leading-relaxed text-gray-700">
              {warning}
            </p>
          ))}
          <p className="text-sm text-gray-500">
            Сохранить всё равно можно — проверьте, что дата указана верно.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-4 py-3">
          <button
            type="button"
            onClick={() => setDateWarnings([])}
            className="inline-flex h-10 items-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Исправить
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => {
              setDateWarnings([]);
              void handleSave(true);
            }}
            className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-white transition disabled:opacity-60"
            style={{ backgroundColor: brandColor }}
          >
            {isSaving ? "Сохранение..." : "Всё равно сохранить"}
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

      <ApprovalProcessModal
        isOpen={Boolean(approvalRequest)}
        onClose={() => setApprovalRequest(null)}
        process={workApprovalProcess ?? null}
        progress={approvalRequest ? approvalProgressMap?.[approvalRequest.guid] ?? null : null}
        onApproveStage={(stageId, comment) => {
          if (!approvalRequest || !workApprovalProcess) return;
          void approveStage.mutateAsync({
            entityType: EMPLOYEE_WORK_ENTITY_TYPE,
            entityId: approvalRequest.guid,
            processId: workApprovalProcess.id,
            stageId,
            comment,
          });
        }}
        isApprovingStage={approveStage.isLoading}
        onConfirm={() => {
          // Кнопку модалка показывает только когда все этапы пройдены, но
          // проверяем и здесь: применение необратимо.
          if (!approvalRequest || !workApprovalProcess) return;
          const progress = approvalProgressMap?.[approvalRequest.guid] ?? null;
          if (!isProcessComplete(workApprovalProcess, progress)) return;
          void reviewRequest(approvalRequest, "approved");
        }}
        isConfirming={reviewWorkRequest.isLoading}
        onReject={(comment) => {
          if (approvalRequest) void reviewRequest(approvalRequest, "rejected", comment);
        }}
        isRejecting={reviewWorkRequest.isLoading}
        confirmLabel="Применить изменения"
      />
    </>
  );
}
