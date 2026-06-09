import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  CheckCircle2,
  Columns3,
  LayoutList,
  Plus,
  SlidersHorizontal,
  Table2,
  UserRound,
  Users,
} from "lucide-react";
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
  useUpdateCandidateStage,
  useDeleteCandidate,
} from "../../../../api/services/candidate.service";
import { mapVacancyRow, useVacanciesQuery } from "../../../../api/services/vacancy.service";
import CandidateKanban from "../components/CandidateKanban";
import CandidateTable from "../components/CandidateTable";
import CandidateCard from "../components/CandidateCard";
import CandidateDetailDrawer from "../components/CandidateDetailDrawer";
import {
  CANDIDATE_ACTIVE_STAGES,
  CANDIDATE_STAGE_CONFIG,
  CANDIDATE_STAGE_ORDER,
  type Candidate,
  type CandidateStage,
} from "../../types";

interface VacancyOption {
  value: string;
  label: string;
  tag: string;
  level: string;
}

type ViewMode = "kanban" | "table" | "list";
type PaginationItem = number | string;

const PAGE_SIZE = 12;
const FETCH_LIMIT = 200;
const BREADCRUMBS = [
  { label: "Рекрутинг", to: "/recruiting/vacancies" },
  { label: "Кандидаты", to: "/recruiting/candidates" },
];

const buildPaginationItems = (currentPage: number, totalPages: number): PaginationItem[] => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  if (currentPage <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (currentPage >= totalPages - 2) [totalPages - 1, totalPages - 2, totalPages - 3].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const result: PaginationItem[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const page = sorted[i], prev = sorted[i - 1];
    if (prev && page - prev > 1) result.push(`ellipsis-${prev}-${page}`);
    result.push(page);
  }
  return result;
};

const selectCls =
  "h-10 rounded-xl border border-gray-200 bg-white px-3 pr-8 text-sm text-gray-700 transition focus:border-brand-400 focus:outline-none appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2220%22 height=%2220%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2394a3b8%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><polyline points=%226 9 12 15 18 9%22/></svg>')] bg-[right_0.5rem_center] bg-no-repeat";

const VIEW_TABS: { mode: ViewMode; label: string; icon: React.ElementType }[] = [
  { mode: "kanban", label: "Kanban", icon: Columns3 },
  { mode: "table", label: "Таблица", icon: Table2 },
  { mode: "list", label: "Список", icon: LayoutList },
];

function CandidatesList() {
  useHeaderBreadcrumbItems(BREADCRUMBS);
  const brandColor = companyStore.mainColor || "#2563eb";
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const vacancyParam = searchParams.get("vacancy") || "";

  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [vacancyFilter, setVacancyFilter] = useState(vacancyParam);
  const [stageFilter, setStageFilter] = useState<CandidateStage | "">("");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [detailItem, setDetailItem] = useState<Candidate | null>(null);
  const [deletingItem, setDeletingItem] = useState<Candidate | null>(null);

  // Keep filter in sync if user lands here from a vacancy link.
  useEffect(() => {
    setVacancyFilter(vacancyParam);
  }, [vacancyParam]);

  // ── Data ───────────────────────────────────────────────────────────────────
  const queryParams = useMemo(
    () => ({
      limit: FETCH_LIMIT,
      offset: 0,
      ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
      ...(vacancyFilter ? { vacancyId: vacancyFilter } : {}),
    }),
    [searchQuery, vacancyFilter]
  );

  const { data: candidatesData, isLoading } = useCandidatesQuery(queryParams);
  const stageMutation = useUpdateCandidateStage();
  const deleteMutation = useDeleteCandidate();

  const { data: vacanciesData } = useVacanciesQuery({ limit: 100, offset: 0 });

  const vacancyOptions: VacancyOption[] = useMemo(
    () =>
      (vacanciesData?.response ?? []).map((row) => {
        const v = mapVacancyRow(row);
        return { value: v.id, label: v.title, tag: v.tag, level: v.experienceLevel };
      }),
    [vacanciesData]
  );

  const allCandidates = useMemo(
    () => (candidatesData?.response ?? []).map(mapCandidateRow),
    [candidatesData]
  );

  // Stage filter only applies to table/list (kanban shows every column).
  const flatCandidates = useMemo(
    () => (stageFilter ? allCandidates.filter((c) => c.stage === stageFilter) : allCandidates),
    [allCandidates, stageFilter]
  );

  const syncedDetailItem = useMemo(
    () => (detailItem ? allCandidates.find((c) => c.id === detailItem.id) ?? detailItem : null),
    [allCandidates, detailItem]
  );

  // ── Client pagination for table / list ──────────────────────────────────────
  const totalCount = flatCandidates.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedCandidates = useMemo(
    () => flatCandidates.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [flatCandidates, safePage]
  );
  const paginationItems = useMemo(() => buildPaginationItems(safePage, totalPages), [safePage, totalPages]);

  const visibleRangeLabel = useMemo(() => {
    if (totalCount === 0) return isLoading ? "Загрузка..." : "Нет кандидатов";
    const start = (safePage - 1) * PAGE_SIZE + 1;
    const end = Math.min(safePage * PAGE_SIZE, totalCount);
    return `Отображение ${start}–${end} из ${totalCount}`;
  }, [safePage, totalCount, isLoading]);

  // ── Summary ──────────────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const active = allCandidates.filter((c) => CANDIDATE_ACTIVE_STAGES.includes(c.stage)).length;
    const interview = allCandidates.filter((c) => c.stage === "interview").length;
    const hired = allCandidates.filter((c) => c.stage === "hired").length;
    return { total: allCandidates.length, active, interview, hired };
  }, [allCandidates]);

  const hasActiveFilters = Boolean(searchQuery || vacancyFilter || stageFilter);
  const activeFiltersCount = (vacancyFilter ? 1 : 0) + (stageFilter ? 1 : 0);

  const resetFilters = () => {
    setSearchQuery("");
    setVacancyFilter("");
    setStageFilter("");
    setCurrentPage(1);
    if (vacancyParam) setSearchParams({});
  };

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const openCreate = () =>
    navigate(vacancyFilter ? `/recruiting/candidates/new?vacancy=${vacancyFilter}` : "/recruiting/candidates/new");
  const openEdit = (item: Candidate) => navigate(`/recruiting/candidates/${item.id}/edit`);

  const handleMoveStage = async (candidate: Candidate, stage: CandidateStage) => {
    try {
      await stageMutation.mutateAsync({ guid: candidate.id, stage });
      toast.success(`Перемещён: ${CANDIDATE_STAGE_CONFIG[stage].label}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось переместить");
    }
  };

  const confirmDelete = async () => {
    if (!deletingItem) return;
    try {
      await deleteMutation.mutateAsync(deletingItem.id);
      if (detailItem?.id === deletingItem.id) setDetailItem(null);
      setDeletingItem(null);
      toast.success("Кандидат удалён");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось удалить");
    }
  };

  const selectedVacancyTitle = useMemo(
    () => vacancyOptions.find((o) => o.value === vacancyFilter)?.label,
    [vacancyOptions, vacancyFilter]
  );

  const summaryCards = [
    { label: "Всего кандидатов", value: String(summary.total), icon: Users, tint: "text-brand-600 bg-brand-50" },
    { label: "В активной воронке", value: String(summary.active), icon: UserRound, tint: "text-blue-600 bg-blue-50" },
    { label: "На интервью", value: String(summary.interview), icon: UserRound, tint: "text-violet-600 bg-violet-50" },
    { label: "Принято", value: String(summary.hired), icon: CheckCircle2, tint: "text-emerald-600 bg-emerald-50" },
  ];

  const showPagination = viewMode !== "kanban" && totalPages > 1;

  return (
    <>
      <PageMeta title="Кандидаты | Рекрутинг" description="Воронка найма и управление кандидатами" />

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
          <div className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
            {VIEW_TABS.map(({ mode, label, icon: Icon }) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`inline-flex h-8 items-center gap-2 rounded-lg px-3 text-sm font-medium transition ${
                  viewMode === mode ? "bg-white text-brand-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <ExpandableSearchInput
              value={searchQuery}
              onChange={(v) => {
                setSearchQuery(v);
                setCurrentPage(1);
              }}
              inputId="candidate-search"
              placeholder="Поиск по имени, должности..."
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
            <Button startIcon={<Plus size={16} />} onClick={openCreate} className="h-10 rounded-xl px-4">
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
                if (!e.target.value && vacancyParam) setSearchParams({});
              }}
            >
              <option value="">Все вакансии</option>
              {vacancyOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={stageFilter}
              className={selectCls}
              onChange={(e) => {
                setStageFilter(e.target.value as CandidateStage | "");
                setCurrentPage(1);
              }}
              disabled={viewMode === "kanban"}
              title={viewMode === "kanban" ? "В Kanban отображаются все этапы" : undefined}
            >
              <option value="">Все этапы</option>
              {CANDIDATE_STAGE_ORDER.map((s) => (
                <option key={s} value={s}>
                  {CANDIDATE_STAGE_CONFIG[s].label}
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

      {/* Vacancy context banner */}
      {selectedVacancyTitle && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-2.5 text-sm text-brand-700">
          <Users size={16} />
          Кандидаты по вакансии: <span className="font-semibold">{selectedVacancyTitle}</span>
          <button
            type="button"
            onClick={() => {
              setVacancyFilter("");
              setSearchParams({});
            }}
            className="ml-auto text-xs font-medium text-brand-600 underline"
          >
            Показать всех
          </button>
        </div>
      )}

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
      ) : allCandidates.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-20 text-center">
          <Users size={36} className="text-gray-300" />
          <p className="text-sm font-medium text-gray-500">Кандидаты не найдены</p>
          <p className="text-xs text-gray-400">
            {hasActiveFilters ? "Измените фильтры или сбросьте их" : "Добавьте первого кандидата"}
          </p>
        </div>
      ) : viewMode === "kanban" ? (
        <CandidateKanban candidates={allCandidates} onOpen={setDetailItem} onMoveStage={handleMoveStage} />
      ) : viewMode === "table" ? (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <CandidateTable
            candidates={pagedCandidates}
            onOpen={setDetailItem}
            onEdit={openEdit}
            onDelete={setDeletingItem}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pagedCandidates.map((c) => (
            <CandidateCard key={c.id} candidate={c} onOpen={setDetailItem} />
          ))}
        </div>
      )}

      {showPagination && (
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

      {/* Modals / Drawer */}
      <CandidateDetailDrawer
        isOpen={Boolean(syncedDetailItem)}
        candidate={syncedDetailItem}
        onClose={() => setDetailItem(null)}
        onEdit={openEdit}
        onDelete={setDeletingItem}
        onMoveStage={handleMoveStage}
      />

      <Modal
        isOpen={Boolean(deletingItem)}
        onClose={() => setDeletingItem(null)}
        showCloseButton={false}
        className="m-4 max-w-[420px]"
      >
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900">Удалить кандидата?</h3>
          <p className="mt-2 text-sm text-gray-500">
            Кандидат <span className="font-medium text-gray-700">«{deletingItem?.fullName}»</span> будет удалён.
            Это действие нельзя отменить.
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
