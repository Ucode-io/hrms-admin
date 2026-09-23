// Reusable multi-stage approval modal. Renders an approval process as a
// timeline of stages: who already approved (avatar/name/role/comment/time),
// which stage is current (with a comment box + approve/reject actions), and
// which are still waiting. It can also render read-only approval history for
// finalized entities. Generic — any module can drive its own process/entity.

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Check, Clock, Lock, MessageSquare, ShieldCheck, UserRound, X } from "lucide-react";
import { Modal } from "../ui/modal";
import { type ApprovalProcess } from "../../modules/Settings/Approvals/mockData";
import {
  type RequestApprovalProgress,
  countApprovedStages,
  getCurrentUser,
  getStageApproval,
  isProcessComplete,
  nextPendingStageIndex,
} from "../../modules/Settings/Approvals/approvalRuntime";
import { useCurrentUserPositionId } from "../../api/services/approval.service";
import { useTranslation, pluralForm } from "../../i18n";

interface ApprovalProcessModalProps {
  isOpen: boolean;
  onClose: () => void;
  process: ApprovalProcess | null;
  /** Current approval progress for the entity (owned by the parent / API). */
  progress: RequestApprovalProgress | null;
  /** Approve one stage; parent records it (API) and refreshes `progress`. */
  onApproveStage: (stageId: string, comment: string) => void;
  isApprovingStage?: boolean;
  /** Called only after every stage is approved. Should run the real confirm. */
  onConfirm: () => void;
  isConfirming?: boolean;
  /** Rejects the whole entity (optionally with the current comment as reason). */
  onReject: (comment: string) => void;
  isRejecting?: boolean;
  /** Label of the final confirm button, e.g. "Подтвердить отпуск". */
  confirmLabel?: string;
  /** Opens the timeline for audit/history without allowing new actions. */
  readOnly?: boolean;
  /** Что именно согласуется — показывается над этапами. */
  details?: ReactNode;
}

const formatDateTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
};

const AVATAR_COLORS = [
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-fuchsia-100 text-fuchsia-700",
];

const getInitials = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0]?.[0] ?? "";
  const second = words[1]?.[0] ?? "";
  return (first + second).toUpperCase();
};

const colorFromName = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

function PersonAvatar({
  name,
  src,
  ring = "ring-white",
}: {
  name: string;
  src?: string;
  ring?: string;
}) {
  return (
    <span
      className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold ring-2 ${ring} ${
        src ? "bg-gray-100" : colorFromName(name)
      }`}
    >
      {src ? (
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        getInitials(name)
      )}
    </span>
  );
}

function RoleAvatar({ tone }: { tone: "current" | "pending" }) {
  return (
    <span
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ring-2 ring-white ${
        tone === "current" ? "bg-brand-100 text-brand-600" : "bg-gray-100 text-gray-400"
      }`}
    >
      <UserRound size={20} />
    </span>
  );
}

export default function ApprovalProcessModal({
  isOpen,
  onClose,
  process,
  progress,
  onApproveStage,
  isApprovingStage = false,
  onConfirm,
  isConfirming = false,
  onReject,
  isRejecting = false,
  confirmLabel,
  readOnly = false,
  details,
}: ApprovalProcessModalProps) {
  const { t, locale } = useTranslation();
  confirmLabel ??= t("common.confirm");
  const [comment, setComment] = useState("");
  const currentUserPositionId = useCurrentUserPositionId();

  useEffect(() => {
    if (isOpen) setComment("");
  }, [isOpen]);

  const nextIndex = useMemo(
    () => (process ? nextPendingStageIndex(process, progress) : -1),
    [process, progress]
  );

  const complete = useMemo(
    () => (process ? isProcessComplete(process, progress) : false),
    [process, progress]
  );

  if (!process) return null;

  const approvedCount = countApprovedStages(process, progress);
  const totalStages = process.stages.length;
  const percent = totalStages > 0 ? Math.round((approvedCount / totalStages) * 100) : 0;
  const currentUser = getCurrentUser();
  const busy = readOnly || isApprovingStage || isRejecting;

  const handleApproveStage = (stageId: string) => {
    onApproveStage(stageId, comment);
    setComment("");
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      showCloseButton={false}
      className="mx-4 w-full max-w-[680px] overflow-hidden rounded-2xl border border-gray-200 shadow-xl"
    >
      {/* Header */}
      <div className="border-b border-gray-200 bg-gradient-to-b from-gray-50 to-white px-6 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <ShieldCheck size={22} />
            </span>
            <div>
              <h3 className="text-xl font-semibold text-gray-900">{process.title}</h3>
              <p className="mt-0.5 text-sm text-gray-500">
                {t(`approvals.multistage_${pluralForm(locale, totalStages)}`, { count: totalStages })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label={t("common.close")}
          >
            <X size={18} />
          </button>
        </div>

        {/* progress bar */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-gray-500">
            <span>
              {t("approvals.approved_of", { approved: approvedCount, total: totalStages })}
            </span>
            <span>{percent}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                complete ? "bg-emerald-500" : "bg-brand-500"
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Stages — vertical approval timeline */}
      <div className="max-h-[58vh] overflow-y-auto px-6 py-5">
        {details ? <div className="mb-5">{details}</div> : null}
        <div className="relative">
          {process.stages.map((stage, index) => {
            const approval = getStageApproval(progress, stage.id);
            const isApproved = Boolean(approval);
            const isCurrent = !isApproved && index === nextIndex;
            const isLast = index === process.stages.length - 1;

            return (
              <div key={stage.id} className="relative flex gap-3.5 pb-6 last:pb-0">
                {/* connecting line to the next node */}
                {!isLast ? (
                  <span
                    aria-hidden
                    className={`absolute bottom-0 left-[17px] top-9 w-0.5 ${
                      isApproved ? "bg-emerald-400" : "bg-gray-200"
                    }`}
                  />
                ) : null}

                {/* timeline node */}
                <span
                  className={`relative z-10 flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-xs font-bold ring-4 ring-white ${
                    isApproved
                      ? "bg-emerald-500 text-white"
                      : isCurrent
                      ? "bg-brand-500 text-white"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {index + 1}
                </span>

                {/* node content — detailed approver block */}
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-base font-semibold text-gray-900">{stage.title}</h4>
                    {isApproved ? (
                      <span className="mt-0.5 shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                        {t("approvals.approved")}
                      </span>
                    ) : isCurrent ? (
                      <span className="mt-0.5 shrink-0 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">
                        {t("approvals.current_stage")}
                      </span>
                    ) : (
                      <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-400">
                        <Clock size={12} />
                        {t("approvals.pending")}
                      </span>
                    )}
                  </div>

                  {/* responsible / approver block */}
                  {isApproved && approval ? (
                    <div className="mt-3 flex items-start gap-3 rounded-xl bg-white/70 p-3 ring-1 ring-emerald-100">
                      <PersonAvatar
                        name={approval.approverName}
                        src={approval.approverAvatar}
                        ring="ring-emerald-200"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900">
                            {approval.approverName}
                          </p>
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                            {stage.positionTitle}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {t("approvals.approved_at", { date: formatDateTime(approval.approvedAt) })}
                        </p>
                        {approval.comment ? (
                          <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-gray-50 px-2.5 py-2 text-xs text-gray-600">
                            <MessageSquare size={13} className="mt-0.5 shrink-0 text-gray-400" />
                            <span className="italic">«{approval.comment}»</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : isCurrent ? (
                    <div className="mt-3 rounded-xl bg-white p-3 ring-1 ring-brand-100">
                      <div className="flex items-center gap-3">
                        <RoleAvatar tone="current" />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
                              {stage.positionTitle}
                            </span>
                            <span className="text-xs font-medium text-gray-400">
                              {t("approvals.stage_owner")}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {t("approvals.you_approve_as")}{" "}
                            <span className="font-medium text-gray-700">{currentUser.name}</span>
                          </p>
                        </div>
                      </div>

                      {readOnly ? (
                        <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 ring-1 ring-gray-100">
                          <Lock size={13} className="mt-0.5 shrink-0 text-gray-400" />
                          <span>{t("approvals.stage_not_approved")}</span>
                        </div>
                      ) : currentUserPositionId &&
                        stage.positionId === currentUserPositionId ? (
                        <>
                          <textarea
                            value={comment}
                            onChange={(event) => setComment(event.target.value)}
                            rows={2}
                            placeholder={t("approvals.comment_placeholder")}
                            className="mt-3 w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
                          />
                          <div className="mt-2 flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => onReject(comment)}
                              disabled={busy}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <X size={15} />
                              {t("approvals.reject")}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApproveStage(stage.id)}
                              disabled={busy}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Check size={15} />
                              {isApprovingStage ? t("approvals.approving") : t("approvals.approve_stage")}
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 ring-1 ring-amber-100">
                          <Lock size={13} className="mt-0.5 shrink-0" />
                          <span>
                            {t("approvals.only_position_can_approve", { position: stage.positionTitle })}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                      <RoleAvatar tone="pending" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
                            {stage.positionTitle}
                          </span>
                          <span className="text-xs font-medium text-gray-400">
                            {t("approvals.stage_owner")}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-gray-400">
                          {t("approvals.waiting_previous")}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 border-t border-gray-200 bg-gray-50/60 px-6 py-4">
        <p className="min-w-0 flex-1 text-xs text-gray-500">
          {readOnly
            ? t("approvals.history_readonly")
            : complete
            ? t("approvals.all_approved_can_confirm")
            : t("approvals.confirm_after_all")}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 whitespace-nowrap rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            {t("common.close")}
          </button>
          {!readOnly ? (
            <button
              type="button"
              onClick={onConfirm}
              disabled={!complete || isConfirming}
              className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isConfirming ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  {t("approvals.confirming")}
                </>
              ) : (
                confirmLabel
              )}
            </button>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
