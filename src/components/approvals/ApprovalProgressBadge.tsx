// Reusable approval-progress chip: a shield, the process title, a segmented
// bar (one segment per stage, filled green once approved) and an "N/M" count.
// Generic — usable by any module that surfaces approval progress on a row.

import { ShieldCheck } from "lucide-react";

interface ApprovalProgressBadgeProps {
  title: string;
  approvedStages: number;
  totalStages: number;
  onClick?: () => void;
  className?: string;
}

export default function ApprovalProgressBadge({
  title,
  approvedStages,
  totalStages,
  onClick,
  className = "",
}: ApprovalProgressBadgeProps) {
  const complete = totalStages > 0 && approvedStages >= totalStages;

  const content = (
    <>
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
          complete ? "bg-emerald-100 text-emerald-600" : "bg-brand-50 text-brand-500"
        }`}
      >
        <ShieldCheck size={12} />
      </span>

      <span className="truncate text-[11px] font-semibold text-gray-700">{title}</span>

      <span className="flex shrink-0 items-center gap-0.5">
        {Array.from({ length: totalStages }).map((_, index) => (
          <span
            key={index}
            className={`h-1.5 w-3.5 rounded-full transition-colors ${
              index < approvedStages ? "bg-emerald-500" : "bg-gray-200"
            }`}
          />
        ))}
      </span>

      <span
        className={`shrink-0 text-[11px] font-bold ${
          complete ? "text-emerald-600" : "text-gray-500"
        }`}
      >
        {approvedStages}/{totalStages}
      </span>
    </>
  );

  const baseClassName = `inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 ${className}`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${baseClassName} max-w-full transition hover:border-brand-200 hover:bg-brand-50/40`}
      >
        {content}
      </button>
    );
  }

  return <span className={`${baseClassName} max-w-full`}>{content}</span>;
}
