import { Pencil, Star, Trash2 } from "lucide-react";
import Avatar from "../../components/Avatar";
import { LevelChip, TagChip } from "../../components/Chips";
import {
  CANDIDATE_SOURCE_CONFIG,
  CANDIDATE_STAGE_CONFIG,
  formatDate,
  type Candidate,
} from "../../types";

interface CandidateTableProps {
  candidates: Candidate[];
  onOpen: (candidate: Candidate) => void;
  onEdit: (candidate: Candidate) => void;
  onDelete: (candidate: Candidate) => void;
}

const Th = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <th
    className={`whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400 ${className}`}
  >
    {children}
  </th>
);

export default function CandidateTable({ candidates, onOpen, onEdit, onDelete }: CandidateTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] border-collapse">
        <thead>
          <tr className="border-b border-gray-100 bg-slate-50/60">
            <Th>Кандидат</Th>
            <Th>Вакансия</Th>
            <Th>Этап</Th>
            <Th>Источник</Th>
            <Th className="text-center">Оценка</Th>
            <Th className="text-center">Дата</Th>
            <Th className="text-right">Действия</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {candidates.map((c) => {
            const stage = CANDIDATE_STAGE_CONFIG[c.stage];
            return (
              <tr key={c.id} className="group transition hover:bg-slate-50/50">
                <td className="px-4 py-3">
                  <button type="button" onClick={() => onOpen(c)} className="flex items-center gap-3 text-left">
                    <Avatar firstName={c.firstName} lastName={c.lastName} photo={c.photo} size={36} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-gray-900 group-hover:text-brand-600">
                        {c.fullName}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {c.tag && <TagChip tag={c.tag} />}
                        {c.level && <LevelChip level={c.level} />}
                      </div>
                    </div>
                  </button>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{c.positionTitle}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${stage.badgeClassName}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${stage.dotClassName}`} />
                    {stage.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {CANDIDATE_SOURCE_CONFIG[c.source].label}
                </td>
                <td className="px-4 py-3 text-center">
                  {c.rating > 0 ? (
                    <span className="inline-flex items-center gap-0.5 text-sm font-medium text-amber-500">
                      <Star size={13} className="fill-amber-400 text-amber-400" />
                      {c.rating}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center text-sm text-gray-500">{formatDate(c.appliedDate)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => onEdit(c)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(c)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
