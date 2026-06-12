import { Pencil, Trash2 } from "lucide-react";
import Avatar from "../../components/Avatar";
import { LevelChip, ScoreBadge } from "../../components/Chips";
import OutcomeBadge from "../../components/OutcomeBadge";
import StagePill from "../../components/StagePill";
import {
  CANDIDATE_SOURCE_CONFIG,
  formatDate,
  type Candidate,
  type StageDef,
} from "../../types";

interface CandidateTableProps {
  candidates: Candidate[];
  /** Resolves the candidate's current stage from its vacancy's stage list. */
  resolveStage: (candidate: Candidate) => StageDef | undefined;
  onOpen: (candidate: Candidate) => void;
  onEdit: (candidate: Candidate) => void;
  onDelete: (candidate: Candidate) => void;
}

const Th = ({ children, className = "" }: { children?: React.ReactNode; className?: string }) => (
  <th
    className={`px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400 ${className}`}
  >
    {children}
  </th>
);

export default function CandidateTable({
  candidates,
  resolveStage,
  onOpen,
  onEdit,
  onDelete,
}: CandidateTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] text-sm">
        <thead className="border-b border-gray-100 bg-gray-50/60">
          <tr>
            <Th>Кандидат</Th>
            <Th>Вакансия</Th>
            <Th>Этап</Th>
            <Th>Оценка</Th>
            <Th>Источник</Th>
            <Th>Отклик</Th>
            <Th>Рекрутер</Th>
            <Th className="w-24" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {candidates.map((candidate) => (
            <tr
              key={candidate.id}
              onClick={() => onOpen(candidate)}
              className="cursor-pointer transition hover:bg-slate-50/60"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Avatar
                    firstName={candidate.firstName}
                    lastName={candidate.lastName}
                    photo={candidate.photo}
                    size={34}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{candidate.fullName}</span>
                      <LevelChip level={candidate.level} />
                    </div>
                    <div className="truncate text-xs text-gray-400">{candidate.email}</div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-gray-600">{candidate.vacancyTitle || "—"}</td>
              <td className="px-4 py-3">
                {candidate.outcome === "active" ? (
                  <StagePill stage={resolveStage(candidate)} />
                ) : (
                  <OutcomeBadge outcome={candidate.outcome} />
                )}
              </td>
              <td className="px-4 py-3">
                <ScoreBadge score={candidate.avgScore} />
              </td>
              <td className="px-4 py-3 text-gray-600">
                {CANDIDATE_SOURCE_CONFIG[candidate.source].label}
              </td>
              <td className="px-4 py-3 text-gray-500">{formatDate(candidate.appliedDate)}</td>
              <td className="px-4 py-3 text-gray-600">{candidate.recruiterName ?? "—"}</td>
              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => onEdit(candidate)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                    title="Редактировать"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(candidate)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-rose-50 hover:text-rose-500"
                    title="Удалить"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
