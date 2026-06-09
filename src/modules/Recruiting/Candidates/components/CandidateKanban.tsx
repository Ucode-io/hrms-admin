import { useState } from "react";
import CandidateCard from "./CandidateCard";
import {
  CANDIDATE_KANBAN_STAGES,
  CANDIDATE_STAGE_CONFIG,
  type Candidate,
  type CandidateStage,
} from "../../types";

interface CandidateKanbanProps {
  candidates: Candidate[];
  onOpen: (candidate: Candidate) => void;
  onMoveStage: (candidate: Candidate, stage: CandidateStage) => void;
}

export default function CandidateKanban({ candidates, onOpen, onMoveStage }: CandidateKanbanProps) {
  const [dragging, setDragging] = useState<Candidate | null>(null);
  const [overStage, setOverStage] = useState<CandidateStage | null>(null);

  const grouped = CANDIDATE_KANBAN_STAGES.reduce((acc, stage) => {
    acc[stage] = candidates.filter((c) => c.stage === stage);
    return acc;
  }, {} as Record<CandidateStage, Candidate[]>);

  const handleDrop = (stage: CandidateStage) => {
    if (dragging && dragging.stage !== stage) onMoveStage(dragging, stage);
    setDragging(null);
    setOverStage(null);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {CANDIDATE_KANBAN_STAGES.map((stage) => {
        const cfg = CANDIDATE_STAGE_CONFIG[stage];
        const items = grouped[stage];
        const isOver = overStage === stage && dragging?.stage !== stage;
        return (
          <div
            key={stage}
            onDragOver={(e) => {
              e.preventDefault();
              setOverStage(stage);
            }}
            onDragLeave={(e) => {
              if (e.currentTarget === e.target) setOverStage(null);
            }}
            onDrop={() => handleDrop(stage)}
            className={`flex w-[290px] shrink-0 flex-col rounded-2xl border bg-slate-50/60 transition ${
              isOver ? "border-brand-300 bg-brand-50/40 ring-2 ring-brand-100" : "border-gray-200"
            }`}
          >
            {/* Column header */}
            <div className="flex items-center justify-between gap-2 border-b border-gray-200/70 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${cfg.dotClassName}`} />
                <h3 className={`text-sm font-semibold ${cfg.accentClassName}`}>{cfg.label}</h3>
              </div>
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-md bg-white px-1.5 text-xs font-semibold text-gray-500 ring-1 ring-gray-200">
                {items.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-3" style={{ minHeight: 120, maxHeight: "calc(100vh - 360px)" }}>
              {items.length === 0 ? (
                <div
                  className={`flex flex-1 items-center justify-center rounded-xl border-2 border-dashed py-8 text-xs ${
                    isOver ? "border-brand-300 text-brand-500" : "border-gray-200 text-gray-300"
                  }`}
                >
                  {isOver ? "Отпустите здесь" : "Пусто"}
                </div>
              ) : (
                items.map((candidate) => (
                  <CandidateCard
                    key={candidate.id}
                    candidate={candidate}
                    onOpen={onOpen}
                    draggable
                    onDragStart={setDragging}
                    onDragEnd={() => {
                      setDragging(null);
                      setOverStage(null);
                    }}
                    isDragging={dragging?.id === candidate.id}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
