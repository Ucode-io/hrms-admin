// Заявки на опоздание (Late Permission, ADR-0015). Решение — только через
// late_permission_review: сервер сам проверяет, что пройдены все этапы
// процесса `late_permission_approval`, и пересчитывает день после одобрения.

import { type ReactNode, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { toast } from "sonner";
import companyStore from "../../../store/company.store";
import { Modal } from "../../../components/ui/modal";
import ApprovalProcessModal from "../../../components/approvals/ApprovalProcessModal";
import ApprovalProgressBadge from "../../../components/approvals/ApprovalProgressBadge";
import ApprovalProgressButton from "../../../components/approvals/ApprovalProgressButton";
import { countApprovedStages } from "../../Settings/Approvals/approvalRuntime";
import {
  useApprovalProcessesQuery,
  useApproveStage,
  useEntityApprovalsQuery,
} from "../../../api/services/approval.service";
import {
  LATE_PERMISSION_ENTITY_TYPE,
  type LatePermission,
  type LatePermissionStatus,
  latePermissionErrorCode,
  useLatePermissionsQuery,
  useReviewLatePermission,
} from "../../../api/services/latePermission.service";
import { useTranslation, monthNames } from "../../../i18n";
import type { MessageKey } from "../../../i18n/messages";

const STATUS_FILTERS: Array<LatePermissionStatus | ""> = ["", "pending", "approved", "rejected", "withdrawn"];

const STATUS_BADGE: Record<LatePermissionStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
  withdrawn: "bg-gray-100 text-gray-600",
};

const isoDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const formatDay = (iso: string) => {
  const [year, month, day] = iso.slice(0, 10).split("-");
  return day ? `${day}.${month}.${year}` : iso;
};

const fullName = (row: LatePermission) =>
  [row.second_name, row.first_name].filter(Boolean).join(" ").trim();

function LatePermissionRequestsView({ leftSlot, tabs }: { leftSlot?: ReactNode; tabs?: ReactNode } = {}) {
  const { t, locale } = useTranslation();
  const brandColor = companyStore.mainColor || "#2563eb";
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [status, setStatus] = useState<LatePermissionStatus | "">("");
  const [approvalRow, setApprovalRow] = useState<LatePermission | null>(null);
  const [rejectRow, setRejectRow] = useState<LatePermission | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: rows = [], isLoading, isFetching } = useLatePermissionsQuery({
    dateFrom: isoDay(month),
    dateTo: isoDay(new Date(month.getFullYear(), month.getMonth() + 1, 0)),
    status,
  });
  const { data: processes } = useApprovalProcessesQuery();
  const approveStage = useApproveStage();
  const review = useReviewLatePermission();

  const processOf = (row: LatePermission) =>
    processes?.find((process) => process.id === row.approval_processes_id);

  const { data: progressMap } = useEntityApprovalsQuery(
    LATE_PERMISSION_ENTITY_TYPE,
    rows.filter((row) => row.approval_processes_id).map((row) => row.guid)
  );

  const errorText = (error: unknown) => {
    const code = latePermissionErrorCode(error);
    const key = `late_permission.error.${code}` as MessageKey;
    return code && t(key) !== key ? t(key) : t("late_permission.error.generic");
  };

  const decide = async (row: LatePermission, decision: "approved" | "rejected", reason = "") => {
    try {
      const result = await review.mutateAsync({ guid: row.guid, status: decision, rejectReason: reason });
      if (decision === "approved" && result.recalc_error) {
        // Одобрено, но минуты опоздания дня не пересчитаны — повтор одобрения
        // только пересчитывает, статус и уведомления не трогает.
        toast.error(t("late_permission.recalc_failed"), {
          duration: 15000,
          action: { label: t("late_permission.retry"), onClick: () => void decide(row, "approved") },
        });
      } else {
        toast.success(decision === "approved" ? t("late_permission.approved_toast") : t("late_permission.rejected_toast"));
      }
      setApprovalRow(null);
      setRejectRow(null);
      setRejectReason("");
    } catch (error) {
      toast.error(errorText(error));
    }
  };

  const approvalProcess = approvalRow ? processOf(approvalRow) : undefined;
  const monthLabel = `${monthNames(locale)[month.getMonth()]} ${month.getFullYear()}`;
  const shiftMonth = (delta: number) =>
    setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));

  return (
    <>
      <div className="-mx-3 md:-mx-4 -mt-3 md:-mt-4">
        <div className="flex flex-wrap items-center gap-2.5 border border-t-0 border-slate-200 bg-white px-4 py-2 lg:px-6">
          {leftSlot && <div className="mr-auto flex items-center">{leftSlot}</div>}
          <div className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1">
            {STATUS_FILTERS.map((value) => (
              <button
                key={value || "all"}
                type="button"
                onClick={() => setStatus(value)}
                className={`h-8 rounded-lg px-2.5 text-[13px] font-medium transition ${
                  status === value ? "bg-brand-50 text-brand-600" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {value ? t(`late_permission.status.${value}` as MessageKey) : t("late_permission.status.all")}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white">
        {tabs}
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-slate-50/70 px-5 py-2.5 text-sm text-gray-500">
          <span className="inline-flex items-center gap-2">
            <Clock size={16} className="text-gray-400" />
            {isLoading ? t("common.loading") : t("late_permission.count", { count: rows.length })}
          </span>
          <div className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label={t("common.prev_month")}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-50">
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[140px] text-center text-sm font-medium text-gray-700">{monthLabel}</span>
            <button type="button" onClick={() => shiftMonth(1)} aria-label={t("common.next_month")}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-50">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">
            {isLoading ? t("common.loading") : t("late_permission.none")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm" style={{ opacity: isFetching ? 0.6 : 1 }}>
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                  <th className="px-5 py-3 font-medium">{t("absence_request.employee")}</th>
                  <th className="px-5 py-3 font-medium">{t("late_permission.date")}</th>
                  <th className="px-5 py-3 font-medium">{t("late_permission.arrive_by")}</th>
                  <th className="px-5 py-3 font-medium">{t("late_permission.reason")}</th>
                  <th className="px-5 py-3 font-medium">{t("tasks.table.header_status")}</th>
                  <th className="px-5 py-3 text-right font-medium">{t("attendance.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => {
                  const process = processOf(row);
                  const progress = process ? progressMap?.[row.guid] ?? null : null;
                  const busy = review.isLoading && review.variables?.guid === row.guid;
                  const name = fullName(row) || t("absence_calendar.employee_fallback");
                  return (
                    <tr key={row.guid} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {row.photo ? (
                            <img src={row.photo} alt={name} className="h-9 w-9 shrink-0 rounded-full object-cover" />
                          ) : (
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                              style={{ backgroundColor: brandColor }}>
                              {name.split(" ").map((part) => part.charAt(0)).join("").slice(0, 2).toUpperCase()}
                            </span>
                          )}
                          <span className="font-medium text-gray-800">{name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-600">{formatDay(row.date)}</td>
                      <td className="px-5 py-3">
                        <span className="font-semibold text-gray-800">{row.arrive_by}</span>
                        {row.status !== "approved" && row.day_start ? (
                          <span className="ml-2 text-xs text-gray-400">
                            {t("late_permission.by_schedule", { time: row.day_start })}
                          </span>
                        ) : null}
                      </td>
                      <td className="max-w-[280px] px-5 py-3 text-gray-600">
                        <span className="line-clamp-2" title={row.reason}>{row.reason}</span>
                        {row.status === "rejected" && row.reject_reason ? (
                          <span className="mt-1 block text-xs text-rose-600">{row.reject_reason}</span>
                        ) : null}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium ${STATUS_BADGE[row.status]}`}>
                          {t(`late_permission.status.${row.status}` as MessageKey)}
                        </span>
                        {row.after_check_in ? (
                          <span className="ml-1.5 inline-flex rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700">
                            {t("late_permission.after_check_in")}
                          </span>
                        ) : null}
                        {process && (row.status === "pending" || (progress?.approvals?.length ?? 0) > 0) ? (
                          <div className="mt-1.5">
                            <ApprovalProgressBadge
                              title={process.title}
                              approvedStages={countApprovedStages(process, progress)}
                              totalStages={process.stages.length}
                              onClick={() => setApprovalRow(row)}
                            />
                          </div>
                        ) : null}
                      </td>
                      <td className="px-5 py-3">
                        {row.status === "pending" ? (
                          <div className="flex justify-end gap-2">
                            {process ? (
                              <ApprovalProgressButton
                                approvedStages={countApprovedStages(process, progress)}
                                totalStages={process.stages.length}
                                onClick={() => setApprovalRow(row)}
                                disabled={busy}
                              />
                            ) : (
                              <button type="button" onClick={() => void decide(row, "approved")} disabled={busy}
                                className="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-[12px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60">
                                <Check className="h-3.5 w-3.5" />
                                {t("common.confirm")}
                              </button>
                            )}
                            <button type="button" onClick={() => setRejectRow(row)} disabled={busy}
                              className="inline-flex h-8 items-center rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-[12px] font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60">
                              {t("approvals.reject")}
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={Boolean(rejectRow)} onClose={() => setRejectRow(null)} className="max-w-[440px] p-6">
        <h3 className="mb-3 text-lg font-semibold text-gray-800">{t("late_permission.reject_title")}</h3>
        <textarea
          value={rejectReason}
          onChange={(event) => setRejectReason(event.target.value)}
          placeholder={t("late_permission.reject_placeholder")}
          rows={3}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-300 focus:outline-none"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setRejectRow(null)}
            className="h-9 rounded-lg border border-gray-200 px-3 text-sm text-gray-600 hover:bg-gray-50">
            {t("common.cancel")}
          </button>
          <button type="button" disabled={review.isLoading}
            onClick={() => rejectRow && void decide(rejectRow, "rejected", rejectReason)}
            className="h-9 rounded-lg bg-rose-600 px-3 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60">
            {t("approvals.reject")}
          </button>
        </div>
      </Modal>

      <ApprovalProcessModal
        isOpen={Boolean(approvalRow)}
        onClose={() => setApprovalRow(null)}
        process={approvalProcess ?? null}
        progress={approvalRow ? progressMap?.[approvalRow.guid] ?? null : null}
        onApproveStage={(stageId, comment) => {
          if (!approvalRow || !approvalProcess) return;
          approveStage
            .mutateAsync({
              entityType: LATE_PERMISSION_ENTITY_TYPE,
              entityId: approvalRow.guid,
              processId: approvalProcess.id,
              stageId,
              comment,
            })
            .catch(() => toast.error(t("attendance.approve_stage_error")));
        }}
        isApprovingStage={approveStage.isLoading}
        confirmLabel={t("late_permission.confirm")}
        onConfirm={() => approvalRow && void decide(approvalRow, "approved")}
        isConfirming={review.isLoading && review.variables?.status === "approved"}
        onReject={(comment) => approvalRow && void decide(approvalRow, "rejected", comment)}
        isRejecting={review.isLoading && review.variables?.status === "rejected"}
        readOnly={approvalRow ? approvalRow.status !== "pending" : false}
      />
    </>
  );
}

export default LatePermissionRequestsView;
