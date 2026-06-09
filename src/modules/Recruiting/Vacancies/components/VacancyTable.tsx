import { Pencil, Trash2, Users } from "lucide-react";
import { TagChip } from "../../components/Chips";
import {
  VACANCY_STATUS_CONFIG,
  WORK_MODE_CONFIG,
  daysOpenLabel,
  formatSalaryRange,
  type Vacancy,
} from "../../types";

interface VacancyTableProps {
  vacancies: Vacancy[];
  onOpenCandidates: (vacancy: Vacancy) => void;
  onEdit: (vacancy: Vacancy) => void;
  onDelete: (vacancy: Vacancy) => void;
  onOpenDetail: (vacancy: Vacancy) => void;
}

const Th = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <th
    className={`whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400 ${className}`}
  >
    {children}
  </th>
);

export default function VacancyTable({
  vacancies,
  onOpenCandidates,
  onEdit,
  onDelete,
  onOpenDetail,
}: VacancyTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] border-collapse">
        <thead>
          <tr className="border-b border-gray-100 bg-slate-50/60">
            <Th>Вакансия</Th>
            <Th>Отдел</Th>
            <Th>Формат</Th>
            <Th>Зарплата</Th>
            <Th className="text-center">Кандидаты</Th>
            <Th className="text-center">Открыта</Th>
            <Th>Статус</Th>
            <Th className="text-right">Действия</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {vacancies.map((v) => {
            const status = VACANCY_STATUS_CONFIG[v.status];
            return (
              <tr key={v.id} className="group transition hover:bg-slate-50/50">
                <td className="px-4 py-3">
                  <button type="button" onClick={() => onOpenDetail(v)} className="flex items-center gap-2 text-left">
                    {v.tag && <TagChip tag={v.tag} />}
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-gray-900 group-hover:text-brand-600">
                        {v.title}
                      </div>
                      <div className="text-xs text-gray-400">{v.experienceLevel}</div>
                    </div>
                  </button>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{v.departmentTitle}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {WORK_MODE_CONFIG[v.workMode].label}
                  <span className="block text-xs text-gray-400">{v.employmentType}</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {formatSalaryRange(v.salaryMin, v.salaryMax, v.salaryCurrency)}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => onOpenCandidates(v)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-2.5 py-1 text-sm font-medium text-gray-700 transition hover:bg-brand-50 hover:text-brand-600"
                  >
                    <Users size={14} /> {v.candidatesCount}
                  </button>
                </td>
                <td className="px-4 py-3 text-center text-sm text-gray-500">
                  {daysOpenLabel(v.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${status.badgeClassName}`}
                  >
                    {status.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => onEdit(v)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(v)}
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
