import { type ChangeEvent, useMemo, useState } from "react";
import { useQueryClient } from "react-query";
import { Icon } from "@iconify/react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  MoreHorizontal,
  MoreVertical,
  Paperclip,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import AbsenceRequestModal from "../../../../components/absences/AbsenceRequestModal";
import ApprovalProcessModal from "../../../../components/approvals/ApprovalProcessModal";
import ApprovalProgressBadge from "../../../../components/approvals/ApprovalProgressBadge";
import ApprovalProgressButton from "../../../../components/approvals/ApprovalProgressButton";
import { Modal } from "../../../../components/ui/modal";
import { Dropdown } from "../../../../components/ui/dropdown/Dropdown";
import { DropdownItem } from "../../../../components/ui/dropdown/DropdownItem";
import {
  type AbsenceRequestStatus,
  useApproveAbsence,
  useCreateAbsence,
  useDeleteAbsenceWithAttendance,
  useUpdateAbsence,
} from "../../../../api/services/absenceRequest.service";
import {
  useEmployeeAbsenceSummaryQuery,
  type EmployeeAbsencePolicy,
  type EmployeeAbsenceRequest,
} from "../../../../api/services/employeeAbsenceSummary.service";
import { useUploadFile } from "../../../../api/services/file-upload.service";
import {
  countApprovedStages,
  isProcessComplete,
} from "../../../settings/Approvals/approvalRuntime";
import {
  findApprovalProcessFor,
  useApprovalProcessesQuery,
  useApproveStage,
  useEntityApprovalsQuery,
} from "../../../../api/services/approval.service";

const ABSENCE_ENTITY_TYPE = "absence";

type AbsencesSectionProps = {
  employeeGuid: string;
  brandColor: string;
  departmentId?: string | null;
};

type AttachmentItem = {
  name: string;
  size: number;
  url: string;
};

type DateBreakdownItem = {
  iso: string;
  day: string;
  month: string;
  weekday: string;
  isWeekend: boolean;
};

const DEFAULT_POLICY_ICON = "mdi:airplane";
const MAX_ATTACHMENTS = 10;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

const WEEKDAY_SHORT_RU = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
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

const STATUS_LABELS: Record<AbsenceRequestStatus, string> = {
  pending: "Ожидает",
  approved: "Подтвержден",
  rejected: "Отклонен",
};

const STATUS_BADGE_CLASSNAME: Record<AbsenceRequestStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
};

const resolveHexColor = (value: unknown, fallback: string): string => {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) return normalized;
  return fallback;
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
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
};

const formatDateRu = (value: string | null): string => {
  if (!value) return "—";
  const date = parseIsoDate(value);
  if (!date) return value;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()}`;
};

const formatDateRange = (from: string | null, to: string | null): string => {
  if (!from && !to) return "—";
  if (from && to) return `${formatDateRu(from)} - ${formatDateRu(to)}`;
  return formatDateRu(from || to);
};

const getDateBreakdown = (from: string, to: string): DateBreakdownItem[] => {
  const start = parseIsoDate(from);
  const end = parseIsoDate(to);
  if (!start || !end || start > end) return [];

  const list: DateBreakdownItem[] = [];
  const cursor = new Date(start);
  let guard = 0;

  while (cursor <= end && guard < 400) {
    const dayOfWeek = cursor.getDay();
    list.push({
      iso: toIsoDate(cursor),
      day: String(cursor.getDate()),
      month: MONTH_SHORT_RU[cursor.getMonth()],
      weekday: WEEKDAY_SHORT_RU[dayOfWeek],
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
    });

    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }

  return list;
};

const parseAttachmentsField = (value: string | null): AttachmentItem[] => {
  if (!value) return [];

  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((item) => {
      if (typeof item === "string") {
        const parts = item.split("/");
        return {
          name: parts[parts.length - 1] || "Файл",
          size: 0,
          url: item,
        };
      }
      if (item && typeof item === "object") {
        const maybeUrl =
          (item as { url?: unknown; file?: unknown }).url ||
          (item as { file?: unknown }).file;
        if (typeof maybeUrl === "string" && maybeUrl) {
          const maybeName = (item as { name?: unknown }).name;
          const maybeSize = (item as { size?: unknown }).size;
          return {
            name:
              typeof maybeName === "string" && maybeName.trim()
                ? maybeName
                : maybeUrl.split("/").pop() || "Файл",
            size:
              typeof maybeSize === "number" && Number.isFinite(maybeSize)
                ? maybeSize
                : 0,
            url: maybeUrl,
          };
        }
      }
      return null;
    })
    .filter((item): item is AttachmentItem => Boolean(item));
};

export default function AbsencesSection({
  employeeGuid,
  brandColor,
  departmentId,
}: AbsencesSectionProps) {
  const queryClient = useQueryClient();
  const todayIso = useMemo(() => toIsoDate(new Date()), []);
  const attachmentInputId = `absence-attachment-upload-${employeeGuid}`;

  const [requestsFilter, setRequestsFilter] = useState<string>("all");
  const [historyPolicyFilter, setHistoryPolicyFilter] = useState<string>("all");
  const [historyYear, setHistoryYear] = useState<number>(new Date().getFullYear());

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [modalPolicyId, setModalPolicyId] = useState<string>("");
  const [modalDateFrom, setModalDateFrom] = useState<string>(todayIso);
  const [modalDateTo, setModalDateTo] = useState<string>(todayIso);
  const [modalNote, setModalNote] = useState<string>("");
  const [modalAttachments, setModalAttachments] = useState<AttachmentItem[]>([]);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null);
  const [deletingRequest, setDeletingRequest] = useState<EmployeeAbsenceRequest | null>(null);
  const [openMenuRequestId, setOpenMenuRequestId] = useState<string | null>(null);
  const [approvalRequest, setApprovalRequest] = useState<EmployeeAbsenceRequest | null>(null);

  // Approval process covering this employee's department (configured in
  // /settings/approvals, loaded once + cached).
  const { data: approvalProcesses } = useApprovalProcessesQuery();
  const absenceApprovalProcess = useMemo(
    () =>
      findApprovalProcessFor(approvalProcesses ?? [], "absence_approval", departmentId),
    [approvalProcesses, departmentId]
  );

  const approveStageMutation = useApproveStage();

  const summaryQuery = useEmployeeAbsenceSummaryQuery({
    userBaseId: employeeGuid,
    asOfDate: todayIso,
    historyYear,
    querySettings: { enabled: Boolean(employeeGuid) },
  });

  const isSummaryLoading = summaryQuery.isLoading;
  const policies: EmployeeAbsencePolicy[] = useMemo(
    () => summaryQuery.data?.policies ?? [],
    [summaryQuery.data?.policies]
  );

  const policiesById = useMemo(() => {
    const map = new Map<string, EmployeeAbsencePolicy>();
    for (const policy of policies) {
      map.set(policy.guid, policy);
    }
    return map;
  }, [policies]);

  const allRequests: EmployeeAbsenceRequest[] = useMemo(
    () => summaryQuery.data?.requests ?? [],
    [summaryQuery.data?.requests]
  );

  const historySummary = summaryQuery.data?.history;

  const createRequestMutation = useCreateAbsence();
  const updateRequestMutation = useUpdateAbsence();
  const approveRequestMutation = useApproveAbsence();
  const deleteRequestMutation = useDeleteAbsenceWithAttendance();
  const uploadFileMutation = useUploadFile({ folder: "Media" });

  const filteredRequests = useMemo(() => {
    if (requestsFilter === "all") return allRequests;
    return allRequests.filter(
      (request) => request.absence_policies_id === requestsFilter
    );
  }, [allRequests, requestsFilter]);

  // Bulk approval progress for visible requests so finalized rows can still
  // show the clickable audit badge.
  const approvalEntityIds = useMemo(
    () =>
      absenceApprovalProcess
        ? filteredRequests.map((request) => request.guid)
        : [],
    [absenceApprovalProcess, filteredRequests]
  );

  const { data: approvalProgressMap } = useEntityApprovalsQuery(
    ABSENCE_ENTITY_TYPE,
    approvalEntityIds
  );

  const historyRequests = useMemo(() => {
    const list = historySummary?.approved ?? [];
    if (historyPolicyFilter === "all") return list;
    return list.filter(
      (request) => request.absence_policies_id === historyPolicyFilter
    );
  }, [historySummary?.approved, historyPolicyFilter]);

  const totalUsedDays = useMemo(() => {
    if (historyPolicyFilter === "all") {
      return historySummary?.total_used_days ?? 0;
    }
    return historyRequests.reduce(
      (sum, request) => sum + (request.requested_days || 0),
      0
    );
  }, [historyPolicyFilter, historyRequests, historySummary?.total_used_days]);

  const selectedPolicy = useMemo(
    () => (modalPolicyId ? policiesById.get(modalPolicyId) || null : null),
    [modalPolicyId, policiesById]
  );

  const modalBreakdown = useMemo(
    () => getDateBreakdown(modalDateFrom, modalDateTo),
    [modalDateFrom, modalDateTo]
  );

  const modalRequestedDays = modalBreakdown.length;
  const modalAvailable = selectedPolicy ? selectedPolicy.available : 0;
  const modalForecast = modalAvailable - modalRequestedDays;

  const invalidateSummary = () => {
    queryClient.invalidateQueries(["employee-absence-summary", employeeGuid]);
  };

  const openCreateModal = (policyGuid?: string) => {
    const fallbackPolicyId =
      policyGuid || modalPolicyId || policies[0]?.guid || "";

    setModalPolicyId(fallbackPolicyId);
    setModalDateFrom(todayIso);
    setModalDateTo(todayIso);
    setModalNote("");
    setModalAttachments([]);
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    if (createRequestMutation.isLoading || isUploadingAttachments) return;
    setIsCreateModalOpen(false);
    setModalNote("");
    setModalAttachments([]);
  };

  const handleDateFromChange = (value: string) => {
    setModalDateFrom(value);
    if (modalDateTo && value && modalDateTo < value) {
      setModalDateTo(value);
    }
  };

  const handleAttachmentFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    event.target.value = "";
    if (!files || files.length === 0) return;

    const remainingSlots = MAX_ATTACHMENTS - modalAttachments.length;
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

      setModalAttachments((prev) => [...prev, ...uploadedItems]);
      toast.success("Файлы успешно загружены.");
    } catch (error) {
      console.error("Failed to upload absence request attachments:", error);
      toast.error("Не удалось загрузить вложения.");
    } finally {
      setIsUploadingAttachments(false);
    }
  };

  const removeAttachment = (url: string) => {
    setModalAttachments((prev) => prev.filter((item) => item.url !== url));
  };

  const submitRequest = async () => {
    if (!employeeGuid) {
      toast.error("Сотрудник не найден.");
      return;
    }

    if (!modalPolicyId) {
      toast.error("Выберите тип отсутствия.");
      return;
    }

    if (!modalDateFrom || !modalDateTo) {
      toast.error("Укажите диапазон дат.");
      return;
    }

    if (modalDateFrom > modalDateTo) {
      toast.error("Дата начала не может быть позже даты окончания.");
      return;
    }

    if (modalRequestedDays <= 0) {
      toast.error("В запросе должен быть хотя бы один день.");
      return;
    }

    try {
      await createRequestMutation.mutateAsync({
        user_base_id: employeeGuid,
        absence_policies_id: modalPolicyId,
        date_from: modalDateFrom,
        date_to: modalDateTo,
        requested_days: modalRequestedDays,
        requested_breakdown: JSON.stringify(
          modalBreakdown.map((item) => ({
            date: item.iso,
            value: 1,
          }))
        ),
        note: modalNote.trim() || null,
        attachments: JSON.stringify(modalAttachments.map((item) => item.url)),
        status: ["pending"],
      });

      invalidateSummary();
      toast.success("Запрос на отсутствие создан.");
      closeCreateModal();
    } catch (error) {
      console.error("Failed to create absence request:", error);
      toast.error("Не удалось создать запрос.");
    }
  };

  const handleReviewRequest = async (
    request: EmployeeAbsenceRequest,
    status: AbsenceRequestStatus
  ) => {
    if (request.status !== "pending") return;
    if (!request.guid) {
      toast.error("Не найден guid заявки.");
      return;
    }

    // When the employee's department has a configured approval process, the
    // request must pass every stage before it can actually be approved. Open
    // the approval modal instead of approving directly.
    if (status === "approved" && absenceApprovalProcess) {
      const progress = approvalProgressMap?.[request.guid] ?? null;
      if (!isProcessComplete(absenceApprovalProcess, progress)) {
        setApprovalRequest(request);
        return;
      }
    }

    try {
      setReviewingRequestId(request.guid);
      if (status === "approved") {
        await approveRequestMutation.mutateAsync({ guid: request.guid });
      } else {
        await updateRequestMutation.mutateAsync({
          guid: request.guid,
          data: {
            status: [status],
            reviewed_at: new Date().toISOString(),
          },
        });
      }

      invalidateSummary();

      if (status === "approved") {
        toast.success("Запрос подтвержден.");
      } else {
        toast.success("Запрос отклонен.");
      }
    } catch (error) {
      console.error("Failed to review absence request:", error);
      toast.error("Не удалось изменить статус запроса.");
    } finally {
      setReviewingRequestId(null);
    }
  };

  const handleApproveStage = async (stageId: string, comment: string) => {
    if (!approvalRequest || !absenceApprovalProcess) return;
    try {
      await approveStageMutation.mutateAsync({
        entityType: ABSENCE_ENTITY_TYPE,
        entityId: approvalRequest.guid,
        processId: absenceApprovalProcess.id,
        stageId,
        comment,
      });
    } catch (error) {
      console.error("Failed to approve absence stage:", error);
      toast.error("Не удалось одобрить этап.");
    }
  };

  const finalizeApproval = async () => {
    if (!approvalRequest) return;
    try {
      setReviewingRequestId(approvalRequest.guid);
      await approveRequestMutation.mutateAsync({ guid: approvalRequest.guid });
      invalidateSummary();
      toast.success("Запрос подтвержден.");
      setApprovalRequest(null);
    } catch (error) {
      console.error("Failed to approve absence request:", error);
      toast.error("Не удалось подтвердить запрос.");
    } finally {
      setReviewingRequestId(null);
    }
  };

  const rejectFromApproval = async (comment: string) => {
    if (!approvalRequest) return;
    try {
      setReviewingRequestId(approvalRequest.guid);
      await updateRequestMutation.mutateAsync({
        guid: approvalRequest.guid,
        data: {
          status: ["rejected"],
          reviewed_at: new Date().toISOString(),
          reject_reason: comment.trim() || null,
        },
      });
      invalidateSummary();
      toast.success("Запрос отклонен.");
      setApprovalRequest(null);
    } catch (error) {
      console.error("Failed to reject absence request:", error);
      toast.error("Не удалось отклонить запрос.");
    } finally {
      setReviewingRequestId(null);
    }
  };

  const confirmDeleteRequest = async () => {
    if (!deletingRequest) return;
    try {
      await deleteRequestMutation.mutateAsync(deletingRequest.guid);
      invalidateSummary();
      toast.success("Запрос удалён.");
      setDeletingRequest(null);
    } catch (error) {
      console.error("Failed to delete absence request:", error);
      toast.error("Не удалось удалить запрос.");
    }
  };

  return (
    <>
      <div className="space-y-3.5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {isSummaryLoading
            ? Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`employee-absence-policy-skeleton-${index}`}
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200" />
                  <div className="mt-3 h-3 w-1/3 animate-pulse rounded bg-slate-200" />
                  <div className="mt-2 h-8 w-1/2 animate-pulse rounded bg-slate-200" />
                  <div className="mt-4 h-9 w-full animate-pulse rounded bg-slate-200" />
                </div>
              ))
            : policies.map((policy) => {
                const iconValue =
                  typeof policy.icon === "string" && policy.icon
                    ? policy.icon
                    : DEFAULT_POLICY_ICON;
                const iconColor = resolveHexColor(policy.color, brandColor);

                return (
                  <div
                    key={policy.guid}
                    className="rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
                        <Icon icon={iconValue} width={18} height={18} color={iconColor} />
                      </span>
                      <p className="m-0 truncate text-[14px] font-bold text-slate-900">
                        {policy.title}
                      </p>
                    </div>

                    <div className="mt-3">
                      <p className="m-0 text-[12px] text-slate-400">Доступно</p>
                      <div className="mt-1 flex items-end gap-1.5">
                        <span
                          className="text-[28px] font-semibold leading-none"
                          style={{ color: brandColor }}
                        >
                          {policy.available.toFixed(1)}
                        </span>
                        <span className="text-[16px] font-semibold leading-none text-slate-700">
                          д
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Лимит: {policy.limit.toFixed(1)} · Использовано:{" "}
                        {policy.used_days.toFixed(1)}
                        {policy.pending_days > 0 ? (
                          <>
                            {" · "}
                            <span className="text-amber-600">
                              Ожидает: {policy.pending_days.toFixed(1)}
                            </span>
                          </>
                        ) : null}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openCreateModal(policy.guid)}
                          className="rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-[12px] font-semibold text-slate-800 transition hover:bg-slate-200"
                        >
                          Создать запрос
                        </button>
                        <button
                          type="button"
                          onClick={() => openCreateModal(policy.guid)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-700 transition hover:bg-slate-200"
                          aria-label="Календарь"
                        >
                          <CalendarDays className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          toast.info("Дополнительные действия будут доступны позже.")
                        }
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-700 transition hover:bg-slate-200"
                        aria-label="Действия"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
        </div>

        {!isSummaryLoading && policies.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-[14px] text-slate-500">
            Политики отсутствий не найдены.
          </div>
        ) : null}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-3.5">
            <h3 className="m-0 text-[15px] font-bold leading-none text-slate-900">
              Запросы
            </h3>

            <div className="flex items-center gap-2">
              <select
                value={requestsFilter}
                onChange={(event) => setRequestsFilter(event.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-800 outline-none"
              >
                <option value="all">Все</option>
                {policies.map((policy) => (
                  <option key={`requests-filter-${policy.guid}`} value={policy.guid}>
                    {policy.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => toast.info("Экспорт запросов будет доступен позже.")}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
                aria-label="Экспорт"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="px-6 py-5">
            {isSummaryLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={`absence-request-skeleton-${index}`}
                    className="h-16 animate-pulse rounded-xl border border-slate-200 bg-slate-50"
                  />
                ))}
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="text-[13px] text-slate-400">Результаты не найдены</div>
            ) : (
              <div className="space-y-2">
                {filteredRequests.map((request) => {
                  const policyTitle =
                    request.policy?.title ||
                    policiesById.get(request.absence_policies_id || "")?.title ||
                    "Без типа";
                  const policyIcon =
                    (request.policy?.icon ||
                      policiesById.get(request.absence_policies_id || "")?.icon) ??
                    DEFAULT_POLICY_ICON;
                  const policyColor = resolveHexColor(
                    request.policy?.color ??
                      policiesById.get(request.absence_policies_id || "")?.color,
                    brandColor
                  );
                  const isReviewing =
                    reviewingRequestId === request.guid &&
                    (updateRequestMutation.isLoading ||
                      approveRequestMutation.isLoading);
                  const attachments = parseAttachmentsField(request.attachments);

                  const approvalProgress = approvalProgressMap?.[request.guid] ?? null;
                  const hasApprovalHistory =
                    (approvalProgress?.approvals?.length ?? 0) > 0;
                  const showApprovalProgress =
                    Boolean(absenceApprovalProcess) &&
                    (request.status === "pending" || hasApprovalHistory);
                  const approvedStages = absenceApprovalProcess
                    ? countApprovedStages(absenceApprovalProcess, approvalProgress)
                    : 0;

                  return (
                    <div
                      key={request.guid}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-100">
                              <Icon
                                icon={policyIcon}
                                width={14}
                                height={14}
                                color={policyColor}
                              />
                            </span>
                            <p className="m-0 truncate text-[13px] font-semibold text-slate-900">
                              {policyTitle}
                            </p>
                            <span
                              className={`rounded px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE_CLASSNAME[request.status]}`}
                            >
                              {STATUS_LABELS[request.status]}
                            </span>
                          </div>

                          <p className="mt-1 text-[12px] text-slate-500">
                            {formatDateRange(request.date_from, request.date_to)} •{" "}
                            {(request.requested_days || 0).toFixed(1)} д.
                          </p>

                          {showApprovalProgress && absenceApprovalProcess ? (
                            <div className="mt-1.5">
                              <ApprovalProgressBadge
                                title={absenceApprovalProcess.title}
                                approvedStages={approvedStages}
                                totalStages={absenceApprovalProcess.stages.length}
                                onClick={() => setApprovalRequest(request)}
                              />
                            </div>
                          ) : null}

                          {request.note ? (
                            <p className="mt-1 text-[12px] text-slate-500 line-clamp-2">
                              {request.note}
                            </p>
                          ) : null}

                          {attachments.length > 0 ? (
                            <div className="mt-1.5 flex flex-wrap gap-2">
                              {attachments.map((attachment) => (
                                <a
                                  key={`${request.guid}-${attachment.url}`}
                                  href={attachment.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100"
                                >
                                  <Paperclip className="h-3 w-3" />
                                  {attachment.name}
                                </a>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2">
                          {request.status === "pending" ? (
                            <>
                              {showApprovalProgress && absenceApprovalProcess ? (
                                <ApprovalProgressButton
                                  approvedStages={approvedStages}
                                  totalStages={absenceApprovalProcess.stages.length}
                                  onClick={() => setApprovalRequest(request)}
                                  disabled={isReviewing}
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleReviewRequest(request, "approved")
                                  }
                                  disabled={isReviewing}
                                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[12px] font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
                                >
                                  Подтвердить
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  void handleReviewRequest(request, "rejected")
                                }
                                disabled={isReviewing}
                                className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[12px] font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                              >
                                Отклонить
                              </button>
                            </>
                          ) : null}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenMenuRequestId((current) =>
                                  current === request.guid ? null : request.guid
                                )
                              }
                              className="dropdown-toggle inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                              aria-label="Действия"
                              aria-haspopup="menu"
                              aria-expanded={openMenuRequestId === request.guid}
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
                            </button>

                            <Dropdown
                              isOpen={openMenuRequestId === request.guid}
                              onClose={() => setOpenMenuRequestId(null)}
                              className="min-w-[160px] py-1"
                            >
                              <DropdownItem
                                onItemClick={() => {
                                  setOpenMenuRequestId(null);
                                  setDeletingRequest(request);
                                }}
                                baseClassName="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-medium text-rose-600 hover:bg-rose-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Удалить
                              </DropdownItem>
                            </Dropdown>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-3.5">
            <h3 className="m-0 text-[15px] font-bold leading-none text-slate-900">
              История
            </h3>

            <div className="flex items-center gap-2">
              <div className="inline-flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() => setHistoryYear((prev) => prev - 1)}
                  className="inline-flex h-9 w-9 items-center justify-center border-none bg-transparent text-slate-700 transition hover:bg-slate-100"
                  aria-label="Предыдущий год"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="inline-flex h-9 min-w-[76px] items-center justify-center border-x border-slate-200 px-3 text-[13px] font-semibold text-slate-900">
                  {historyYear}
                </span>
                <button
                  type="button"
                  onClick={() => setHistoryYear((prev) => prev + 1)}
                  className="inline-flex h-9 w-9 items-center justify-center border-none bg-transparent text-slate-700 transition hover:bg-slate-100"
                  aria-label="Следующий год"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <select
                value={historyPolicyFilter}
                onChange={(event) => setHistoryPolicyFilter(event.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-800 outline-none"
              >
                <option value="all">Все</option>
                {policies.map((policy) => (
                  <option key={`history-filter-${policy.guid}`} value={policy.guid}>
                    {policy.title}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => toast.info("Экспорт истории будет доступен позже.")}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
                aria-label="Экспорт"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 px-6 py-5 md:grid-cols-2">
            <div>
              <p className="m-0 text-[24px] font-semibold leading-none text-slate-900">
                {totalUsedDays.toFixed(1)} дней
              </p>
              <p className="mt-1.5 text-[12px] text-slate-400">Всего использовано</p>
            </div>
            <div>
              <p className="m-0 text-[24px] font-semibold leading-none text-slate-900">
                {historyRequests.length}
              </p>
              <p className="mt-1.5 text-[12px] text-slate-400">Заявок одобрено</p>
            </div>
          </div>

          <div className="border-t border-slate-200 px-6 py-4">
            {historyRequests.length === 0 ? (
              <p className="m-0 text-[12px] text-slate-400">
                За выбранный период записей нет.
              </p>
            ) : (
              <div className="space-y-2">
                {historyRequests.map((request) => {
                  const policyTitle =
                    request.policy?.title ||
                    policiesById.get(request.absence_policies_id || "")?.title ||
                    "Без названия";
                  return (
                    <div
                      key={`history-${request.guid}`}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="m-0 truncate text-[12px] font-semibold text-slate-800">
                          {policyTitle}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {formatDateRange(request.date_from, request.date_to)}
                        </p>
                      </div>
                      <p className="m-0 text-[12px] font-semibold text-slate-900">
                        {(request.requested_days || 0).toFixed(1)} д.
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <ApprovalProcessModal
        isOpen={Boolean(approvalRequest)}
        onClose={() => setApprovalRequest(null)}
        process={absenceApprovalProcess ?? null}
        progress={
          approvalRequest ? approvalProgressMap?.[approvalRequest.guid] ?? null : null
        }
        onApproveStage={(stageId, comment) =>
          void handleApproveStage(stageId, comment)
        }
        isApprovingStage={approveStageMutation.isLoading}
        confirmLabel="Подтвердить отпуск"
        onConfirm={() => void finalizeApproval()}
        isConfirming={
          Boolean(approvalRequest) &&
          reviewingRequestId === approvalRequest?.guid &&
          approveRequestMutation.isLoading
        }
        onReject={(comment) => void rejectFromApproval(comment)}
        isRejecting={
          Boolean(approvalRequest) &&
          reviewingRequestId === approvalRequest?.guid &&
          updateRequestMutation.isLoading
        }
        readOnly={approvalRequest?.status !== "pending"}
      />

      <AbsenceRequestModal
        isOpen={isCreateModalOpen}
        onClose={closeCreateModal}
        policies={policies.map((policy) => ({
          guid: policy.guid,
          title: policy.title,
          icon: typeof policy.icon === "string" ? policy.icon : undefined,
          color: typeof policy.color === "string" ? policy.color : undefined,
        }))}
        policyId={modalPolicyId}
        onPolicyIdChange={setModalPolicyId}
        dateFrom={modalDateFrom}
        onDateFromChange={handleDateFromChange}
        dateTo={modalDateTo}
        onDateToChange={setModalDateTo}
        note={modalNote}
        onNoteChange={setModalNote}
        attachmentInputId={attachmentInputId}
        attachments={modalAttachments}
        onAttachmentFiles={(event) => void handleAttachmentFiles(event)}
        onRemoveAttachment={removeAttachment}
        isUploadingAttachments={isUploadingAttachments}
        maxAttachments={MAX_ATTACHMENTS}
        breakdown={modalBreakdown}
        availableDays={modalAvailable}
        requestedDays={modalRequestedDays}
        forecastDays={modalForecast}
        brandColor={brandColor}
        isSubmitting={createRequestMutation.isLoading}
        submitDisabled={
          createRequestMutation.isLoading ||
          isUploadingAttachments ||
          !modalPolicyId ||
          modalRequestedDays <= 0
        }
        onSubmit={() => void submitRequest()}
      />

      <Modal
        isOpen={Boolean(deletingRequest)}
        onClose={() => {
          if (deleteRequestMutation.isLoading) return;
          setDeletingRequest(null);
        }}
        showCloseButton={false}
        className="max-w-md mx-auto p-6"
      >
        {deletingRequest ? (
          <div>
            <div className="flex items-start gap-3">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-50">
                <Trash2 className="h-5 w-5 text-rose-600" />
              </span>
              <div className="min-w-0">
                <h4 className="m-0 text-[16px] font-bold text-slate-900">
                  Удалить запрос?
                </h4>
                <p className="mt-1 text-[13px] text-slate-500 leading-relaxed">
                  Будет удалена заявка{" "}
                  <span className="font-semibold text-slate-700">
                    {deletingRequest.policy?.title ||
                      policiesById.get(deletingRequest.absence_policies_id || "")
                        ?.title ||
                      "Без типа"}
                  </span>{" "}
                  на период{" "}
                  <span className="font-semibold text-slate-700">
                    {formatDateRange(
                      deletingRequest.date_from,
                      deletingRequest.date_to
                    )}
                  </span>
                  {deletingRequest.status === "approved" ? (
                    <>
                      {" "}— подтверждённый отпуск ({(deletingRequest.requested_days || 0).toFixed(1)} д.)
                      будет вычтен из использованных дней.
                    </>
                  ) : (
                    <>. Действие нельзя отменить.</>
                  )}
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingRequest(null)}
                disabled={deleteRequestMutation.isLoading}
                className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteRequest()}
                disabled={deleteRequestMutation.isLoading}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-rose-600 bg-rose-600 px-4 text-[13px] font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
              >
                {deleteRequestMutation.isLoading ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Удаление…
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    Удалить
                  </>
                )}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
