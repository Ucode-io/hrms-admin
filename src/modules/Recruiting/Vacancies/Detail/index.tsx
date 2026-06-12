import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  Briefcase,
  CalendarDays,
  ChevronLeft,
  Columns3,
  Info,
  MapPin,
  Pencil,
  Plus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import PageMeta from "../../../../components/common/PageMeta";
import Button from "../../../../components/ui/button/Button";
import { useHeaderBreadcrumbItems } from "../../../../context/HeaderBreadcrumbContext";
import {
  mapVacancyRow,
  useUpdateVacancyStatus,
  useVacancyCandidateCounts,
  useVacancyQuery,
} from "../../../../api/services/vacancy.service";
import {
  mapCandidateRow,
  useCandidatesQuery,
  useMoveCandidateStage,
  useSetCandidateOutcome,
} from "../../../../api/services/candidate.service";
import { TagChip } from "../../components/Chips";
import RejectSheet from "../../components/RejectSheet";
import PipelineKanban from "./components/PipelineKanban";
import CandidatesTab from "./components/CandidatesTab";
import InfoTab from "./components/InfoTab";
import {
  VACANCY_PRIORITY_CONFIG,
  VACANCY_STATUS_CONFIG,
  VACANCY_STATUS_ORDER,
  daysOpenLabel,
  formatSalaryRange,
  type Candidate,
  type CandidateOutcome,
  type VacancyStatus,
} from "../../types";

type TabKey = "pipeline" | "candidates" | "info";

const TABS: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
  { key: "pipeline", label: "Воронка", icon: <Columns3 size={15} /> },
  { key: "candidates", label: "Кандидаты", icon: <Users size={15} /> },
  { key: "info", label: "Информация", icon: <Info size={15} /> },
];

export default function VacancyDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") as TabKey) || "pipeline";

  const { data: vacancyRow, isLoading } = useVacancyQuery(id);
  const { data: countsMap } = useVacancyCandidateCounts();
  const { data: candidatesData } = useCandidatesQuery(
    { limit: 500, offset: 0, vacancyId: id },
    Boolean(id)
  );

  const statusMutation = useUpdateVacancyStatus();
  const moveMutation = useMoveCandidateStage();
  const outcomeMutation = useSetCandidateOutcome();

  const [rejectingCandidate, setRejectingCandidate] = useState<Candidate | null>(null);

  const vacancy = useMemo(
    () => (vacancyRow ? mapVacancyRow(vacancyRow, id ? countsMap?.[id] : undefined) : null),
    [vacancyRow, countsMap, id]
  );

  const candidates = useMemo(
    () => (candidatesData?.response ?? []).map(mapCandidateRow),
    [candidatesData]
  );

  useHeaderBreadcrumbItems(
    useMemo(
      () => [
        { label: "Рекрутинг", to: "/recruiting/vacancies" },
        { label: "Вакансии", to: "/recruiting/vacancies" },
        { label: vacancy?.title ?? "Вакансия", to: "#" },
      ],
      [vacancy?.title]
    )
  );

  const setTab = (next: TabKey) => {
    setSearchParams(next === "pipeline" ? {} : { tab: next }, { replace: true });
  };

  const handleMove = async (candidate: Candidate, toStageId: string) => {
    try {
      await moveMutation.mutateAsync({ guid: candidate.id, toStageId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось переместить");
    }
  };

  const handleOutcome = async (candidate: Candidate, outcome: CandidateOutcome) => {
    if (outcome === "rejected") {
      setRejectingCandidate(candidate);
      return;
    }
    try {
      await outcomeMutation.mutateAsync({ guid: candidate.id, outcome });
      toast.success(
        outcome === "hired" ? `${candidate.fullName} — нанят 🎉` : `${candidate.fullName} — в резерве`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось обновить");
    }
  };

  const handleStatusChange = async (status: VacancyStatus) => {
    if (!id) return;
    try {
      await statusMutation.mutateAsync({ guid: id, status });
      toast.success(`Статус изменён: ${VACANCY_STATUS_CONFIG[status].label}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось изменить статус");
    }
  };

  if (isLoading || !vacancy) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  const status = VACANCY_STATUS_CONFIG[vacancy.status];
  const priority = VACANCY_PRIORITY_CONFIG[vacancy.priority];

  return (
    <>
      <PageMeta title={`${vacancy.title} | Рекрутинг`} description="Воронка вакансии" />

      {/* Back */}
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/recruiting/vacancies")}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex items-center gap-2 text-sm">
          <span
            className="cursor-pointer text-brand-600"
            onClick={() => navigate("/recruiting/vacancies")}
          >
            Вакансии
          </span>
          <span className="text-gray-300">/</span>
          <span className="font-medium text-gray-800">{vacancy.title}</span>
        </div>
      </div>

      {/* Header card */}
      <div className="rounded-2xl border border-gray-200 bg-white px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <Briefcase size={22} />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold text-gray-900">{vacancy.title}</h1>
                <TagChip tag={vacancy.tag} />
                <span
                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${priority.badgeClassName}`}
                >
                  {priority.label}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-gray-500">
                <span>{vacancy.departmentTitle}</span>
                {vacancy.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={13} />
                    {vacancy.location}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <CalendarDays size={13} />
                  открыта {daysOpenLabel(vacancy.openedAt)}
                </span>
                <span className="font-medium text-gray-700">
                  {formatSalaryRange(vacancy.salaryMin, vacancy.salaryMax, vacancy.salaryCurrency)}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-gray-500">
                {vacancy.recruiterName && <span>Рекрутер: {vacancy.recruiterName}</span>}
                {vacancy.hiringManagerName && <span>Менеджер: {vacancy.hiringManagerName}</span>}
                <span className="text-emerald-600">
                  {vacancy.hiredCount} из {vacancy.openings} нанято
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Status switcher */}
            <div className="relative">
              <select
                value={vacancy.status}
                onChange={(e) => handleStatusChange(e.target.value as VacancyStatus)}
                className={`h-10 cursor-pointer appearance-none rounded-xl border-0 py-0 pl-3 pr-8 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-100 ${status.badgeClassName}`}
              >
                {VACANCY_STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {VACANCY_STATUS_CONFIG[s].label}
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="outline"
              startIcon={<Pencil size={15} />}
              onClick={() => navigate(`/recruiting/vacancies/${vacancy.id}/edit`)}
              className="h-10 rounded-xl px-4"
            >
              Редактировать
            </Button>
            <Button
              startIcon={<Plus size={15} />}
              onClick={() => navigate(`/recruiting/candidates/new?vacancyId=${vacancy.id}`)}
              className="h-10 rounded-xl px-4"
            >
              Кандидат
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-5 flex items-center gap-1 border-b border-gray-100">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 border-b-2 px-3.5 pb-2.5 text-sm font-medium transition ${
                tab === t.key
                  ? "border-brand-500 text-brand-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.icon}
              {t.label}
              {t.key === "candidates" && (
                <span className="rounded-md bg-gray-100 px-1.5 text-[11px] font-semibold text-gray-500">
                  {candidates.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="mt-4 pb-10">
        {tab === "pipeline" && (
          <PipelineKanban
            vacancy={vacancy}
            candidates={candidates}
            onMove={handleMove}
            onOutcome={handleOutcome}
            onOpenCandidate={(c) => navigate(`/recruiting/candidates/${c.id}`)}
          />
        )}
        {tab === "candidates" && (
          <CandidatesTab
            vacancy={vacancy}
            candidates={candidates}
            onOpenCandidate={(c) => navigate(`/recruiting/candidates/${c.id}`)}
          />
        )}
        {tab === "info" && <InfoTab vacancy={vacancy} countsByStage={countsMap?.[vacancy.id]?.byStage} />}
      </div>

      <RejectSheet
        isOpen={Boolean(rejectingCandidate)}
        candidateName={rejectingCandidate?.fullName ?? ""}
        onClose={() => setRejectingCandidate(null)}
        isSubmitting={outcomeMutation.isLoading}
        onConfirm={async (reason) => {
          if (!rejectingCandidate) return;
          try {
            await outcomeMutation.mutateAsync({
              guid: rejectingCandidate.id,
              outcome: "rejected",
              rejectionReason: reason,
            });
            toast.success(`${rejectingCandidate.fullName} — отказ`);
            setRejectingCandidate(null);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Не удалось обновить");
          }
        }}
      />
    </>
  );
}
