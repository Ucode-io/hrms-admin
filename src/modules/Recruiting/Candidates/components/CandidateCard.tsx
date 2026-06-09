import { MapPin, Star } from "lucide-react";
import Avatar from "../../components/Avatar";
import { LevelChip, TagChip } from "../../components/Chips";
import {
  CANDIDATE_SOURCE_CONFIG,
  CANDIDATE_STAGE_CONFIG,
  formatDate,
  type Candidate,
} from "../../types";

interface CandidateCardProps {
  candidate: Candidate;
  onOpen: (candidate: Candidate) => void;
  draggable?: boolean;
  onDragStart?: (candidate: Candidate) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
}

export default function CandidateCard({
  candidate,
  onOpen,
  draggable = false,
  onDragStart,
  onDragEnd,
  isDragging = false,
}: CandidateCardProps) {
  const accent = CANDIDATE_STAGE_CONFIG[candidate.stage].cardAccentClassName;

  return (
    <div
      draggable={draggable}
      onDragStart={() => onDragStart?.(candidate)}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(candidate)}
      className={`cursor-pointer rounded-xl border border-l-[3px] border-gray-200 bg-white p-3.5 transition hover:border-gray-300 hover:shadow-sm ${accent} ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <Avatar
          firstName={candidate.firstName}
          lastName={candidate.lastName}
          photo={candidate.photo}
          size={38}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="truncate text-sm font-semibold text-gray-900">{candidate.fullName}</h4>
            {candidate.rating > 0 && (
              <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-amber-500">
                <Star size={12} className="fill-amber-400 text-amber-400" />
                {candidate.rating}
              </span>
            )}
          </div>
          <p className="truncate text-xs text-gray-500">{candidate.positionTitle}</p>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {candidate.tag && <TagChip tag={candidate.tag} />}
        {candidate.level && <LevelChip level={candidate.level} />}
      </div>

      <div className="mt-2.5 flex items-center justify-between text-[11px] text-gray-400">
        <span className="inline-flex items-center gap-1">
          <MapPin size={12} />
          {CANDIDATE_SOURCE_CONFIG[candidate.source].label}
        </span>
        <span>{formatDate(candidate.appliedDate)}</span>
      </div>
    </div>
  );
}
