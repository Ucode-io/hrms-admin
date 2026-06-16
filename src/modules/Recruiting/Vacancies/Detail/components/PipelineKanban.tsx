import { useMemo, useState } from "react";
import { Archive, ChevronDown, ChevronUp, MessageSquare, RotateCcw, ThumbsDown, Trophy } from "lucide-react";
import Avatar from "../../../components/Avatar";
import { ScoreBadge } from "../../../components/Chips";
import OutcomeBadge from "../../../components/OutcomeBadge";
import {
  rejectionReasonLabel,
  STAGE_COLOR_CONFIG,
  daysOpenLabel,
  sortStages,
  type Candidate,
  type CandidateOutcome,
  type StageDef,
  type Vacancy,
} from "../../../types";

interface PipelineKanbanProps {
  vacancy: Vacancy;
  candidates: Candidate[];
  onMove: (candidate: Candidate, toStageId: string) => void;
  onOutcome: (candidate: Candidate, outcome: CandidateOutcome) => void;
  onOpenCandidate: (candidate: Candidate) => void;
}

/** Kanban board with one column per vacancy stage + terminal outcome dock. */
export default function PipelineKanban({
  vacancy,
  candidates,
  onMove,
  onOutcome,
  onOpenCandidate,
}: PipelineKanbanProps) {
  const stages = useMemo(() => sortStages(vacancy.stages), [vacancy.stages]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [showTerminal, setShowTerminal] = useState(true);

  const active = useMemo(() => candidates.filter((c) => c.outcome === "active"), [candidates]);
  const terminal = useMemo(() => candidates.filter((c) => c.outcome !== "active"), [candidates]);

  const byStage = useMemo(() => {
    const map = new Map<string, Candidate[]>();
    for (const stage of stages) map.set(stage.id, []);
    for (const c of active) {
      if (c.currentStageId && map.has(c.currentStageId)) map.get(c.currentStageId)!.push(c);
    }
    return map;
  }, [stages, active]);

  const dragging = draggingId ? candidates.find((c) => c.id === draggingId) ?? null : null;

  const handleDrop = (targetId: string) => {
    if (!dragging) return;
    if (targetId.startsWith("outcome:")) {
      onOutcome(dragging, targetId.slice("outcome:".length) as CandidateOutcome);
    } else if (dragging.currentStageId !== targetId || dragging.outcome !== "active") {
      onMove(dragging, targetId);
    }
    setDraggingId(null);
    setDropTarget(null);
  };

  /** Last visited stage — target for "вернуть в воронку". */
  const returnStageId = (c: Candidate): string | null => {
    const lastStageEntry = [...c.history].reverse().find((h) => h.toStageId);
    const stageId = lastStageEntry?.toStageId ?? stages[0]?.id ?? null;
    return stageId && stages.some((s) => s.id === stageId) ? stageId : stages[0]?.id ?? null;
  };

  if (stages.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-5 py-16 text-center text-sm text-gray-400">
        У вакансии нет этапов — добавьте их через «Редактировать»
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Board */}
      <div className="overflow-x-auto pb-2">
        <div className="flex min-h-[420px] gap-3" style={{ minWidth: stages.length * 280 }}>
          {stages.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              candidates={byStage.get(stage.id) ?? []}
              isDropTarget={dropTarget === stage.id}
              isDragging={Boolean(draggingId)}
              onDragOver={(e) => {
                e.preventDefault();
                setDropTarget(stage.id);
              }}
              onDragLeave={() => setDropTarget((t) => (t === stage.id ? null : t))}
              onDrop={() => handleDrop(stage.id)}
              renderCard={(candidate) => (
                <KanbanCard
                  key={candidate.id}
                  candidate={candidate}
                  stage={stage}
                  isDragging={draggingId === candidate.id}
                  onDragStart={() => setDraggingId(candidate.id)}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setDropTarget(null);
                  }}
                  onClick={() => onOpenCandidate(candidate)}
                />
              )}
            />
          ))}
        </div>
      </div>

      {/* Outcome dock — appears while dragging */}
      {draggingId && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="flex w-full max-w-[640px] gap-3 rounded-2xl border border-gray-200 bg-white/95 p-3 shadow-2xl backdrop-blur">
            {(
              [
                { outcome: "hired", label: "Нанят", icon: <Trophy size={18} />, cls: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400" },
                { outcome: "rejected", label: "Отказ", icon: <ThumbsDown size={18} />, cls: "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-400" },
                { outcome: "reserve", label: "Резерв", icon: <Archive size={18} />, cls: "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-400" },
              ] as const
            ).map((zone) => (
              <div
                key={zone.outcome}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropTarget(`outcome:${zone.outcome}`);
                }}
                onDragLeave={() => setDropTarget((t) => (t === `outcome:${zone.outcome}` ? null : t))}
                onDrop={() => handleDrop(`outcome:${zone.outcome}`)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-4 text-sm font-semibold transition ${zone.cls} ${
                  dropTarget === `outcome:${zone.outcome}` ? "scale-[1.03] shadow-md" : ""
                }`}
              >
                {zone.icon}
                {zone.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Terminal strip */}
      {terminal.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white">
          <button
            type="button"
            onClick={() => setShowTerminal((s) => !s)}
            className="flex w-full items-center justify-between px-5 py-3.5 text-sm font-medium text-gray-700"
          >
            <span>
              Завершённые · {terminal.length}
              <span className="ml-2 text-xs font-normal text-gray-400">
                нанятые, отказы и резерв
              </span>
            </span>
            {showTerminal ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showTerminal && (
            <div className="grid grid-cols-1 gap-2 border-t border-gray-100 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {terminal.map((candidate) => (
                <div
                  key={candidate.id}
                  onClick={() => onOpenCandidate(candidate)}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/50 px-3.5 py-2.5 transition hover:border-brand-200 hover:bg-white"
                >
                  <Avatar firstName={candidate.firstName} lastName={candidate.lastName} photo={candidate.photo} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-gray-800">{candidate.fullName}</div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <OutcomeBadge outcome={candidate.outcome} />
                      {candidate.outcome === "rejected" && candidate.rejectionReason && (
                        <span className="truncate text-[11px] text-gray-400">
                          {rejectionReasonLabel(candidate.rejectionReason)}
                        </span>
                      )}
                    </div>
                  </div>
                  <ScoreBadge score={candidate.avgScore} />
                  <button
                    type="button"
                    title="Вернуть в воронку"
                    onClick={(e) => {
                      e.stopPropagation();
                      const target = returnStageId(candidate);
                      if (target) onMove(candidate, target);
                    }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-brand-50 hover:text-brand-600"
                  >
                    <RotateCcw size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KanbanColumn({
  stage,
  candidates,
  isDropTarget,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  renderCard,
}: {
  stage: StageDef;
  candidates: Candidate[];
  isDropTarget: boolean;
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: () => void;
  renderCard: (candidate: Candidate) => React.ReactNode;
}) {
  const config = STAGE_COLOR_CONFIG[stage.color];
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`flex w-[272px] shrink-0 flex-col rounded-2xl border bg-gray-50/70 transition ${
        isDropTarget
          ? "border-brand-300 bg-brand-50/40 ring-2 ring-brand-100"
          : isDragging
            ? "border-dashed border-gray-300"
            : "border-gray-200"
      }`}
    >
      <div className="flex items-center gap-2 px-4 pb-2 pt-3.5">
        <span className={`h-2 w-2 rounded-full ${config.dotClassName}`} />
        <span className={`text-[13px] font-semibold ${config.accentClassName}`}>{stage.name}</span>
        <span className="ml-auto rounded-md bg-white px-1.5 py-0.5 text-[11px] font-semibold text-gray-400 ring-1 ring-gray-200">
          {candidates.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 px-2.5 pb-3">
        {candidates.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-gray-200 py-8 text-xs text-gray-300">
            Пусто
          </div>
        ) : (
          candidates.map(renderCard)
        )}
      </div>
    </div>
  );
}

function KanbanCard({
  candidate,
  stage,
  isDragging,
  onDragStart,
  onDragEnd,
  onClick,
}: {
  candidate: Candidate;
  stage: StageDef;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: () => void;
}) {
  const config = STAGE_COLOR_CONFIG[stage.color];
  const evaluation = candidate.evaluations.find((e) => e.stageId === stage.id);
  const commentsCount = evaluation?.comments.length ?? 0;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`cursor-grab rounded-xl border border-l-4 border-gray-200 bg-white p-3 shadow-sm transition hover:border-brand-200 hover:shadow ${
        config.cardAccentClassName
      } ${isDragging ? "opacity-40" : ""}`}
    >
      <div className="flex items-center gap-2.5">
        <Avatar firstName={candidate.firstName} lastName={candidate.lastName} photo={candidate.photo} size={34} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-gray-800">{candidate.fullName}</div>
          <div className="truncate text-[11px] text-gray-400">
            {candidate.level && `${candidate.level} · `}
            на этапе {daysOpenLabel(candidate.stageChangedAt)}
          </div>
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        <ScoreBadge score={evaluation?.score ?? null} />
        <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
          <MessageSquare size={12} />
          {commentsCount}
        </span>
      </div>
    </div>
  );
}
