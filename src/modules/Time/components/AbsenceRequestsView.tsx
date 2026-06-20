import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "react-query";
import { Icon } from "@iconify/react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import companyStore from "../../../store/company.store";
import {
  type Absence,
  type AbsenceRequestStatus,
  useApproveAbsence,
  useUpdateAbsence,
} from "../../../api/services/absenceRequest.service";
import { useSettingsDirectoryQuery } from "../../../api/services/settingsDirectory.service";
import encodeJsonToUrlParam from "../../../utils/encodeJsonToUrlParam";
import EmployeesPaginationFooter from "../../Employees/List/components/EmployeesPaginationFooter";
import ApprovalProcessModal from "../../../components/approvals/ApprovalProcessModal";
import ApprovalProgressBadge from "../../../components/approvals/ApprovalProgressBadge";
import ApprovalProgressButton from "../../../components/approvals/ApprovalProgressButton";
import {
  countApprovedStages,
  isProcessComplete,
} from "../../settings/Approvals/approvalRuntime";
import {
  findApprovalProcessFor,
  useApprovalProcessesQuery,
  useApproveStage,
  useEntityApprovalsQuery,
} from "../../../api/services/approval.service";

const ABSENCES_SLUG = "absences";
const ABSENCE_ENTITY_TYPE = "absence";

type AbsenceRow = Absence & {
  user_base_id_data?: {
    guid?: string | null;
    first_name?: string | null;
    second_name?: string | null;
    photo?: string | null;
    name?: string | null;
    departments_id?: string | null;
    departments_id_data?: {
      guid?: string | null;
      title?: string | null;
      [key: string]: unknown;
    } | null;
  } | null;
};

type PaginationItem = number | string;

const PAGE_SIZE = 20;
const DEFAULT_POLICY_ICON = "mdi:airplane";

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

const STATUS_FILTER_OPTIONS: { value: AbsenceRequestStatus; label: string }[] = [
  { value: "pending", label: "Ожидает" },
  { value: "approved", label: "Подтвержден" },
  { value: "rejected", label: "Отклонен" },
];

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

const toIsoDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const normalizeStatus = (status: Absence["status"]): AbsenceRequestStatus => {
  const raw = Array.isArray(status) ? status[0] : status;
  if (raw === "approved" || raw === "rejected") return raw;
  return "pending";
};

const resolveHexColor = (value: unknown, fallback: string): string => {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) return normalized;
  return fallback;
};

const formatDateRange = (from: string, to: string): string => {
  const formatOne = (iso: string): string => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${day}.${month}.${date.getFullYear()}`;
  };
  if (!from && !to) return "—";
  if (from === to) return formatOne(from);
  return `${formatOne(from)} — ${formatOne(to)}`;
};

const getInitials = (name: string): string =>
  name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

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
  const sorted = [...pages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  const result: PaginationItem[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const page = sorted[i];
    const prev = sorted[i - 1];
    if (prev && page - prev > 1) result.push(`ellipsis-${prev}-${page}`);
    result.push(page);
  }
  return result;
};

function AbsenceRequestsView({ leftSlot }: { leftSlot?: ReactNode } = {}) {
  const queryClient = useQueryClient();
  const brandColor = companyStore.mainColor || "#2563eb";

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<AbsenceRequestStatus | "">("");
  const [policyFilter, setPolicyFilter] = useState("");
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null);
  const [approvalRequest, setApprovalRequest] = useState<AbsenceRow | null>(null);

  const { data: approvalProcesses } = useApprovalProcessesQuery();
  const approveStageMutation = useApproveStage();
  const approveRequestMutation = useApproveAbsence();
  const updateRequestMutation = useUpdateAbsence();

  const monthStartIso = useMemo(
    () => toIsoDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)),
    [currentMonth]
  );
  const monthEndIso = useMemo(
    () => toIsoDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)),
    [currentMonth]
  );

  // Reset to first page whenever the query inputs change.
  useEffect(() => {
    setCurrentPage(1);
  }, [monthStartIso, monthEndIso, statusFilter, policyFilter]);

  // Build the items API query: month range overlap + optional filters + pagination.
  const backendQueryData = useMemo(() => {
    const payload: Record<string, unknown> = {
      limit: PAGE_SIZE,
      offset: (currentPage - 1) * PAGE_SIZE,
      // A request overlaps the selected month when it starts on/before the
      // month end AND ends on/after the month start.
      date_from: { $lte: monthEndIso },
      date_to: { $gte: monthStartIso },
    };

    if (statusFilter) {
      payload.status = [statusFilter];
    }
    if (policyFilter) {
      payload.absence_policies_id = policyFilter;
    }

    return payload;
  }, [currentPage, monthStartIso, monthEndIso, statusFilter, policyFilter]);

  const { data, isLoading, isFetching } = useSettingsDirectoryQuery({
    slug: ABSENCES_SLUG,
    params: {
      with_relations: true,
      data: encodeJsonToUrlParam(backendQueryData),
    },
    querySettings: {
      keepPreviousData: true,
    },
  });

  const { data: policiesData } = useSettingsDirectoryQuery({
    slug: "absence_policies",
    params: { limit: 100, offset: 0 },
  });

  const policyOptions = useMemo(() => {
    const rows = (policiesData?.response || []) as Array<{ guid?: string; title?: string }>;
    return rows
      .filter((row) => row?.guid)
      .map((row) => ({ value: String(row.guid), label: String(row.title || "Без названия") }));
  }, [policiesData]);

  const rows = useMemo(() => {
    const list = (data?.response || []) as AbsenceRow[];
    return [...list].sort((a, b) => (b.date_from || "").localeCompare(a.date_from || ""));
  }, [data]);

  const resolveRowDepartmentId = (row: AbsenceRow): string => {
    const employee = row.user_base_id_data;
    return (
      (typeof employee?.departments_id === "string" && employee.departments_id) ||
      (typeof employee?.departments_id_data?.guid === "string"
        ? employee.departments_id_data.guid
        : "") ||
      ""
    );
  };

  const resolveRowProcess = (row: AbsenceRow) =>
    findApprovalProcessFor(
      approvalProcesses ?? [],
      "absence_approval",
      resolveRowDepartmentId(row)
    );

  const approvalEntityIds = useMemo(
    () =>
      rows
        .filter((row) => resolveRowProcess(row))
        .map((row) => row.guid),
    [rows, approvalProcesses]
  );

  const { data: approvalProgressMap } = useEntityApprovalsQuery(
    ABSENCE_ENTITY_TYPE,
    approvalEntityIds
  );

  const totalCount = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const paginationItems = useMemo(
    () => buildPaginationItems(currentPage, totalPages),
    [currentPage, totalPages]
  );

  const visibleRangeLabel = useMemo(() => {
    if (totalCount === 0) return "Нет записей";
    const start = (currentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(currentPage * PAGE_SIZE, totalCount);
    return `${start}–${end} из ${totalCount}`;
  }, [currentPage, totalCount]);

  const activeFiltersCount = (statusFilter ? 1 : 0) + (policyFilter ? 1 : 0);
  const monthLabel = `${MONTH_NAMES_RU[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;

  const goToPreviousMonth = () =>
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const goToNextMonth = () =>
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

  const resetFilters = () => {
    setStatusFilter("");
    setPolicyFilter("");
  };

  const invalidateAbsenceRows = () => {
    queryClient.invalidateQueries(["SETTINGS_DIRECTORY", ABSENCES_SLUG]);
  };

  const handleReviewRequest = async (
    row: AbsenceRow,
    status: "approved" | "rejected"
  ) => {
    const process = resolveRowProcess(row);
    if (status === "approved" && process) {
      const progress = approvalProgressMap?.[row.guid] ?? null;
      if (!isProcessComplete(process, progress)) {
        setApprovalRequest(row);
        return;
      }
    }

    try {
      setReviewingRequestId(row.guid);
      if (status === "approved") {
        await approveRequestMutation.mutateAsync({ guid: row.guid });
      } else {
        await updateRequestMutation.mutateAsync({
          guid: row.guid,
          data: {
            status: ["rejected"],
            reviewed_at: new Date().toISOString(),
          },
        });
      }
      invalidateAbsenceRows();
      toast.success(status === "approved" ? "Запрос подтвержден." : "Запрос отклонен.");
    } catch (error) {
      console.error("Failed to review absence request:", error);
      toast.error("Не удалось изменить статус запроса.");
    } finally {
      setReviewingRequestId(null);
    }
  };

  const approvalRequestProcess = approvalRequest
    ? resolveRowProcess(approvalRequest)
    : undefined;

  const handleApproveStage = async (stageId: string, comment: string) => {
    if (!approvalRequest || !approvalRequestProcess) return;
    try {
      await approveStageMutation.mutateAsync({
        entityType: ABSENCE_ENTITY_TYPE,
        entityId: approvalRequest.guid,
        processId: approvalRequestProcess.id,
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
      invalidateAbsenceRows();
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
      invalidateAbsenceRows();
      toast.success("Запрос отклонен.");
      setApprovalRequest(null);
    } catch (error) {
      console.error("Failed to reject absence request:", error);
      toast.error("Не удалось отклонить запрос.");
    } finally {
      setReviewingRequestId(null);
    }
  };

  return (
    <>
      {/* Toolbar row: view selector (left) + filters & month nav (right) */}
      <div className="-mx-3 md:-mx-4 -mt-3 md:-mt-4">
        <div
          className="px-4 lg:px-6 py-2"
          style={{
            display: "flex",
            alignItems: "center",
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
            onClick={() => setIsFiltersOpen((prev) => !prev)}
            className={`inline-flex h-[38px] items-center gap-2 rounded-xl border px-3 text-sm font-medium transition ${
              isFiltersOpen || activeFiltersCount > 0
                ? "border-brand-200 bg-brand-50 text-brand-600"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <SlidersHorizontal size={16} />
            Фильтры
            {activeFiltersCount > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-md bg-brand-500 px-1 text-xs font-semibold text-white">
                {activeFiltersCount}
              </span>
            )}
          </button>

          <div className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
            <button
              type="button"
              onClick={goToPreviousMonth}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 transition hover:bg-white hover:text-gray-900"
              aria-label="Предыдущий месяц"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[140px] text-center text-sm font-medium text-gray-700">
              {monthLabel}
            </span>
            <button
              type="button"
              onClick={goToNextMonth}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 transition hover:bg-white hover:text-gray-900"
              aria-label="Следующий месяц"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Filters bar */}
        {isFiltersOpen && (
          <div className="flex flex-wrap items-end gap-4 border border-t-0 border-gray-200 bg-gray-50 px-4 py-4 lg:px-6">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500">Статус</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as AbsenceRequestStatus | "")}
                className="h-9 min-w-[180px] rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-brand-400 focus:outline-none"
              >
                <option value="">Все статусы</option>
                {STATUS_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500">Тип отсутствия</span>
              <select
                value={policyFilter}
                onChange={(event) => setPolicyFilter(event.target.value)}
                className="h-9 min-w-[200px] rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-brand-400 focus:outline-none"
              >
                <option value="">Все типы</option>
                {policyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                <X size={15} />
                Сбросить
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content card */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="flex items-center gap-2 border-b border-gray-100 bg-slate-50/70 px-5 py-3 text-sm text-gray-500">
        <CalendarDays size={16} className="text-gray-400" />
        {totalCount > 0
          ? `Отображено ${rows.length} из ${totalCount}`
          : isLoading
            ? "Загрузка..."
            : "Запросов нет"}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="px-5 py-10 text-center text-sm text-gray-400">Загрузка…</div>
      ) : rows.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-gray-400">
          За {monthLabel.toLowerCase()} запросов нет
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm" style={{ opacity: isFetching ? 0.6 : 1 }}>
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                <th className="px-5 py-3 font-medium">Сотрудник</th>
                <th className="px-5 py-3 font-medium">Тип отсутствия</th>
                <th className="px-5 py-3 font-medium">Период</th>
                <th className="px-5 py-3 font-medium">Дней</th>
                <th className="px-5 py-3 font-medium">Статус</th>
                <th className="px-5 py-3 text-right font-medium">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => {
                const status = normalizeStatus(row.status);
                const employee = row.user_base_id_data;
                const employeeName =
                  [employee?.second_name, employee?.first_name].filter(Boolean).join(" ").trim() ||
                  employee?.name ||
                  "Сотрудник";
                const employeePhoto = employee?.photo || "";
                const policyTitle =
                  row.absence_policy_title || row.absence_policies_id_data?.title || "Отсутствие";
                const policyIcon =
                  row.absence_policy_icon ||
                  (row.absence_policies_id_data?.icon as string | undefined) ||
                  DEFAULT_POLICY_ICON;
                const policyColor = resolveHexColor(
                  row.absence_policy_color || row.absence_policies_id_data?.color,
                  brandColor
                );
                const rowProcess = resolveRowProcess(row);
                const rowProgress = rowProcess
                  ? approvalProgressMap?.[row.guid] ?? null
                  : null;
                const hasApprovalHistory = (rowProgress?.approvals?.length ?? 0) > 0;
                const showApprovalProgress =
                  Boolean(rowProcess) && (status === "pending" || hasApprovalHistory);
                const approvedStages = rowProcess
                  ? countApprovedStages(rowProcess, rowProgress)
                  : 0;
                const isReviewing =
                  reviewingRequestId === row.guid &&
                  (approveRequestMutation.isLoading || updateRequestMutation.isLoading);

                return (
                  <tr key={row.guid} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {employeePhoto ? (
                          <img
                            src={employeePhoto}
                            alt={employeeName}
                            className="h-9 w-9 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                            style={{ backgroundColor: brandColor }}
                          >
                            {getInitials(employeeName)}
                          </span>
                        )}
                        <span className="font-medium text-gray-800">{employeeName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                          style={{ backgroundColor: `${policyColor}1a`, color: policyColor }}
                        >
                          <Icon icon={policyIcon} width={17} height={17} />
                        </span>
                        <span className="text-gray-700">{policyTitle}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {formatDateRange(row.date_from, row.date_to)}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {row.requested_days != null ? `${row.requested_days} дн.` : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium ${STATUS_BADGE_CLASSNAME[status]}`}
                      >
                        {STATUS_LABELS[status]}
                      </span>
                      {showApprovalProgress && rowProcess ? (
                        <div className="mt-1.5">
                          <ApprovalProgressBadge
                            title={rowProcess.title}
                            approvedStages={approvedStages}
                            totalStages={rowProcess.stages.length}
                            onClick={() => setApprovalRequest(row)}
                          />
                        </div>
                      ) : null}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        {status === "pending" ? (
                          <>
                            {rowProcess ? (
                              <ApprovalProgressButton
                                approvedStages={approvedStages}
                                totalStages={rowProcess.stages.length}
                                onClick={() => setApprovalRequest(row)}
                                disabled={isReviewing}
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => void handleReviewRequest(row, "approved")}
                                disabled={isReviewing}
                                className="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-[12px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <Check className="h-3.5 w-3.5" />
                                Подтвердить
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => void handleReviewRequest(row, "rejected")}
                              disabled={isReviewing}
                              className="inline-flex h-8 items-center rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-[12px] font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Отклонить
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      </div>

      {totalPages > 1 && (
        <EmployeesPaginationFooter
          visibleRangeLabel={visibleRangeLabel}
          paginationItems={paginationItems}
          currentPage={currentPage}
          totalPages={totalPages}
          brandColor={brandColor}
          onPrevious={() => setCurrentPage((page) => Math.max(1, page - 1))}
          onNext={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
          onPageChange={(page) => setCurrentPage(page)}
        />
      )}

      <ApprovalProcessModal
        isOpen={Boolean(approvalRequest)}
        onClose={() => setApprovalRequest(null)}
        process={approvalRequestProcess ?? null}
        progress={
          approvalRequest ? approvalProgressMap?.[approvalRequest.guid] ?? null : null
        }
        onApproveStage={(stageId, comment) =>
          void handleApproveStage(stageId, comment)
        }
        isApprovingStage={approveStageMutation.isLoading}
        confirmLabel="Подтвердить отсутствие"
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
        readOnly={
          approvalRequest ? normalizeStatus(approvalRequest.status) !== "pending" : false
        }
      />
    </>
  );
}

export default AbsenceRequestsView;
