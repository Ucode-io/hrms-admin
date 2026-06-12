import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import {
  Archive,
  ArrowRight,
  Briefcase,
  CalendarDays,
  ChevronLeft,
  ClipboardList,
  FileText,
  History,
  Link as LinkIcon,
  Mail,
  Paperclip,
  Pencil,
  Phone,
  RotateCcw,
  ThumbsDown,
  Trophy,
  UserRound,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import PageMeta from "../../../../components/common/PageMeta";
import Button from "../../../../components/ui/button/Button";
import { useHeaderBreadcrumbItems } from "../../../../context/HeaderBreadcrumbContext";
import {
  mapCandidateRow,
  useAddStageComment,
  useCandidateQuery,
  useEvaluateCandidateStage,
  useMoveCandidateStage,
  useSetCandidateOutcome,
} from "../../../../api/services/candidate.service";
import { mapVacancyRow, useVacancyQuery } from "../../../../api/services/vacancy.service";
import Avatar from "../../components/Avatar";
import { LevelChip, ScoreBadge } from "../../components/Chips";
import OutcomeBadge from "../../components/OutcomeBadge";
import FormSelect from "../../components/FormSelect";
import RejectSheet from "../../components/RejectSheet";
import StageProgressRail from "./components/StageProgressRail";
import StageEvaluationItem from "./components/StageEvaluationItem";
import HistoryTimeline from "./components/HistoryTimeline";
import DocumentsCard from "./components/DocumentsCard";
import {
  CANDIDATE_REJECTION_REASON_CONFIG,
  CANDIDATE_SOURCE_CONFIG,
  OUTCOME_CONFIG,
  formatDate,
  formatSalaryRange,
  sortStages,
  type StageDef,
} from "../../types";

type TabKey = "evaluation" | "profile" | "documents" | "history";

export default function CandidateDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") as TabKey) || "evaluation";

  const { data: candidateRow, isLoading } = useCandidateQuery(id);
  const candidate = useMemo(
    () => (candidateRow ? mapCandidateRow(candidateRow) : null),
    [candidateRow]
  );

  const { data: vacancyRow } = useVacancyQuery(candidate?.vacancyId || undefined);
  const vacancy = useMemo(() => (vacancyRow ? mapVacancyRow(vacancyRow) : null), [vacancyRow]);
  const stages = useMemo(() => sortStages(vacancy?.stages ?? []), [vacancy]);

  const moveMutation = useMoveCandidateStage();
  const outcomeMutation = useSetCandidateOutcome();
  const scoreMutation = useEvaluateCandidateStage();
  const commentMutation = useAddStageComment();

  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());

  // Текущий этап раскрыт по умолчанию.
  useEffect(() => {
    if (candidate?.currentStageId) setExpandedStages(new Set([candidate.currentStageId]));
  }, [candidate?.currentStageId]);

  useHeaderBreadcrumbItems(
    useMemo(
      () => [
        { label: "Рекрутинг", to: "/recruiting/vacancies" },
        { label: "Кандидаты", to: "/recruiting/candidates" },
        { label: candidate?.fullName ?? "Кандидат", to: "#" },
      ],
      [candidate?.fullName]
    )
  );

  if (isLoading || !candidate) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  const isActive = candidate.outcome === "active";
  const currentIndex = stages.findIndex((s) => s.id === candidate.currentStageId);
  const nextStage = currentIndex >= 0 ? stages[currentIndex + 1] ?? null : null;

  const evaluatedStages = stages.filter((s) =>
    candidate.evaluations.some((e) => e.stageId === s.id)
  );

  const enteredAt = (stage: StageDef): string | null =>
    [...candidate.history].reverse().find((h) => h.toStageId === stage.id)?.at ?? null;

  const setTab = (next: TabKey) =>
    setSearchParams(next === "evaluation" ? {} : { tab: next }, { replace: true });

  const toggleStage = (stageId: string) =>
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });

  const handleMove = async (toStageId: string) => {
    try {
      await moveMutation.mutateAsync({ guid: candidate.id, toStageId });
      const name = stages.find((s) => s.id === toStageId)?.name ?? "";
      toast.success(`Кандидат перемещён${name ? `: ${name}` : ""}`);
      setExpandedStages(new Set([toStageId]));
      setTab("evaluation");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось переместить");
    }
  };

  const handleOutcome = async (outcome: "hired" | "reserve") => {
    try {
      await outcomeMutation.mutateAsync({ guid: candidate.id, outcome });
      toast.success(outcome === "hired" ? `${candidate.fullName} — нанят 🎉` : "Кандидат в резерве");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось обновить");
    }
  };

  const handleReturn = async () => {
    const lastStage = [...candidate.history].reverse().find((h) => h.toStageId)?.toStageId;
    const target =
      (lastStage && stages.some((s) => s.id === lastStage) ? lastStage : stages[0]?.id) ?? null;
    if (!target) {
      toast.error("У вакансии нет этапов");
      return;
    }
    await handleMove(target);
  };

  const handleScore = async (stageId: string, score: number | null) => {
    try {
      await scoreMutation.mutateAsync({ guid: candidate.id, stageId, score });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить оценку");
    }
  };

  const handleComment = async (stageId: string, text: string) => {
    try {
      await commentMutation.mutateAsync({ guid: candidate.id, stageId, text });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось добавить комментарий");
    }
  };

  const stageOptions = stages.map((s) => ({ value: s.id, label: s.name }));

  const tabs: Array<{ key: TabKey; label: string; icon: React.ReactNode; count?: number }> = [
    { key: "evaluation", label: "Оценка этапов", icon: <ClipboardList size={15} /> },
    { key: "profile", label: "Профиль", icon: <UserRound size={15} /> },
    { key: "documents", label: "Документы", icon: <Paperclip size={15} />, count: candidate.documents.length },
    { key: "history", label: "История", icon: <History size={15} />, count: candidate.history.length },
  ];

  return (
    <>
      <PageMeta title={`${candidate.fullName} | Рекрутинг`} description="Профиль кандидата" />

      {/* Back */}
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex items-center gap-2 text-sm">
          <span
            className="cursor-pointer text-brand-600"
            onClick={() => navigate("/recruiting/candidates")}
          >
            Кандидаты
          </span>
          <span className="text-gray-300">/</span>
          <span className="font-medium text-gray-800">{candidate.fullName}</span>
        </div>
      </div>

      {/* ───── Header card: identity + funnel + actions + tabs ───── */}
      <div className="rounded-2xl border border-gray-200 bg-white">
        {/* Identity row */}
        <div className="flex flex-wrap items-center gap-4 px-6 pt-5">
          <Avatar
            firstName={candidate.firstName}
            lastName={candidate.lastName}
            photo={candidate.photo}
            size={52}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold text-gray-900">{candidate.fullName}</h1>
              <LevelChip level={candidate.level} />
              <OutcomeBadge outcome={candidate.outcome} />
              <ScoreBadge score={candidate.avgScore} size="md" />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[13px] text-gray-500">
              {vacancy && (
                <Link
                  to={`/recruiting/vacancies/${vacancy.id}`}
                  className="inline-flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700"
                >
                  <Briefcase size={13} />
                  {vacancy.title}
                </Link>
              )}
              <span>{CANDIDATE_SOURCE_CONFIG[candidate.source].label}</span>
              <span>отклик {formatDate(candidate.appliedDate)}</span>
            </div>
          </div>

          {/* Primary actions */}
          <div className="flex flex-wrap items-center gap-2">
            {isActive ? (
              <>
                <button
                  type="button"
                  onClick={() => handleOutcome("hired")}
                  disabled={outcomeMutation.isLoading}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 text-sm font-medium text-emerald-700 transition hover:border-emerald-300 disabled:opacity-50"
                >
                  <Trophy size={14} />
                  Нанять
                </button>
                <button
                  type="button"
                  onClick={() => setIsRejectOpen(true)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 text-sm font-medium text-rose-600 transition hover:border-rose-300"
                >
                  <ThumbsDown size={14} />
                  Отказ
                </button>
                <button
                  type="button"
                  onClick={() => handleOutcome("reserve")}
                  disabled={outcomeMutation.isLoading}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  <Archive size={14} />
                  Резерв
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleReturn}
                disabled={moveMutation.isLoading}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-3.5 text-sm font-medium text-brand-600 transition hover:border-brand-300 disabled:opacity-50"
              >
                <RotateCcw size={14} />
                Вернуть в воронку
              </button>
            )}
            <Button
              variant="outline"
              startIcon={<Pencil size={15} />}
              onClick={() => navigate(`/recruiting/candidates/${candidate.id}/edit`)}
              className="h-9 rounded-xl px-4"
            >
              Изменить
            </Button>
          </div>
        </div>

        {/* Funnel rail + move controls */}
        {stages.length > 0 && (
          <div className="mt-4 border-t border-gray-100 px-6 py-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="min-w-0 flex-1">
                <StageProgressRail
                  stages={stages}
                  candidate={candidate}
                  onStageClick={(stage) => {
                    if (candidate.evaluations.some((e) => e.stageId === stage.id)) {
                      setTab("evaluation");
                      setExpandedStages((prev) => new Set(prev).add(stage.id));
                    }
                  }}
                />
              </div>
              {isActive && (
                <div className="flex shrink-0 items-center gap-2">
                  <div className="w-44">
                    <FormSelect
                      options={stageOptions}
                      value={candidate.currentStageId}
                      onChange={(v) => v && v !== candidate.currentStageId && handleMove(v)}
                      isSearchable={false}
                      menuPortal
                    />
                  </div>
                  {nextStage && (
                    <button
                      type="button"
                      onClick={() => handleMove(nextStage.id)}
                      disabled={moveMutation.isLoading}
                      title={`Следующий этап: ${nextStage.name}`}
                      className="inline-flex h-[44px] items-center gap-1.5 rounded-xl bg-brand-500 px-4 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
                    >
                      {nextStage.name}
                      <ArrowRight size={14} />
                    </button>
                  )}
                </div>
              )}
              {!isActive && (
                <span className="shrink-0 text-sm text-gray-500">
                  {OUTCOME_CONFIG[candidate.outcome].label}
                  {candidate.outcome === "rejected" && candidate.rejectionReason && (
                    <> · {CANDIDATE_REJECTION_REASON_CONFIG[candidate.rejectionReason].label}</>
                  )}
                  {candidate.outcome === "hired" && candidate.hiredAt && (
                    <> · {formatDate(candidate.hiredAt)}</>
                  )}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 border-t border-gray-100 px-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 border-b-2 px-3.5 py-3 text-sm font-medium transition ${
                tab === t.key
                  ? "border-brand-500 text-brand-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.icon}
              {t.label}
              {typeof t.count === "number" && t.count > 0 && (
                <span className="rounded-md bg-gray-100 px-1.5 text-[11px] font-semibold text-gray-500">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ───── Tab content ───── */}
      <div className="mt-4 pb-10">
        {tab === "evaluation" && (
          <div className="mx-auto max-w-[860px]">
            {evaluatedStages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-5 py-14 text-center text-sm text-gray-400">
                Кандидат ещё не проходил этапы
              </div>
            ) : (
              <div className="space-y-2.5">
                {evaluatedStages.map((stage) => {
                  const evaluation = candidate.evaluations.find((e) => e.stageId === stage.id)!;
                  return (
                    <StageEvaluationItem
                      key={stage.id}
                      stage={stage}
                      evaluation={evaluation}
                      enteredAt={enteredAt(stage)}
                      isCurrent={isActive && stage.id === candidate.currentStageId}
                      isExpanded={expandedStages.has(stage.id)}
                      onToggle={() => toggleStage(stage.id)}
                      onScore={(score) => handleScore(stage.id, score)}
                      onAddComment={(text) => handleComment(stage.id, text)}
                      isScoring={scoreMutation.isLoading}
                      isCommenting={commentMutation.isLoading}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "profile" && (
          <div className="mx-auto max-w-[860px] space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white">
              <div className="border-b border-gray-100 px-6 py-4 text-[15px] font-semibold text-gray-900">
                Контакты и детали
              </div>
              <dl className="grid grid-cols-1 gap-x-8 gap-y-4 px-6 py-5 sm:grid-cols-2">
                {[
                  {
                    icon: <Mail size={15} />,
                    label: "Email",
                    value: candidate.email ? (
                      <a href={`mailto:${candidate.email}`} className="hover:text-brand-600">
                        {candidate.email}
                      </a>
                    ) : (
                      "—"
                    ),
                  },
                  {
                    icon: <Phone size={15} />,
                    label: "Телефон",
                    value: candidate.phone ? (
                      <a href={`tel:${candidate.phone}`} className="hover:text-brand-600">
                        {candidate.phone}
                      </a>
                    ) : (
                      "—"
                    ),
                  },
                  {
                    icon: <UserRound size={15} />,
                    label: "Источник",
                    value: CANDIDATE_SOURCE_CONFIG[candidate.source].label,
                  },
                  {
                    icon: <CalendarDays size={15} />,
                    label: "Дата отклика",
                    value: formatDate(candidate.appliedDate),
                  },
                  {
                    icon: <Wallet size={15} />,
                    label: "Ожидания по ЗП",
                    value: candidate.salaryExpectation
                      ? formatSalaryRange(
                          candidate.salaryExpectation,
                          null,
                          candidate.salaryCurrency
                        ).replace("от ", "")
                      : "—",
                  },
                  {
                    icon: <UserRound size={15} />,
                    label: "Рекрутер",
                    value: candidate.recruiterName ?? "—",
                  },
                ].map((row) => (
                  <div key={row.label} className="flex items-start gap-3">
                    <span className="mt-0.5 shrink-0 text-gray-300">{row.icon}</span>
                    <div className="min-w-0">
                      <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                        {row.label}
                      </dt>
                      <dd className="truncate text-sm text-gray-700">{row.value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </div>

            {(candidate.skills.length > 0 ||
              candidate.links.length > 0 ||
              candidate.resumeUrl ||
              candidate.notes) && (
              <div className="rounded-2xl border border-gray-200 bg-white">
                <div className="border-b border-gray-100 px-6 py-4 text-[15px] font-semibold text-gray-900">
                  О кандидате
                </div>
                <div className="space-y-5 px-6 py-5">
                  {candidate.skills.length > 0 && (
                    <div>
                      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                        Навыки
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {candidate.skills.map((skill) => (
                          <span
                            key={skill}
                            className="rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-600"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {candidate.links.length > 0 && (
                    <div>
                      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                        Ссылки
                      </div>
                      <ul className="space-y-1">
                        {candidate.links.map((link) => (
                          <li key={link}>
                            <a
                              href={link}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex max-w-full items-center gap-1.5 truncate text-sm text-brand-600 hover:text-brand-700"
                            >
                              <LinkIcon size={13} className="shrink-0" />
                              <span className="truncate">{link.replace(/^https?:\/\//, "")}</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {candidate.resumeUrl && (
                    <a
                      href={candidate.resumeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
                    >
                      <FileText size={14} />
                      Открыть резюме
                    </a>
                  )}
                  {candidate.notes && (
                    <div>
                      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                        Заметки
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-gray-600">{candidate.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "documents" && (
          <div className="mx-auto max-w-[860px]">
            <DocumentsCard candidate={candidate} />
          </div>
        )}

        {tab === "history" && (
          <div className="mx-auto max-w-[860px]">
            <div className="rounded-2xl border border-gray-200 bg-white px-6 py-5">
              <HistoryTimeline candidate={candidate} stages={stages} />
            </div>
          </div>
        )}
      </div>

      <RejectSheet
        isOpen={isRejectOpen}
        candidateName={candidate.fullName}
        onClose={() => setIsRejectOpen(false)}
        isSubmitting={outcomeMutation.isLoading}
        onConfirm={async (reason) => {
          try {
            await outcomeMutation.mutateAsync({
              guid: candidate.id,
              outcome: "rejected",
              rejectionReason: reason,
            });
            toast.success(`${candidate.fullName} — отказ`);
            setIsRejectOpen(false);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Не удалось обновить");
          }
        }}
      />
    </>
  );
}
