import { Pencil, Trash2 } from "lucide-react";
import { TagChip } from "../../components/Chips";
import {
  VACANCY_PRIORITY_CONFIG,
  VACANCY_STATUS_CONFIG,
  daysOpenLabel,
  formatSalaryRange,
  type Vacancy,
} from "../../types";

interface VacancyTableProps {
  vacancies: Vacancy[];
  onOpen: (vacancy: Vacancy) => void;
  onEdit: (vacancy: Vacancy) => void;
  onDelete: (vacancy: Vacancy) => void;
}

const Th = ({ children, className = "" }: { children?: React.ReactNode; className?: string }) => (
  <th
    className={`px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400 ${className}`}
  >
    {children}
  </th>
);

export default function VacancyTable({ vacancies, onOpen, onEdit, onDelete }: VacancyTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-sm">
        <thead className="border-b border-gray-100 bg-gray-50/60">
          <tr>
            <Th>Вакансия</Th>
            <Th>Департамент</Th>
            <Th>Статус</Th>
            <Th>Приоритет</Th>
            <Th>Зарплата</Th>
            <Th>Кандидаты</Th>
            <Th>В работе</Th>
            <Th className="w-24" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {vacancies.map((vacancy) => {
            const status = VACANCY_STATUS_CONFIG[vacancy.status];
            const priority = VACANCY_PRIORITY_CONFIG[vacancy.priority];
            return (
              <tr
                key={vacancy.id}
                onClick={() => onOpen(vacancy)}
                className="cursor-pointer transition hover:bg-slate-50/60"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <TagChip tag={vacancy.tag} />
                    <span className="font-medium text-gray-900">{vacancy.title}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">{vacancy.departmentTitle}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium ${status.badgeClassName}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${status.dotClassName}`} />
                    {status.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${priority.badgeClassName}`}
                  >
                    {priority.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {formatSalaryRange(vacancy.salaryMin, vacancy.salaryMax, vacancy.salaryCurrency)}
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium text-gray-800">{vacancy.candidatesCount}</span>
                  <span className="text-gray-400"> · {vacancy.hiredCount} нанято</span>
                </td>
                <td className="px-4 py-3 text-gray-500">{daysOpenLabel(vacancy.openedAt)}</td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
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
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
