import { useEffect, useState } from "react";
import {
  ArrowRight,
  Briefcase,
  CalendarClock,
  Cake,
  FileText,
  Link2,
  Mail,
  Pencil,
  Phone,
  Trash2,
  User,
  Wallet,
} from "lucide-react";
import BottomSheet from "../../components/BottomSheet";
import Avatar from "../../components/Avatar";
import { LevelChip, RatingStars, TagChip } from "../../components/Chips";
import {
  CANDIDATE_SOURCE_CONFIG,
  CANDIDATE_STAGE_CONFIG,
  CANDIDATE_STAGE_ORDER,
  GENDER_CONFIG,
  formatDate,
  type Candidate,
  type CandidateStage,
} from "../../types";

interface CandidateDetailDrawerProps {
  isOpen: boolean;
  candidate: Candidate | null;
  onClose: () => void;
  onEdit: (candidate: Candidate) => void;
  onDelete: (candidate: Candidate) => void;
  onMoveStage: (candidate: Candidate, stage: CandidateStage) => void;
}

type Tab = "main" | "history" | "notes";

const ADVANCE_PATH: CandidateStage[] = [
  "new",
  "resume_reviewed",
  "screening_call",
  "interview",
  "test_task",
  "tech_interview",
  "offer_sent",
  "offer_considering",
  "offer_accepted",
  "hired",
];

const InfoRow = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) => (
  <div className="flex items-start justify-between gap-3 py-2.5">
    <span className="inline-flex shrink-0 items-center gap-2 text-sm text-gray-500">
      <Icon size={15} className="text-gray-400" />
      {label}
    </span>
    <span className="text-right text-sm font-medium text-gray-800">{value || "—"}</span>
  </div>
);

export default function CandidateDetailDrawer({
  isOpen,
  candidate,
  onClose,
  onEdit,
  onDelete,
  onMoveStage,
}: CandidateDetailDrawerProps) {
  const [tab, setTab] = useState<Tab>("main");

  useEffect(() => {
    if (isOpen) setTab("main");
  }, [isOpen, candidate?.id]);

  if (!candidate) return null;

  const advanceIdx = ADVANCE_PATH.indexOf(candidate.stage);
  const nextStage = advanceIdx >= 0 && advanceIdx < ADVANCE_PATH.length - 1 ? ADVANCE_PATH[advanceIdx + 1] : null;

  const tabs: { key: Tab; label: string }[] = [
    { key: "main", label: "Главная" },
    { key: "history", label: `История (${candidate.stageHistory.length})` },
    { key: "notes", label: "Заметки" },
  ];

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      leading={<Avatar firstName={candidate.firstName} lastName={candidate.lastName} photo={candidate.photo} size={48} />}
      title={
        <span className="flex items-center gap-2">
          {candidate.fullName}
          {candidate.tag && <TagChip tag={candidate.tag} />}
          {candidate.level && <LevelChip level={candidate.level} />}
        </span>
      }
      subtitle={`${candidate.positionTitle} · Добавлен ${formatDate(candidate.createdAt)} из ${
        CANDIDATE_SOURCE_CONFIG[candidate.source].label
      }`}
      headerActions={
        <>
          {nextStage && (
            <button
              type="button"
              onClick={() => onMoveStage(candidate, nextStage)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 text-sm font-medium text-white transition hover:bg-brand-600"
            >
              Продвинуть <ArrowRight size={15} />
            </button>
          )}
          <button
            type="button"
            onClick={() => onEdit(candidate)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-gray-200 px-3.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
          >
            <Pencil size={15} /> Изменить
          </button>
          <button
            type="button"
            onClick={() => onDelete(candidate)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-400 transition hover:bg-rose-50 hover:text-rose-600"
          >
            <Trash2 size={15} />
          </button>
        </>
      }
    >
      {/* Stage stepper */}
      <div className="mb-5 rounded-2xl border border-gray-200 bg-white p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Этап воронки</p>
        <div className="flex flex-wrap gap-2">
          {CANDIDATE_STAGE_ORDER.map((s) => {
            const cfg = CANDIDATE_STAGE_CONFIG[s];
            const active = s === candidate.stage;
            return (
              <button
                key={s}
                type="button"
                onClick={() => !active && onMoveStage(candidate, s)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                  active ? cfg.badgeClassName : "border border-gray-200 text-gray-400 hover:bg-gray-50"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotClassName}`} />
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex items-center gap-1 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === t.key
                ? "border-brand-500 text-brand-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "main" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[380px_1fr]">
          {/* Info */}
          <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white px-4">
            <InfoRow icon={Briefcase} label="Вакансия" value={candidate.vacancyTitle || candidate.positionTitle} />
            <InfoRow icon={Mail} label="Эл. почта" value={candidate.email} />
            <InfoRow icon={Phone} label="Телефон" value={candidate.phone} />
            <InfoRow icon={Cake} label="Дата рождения" value={formatDate(candidate.dateOfBirth)} />
            <InfoRow
              icon={User}
              label="Пол"
              value={candidate.gender ? GENDER_CONFIG[candidate.gender].label : "—"}
            />
            <InfoRow icon={CalendarClock} label="Источник" value={CANDIDATE_SOURCE_CONFIG[candidate.source].label} />
            <InfoRow icon={CalendarClock} label="Дата отклика" value={formatDate(candidate.appliedDate)} />
            <InfoRow
              icon={Wallet}
              label="Ожидания по ЗП"
              value={
                candidate.salaryExpectation
                  ? `${candidate.salaryExpectation.toLocaleString("ru-RU")} ${candidate.salaryCurrency}`
                  : "—"
              }
            />
            <InfoRow icon={User} label="Рекрутер" value={candidate.recruiterName} />
          </div>

          {/* Right */}
          <div className="space-y-5">
            <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3">
              <span className="text-sm font-medium text-gray-700">Оценка кандидата</span>
              <RatingStars value={candidate.rating} size={18} />
            </div>

            {candidate.skills.length > 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <p className="mb-2 text-sm font-semibold text-gray-800">Навыки</p>
                <div className="flex flex-wrap gap-1.5">
                  {candidate.skills.map((s) => (
                    <span key={s} className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {candidate.links.length > 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <p className="mb-2 text-sm font-semibold text-gray-800">Ссылки</p>
                <div className="space-y-1.5">
                  {candidate.links.map((l) => (
                    <a
                      key={l}
                      href={l}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 truncate text-sm text-brand-600 hover:underline"
                    >
                      <Link2 size={14} className="shrink-0" />
                      <span className="truncate">{l}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {candidate.coverLetter && (
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <p className="mb-1.5 text-sm font-semibold text-gray-800">Сопроводительное письмо</p>
                <p className="whitespace-pre-line text-sm text-gray-600">{candidate.coverLetter}</p>
              </div>
            )}

            {candidate.resumeUrl && (
              <a
                href={candidate.resumeUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition hover:border-brand-200 hover:bg-brand-50/40"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-500">
                  <FileText size={18} />
                </span>
                Резюме кандидата
                <span className="ml-auto text-xs text-brand-600">Открыть →</span>
              </a>
            )}
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          {candidate.stageHistory.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-400">История пуста</div>
          ) : (
            <ul>
              {candidate.stageHistory.map((entry, i) => {
                const toCfg = CANDIDATE_STAGE_CONFIG[entry.toStage];
                const fromCfg = entry.fromStage ? CANDIDATE_STAGE_CONFIG[entry.fromStage] : null;
                const isLast = i === candidate.stageHistory.length - 1;
                return (
                  <li key={entry.id} className="relative flex gap-3 pb-5">
                    {!isLast && <span className="absolute left-[7px] top-4 h-full w-px bg-gray-200" />}
                    <span className={`mt-1 h-3.5 w-3.5 shrink-0 rounded-full ring-4 ring-white ${toCfg.dotClassName}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-700">
                        {fromCfg ? (
                          <>
                            <span className="text-gray-400">{fromCfg.label}</span>
                            <ArrowRight size={13} className="text-gray-300" />
                            <span className="font-medium">{toCfg.label}</span>
                          </>
                        ) : (
                          <span className="font-medium">{toCfg.label}</span>
                        )}
                      </div>
                      {entry.comment && <p className="mt-0.5 text-sm text-gray-500">{entry.comment}</p>}
                      <div className="mt-0.5 text-xs text-gray-400">
                        {formatDate(entry.at)}
                        {entry.byName ? ` · ${entry.byName}` : ""}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {tab === "notes" && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          {candidate.notes ? (
            <p className="whitespace-pre-line text-sm text-gray-600">{candidate.notes}</p>
          ) : (
            <div className="py-10 text-center text-sm text-gray-400">Заметок пока нет</div>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
