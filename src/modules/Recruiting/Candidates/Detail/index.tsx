import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  Archive,
  ArrowRight,
  Briefcase,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  FileText,
  History,
  Link as LinkIcon,
  Mail,
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
  useAddCandidateDocument,
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
import { FILE_COMMENT_MARKER, type AttachedFile } from "../../components/CommentThread";
import StageProgressRail from "./components/StageProgressRail";
import StageEvaluationItem from "./components/StageEvaluationItem";
import HistoryTimeline from "./components/HistoryTimeline";
import DocumentsCard from "./components/DocumentsCard";
import {
  rejectionReasonLabel,
  sourceLabel,
  OUTCOME_CONFIG,
  formatDate,
  formatSalaryRange,
  sortStages,
  type StageDef,
} from "../../types";

export default function CandidateDetail() {
  const navigate = useNavigate();
  const { id } = useParams();

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
  const documentMutation = useAddCandidateDocument();

  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
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
  const currentStage = currentIndex >= 0 ? stages[currentIndex] : null;

  const evaluatedStages = stages.filter((s) =>
    candidate.evaluations.some((e) => e.stageId === s.id)
  );

  const enteredAt = (stage: StageDef): string | null =>
    [...candidate.history].reverse().find((h) => h.toStageId === stage.id)?.at ?? null;

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

  // Загруженный файл попадает и в блок «Документы», и в ленту комментариев этапа.
  const handleAttach = async (stageId: string, file: AttachedFile) => {
    try {
      await documentMutation.mutateAsync({
        guid: candidate.id,
        doc: { name: file.name, type: "other", url: file.dataUrl, size: file.size },
      });
      await commentMutation.mutateAsync({
        guid: candidate.id,
        stageId,
        text: FILE_COMMENT_MARKER + JSON.stringify({ name: file.name, size: file.size }),
      });
      toast.success("Файл добавлен");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось загрузить файл");
    }
  };

  const stageOptions = stages.map((s) => ({ value: s.id, label: s.name }));

  const contactRows = [
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
      value: sourceLabel(candidate.source),
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
        ? formatSalaryRange(candidate.salaryExpectation, null, candidate.salaryCurrency).replace(
            "от ",
            ""
          )
        : "—",
    },
  ];

  return (
    <>
      <PageMeta title={`${candidate.fullName} | Рекрутинг`} description="Профиль кандидата" />

      {/* Back + title bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50"
          >
            <ChevronLeft size={18} />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">{candidate.fullName}</h1>
          <LevelChip level={candidate.level} />
          <OutcomeBadge outcome={candidate.outcome} />
        </div>
        <Button
          variant="outline"
          startIcon={<Pencil size={15} />}
          onClick={() => navigate(`/recruiting/candidates/${candidate.id}/edit`)}
          className="h-9 rounded-xl px-4"
        >
          Изменить
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        {/* ───── Sidebar ───── */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex flex-col items-center text-center">
              <Avatar
                firstName={candidate.firstName}
                lastName={candidate.lastName}
                photo={candidate.photo}
                size={88}
              />
              <h2 className="mt-3 text-base font-semibold text-gray-900">{candidate.fullName}</h2>
              {vacancy && (
                <Link
                  to={`/recruiting/vacancies/${vacancy.id}`}
                  className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  <Briefcase size={13} />
                  {vacancy.title}
                </Link>
              )}
              <div className="mt-2.5 flex items-center gap-2">
                <ScoreBadge score={candidate.avgScore} size="md" />
                <span className="text-xs text-gray-400">средний балл</span>
              </div>
            </div>

            <dl className="mt-5 space-y-3.5 border-t border-gray-100 pt-5">
              {contactRows.map((row) => (
                <div key={row.label} className="flex items-start gap-3">
                  <span className="mt-0.5 shrink-0 text-gray-300">{row.icon}</span>
                  <div className="min-w-0">
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                      {row.label}
                    </dt>
                    <dd className="break-words text-sm text-gray-700">{row.value}</dd>
                  </div>
                </div>
              ))}
            </dl>

            {candidate.skills.length > 0 && (
              <div className="mt-5 border-t border-gray-100 pt-5">
                <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-400">
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

            {(candidate.links.length > 0 || candidate.resumeUrl) && (
              <div className="mt-5 border-t border-gray-100 pt-5">
                <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                  Ссылки
                </div>
                <ul className="space-y-1.5">
                  {candidate.resumeUrl && (
                    <li>
                      <a
                        href={candidate.resumeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
                      >
                        <FileText size={13} className="shrink-0" />
                        Открыть резюме
                      </a>
                    </li>
                  )}
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

            {candidate.notes && (
              <div className="mt-5 border-t border-gray-100 pt-5">
                <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                  Заметки
                </div>
                <p className="whitespace-pre-wrap text-sm text-gray-600">{candidate.notes}</p>
              </div>
            )}
          </div>

          <DocumentsCard candidate={candidate} />
        </aside>

        {/* ───── Main ───── */}
        <div className="space-y-4">
          {/* Воронка подбора */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[15px] font-semibold text-gray-900">Воронка подбора</h3>
              {isActive ? (
                currentStage && (
                  <span className="text-sm text-gray-500">
                    Текущий этап: <span className="font-medium text-gray-800">{currentStage.name}</span>
                  </span>
                )
              ) : (
                <span className="text-sm text-gray-500">
                  {OUTCOME_CONFIG[candidate.outcome].label}
                  {candidate.outcome === "rejected" && candidate.rejectionReason && (
                    <> · {rejectionReasonLabel(candidate.rejectionReason)}</>
                  )}
                  {candidate.outcome === "hired" && candidate.hiredAt && (
                    <> · {formatDate(candidate.hiredAt)}</>
                  )}
                </span>
              )}
            </div>

            {stages.length > 0 && (
              <div className="mt-4">
                <StageProgressRail
                  stages={stages}
                  candidate={candidate}
                  onStageClick={(stage) => {
                    if (candidate.evaluations.some((e) => e.stageId === stage.id)) {
                      setExpandedStages((prev) => new Set(prev).add(stage.id));
                      document
                        .getElementById(`stage-${stage.id}`)
                        ?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                  }}
                />
              </div>
            )}

            {/* Controls */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
              {isActive ? (
                <div className="flex flex-wrap items-center gap-2">
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

              {isActive && (
                <div className="flex flex-wrap items-center gap-2">
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
                </div>
              )}
            </div>
          </div>

          {/* Оценка по этапам */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <h3 className="mb-4 text-[15px] font-semibold text-gray-900">
              Оценка по этапам
              {stages.length > 0 && (
                <span className="ml-1.5 font-normal text-gray-400">
                  · {evaluatedStages.length} из {stages.length}
                </span>
              )}
            </h3>
            {evaluatedStages.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 px-5 py-12 text-center text-sm text-gray-400">
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
                      documents={candidate.documents}
                      isCurrent={isActive && stage.id === candidate.currentStageId}
                      isExpanded={expandedStages.has(stage.id)}
                      onToggle={() => toggleStage(stage.id)}
                      onScore={(score) => handleScore(stage.id, score)}
                      onAddComment={(text) => handleComment(stage.id, text)}
                      onAttachFile={(file) => handleAttach(stage.id, file)}
                      isScoring={scoreMutation.isLoading}
                      isCommenting={commentMutation.isLoading || documentMutation.isLoading}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* История */}
          <div className="rounded-2xl border border-gray-200 bg-white">
            <button
              type="button"
              onClick={() => setIsHistoryOpen((v) => !v)}
              className="flex w-full items-center justify-between px-5 py-4 text-left"
            >
              <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-gray-900">
                <History size={16} className="text-gray-400" />
                История
                {candidate.history.length > 0 && (
                  <span className="font-normal text-gray-400">· {candidate.history.length}</span>
                )}
              </span>
              <ChevronDown
                size={18}
                className={`text-gray-400 transition-transform ${isHistoryOpen ? "rotate-180" : ""}`}
              />
            </button>
            {isHistoryOpen && (
              <div className="border-t border-gray-100 px-5 py-4">
                <HistoryTimeline candidate={candidate} stages={stages} />
              </div>
            )}
          </div>
        </div>
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
