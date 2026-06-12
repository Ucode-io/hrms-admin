import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import Avatar from "../../../components/Avatar";
import { LevelChip, ScoreBadge } from "../../../components/Chips";
import OutcomeBadge from "../../../components/OutcomeBadge";
import StagePill from "../../../components/StagePill";
import {
  CANDIDATE_SOURCE_CONFIG,
  formatDate,
  type Candidate,
  type Vacancy,
} from "../../../types";

interface CandidatesTabProps {
  vacancy: Vacancy;
  candidates: Candidate[];
  onOpenCandidate: (candidate: Candidate) => void;
}

const Th = ({ children, className = "" }: { children?: React.ReactNode; className?: string }) => (
  <th
    className={`px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400 ${className}`}
  >
    {children}
  </th>
);

/** Flat list of the vacancy's candidates. */
export default function CandidatesTab({ vacancy, candidates, onOpenCandidate }: CandidatesTabProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (c) => c.fullName.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    );
  }, [candidates, search]);

  const stageOf = (c: Candidate) => vacancy.stages.find((s) => s.id === c.currentStageId);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3.5">
        <span className="text-sm font-semibold text-gray-800">
          Кандидаты <span className="font-normal text-gray-400">· {candidates.length}</span>
        </span>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени..."
            className="h-9 w-56 rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-800 transition placeholder:text-gray-400 focus:border-brand-400 focus:outline-none"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-5 py-16 text-center">
          <Users size={32} className="text-gray-300" />
          <p className="text-sm text-gray-400">
            {candidates.length === 0 ? "Кандидатов пока нет" : "Никто не найден"}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/60">
              <tr>
                <Th>Кандидат</Th>
                <Th>Этап</Th>
                <Th>Оценка</Th>
                <Th>Источник</Th>
                <Th>Отклик</Th>
                <Th>Рекрутер</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((candidate) => (
                <tr
                  key={candidate.id}
                  onClick={() => onOpenCandidate(candidate)}
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
                  <td className="px-4 py-3">
                    {candidate.outcome === "active" ? (
                      <StagePill stage={stageOf(candidate)} />
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
