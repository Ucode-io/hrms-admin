import { Briefcase, MapPin, Users, Wallet, Clock, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { TagChip } from "../../components/Chips";
import {
  VACANCY_STATUS_CONFIG,
  VACANCY_PRIORITY_CONFIG,
  WORK_MODE_CONFIG,
  daysOpenLabel,
  formatSalaryRange,
  type Vacancy,
} from "../../types";

interface VacancyCardProps {
  vacancy: Vacancy;
  onOpenCandidates: (vacancy: Vacancy) => void;
  onEdit: (vacancy: Vacancy) => void;
  onDelete: (vacancy: Vacancy) => void;
  onOpenDetail: (vacancy: Vacancy) => void;
}

export default function VacancyCard({
  vacancy,
  onOpenCandidates,
  onEdit,
  onDelete,
  onOpenDetail,
}: VacancyCardProps) {
  const status = VACANCY_STATUS_CONFIG[vacancy.status];
  const priority = VACANCY_PRIORITY_CONFIG[vacancy.priority];
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  const fillPct =
    vacancy.openings > 0 ? Math.min(100, Math.round((vacancy.hiredCount / vacancy.openings) * 100)) : 0;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:border-gray-300 hover:shadow-sm">
      {/* Accent bar */}
      <span className={`absolute left-0 top-0 h-full w-1 ${status.barClassName}`} />

      <div className="flex flex-col gap-4 p-5 pl-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => onOpenDetail(vacancy)}
            className="min-w-0 flex-1 text-left"
          >
            <div className="flex items-center gap-2">
              {vacancy.tag && <TagChip tag={vacancy.tag} />}
              <h3 className="truncate text-[15px] font-semibold text-gray-900 group-hover:text-brand-600">
                {vacancy.title}
              </h3>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
              <Briefcase size={13} className="shrink-0" />
              {vacancy.departmentTitle}
              {vacancy.location && (
                <>
                  <span className="text-gray-300">·</span>
                  <MapPin size={13} className="shrink-0" />
                  {vacancy.location}
                </>
              )}
            </p>
          </button>

          <div className="flex shrink-0 items-center gap-1.5">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${status.badgeClassName}`}
            >
              {status.label}
            </span>
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              >
                <MoreVertical size={16} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-8 z-20 w-40 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit(vacancy);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Pencil size={14} /> Редактировать
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete(vacancy);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 size={14} /> Удалить
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Meta chips */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-600">
          <span className="inline-flex items-center gap-1.5">
            <Briefcase size={14} className="text-gray-400" />
            {WORK_MODE_CONFIG[vacancy.workMode].label} · {vacancy.employmentType}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Wallet size={14} className="text-gray-400" />
            {formatSalaryRange(vacancy.salaryMin, vacancy.salaryMax, vacancy.salaryCurrency)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock size={14} className="text-gray-400" />
            {daysOpenLabel(vacancy.createdAt)}
          </span>
          {vacancy.priority !== "low" && (
            <span
              className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ${priority.badgeClassName}`}
            >
              {priority.label} приоритет
            </span>
          )}
        </div>

        {/* Pipeline progress */}
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 font-medium text-gray-700">
              <Users size={14} className="text-gray-400" />
              Кандидатов: {vacancy.candidatesCount}
            </span>
            <span className="text-gray-400">
              {vacancy.hiredCount}/{vacancy.openings} закрыто
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full transition-all ${status.barClassName}`}
              style={{ width: `${fillPct}%` }}
            />
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => onOpenCandidates(vacancy)}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
          >
            <Users size={15} /> Кандидаты ({vacancy.candidatesCount})
          </button>
          <button
            type="button"
            onClick={() => onEdit(vacancy)}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-500 text-sm font-medium text-white transition hover:bg-brand-600"
          >
            <Pencil size={15} /> Редактировать
          </button>
        </div>
      </div>
    </div>
  );
}
