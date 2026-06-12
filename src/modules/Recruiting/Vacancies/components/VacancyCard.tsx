import { CalendarDays, MapPin, Pencil, Trash2, UserCheck, Users } from "lucide-react";
import Avatar from "../../components/Avatar";
import { TagChip } from "../../components/Chips";
import type { VacancyCounts } from "../../../../api/services/vacancy.service";
import {
  STAGE_COLOR_CONFIG,
  VACANCY_PRIORITY_CONFIG,
  VACANCY_STATUS_CONFIG,
  daysOpenLabel,
  formatSalaryRange,
  sortStages,
  type Vacancy,
} from "../../types";

interface VacancyCardProps {
  vacancy: Vacancy;
  counts?: VacancyCounts;
  onOpen: (vacancy: Vacancy) => void;
  onEdit: (vacancy: Vacancy) => void;
  onDelete: (vacancy: Vacancy) => void;
}

export default function VacancyCard({ vacancy, counts, onOpen, onEdit, onDelete }: VacancyCardProps) {
  const status = VACANCY_STATUS_CONFIG[vacancy.status];
  const priority = VACANCY_PRIORITY_CONFIG[vacancy.priority];
  const stages = sortStages(vacancy.stages);
  const byStage = counts?.byStage ?? {};
  const activeTotal = stages.reduce((sum, s) => sum + (byStage[s.id] ?? 0), 0);

  return (
    <div
      onClick={() => onOpen(vacancy)}
      className="group flex cursor-pointer flex-col rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-brand-200 hover:shadow-sm"
    >
      {/* Top: tag + badges + actions */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <TagChip tag={vacancy.tag} />
          <span
            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium ${status.badgeClassName}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${status.dotClassName}`} />
            {status.label}
          </span>
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${priority.badgeClassName}`}
          >
            {priority.label}
          </span>
        </div>
        <div
          className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => onEdit(vacancy)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            title="Редактировать"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(vacancy)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-rose-50 hover:text-rose-500"
            title="Удалить"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Title + meta */}
      <h3 className="mt-3 text-[15px] font-semibold text-gray-900 group-hover:text-brand-600">
        {vacancy.title}
      </h3>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
        <span>{vacancy.departmentTitle}</span>
        {vacancy.location && (
          <span className="inline-flex items-center gap-1">
            <MapPin size={12} />
            {vacancy.location}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <CalendarDays size={12} />
          открыта {daysOpenLabel(vacancy.openedAt)}
        </span>
      </div>

      <div className="mt-2.5 text-sm font-semibold text-gray-800">
        {formatSalaryRange(vacancy.salaryMin, vacancy.salaryMax, vacancy.salaryCurrency)}
      </div>

      {/* Mini pipeline bar */}
      <div className="mt-4">
        <div className="flex h-2 w-full gap-[3px] overflow-hidden rounded-full">
          {activeTotal === 0 ? (
            <span className="h-full w-full rounded-full bg-gray-100" />
          ) : (
            stages.map((stage) => {
              const count = byStage[stage.id] ?? 0;
              if (count === 0) return null;
              return (
                <span
                  key={stage.id}
                  title={`${stage.name}: ${count}`}
                  className={`h-full rounded-full ${STAGE_COLOR_CONFIG[stage.color].barClassName}`}
                  style={{ width: `${(count / activeTotal) * 100}%` }}
                />
              );
            })
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
          {activeTotal === 0 ? (
            <span className="text-[11px] text-gray-400">Нет активных кандидатов</span>
          ) : (
            stages.map((stage) => {
              const count = byStage[stage.id] ?? 0;
              if (count === 0) return null;
              return (
                <span key={stage.id} className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${STAGE_COLOR_CONFIG[stage.color].dotClassName}`}
                  />
                  {stage.name} · {count}
                </span>
              );
            })
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1">
            <Users size={13} />
            {vacancy.candidatesCount} кандидатов
          </span>
          <span className="inline-flex items-center gap-1 text-emerald-600">
            <UserCheck size={13} />
            {vacancy.hiredCount} из {vacancy.openings} нанято
          </span>
        </div>
        {vacancy.recruiterName && (
          <div title={`Рекрутер: ${vacancy.recruiterName}`}>
            <Avatar
              firstName={vacancy.recruiterName.split(" ")[1] ?? ""}
              lastName={vacancy.recruiterName.split(" ")[0] ?? ""}
              size={24}
            />
          </div>
        )}
      </div>
    </div>
  );
}
