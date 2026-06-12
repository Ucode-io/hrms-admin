import { Check } from "lucide-react";
import {
  STAGE_COLOR_CONFIG,
  scoreTone,
  sortStages,
  type Candidate,
  type StageDef,
} from "../../../types";

interface StageProgressRailProps {
  stages: StageDef[];
  candidate: Candidate;
  onStageClick?: (stage: StageDef) => void;
}

/** Horizontal stepper: passed stages (with score), current, upcoming. */
export default function StageProgressRail({ stages, candidate, onStageClick }: StageProgressRailProps) {
  const ordered = sortStages(stages);
  const currentIndex = ordered.findIndex((s) => s.id === candidate.currentStageId);
  const isTerminal = candidate.outcome !== "active";

  const visitedIds = new Set(candidate.evaluations.map((e) => e.stageId));

  return (
    <div className="overflow-x-auto">
      <ol className="flex min-w-max items-start gap-0 px-1 py-1">
        {ordered.map((stage, index) => {
          const evaluation = candidate.evaluations.find((e) => e.stageId === stage.id);
          const isCurrent = !isTerminal && index === currentIndex;
          const isPassed = isTerminal
            ? visitedIds.has(stage.id)
            : currentIndex >= 0 && index < currentIndex;
          const config = STAGE_COLOR_CONFIG[stage.color];

          return (
            <li key={stage.id} className="flex items-start">
              {index > 0 && (
                <span
                  className={`mt-[15px] h-0.5 w-8 sm:w-12 ${
                    isPassed || isCurrent ? "bg-brand-300" : "bg-gray-200"
                  }`}
                />
              )}
              <button
                type="button"
                onClick={() => onStageClick?.(stage)}
                className="group flex w-[92px] flex-col items-center gap-1.5 sm:w-[108px]"
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${
                    isCurrent
                      ? `${config.dotClassName} text-white ring-4 ring-brand-100`
                      : isPassed
                        ? `${config.dotClassName} text-white`
                        : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {isPassed && !evaluation?.score ? <Check size={14} /> : null}
                  {evaluation?.score ? evaluation.score : !isPassed ? index + 1 : null}
                </span>
                <span
                  className={`max-w-full truncate text-center text-[11px] leading-tight ${
                    isCurrent ? "font-semibold text-gray-900" : isPassed ? "text-gray-600" : "text-gray-400"
                  }`}
                  title={stage.name}
                >
                  {stage.name}
                </span>
                {evaluation?.score != null && (
                  <span className={`text-[10px] font-semibold ${scoreTone(evaluation.score).textClassName}`}>
                    {evaluation.score}/10
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
