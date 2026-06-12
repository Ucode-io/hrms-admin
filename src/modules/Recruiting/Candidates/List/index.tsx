import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Archive, Plus, SlidersHorizontal, ThumbsDown, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import PageMeta from "../../../../components/common/PageMeta";
import Button from "../../../../components/ui/button/Button";
import ExpandableSearchInput from "../../../../components/form/ExpandableSearchInput";
import { Modal } from "../../../../components/ui/modal";
import { useHeaderBreadcrumbItems } from "../../../../context/HeaderBreadcrumbContext";
import companyStore from "../../../../store/company.store";
import EmployeesPaginationFooter from "../../../Employees/List/components/EmployeesPaginationFooter";
import {
  mapCandidateRow,
  useCandidatesQuery,
  useDeleteCandidate,
} from "../../../../api/services/candidate.service";
import { mapVacancyRow, useVacanciesQuery } from "../../../../api/services/vacancy.service";
import { mapStageDefs } from "../../../../api/services/stageTemplate.service";
import CandidateTable from "../components/CandidateTable";
import {
  CANDIDATE_SOURCE_CONFIG,
  CANDIDATE_SOURCE_ORDER,
  OUTCOME_CONFIG,
  OUTCOME_ORDER,
  type Candidate,
  type CandidateOutcome,
  type CandidateSource,
  type StageDef,
} from "../../types";

type PaginationItem = number | string;

const PAGE_SIZE = 12;
const BREADCRUMBS = [
  { label: "Рекрутинг", to: "/recruiting/vacancies" },
  { label: "Кандидаты", to: "/recruiting/candidates" },
];

const buildPaginationItems = (currentPage: number, totalPages: number): PaginationItem[] => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  if (currentPage <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (currentPage >= totalPages - 2)
    [totalPages - 1, totalPages - 2, totalPages - 3].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const result: PaginationItem[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const page = sorted[i],
      prev = sorted[i - 1];
    if (prev && page - prev > 1) result.push(`ellipsis-${prev}-${page}`);
    result.push(page);
  }
  return result;
};

const selectCls =
  "h-10 rounded-xl border border-gray-200 bg-white px-3 pr-8 text-sm text-gray-700 transition focus:border-brand-400 focus:outline-none appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2220%22 height=%2220%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2394a3b8%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><polyline points=%226 9 12 15 18 9%22/></svg>')] bg-[right_0.5rem_center] bg-no-repeat";

function CandidatesList() {
  useHeaderBreadcrumbItems(BREADCRUMBS);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const brandColor = companyStore.mainColor || "#2563eb";

  const [searchQuery, setSearchQuery] = useState("");
  const [vacancyFilter, setVacancyFilter] = useState(searchParams.get("vacancy") ?? "");
  const [outcomeFilter, setOutcomeFilter] = useState<CandidateOutcome | "">("");
  const [sourceFilter, setSourceFilter] = useState<CandidateSource | "">("");
  const [isFiltersOpen, setIsFiltersOpen] = useState(Boolean(searchParams.get("vacancy")));
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingItem, setDeletingItem] = useState<Candidate | null>(null);

  const queryParams = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset: (currentPage - 1) * PAGE_SIZE,
      ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
      ...(vacancyFilter ? { vacancyId: vacancyFilter } : {}),
      ...(outcomeFilter ? { outcome: outcomeFilter } : {}),
      ...(sourceFilter ? { source: sourceFilter } : {}),
    }),
    [currentPage, searchQuery, vacancyFilter, outcomeFilter, sourceFilter]
  );

  const { data: candidatesData, isLoading } = useCandidatesQuery(queryParams);
  const { data: vacanciesData } = useVacanciesQuery({ limit: 200, offset: 0 });
  const deleteMutation = useDeleteCandidate();

  const candidates = useMemo(
    () => (candidatesData?.response ?? []).map(mapCandidateRow),
    [candidatesData]
  );

  const vacancies = useMemo(
    () => (vacanciesData?.response ?? []).map((row) => mapVacancyRow(row)),
    [vacanciesData]
  );

  // vacancyId → stages, to render the candidate's current stage pill.
  const stagesByVacancy = useMemo(() => {
    const map = new Map<string, StageDef[]>();
    for (const row of vacanciesData?.response ?? []) {
      map.set(row.guid, mapStageDefs(row.stages));
    }
    return map;
  }, [vacanciesData]);

  const resolveStage = (candidate: Candidate): StageDef | undefined =>
    stagesByVacancy.get(candidate.vacancyId)?.find((s) => s.id === candidate.currentStageId);

  const totalCount = candidatesData?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginationItems = useMemo(
    () => buildPaginationItems(safePage, totalPages),
    [safePage, totalPages]
  );

  const visibleRangeLabel = useMemo(() => {
    if (totalCount === 0) return isLoading ? "Загрузка..." : "Нет кандидатов";
    const start = (safePage - 1) * PAGE_SIZE + 1;
    const end = Math.min(safePage * PAGE_SIZE, totalCount);
    return `Отображение ${start}–${end} из ${totalCount}`;
  }, [safePage, totalCount, isLoading]);

  const summary = useMemo(() => {
    const active = candidates.filter((c) => c.outcome === "active").length;
    const hired = candidates.filter((c) => c.outcome === "hired").length;
    const rejected = candidates.filter((c) => c.outcome === "rejected").length;
    return { total: totalCount, active, hired, rejected };
  }, [candidates, totalCount]);

  const hasActiveFilters = Boolean(searchQuery || vacancyFilter || outcomeFilter || sourceFilter);
  const activeFiltersCount =
    (vacancyFilter ? 1 : 0) + (outcomeFilter ? 1 : 0) + (sourceFilter ? 1 : 0);

  const resetFilters = () => {
    setSearchQuery("");
    setVacancyFilter("");
    setOutcomeFilter("");
    setSourceFilter("");
    setCurrentPage(1);
  };

  const confirmDelete = async () => {
    if (!deletingItem) return;
    try {
      await deleteMutation.mutateAsync(deletingItem.id);
      setDeletingItem(null);
      toast.success("Кандидат удалён");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось удалить");
    }
  };

  const summaryCards = [
    { label: "Всего кандидатов", value: String(summary.total), icon: Users, tint: "text-brand-600 bg-brand-50" },
    { label: "В работе", value: String(summary.active), icon: SlidersHorizontal, tint: "text-blue-600 bg-blue-50" },
    { label: "Нанято", value: String(summary.hired), icon: Trophy, tint: "text-emerald-600 bg-emerald-50" },
    { label: "Отказов", value: String(summary.rejected), icon: ThumbsDown, tint: "text-rose-600 bg-rose-50" },
  ];

  return (
    <>
      <PageMeta title="Кандидаты | Рекрутинг" description="Все кандидаты по вакансиям" />

      {/* Toolbar */}
      <div className="-mx-3 md:-mx-4 -mt-3 md:-mt-4">
        <div
          className="px-4 lg:px-6 py-2.5"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            flexWrap: "wrap",
            backgroundColor: "#fff",
            border: "1px solid #e2e8f0",
            borderTop: "none",
            borderBottom: isFiltersOpen ? "none" : "1px solid #e2e8f0",
          }}
        >
          <span className="text-sm font-medium text-gray-600">
            <Archive size={15} className="mr-1.5 inline -translate-y-px text-gray-400" />
            Все кандидаты компании
          </span>
          <div className="ml-auto flex items-center gap-2">
            <ExpandableSearchInput
              value={searchQuery}
              onChange={(v) => {
                setSearchQuery(v);
                setCurrentPage(1);
              }}
              inputId="candidate-search"
              placeholder="Поиск по имени, email..."
              expandedWidth={360}
              collapsedSize={40}
              brandColor={brandColor}
            />
            <button
              type="button"
              onClick={() => setIsFiltersOpen((o) => !o)}
              className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition ${
                isFiltersOpen || activeFiltersCount > 0
                  ? "border-brand-200 bg-brand-50 text-brand-600"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              <SlidersHorizontal size={16} />
              Фильтр{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ""}
            </button>
            <Button
              startIcon={<Plus size={16} />}
              onClick={() => navigate("/recruiting/candidates/new")}
              className="h-10 rounded-xl px-4"
            >
              Добавить
            </Button>
          </div>
        </div>

        {isFiltersOpen && (
          <div
            className="px-4 lg:px-6 py-3"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
              background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
              border: "1px solid #e2e8f0",
              borderTop: "1px solid #dbe4ee",
            }}
          >
            <select
              value={vacancyFilter}
              className={selectCls}
              onChange={(e) => {
                setVacancyFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">Все вакансии</option>
              {vacancies.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.title}
                </option>
              ))}
            </select>
            <select
              value={outcomeFilter}
              className={selectCls}
              onChange={(e) => {
                setOutcomeFilter(e.target.value as CandidateOutcome | "");
                setCurrentPage(1);
              }}
            >
              <option value="">Все статусы</option>
              {OUTCOME_ORDER.map((o) => (
                <option key={o} value={o}>
                  {OUTCOME_CONFIG[o].label}
                </option>
              ))}
            </select>
            <select
              value={sourceFilter}
              className={selectCls}
              onChange={(e) => {
                setSourceFilter(e.target.value as CandidateSource | "");
                setCurrentPage(1);
              }}
            >
              <option value="">Все источники</option>
              {CANDIDATE_SOURCE_ORDER.map((s) => (
                <option key={s} value={s}>
                  {CANDIDATE_SOURCE_CONFIG[s].label}
                </option>
              ))}
            </select>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex h-10 items-center rounded-xl border border-gray-200 bg-white px-3.5 text-sm font-medium text-gray-500 transition hover:bg-gray-50 hover:text-gray-700"
              >
                Сбросить
              </button>
            )}
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="mt-4 mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summaryCards.map((card) => {
          const CardIcon = card.icon;
          return (
            <div
              key={card.label}
              className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3.5"
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.tint}`}>
                <CardIcon size={20} />
              </span>
              <div className="min-w-0">
                <div className="truncate text-lg font-semibold text-gray-900">{card.value}</div>
                <div className="truncate text-xs text-gray-500">{card.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-20 text-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          <p className="text-sm text-gray-400">Загрузка...</p>
        </div>
      ) : candidates.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-20 text-center">
          <Users size={36} className="text-gray-300" />
          <p className="text-sm font-medium text-gray-500">Кандидаты не найдены</p>
          <p className="text-xs text-gray-400">
            {hasActiveFilters ? "Измените фильтры или сбросьте их" : "Добавьте первого кандидата"}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <CandidateTable
            candidates={candidates}
            resolveStage={resolveStage}
            onOpen={(c) => navigate(`/recruiting/candidates/${c.id}`)}
            onEdit={(c) => navigate(`/recruiting/candidates/${c.id}/edit`)}
            onDelete={setDeletingItem}
          />
        </div>
      )}

      {totalPages > 1 && (
        <EmployeesPaginationFooter
          visibleRangeLabel={visibleRangeLabel}
          paginationItems={paginationItems}
          currentPage={safePage}
          totalPages={totalPages}
          brandColor={brandColor}
          onPrevious={() => setCurrentPage((p) => Math.max(1, p - 1))}
          onNext={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          onPageChange={(p) => setCurrentPage(p)}
        />
      )}

      <Modal
        isOpen={Boolean(deletingItem)}
        onClose={() => setDeletingItem(null)}
        showCloseButton={false}
        className="m-4 max-w-[420px]"
      >
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900">Удалить кандидата?</h3>
          <p className="mt-2 text-sm text-gray-500">
            Кандидат <span className="font-medium text-gray-700">{deletingItem?.fullName}</span>, все
            оценки и комментарии будут удалены. Это действие нельзя отменить.
          </p>
          <div className="mt-6 flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setDeletingItem(null)} className="px-5">
              Отменить
            </Button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleteMutation.isLoading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-rose-600 px-5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-60"
            >
              {deleteMutation.isLoading ? "Удаление..." : "Удалить"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default CandidatesList;
