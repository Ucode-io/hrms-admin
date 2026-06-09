import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Briefcase, CheckCircle2, LayoutGrid, List, PauseCircle, Plus, SlidersHorizontal, Users } from "lucide-react";
import { toast } from "sonner";
import PageMeta from "../../../../components/common/PageMeta";
import Button from "../../../../components/ui/button/Button";
import ExpandableSearchInput from "../../../../components/form/ExpandableSearchInput";
import { Modal } from "../../../../components/ui/modal";
import { useHeaderBreadcrumbItems } from "../../../../context/HeaderBreadcrumbContext";
import companyStore from "../../../../store/company.store";
import EmployeesPaginationFooter from "../../../Employees/List/components/EmployeesPaginationFooter";
import { MOCK_DEPARTMENTS } from "../../mock/mockStore";
import {
  mapVacancyRow,
  useVacanciesQuery,
  useVacancyCandidateCounts,
  useUpdateVacancyStatus,
  useDeleteVacancy,
} from "../../../../api/services/vacancy.service";
import VacancyCard from "../components/VacancyCard";
import VacancyTable from "../components/VacancyTable";
import VacancyDetailDrawer from "../components/VacancyDetailDrawer";
import {
  VACANCY_STATUS_CONFIG,
  VACANCY_STATUS_ORDER,
  type Vacancy,
  type VacancyStatus,
} from "../../types";

type ViewMode = "cards" | "table";
type PaginationItem = number | string;

const PAGE_SIZE = 9;
const BREADCRUMBS = [
  { label: "Рекрутинг", to: "/recruiting/vacancies" },
  { label: "Вакансии", to: "/recruiting/vacancies" },
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

function VacanciesList() {
  useHeaderBreadcrumbItems(BREADCRUMBS);
  const navigate = useNavigate();
  const brandColor = companyStore.mainColor || "#2563eb";

  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<VacancyStatus | "">("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [detailItem, setDetailItem] = useState<Vacancy | null>(null);
  const [deletingItem, setDeletingItem] = useState<Vacancy | null>(null);

  const queryParams = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset: (currentPage - 1) * PAGE_SIZE,
      ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(departmentFilter ? { departmentId: departmentFilter } : {}),
    }),
    [currentPage, searchQuery, statusFilter, departmentFilter]
  );

  const { data: vacanciesData, isLoading } = useVacanciesQuery(queryParams);
  const { data: countsMap } = useVacancyCandidateCounts();
  const statusMutation = useUpdateVacancyStatus();
  const deleteMutation = useDeleteVacancy();

  const departmentOptions = MOCK_DEPARTMENTS;

  const vacancies = useMemo(
    () => (vacanciesData?.response ?? []).map((row) => mapVacancyRow(row, countsMap?.[row.guid])),
    [vacanciesData, countsMap]
  );

  const syncedDetailItem = useMemo(
    () => (detailItem ? vacancies.find((v) => v.id === detailItem.id) ?? detailItem : null),
    [vacancies, detailItem]
  );

  const totalCount = vacanciesData?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginationItems = useMemo(() => buildPaginationItems(safePage, totalPages), [safePage, totalPages]);

  const visibleRangeLabel = useMemo(() => {
    if (totalCount === 0) return isLoading ? "Загрузка..." : "Нет вакансий";
    const start = (safePage - 1) * PAGE_SIZE + 1;
    const end = Math.min(safePage * PAGE_SIZE, totalCount);
    return `Отображение ${start}–${end} из ${totalCount}`;
  }, [safePage, totalCount, isLoading]);

  const summary = useMemo(() => {
    const open = vacancies.filter((v) => v.status === "open").length;
    const paused = vacancies.filter((v) => v.status === "paused").length;
    const candidates = vacancies.reduce((s, v) => s + v.candidatesCount, 0);
    return { total: totalCount, open, paused, candidates };
  }, [vacancies, totalCount]);

  const hasActiveFilters = Boolean(searchQuery || statusFilter || departmentFilter);
  const activeFiltersCount = (statusFilter ? 1 : 0) + (departmentFilter ? 1 : 0);

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("");
    setDepartmentFilter("");
    setCurrentPage(1);
  };

  const openCreate = () => navigate("/recruiting/vacancies/new");
  const openEdit = (item: Vacancy) => navigate(`/recruiting/vacancies/${item.id}/edit`);
  const goToCandidates = (item: Vacancy) => navigate(`/recruiting/candidates?vacancy=${item.id}`);

  const handleChangeStatus = async (item: Vacancy, status: VacancyStatus) => {
    try {
      await statusMutation.mutateAsync({ guid: item.id, status });
      toast.success(`Статус изменён: ${VACANCY_STATUS_CONFIG[status].label}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось изменить статус");
    }
  };

  const confirmDelete = async () => {
    if (!deletingItem) return;
    try {
      await deleteMutation.mutateAsync(deletingItem.id);
      if (detailItem?.id === deletingItem.id) setDetailItem(null);
      setDeletingItem(null);
      toast.success("Вакансия удалена");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось удалить");
    }
  };

  const summaryCards = [
    { label: "Всего вакансий", value: String(summary.total), icon: Briefcase, tint: "text-brand-600 bg-brand-50" },
    { label: "Открыто", value: String(summary.open), icon: CheckCircle2, tint: "text-emerald-600 bg-emerald-50" },
    { label: "На паузе", value: String(summary.paused), icon: PauseCircle, tint: "text-amber-600 bg-amber-50" },
    { label: "Кандидатов", value: String(summary.candidates), icon: Users, tint: "text-violet-600 bg-violet-50" },
  ];

  return (
    <>
      <PageMeta title="Вакансии | Рекрутинг" description="Управление открытыми вакансиями компании" />

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
            {(["cards", "table"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`inline-flex h-8 items-center gap-2 rounded-lg px-3 text-sm font-medium transition ${
                  viewMode === mode ? "bg-white text-brand-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {mode === "cards" ? <><LayoutGrid size={16} />Карточки</> : <><List size={16} />Таблица</>}
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
              inputId="vacancy-search"
              placeholder="Поиск по названию вакансии..."
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
              Создать
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
              value={statusFilter}
              className={selectCls}
              onChange={(e) => {
                setStatusFilter(e.target.value as VacancyStatus | "");
                setCurrentPage(1);
              }}
            >
              <option value="">Все статусы</option>
              {VACANCY_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {VACANCY_STATUS_CONFIG[s].label}
                </option>
              ))}
            </select>
            <select
              value={departmentFilter}
              className={selectCls}
              onChange={(e) => {
                setDepartmentFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">Все отделы</option>
              {departmentOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
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
      ) : vacancies.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-20 text-center">
          <Briefcase size={36} className="text-gray-300" />
          <p className="text-sm font-medium text-gray-500">Вакансии не найдены</p>
          <p className="text-xs text-gray-400">
            {hasActiveFilters ? "Измените фильтры или сбросьте их" : "Создайте первую вакансию"}
          </p>
        </div>
      ) : viewMode === "cards" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {vacancies.map((v) => (
            <VacancyCard
              key={v.id}
              vacancy={v}
              onOpenCandidates={goToCandidates}
              onEdit={openEdit}
              onDelete={setDeletingItem}
              onOpenDetail={setDetailItem}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <VacancyTable
            vacancies={vacancies}
            onOpenCandidates={goToCandidates}
            onEdit={openEdit}
            onDelete={setDeletingItem}
            onOpenDetail={setDetailItem}
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

      {/* Modals / Drawer */}
      <VacancyDetailDrawer
        isOpen={Boolean(syncedDetailItem)}
        vacancy={syncedDetailItem}
        onClose={() => setDetailItem(null)}
        onEdit={openEdit}
        onDelete={setDeletingItem}
        onOpenCandidates={goToCandidates}
        onChangeStatus={handleChangeStatus}
      />

      <Modal
        isOpen={Boolean(deletingItem)}
        onClose={() => setDeletingItem(null)}
        showCloseButton={false}
        className="m-4 max-w-[420px]"
      >
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900">Удалить вакансию?</h3>
          <p className="mt-2 text-sm text-gray-500">
            Вакансия <span className="font-medium text-gray-700">«{deletingItem?.title}»</span> будет удалена.
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

export default VacanciesList;
