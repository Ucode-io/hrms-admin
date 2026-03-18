import { type ChangeEvent, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  MoreHorizontal,
  Paperclip,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Modal } from "../../../../components/ui/modal";
import {
  type Absence,
  type AbsenceRequestStatus,
  useAbsencesQuery,
  useCreateAbsence,
  useUpdateAbsence,
} from "../../../../api/services/absenceRequest.service";
import {
  type AbsenceBalanceTransaction,
  useAbsenceBalanceTransactionsQuery,
  useCreateAbsenceBalanceTransaction,
} from "../../../../api/services/absenceBalanceTransaction.service";
import { useUploadFile } from "../../../../api/services/file-upload.service";
import {
  type SettingsDirectoryItem,
  useSettingsDirectoryQuery,
} from "../../../../api/services/settingsDirectory.service";

type AbsencesSectionProps = {
  employeeGuid: string;
  brandColor: string;
};

type AbsencePolicyItem = SettingsDirectoryItem & {
  icon?: string;
  color?: string;
  value?: number | string;
};

type AttachmentItem = {
  name: string;
  size: number;
  url: string;
};

type NormalizedAbsenceRequest = {
  guid: string;
  policyId: string;
  status: AbsenceRequestStatus;
  dateFrom: string;
  dateTo: string;
  requestedDays: number;
  note: string;
  attachments: AttachmentItem[];
  createdAt: string;
  updatedAt: string;
};

type NormalizedBalanceTransaction = {
  guid: string;
  policyId: string;
  absenceId: string;
  amount: number;
  type: string;
  sourceDate: string;
};

type DateBreakdownItem = {
  iso: string;
  day: string;
  month: string;
  weekday: string;
  isWeekend: boolean;
};

type RequestedBreakdownItem = {
  date: string;
  value: number;
};

const ABSENCE_POLICIES_SLUG = "absence_policies";
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

const INPUT_CLASSNAME =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-slate-300";

const DATEPICKER_CLASSNAME =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-slate-300";

const resolveNumericValue = (value: unknown, fallback: number): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return fallback;
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
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
};

const parseFlexibleDate = (value: string): Date | null => {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return parseIsoDate(value);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const formatDateRu = (value: string): string => {
  const date = parseIsoDate(value);
  if (!date) return value || "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()}`;
};

const formatDateRange = (from: string, to: string): string => {
  if (!from && !to) return "—";
  if (from && to) return `${formatDateRu(from)} - ${formatDateRu(to)}`;
  return formatDateRu(from || to);
};

const resolveStatus = (value: unknown): AbsenceRequestStatus => {
  if (Array.isArray(value)) {
    const first = value[0];
    if (first === "approved" || first === "rejected" || first === "pending") return first;
    return "pending";
  }

  if (value === "approved" || value === "rejected" || value === "pending") {
    return value;
  }

  return "pending";
};

const resolveStringValue = (value: unknown): string => {
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === "string" ? first : "";
  }
  return typeof value === "string" ? value : "";
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

const resolveAttachments = (value: unknown): AttachmentItem[] => {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return resolveAttachments(parsed);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(value)) return [];

  return value
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
        const maybeUrl = (item as { url?: unknown; file?: unknown }).url || (item as { file?: unknown }).file;
        if (typeof maybeUrl === "string" && maybeUrl) {
          const maybeName = (item as { name?: unknown }).name;
          const maybeSize = (item as { size?: unknown }).size;

          return {
            name:
              typeof maybeName === "string" && maybeName.trim()
                ? maybeName
                : maybeUrl.split("/").pop() || "Файл",
            size: typeof maybeSize === "number" && Number.isFinite(maybeSize) ? maybeSize : 0,
            url: maybeUrl,
          };
        }
      }

      return null;
    })
    .filter((item): item is AttachmentItem => Boolean(item));
};

const resolveRequestedBreakdown = (value: unknown): RequestedBreakdownItem[] => {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return resolveRequestedBreakdown(parsed);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const date = (item as { date?: unknown }).date;
      const amount = (item as { value?: unknown; amount?: unknown }).value ?? (item as { amount?: unknown }).amount;

      if (typeof date !== "string" || !date) return null;

      return {
        date,
        value: resolveNumericValue(amount, 0),
      };
    })
    .filter((item): item is RequestedBreakdownItem => Boolean(item));
};

const normalizeBalanceTransaction = (
  item: AbsenceBalanceTransaction
): NormalizedBalanceTransaction => {
  const amount = resolveNumericValue(
    item.amount ??
      (item as { value?: unknown }).value ??
      (item as { days?: unknown }).days,
    0
  );

  const sourceDate =
    (typeof item.date === "string" && item.date) ||
    (typeof item.occurred_at === "string" && item.occurred_at) ||
    (typeof item.created_at === "string" && item.created_at) ||
    "";

  return {
    guid: item.guid,
    policyId: typeof item.absence_policies_id === "string" ? item.absence_policies_id : "",
    absenceId: typeof item.absences_id === "string" ? item.absences_id : "",
    amount,
    type: resolveStringValue(item.transaction_type || item.type).toLowerCase(),
    sourceDate,
  };
};

const normalizeRequest = (item: Absence): NormalizedAbsenceRequest => {
  const dateFrom = typeof item.date_from === "string" ? item.date_from : "";
  const dateTo = typeof item.date_to === "string" ? item.date_to : "";
  const requestedBreakdown = resolveRequestedBreakdown(item.requested_breakdown);
  const daysFromBreakdown = requestedBreakdown.reduce((sum, part) => sum + part.value, 0);
  const calculatedDays = getDateBreakdown(dateFrom, dateTo).length;

  return {
    guid:
      (typeof item.guid === "string" && item.guid) ||
      (typeof (item as { id?: unknown }).id === "string" ? ((item as { id: string }).id) : ""),
    policyId: typeof item.absence_policies_id === "string" ? item.absence_policies_id : "",
    status: resolveStatus(item.status),
    dateFrom,
    dateTo,
    requestedDays: resolveNumericValue(item.requested_days, daysFromBreakdown || calculatedDays),
    note: typeof item.note === "string" ? item.note : "",
    attachments: resolveAttachments(item.attachments),
    createdAt: typeof item.created_at === "string" ? item.created_at : "",
    updatedAt: typeof item.updated_at === "string" ? item.updated_at : "",
  };
};

const byNewest = (a: NormalizedAbsenceRequest, b: NormalizedAbsenceRequest): number => {
  const aTs = new Date(a.createdAt || a.updatedAt || 0).getTime();
  const bTs = new Date(b.createdAt || b.updatedAt || 0).getTime();
  return bTs - aTs;
};

export default function AbsencesSection({
  employeeGuid,
  brandColor,
}: AbsencesSectionProps) {
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

  const { data: policiesData, isLoading: isPoliciesLoading } = useSettingsDirectoryQuery({
    slug: ABSENCE_POLICIES_SLUG,
    params: {
      limit: 1000,
      offset: 0,
    },
  });

  const { data: requestsData, isLoading: isRequestsLoading } = useAbsencesQuery({
    data: {
      user_base_id: employeeGuid,
      limit: 1000,
      offset: 0,
    },
    querySettings: {
      enabled: Boolean(employeeGuid),
    },
  });

  const { data: balanceTransactionsData } = useAbsenceBalanceTransactionsQuery({
    data: {
      user_base_id: employeeGuid,
      limit: 2000,
      offset: 0,
    },
    querySettings: {
      enabled: Boolean(employeeGuid),
    },
  });

  const createRequestMutation = useCreateAbsence();
  const updateRequestMutation = useUpdateAbsence();
  const createBalanceTransactionMutation = useCreateAbsenceBalanceTransaction();
  const uploadFileMutation = useUploadFile({ folder: "Media" });

  const policies = useMemo(
    () => ((policiesData?.response || []) as AbsencePolicyItem[]),
    [policiesData?.response]
  );

  const policiesById = useMemo(() => {
    const map = new Map<string, AbsencePolicyItem>();
    for (const policy of policies) {
      map.set(policy.guid, policy);
    }
    return map;
  }, [policies]);

  const allRequests = useMemo(() => {
    const source = (requestsData?.response || []) as Absence[];
    return source.map(normalizeRequest).sort(byNewest);
  }, [requestsData?.response]);

  const balanceTransactions = useMemo(() => {
    const source = (balanceTransactionsData?.response || []) as AbsenceBalanceTransaction[];
    return source.map(normalizeBalanceTransaction);
  }, [balanceTransactionsData?.response]);

  const balanceByPolicy = useMemo(() => {
    const map = new Map<string, number>();

    for (const transaction of balanceTransactions) {
      if (!transaction.policyId) continue;
      map.set(transaction.policyId, (map.get(transaction.policyId) || 0) + transaction.amount);
    }

    return map;
  }, [balanceTransactions]);

  const filteredRequests = useMemo(() => {
    if (requestsFilter === "all") return allRequests;
    return allRequests.filter((request) => request.policyId === requestsFilter);
  }, [allRequests, requestsFilter]);

  const historyRequests = useMemo(() => {
    return allRequests
      .filter((request) => request.status === "approved")
      .filter((request) => {
        if (historyPolicyFilter !== "all" && request.policyId !== historyPolicyFilter) {
          return false;
        }

        const sourceDate = parseIsoDate(request.dateFrom);
        if (!sourceDate) return false;

        return sourceDate.getFullYear() === historyYear;
      })
      .sort(byNewest);
  }, [allRequests, historyPolicyFilter, historyYear]);

  const historyTransactions = useMemo(() => {
    return balanceTransactions.filter((transaction) => {
      if (historyPolicyFilter !== "all" && transaction.policyId !== historyPolicyFilter) {
        return false;
      }

      const sourceDate = parseFlexibleDate(transaction.sourceDate);
      if (!sourceDate) return false;

      return sourceDate.getFullYear() === historyYear;
    });
  }, [balanceTransactions, historyPolicyFilter, historyYear]);

  const totalUsedDays = useMemo(() => {
    const usedFromTransactions = historyTransactions
      .filter((transaction) => transaction.amount < 0)
      .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);

    if (usedFromTransactions > 0) {
      return usedFromTransactions;
    }

    return historyRequests.reduce((sum, request) => sum + request.requestedDays, 0);
  }, [historyRequests, historyTransactions]);

  const totalAdjustments = useMemo(() => {
    return historyTransactions
      .filter((transaction) => transaction.type.includes("adjust"))
      .reduce((sum, transaction) => sum + transaction.amount, 0);
  }, [historyTransactions]);

  const selectedPolicy = useMemo(
    () => (modalPolicyId ? policiesById.get(modalPolicyId) || null : null),
    [modalPolicyId, policiesById]
  );

  const modalBreakdown = useMemo(
    () => getDateBreakdown(modalDateFrom, modalDateTo),
    [modalDateFrom, modalDateTo]
  );

  const modalRequestedDays = modalBreakdown.length;

  const modalAvailable = useMemo(() => {
    if (!selectedPolicy) return 0;
    const limit = resolveNumericValue(selectedPolicy.value, 0);
    const balance = balanceByPolicy.get(selectedPolicy.guid) || 0;
    return limit + balance;
  }, [balanceByPolicy, selectedPolicy]);

  const modalForecast = modalAvailable - modalRequestedDays;

  const openCreateModal = (policyGuid?: string) => {
    const fallbackPolicyId =
      policyGuid ||
      modalPolicyId ||
      policies[0]?.guid ||
      "";

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

      toast.success("Запрос на отсутствие создан.");
      closeCreateModal();
    } catch (error) {
      console.error("Failed to create absence request:", error);
      toast.error("Не удалось создать запрос.");
    }
  };

  const handleReviewRequest = async (
    request: NormalizedAbsenceRequest,
    status: AbsenceRequestStatus
  ) => {
    if (request.status !== "pending") return;
    if (!request.guid) {
      toast.error("Не найден guid заявки.");
      return;
    }

    try {
      setReviewingRequestId(request.guid);
      await updateRequestMutation.mutateAsync({
        guid: request.guid,
        data: {
          status: [status],
          reviewed_at: new Date().toISOString(),
        },
      });

      if (status === "approved") {
        await createBalanceTransactionMutation.mutateAsync({
          user_base_id: employeeGuid,
          absence_policies_id: request.policyId || null,
          absences_id: request.guid,
          amount: -Math.abs(request.requestedDays),
          transaction_type: ["absence_approved"],
          date: request.dateFrom || toIsoDate(new Date()),
        });
      }

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

  return (
    <>
      <div className="space-y-3.5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {isPoliciesLoading
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
                const policyLimit = resolveNumericValue(policy.value, 0);
                const policyBalance = balanceByPolicy.get(policy.guid) || 0;
                const available = policyLimit + policyBalance;
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
                        {String(policy.title || "Без названия")}
                      </p>
                    </div>

                    <div className="mt-3">
                      <p className="m-0 text-[12px] text-slate-400">Доступно</p>
                      <div className="mt-1 flex items-end gap-1.5">
                        <span className="text-[28px] font-semibold leading-none" style={{ color: brandColor }}>
                          {available.toFixed(1)}
                        </span>
                        <span className="text-[16px] font-semibold leading-none text-slate-700">д</span>
                      </div>
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
                        onClick={() => toast.info("Дополнительные действия будут доступны позже.")}
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

        {!isPoliciesLoading && policies.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-[14px] text-slate-500">
            Политики отсутствий не найдены.
          </div>
        ) : null}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-3.5">
            <h3 className="m-0 text-[15px] font-bold leading-none text-slate-900">Запросы</h3>

            <div className="flex items-center gap-2">
              <select
                value={requestsFilter}
                onChange={(event) => setRequestsFilter(event.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-800 outline-none"
              >
                <option value="all">Все</option>
                {policies.map((policy) => (
                  <option key={`requests-filter-${policy.guid}`} value={policy.guid}>
                    {String(policy.title || "Без названия")}
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
            {isRequestsLoading ? (
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
                  const policy = policiesById.get(request.policyId);
                  const policyTitle = String(
                    policy?.title ||
                      request.policyId ||
                      "Без типа"
                  );
                  const policyIcon =
                    typeof policy?.icon === "string" && policy.icon
                      ? policy.icon
                      : DEFAULT_POLICY_ICON;
                  const policyColor = resolveHexColor(policy?.color, brandColor);
                  const isReviewing =
                    reviewingRequestId === request.guid &&
                    updateRequestMutation.isLoading;

                  return (
                    <div
                      key={request.guid}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-100">
                              <Icon icon={policyIcon} width={14} height={14} color={policyColor} />
                            </span>
                            <p className="m-0 truncate text-[13px] font-semibold text-slate-900">
                              {policyTitle}
                            </p>
                            <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE_CLASSNAME[request.status]}`}>
                              {STATUS_LABELS[request.status]}
                            </span>
                          </div>

                          <p className="mt-1 text-[12px] text-slate-500">
                            {formatDateRange(request.dateFrom, request.dateTo)} • {request.requestedDays.toFixed(1)} д.
                          </p>

                          {request.note ? (
                            <p className="mt-1 text-[12px] text-slate-500 line-clamp-2">{request.note}</p>
                          ) : null}

                          {request.attachments.length > 0 ? (
                            <div className="mt-1.5 flex flex-wrap gap-2">
                              {request.attachments.map((attachment) => (
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
                              <button
                                type="button"
                                onClick={() => void handleReviewRequest(request, "approved")}
                                disabled={isReviewing}
                                className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[12px] font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
                              >
                                Подтвердить
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleReviewRequest(request, "rejected")}
                                disabled={isReviewing}
                                className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[12px] font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                              >
                                Отклонить
                              </button>
                            </>
                          ) : null}
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
            <h3 className="m-0 text-[15px] font-bold leading-none text-slate-900">История</h3>

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
                    {String(policy.title || "Без названия")}
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
                {totalAdjustments}
              </p>
              <p className="mt-1.5 text-[12px] text-slate-400">Итого корректировок</p>
            </div>
          </div>

          <div className="border-t border-slate-200 px-6 py-4">
            {historyRequests.length === 0 ? (
              <p className="m-0 text-[12px] text-slate-400">За выбранный период записей нет.</p>
            ) : (
              <div className="space-y-2">
                {historyRequests.map((request) => {
                  const policy = policiesById.get(request.policyId);
                  return (
                    <div
                      key={`history-${request.guid}`}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="m-0 truncate text-[12px] font-semibold text-slate-800">
                          {String(policy?.title || "Без названия")}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {formatDateRange(request.dateFrom, request.dateTo)}
                        </p>
                      </div>
                      <p className="m-0 text-[12px] font-semibold text-slate-900">
                        {request.requestedDays.toFixed(1)} д.
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={closeCreateModal}
        showCloseButton={false}
        className="mx-4 w-full max-w-[980px] overflow-visible rounded-2xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="m-0 text-[18px] font-semibold text-slate-900">Запрос на отсутствие</h3>
          <button
            type="button"
            onClick={closeCreateModal}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 divide-y divide-slate-200 md:grid-cols-2 md:divide-x md:divide-y-0">
          <div className="space-y-4 px-6 py-5">
            <div>
              <label className="mb-1 block text-[12px] font-medium text-slate-700">Тип отсутствия</label>
              <select
                value={modalPolicyId}
                onChange={(event) => setModalPolicyId(event.target.value)}
                className={INPUT_CLASSNAME}
              >
                <option value="">Выберите тип</option>
                {policies.map((policy) => (
                  <option key={`modal-policy-${policy.guid}`} value={policy.guid}>
                    {String(policy.title || "Без названия")}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[12px] font-medium text-slate-700">Дата начала</label>
                <DatePicker
                  selected={parseIsoDate(modalDateFrom)}
                  onChange={(date) => handleDateFromChange(date ? toIsoDate(date) : "")}
                  dateFormat="dd.MM.yyyy"
                  placeholderText="дд.мм.гггг"
                  showYearDropdown
                  showMonthDropdown
                  dropdownMode="select"
                  className={DATEPICKER_CLASSNAME}
                  wrapperClassName="w-full"
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-slate-700">Дата окончания</label>
                <DatePicker
                  selected={parseIsoDate(modalDateTo)}
                  onChange={(date) => setModalDateTo(date ? toIsoDate(date) : "")}
                  minDate={parseIsoDate(modalDateFrom) || undefined}
                  dateFormat="dd.MM.yyyy"
                  placeholderText="дд.мм.гггг"
                  showYearDropdown
                  showMonthDropdown
                  dropdownMode="select"
                  className={DATEPICKER_CLASSNAME}
                  wrapperClassName="w-full"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[12px] font-medium text-slate-700">Заметка</label>
              <textarea
                value={modalNote}
                onChange={(event) => setModalNote(event.target.value)}
                placeholder="Укажите причину отсутствия"
                className="h-24 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none transition focus:border-slate-300"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="block text-[12px] font-medium text-slate-700">Вложения</label>
                <span className="text-[11px] text-slate-400">до {MAX_ATTACHMENTS} файлов, до 50MB</span>
              </div>

              <label
                htmlFor={attachmentInputId}
                className={`flex h-28 w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center transition ${isUploadingAttachments ? "cursor-default opacity-70" : "cursor-pointer hover:border-slate-400 hover:bg-slate-100"}`}
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-500">
                  <Upload className="h-4 w-4" style={{ color: brandColor }} />
                </span>
                <span className="mt-2 text-[12px] font-semibold text-slate-700">
                  {isUploadingAttachments ? "Загрузка..." : "Нажмите для добавления файлов"}
                </span>
              </label>
              <input
                id={attachmentInputId}
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.docx,.doc,.xlsx,.xls,.jpeg,.jpg,.png,.sig,.p7s"
                disabled={isUploadingAttachments}
                onChange={(event) => void handleAttachmentFiles(event)}
              />

              {modalAttachments.length > 0 ? (
                <div className="mt-2 space-y-1.5">
                  {modalAttachments.map((attachment) => (
                    <div
                      key={attachment.url}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-2.5 py-2"
                    >
                      <a
                        href={attachment.url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate pr-3 text-[12px] text-slate-700 hover:underline"
                      >
                        {attachment.name}
                      </a>
                      <button
                        type="button"
                        onClick={() => removeAttachment(attachment.url)}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                        aria-label="Удалить файл"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col px-6 py-5">
            <h4 className="m-0 text-[14px] font-semibold text-slate-900">Разбивка</h4>

            <div className="mt-3 max-h-[320px] overflow-auto rounded-xl border border-slate-200">
              {modalBreakdown.length === 0 ? (
                <div className="px-4 py-6 text-[12px] text-slate-400">Выберите корректный диапазон дат.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {modalBreakdown.map((item) => (
                    <div key={item.iso} className="flex items-center gap-2 px-3 py-2">
                      <div
                        className={`inline-flex min-w-[48px] flex-col items-center rounded-md px-1.5 py-1 text-[11px] font-semibold ${
                          item.isWeekend ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        <span>{item.day}</span>
                        <span className="text-[10px] font-medium">{item.month}</span>
                      </div>
                      <span className="min-w-[18px] text-[12px] font-medium text-slate-700">{item.weekday}</span>
                      <span className="h-px flex-1 bg-slate-200" />
                      <span className="inline-flex min-w-[48px] items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] font-medium text-slate-700">
                        1.0
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-700">
              <div className="flex items-center justify-between py-0.5">
                <span>Доступно</span>
                <strong>{modalAvailable.toFixed(1)} д.</strong>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span>Запрошено</span>
                <strong>{modalRequestedDays.toFixed(1)} д.</strong>
              </div>
              <div className="mt-1 flex items-center justify-between border-t border-slate-200 pt-1.5">
                <span>Остаток (прогноз)</span>
                <strong>{modalForecast.toFixed(1)} д.</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end border-t border-slate-200 px-6 py-3.5">
          <button
            type="button"
            onClick={() => void submitRequest()}
            disabled={
              createRequestMutation.isLoading ||
              isUploadingAttachments ||
              !modalPolicyId ||
              modalRequestedDays <= 0
            }
            className="rounded-lg border-none px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-60"
            style={{ backgroundColor: brandColor }}
          >
            {createRequestMutation.isLoading ? "Отправка..." : "Запрос"}
          </button>
        </div>
      </Modal>
    </>
  );
}
