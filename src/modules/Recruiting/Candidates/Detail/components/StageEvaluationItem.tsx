import { ChevronDown, MessageSquare } from "lucide-react";
import ScorePicker from "../../../components/ScorePicker";
import CommentThread, { type AttachedFile } from "../../../components/CommentThread";
import { ScoreBadge } from "../../../components/Chips";
import {
  STAGE_COLOR_CONFIG,
  formatDate,
  type CandidateDocument,
  type StageDef,
  type StageEvaluation,
} from "../../../types";

interface StageEvaluationItemProps {
  stage: StageDef;
  evaluation: StageEvaluation;
  /** When the candidate entered this stage (from history). */
  enteredAt: string | null;
  /** Документы кандидата — для отображения вложений в комментариях. */
  documents: CandidateDocument[];
  isCurrent: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onScore: (score: number | null) => void;
  onAddComment: (text: string) => Promise<void> | void;
  onAttachFile: (file: AttachedFile) => Promise<void> | void;
  isScoring?: boolean;
  isCommenting?: boolean;
}

/** Accordion row: stage summary collapsed, score + comments when expanded. */
export default function StageEvaluationItem({
  stage,
  evaluation,
  enteredAt,
  documents,
  isCurrent,
  isExpanded,
  onToggle,
  onScore,
  onAddComment,
  onAttachFile,
  isScoring = false,
  isCommenting = false,
}: StageEvaluationItemProps) {
  const config = STAGE_COLOR_CONFIG[stage.color];

  return (
    <div
      id={`stage-${stage.id}`}
      className={`overflow-hidden rounded-xl border transition ${
        isCurrent ? "border-brand-200" : "border-gray-200"
      }`}
    >
      {/* Summary row */}
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
          isExpanded ? "bg-gray-50/70" : "bg-white hover:bg-gray-50/50"
        }`}
      >
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${config.dotClassName}`} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">{stage.name}</span>
            {isCurrent && (
              <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-600">
                ТЕКУЩИЙ
              </span>
            )}
          </span>
          {enteredAt && (
            <span className="text-[11px] text-gray-400">с {formatDate(enteredAt)}</span>
          )}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-gray-400">
          <MessageSquare size={12} />
          {evaluation.comments.length}
        </span>
        <ScoreBadge score={evaluation.score} />
        <ChevronDown
          size={16}
          className={`shrink-0 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
        />
      </button>

      {/* Expanded body */}
      {isExpanded && (
        <div className="space-y-5 border-t border-gray-100 bg-white px-4 py-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[13px] font-medium text-gray-600">Оценка этапа (1–10)</span>
              {isScoring && <span className="text-xs text-gray-400">Сохранение…</span>}
            </div>
            <ScorePicker value={evaluation.score} onChange={onScore} disabled={isScoring} />
          </div>
          <div>
            <span className="mb-2 block text-[13px] font-medium text-gray-600">Комментарии</span>
            <CommentThread
              comments={evaluation.comments}
              documents={documents}
              onAdd={onAddComment}
              onAttach={onAttachFile}
              isSubmitting={isCommenting}
            />
          </div>
        </div>
      )}
    </div>
  );
}
