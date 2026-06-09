import {
  Briefcase,
  CalendarClock,
  MapPin,
  Pencil,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import BottomSheet from "../../components/BottomSheet";
import { TagChip } from "../../components/Chips";
import {
  VACANCY_PRIORITY_CONFIG,
  VACANCY_STATUS_CONFIG,
  VACANCY_STATUS_ORDER,
  WORK_MODE_CONFIG,
  daysOpenLabel,
  formatDate,
  formatSalaryRange,
  type Vacancy,
  type VacancyStatus,
} from "../../types";

interface VacancyDetailDrawerProps {
  isOpen: boolean;
  vacancy: Vacancy | null;
  onClose: () => void;
  onEdit: (vacancy: Vacancy) => void;
  onDelete: (vacancy: Vacancy) => void;
  onOpenCandidates: (vacancy: Vacancy) => void;
  onChangeStatus: (vacancy: Vacancy, status: VacancyStatus) => void;
}

const InfoRow = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) => (
  <div className="flex items-center justify-between gap-3 py-2.5">
    <span className="inline-flex items-center gap-2 text-sm text-gray-500">
      <Icon size={15} className="text-gray-400" />
      {label}
    </span>
    <span className="text-right text-sm font-medium text-gray-800">{value || "—"}</span>
  </div>
);

const Block = ({ title, text }: { title: string; text: string }) => {
  if (!text) return null;
  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold text-gray-800">{title}</p>
      <div className="space-y-1 rounded-2xl border border-gray-100 bg-white px-4 py-3 text-sm text-gray-600">
        {text.split("\n").map((line, i) =>
          line.trim() ? (
            <p key={i} className="flex gap-2">
              <span className="text-gray-300">•</span>
              {line.trim()}
            </p>
          ) : null
        )}
      </div>
    </div>
  );
};

export default function VacancyDetailDrawer({
  isOpen,
  vacancy,
  onClose,
  onEdit,
  onDelete,
  onOpenCandidates,
  onChangeStatus,
}: VacancyDetailDrawerProps) {
  if (!vacancy) return null;

  const status = VACANCY_STATUS_CONFIG[vacancy.status];
  const priority = VACANCY_PRIORITY_CONFIG[vacancy.priority];
  const fillPct =
    vacancy.openings > 0 ? Math.min(100, Math.round((vacancy.hiredCount / vacancy.openings) * 100)) : 0;

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      leading={
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <Briefcase size={20} />
        </span>
      }
      title={
        <span className="flex items-center gap-2">
          {vacancy.tag && <TagChip tag={vacancy.tag} />}
          {vacancy.title}
        </span>
      }
      subtitle={`${vacancy.departmentTitle} · ${vacancy.experienceLevel}`}
      headerActions={
        <>
          <button
            type="button"
            onClick={() => onEdit(vacancy)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-gray-200 px-3.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
          >
            <Pencil size={15} /> Изменить
          </button>
          <button
            type="button"
            onClick={() => onDelete(vacancy)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-400 transition hover:bg-rose-50 hover:text-rose-600"
          >
            <Trash2 size={15} />
          </button>
        </>
      }
      footer={
        <button
          type="button"
          onClick={() => onOpenCandidates(vacancy)}
          className="ml-auto inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-6 text-sm font-medium text-white transition hover:bg-brand-600"
        >
          <Users size={16} /> Кандидаты ({vacancy.candidatesCount})
        </button>
      }
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_1fr]">
        {/* Left column */}
        <div className="space-y-5">
          {/* Status switcher */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Статус</p>
            <div className="flex flex-wrap gap-2">
              {VACANCY_STATUS_ORDER.map((s) => {
                const cfg = VACANCY_STATUS_CONFIG[s];
                const active = s === vacancy.status;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => !active && onChangeStatus(vacancy, s)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      active ? cfg.badgeClassName : "border border-gray-200 text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotClassName}`} />
                    {cfg.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-1.5 font-medium text-gray-700">
                  <Users size={15} className="text-gray-400" /> {vacancy.candidatesCount} кандидатов
                </span>
                <span className="text-gray-500">
                  {vacancy.hiredCount} из {vacancy.openings} закрыто
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div className={`h-full rounded-full ${status.barClassName}`} style={{ width: `${fillPct}%` }} />
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white px-4">
            <InfoRow
              icon={Wallet}
              label="Зарплата"
              value={formatSalaryRange(vacancy.salaryMin, vacancy.salaryMax, vacancy.salaryCurrency)}
            />
            <InfoRow
              icon={Briefcase}
              label="Формат"
              value={`${WORK_MODE_CONFIG[vacancy.workMode].label} · ${vacancy.employmentType}`}
            />
            <InfoRow icon={MapPin} label="Локация" value={vacancy.location} />
            <InfoRow icon={Briefcase} label="Подразделение" value={vacancy.divisionTitle} />
            <InfoRow
              icon={CalendarClock}
              label="Открыта"
              value={`${formatDate(vacancy.openedAt)} (${daysOpenLabel(vacancy.openedAt)})`}
            />
            <InfoRow icon={CalendarClock} label="Дедлайн" value={formatDate(vacancy.deadline)} />
            <InfoRow
              icon={Users}
              label="Приоритет"
              value={
                <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs ${priority.badgeClassName}`}>
                  {priority.label}
                </span>
              }
            />
            <InfoRow icon={Users} label="Рекрутер" value={vacancy.recruiterName} />
            <InfoRow icon={Users} label="Нанимающий менеджер" value={vacancy.hiringManagerName} />
          </div>

          {vacancy.skills.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="mb-2 text-sm font-semibold text-gray-800">Навыки</p>
              <div className="flex flex-wrap gap-1.5">
                {vacancy.skills.map((s) => (
                  <span key={s} className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {vacancy.description && (
            <div>
              <p className="mb-1.5 text-sm font-semibold text-gray-800">Описание</p>
              <p className="rounded-2xl border border-gray-100 bg-white px-4 py-3 text-sm text-gray-600">
                {vacancy.description}
              </p>
            </div>
          )}
          <Block title="Обязанности" text={vacancy.responsibilities} />
          <Block title="Требования" text={vacancy.requirements} />
          <Block title="Условия" text={vacancy.conditions} />
          {!vacancy.description &&
            !vacancy.responsibilities &&
            !vacancy.requirements &&
            !vacancy.conditions && (
              <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-gray-200 text-sm text-gray-400">
                Описание вакансии не заполнено
              </div>
            )}
        </div>
      </div>
    </BottomSheet>
  );
}
