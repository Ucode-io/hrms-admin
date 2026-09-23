import { useTranslation } from "../../i18n";
// Reusable "confirm" button whose fill reflects approval-stage progress.
// Looks translucent/disabled at 0% and fills with green as stages are
// approved; becomes a solid button once every stage is approved.
// Generic — usable by any module that drives a multi-stage approval process.

interface ApprovalProgressButtonProps {
  approvedStages: number;
  totalStages: number;
  onClick: () => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export default function ApprovalProgressButton({
  approvedStages,
  totalStages,
  onClick,
  label,
  disabled = false,
  className = "",
}: ApprovalProgressButtonProps) {
  const { t } = useTranslation();
  label ??= t("common.confirm");
  const percent =
    totalStages > 0 ? Math.min(100, Math.round((approvedStages / totalStages) * 100)) : 0;
  const complete = totalStages > 0 && approvedStages >= totalStages;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative overflow-hidden rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
        complete
          ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
      } ${className}`}
      title={
        complete
          ? t("approvals.all_approved")
          : t("approvals.approved_of", { approved: approvedStages, total: totalStages })
      }
    >
      {!complete ? (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 bg-emerald-500/25 transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      ) : null}
      <span className="relative flex items-center gap-1.5">
        {label}
        <span
          className={`text-[10px] font-bold ${
            complete ? "text-white/90" : "text-emerald-600"
          }`}
        >
          {approvedStages}/{totalStages}
        </span>
      </span>
    </button>
  );
}
