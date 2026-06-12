import { OUTCOME_CONFIG, type CandidateOutcome } from "../types";

export default function OutcomeBadge({ outcome }: { outcome: CandidateOutcome }) {
  const config = OUTCOME_CONFIG[outcome];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${config.badgeClassName}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dotClassName}`} />
      {config.label}
    </span>
  );
}
