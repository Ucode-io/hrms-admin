import { ArrowRight, CircleDot } from "lucide-react";
import {
  OUTCOME_CONFIG,
  formatDateTime,
  type Candidate,
  type StageDef,
} from "../../../types";

interface HistoryTimelineProps {
  candidate: Candidate;
  stages: StageDef[];
}

/** Chronological log of pipeline movements (newest first). */
export default function HistoryTimeline({ candidate, stages }: HistoryTimelineProps) {
  const stageName = (id: string | null): string =>
    id ? stages.find((s) => s.id === id)?.name ?? "Удалённый этап" : "";

  const entries = [...candidate.history].reverse();

  if (entries.length === 0) {
    return <p className="text-sm text-gray-300">История пуста</p>;
  }

  return (
    <ol className="space-y-0">
      {entries.map((entry, i) => {
        const isLast = i === entries.length - 1;
        const label = entry.toOutcome ? (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            {entry.fromStageId && (
              <>
                <span className="text-gray-600">{stageName(entry.fromStageId)}</span>
                <ArrowRight size={12} className="text-gray-300" />
              </>
            )}
            <span className="font-medium text-gray-800">{OUTCOME_CONFIG[entry.toOutcome].label}</span>
          </span>
        ) : entry.fromStageId ? (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <span className="text-gray-600">{stageName(entry.fromStageId)}</span>
            <ArrowRight size={12} className="text-gray-300" />
            <span className="font-medium text-gray-800">{stageName(entry.toStageId)}</span>
          </span>
        ) : (
          <span>
            Добавлен в воронку{entry.toStageId ? `: ${stageName(entry.toStageId)}` : ""}
          </span>
        );

        return (
          <li key={entry.id} className="relative flex gap-3 pb-4">
            {!isLast && <span className="absolute left-[7px] top-5 h-full w-px bg-gray-200" />}
            <CircleDot size={15} className="relative z-10 mt-0.5 shrink-0 text-brand-400" />
            <div className="min-w-0 text-sm">
              <div className="text-gray-700">{label}</div>
              <div className="mt-0.5 text-xs text-gray-400">
                {entry.byName} · {formatDateTime(entry.at)}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
