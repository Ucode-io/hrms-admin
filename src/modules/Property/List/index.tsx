import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Boxes, LayoutGrid, List, Plus, SlidersHorizontal } from "lucide-react";
import Select, { type SingleValue, type StylesConfig } from "react-select";
import { toast } from "sonner";
import PageMeta from "../../../components/common/PageMeta";
import Button from "../../../components/ui/button/Button";
import ExpandableSearchInput from "../../../components/form/ExpandableSearchInput";
import { useHeaderBreadcrumbItems } from "../../../context/HeaderBreadcrumbContext";
import EmployeesPaginationFooter from "../../Employees/List/components/EmployeesPaginationFooter";
import companyStore from "../../../store/company.store";
import PropertyTable from "../components/PropertyTable";
import PropertyGrid from "../components/PropertyGrid";
import MovementModal from "../components/MovementModal";
import PropertyDetailDrawer from "../components/PropertyDetailDrawer";
import { Modal } from "../../../components/ui/modal";
import { useSettingsDirectoryQuery } from "../../../api/services/settingsDirectory.service";
import {
  mapPropertyRow,
  usePropertiesQuery,
  useDeleteProperty,
} from "../../../api/services/property.service";
import encodeJsonToUrlParam from "../../../utils/encodeJsonToUrlParam";
import {
  PROPERTY_STATUS_CONFIG,
  PROPERTY_STATUS_ORDER,
  type PropertyItem,
  type PropertyStatus,
} from "../types";

type ViewMode = "table" | "grid";
type PaginationItem = number | string;
type FilterSelectOption = { value: string; label: string };

// Shared filter-select styling — matches Attendance/Absence filter selects.
const getFilterSelectStyles = (): StylesConfig<FilterSelectOption, false> => ({
  control: (base, state) => ({
    ...base,
    minHeight: "40px",
    borderColor: state.isFocused ? "#cbd5e1" : "#e2e8f0",
    borderRadius: "0.75rem",
    boxShadow: "none",
    "&:hover": { borderColor: "#cbd5e1" },
  }),
  valueContainer: (base) => ({ ...base, padding: "0 10px", fontSize: "14px" }),
  input: (base) => ({ ...base, margin: 0, padding: 0, fontSize: "14px" }),
  indicatorsContainer: (base) => ({ ...base, height: "38px" }),
  option: (base, state) => ({
    ...base,
    fontSize: "14px",
    cursor: "pointer",
    backgroundColor: state.isSelected ? "#e2e8f0" : state.isFocused ? "#f8fafc" : "white",
    color: "#111827",
    padding: "8px 12px",
  }),
  menu: (base) => ({ ...base, zIndex: 100000, borderRadius: "0.75rem", border: "1px solid #e5e7eb" }),
  menuPortal: (base) => ({ ...base, zIndex: 100000 }),
  singleValue: (base) => ({ ...base, fontSize: "14px" }),
  placeholder: (base) => ({ ...base, fontSize: "14px", color: "#94a3b8" }),
});

const PAGE_SIZE = 10;
const PROPERTY_BREADCRUMBS = [{ label: "Имущество", to: "/property" }];

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

function PropertyList() {
  useHeaderBreadcrumbItems(PROPERTY_BREADCRUMBS);
  const navigate = useNavigate();
  const brandColor = companyStore.mainColor || "#2563eb";

  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<PropertyStatus | "">("");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [movementItem, setMovementItem] = useState<PropertyItem | null>(null);
  const [detailItem, setDetailItem] = useState<PropertyItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<PropertyItem | null>(null);

  // ── API ──────────────────────────────────────────────────────────────────
  const queryParams = useMemo(() => ({
    limit: PAGE_SIZE,
    offset: (currentPage - 1) * PAGE_SIZE,
    ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
    ...(categoryFilter ? { categoryId: categoryFilter } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  }), [currentPage, searchQuery, categoryFilter, statusFilter]);

  const { data: propertiesData, isLoading } = usePropertiesQuery(queryParams);
  const deleteMutation = useDeleteProperty();

  const { data: categoriesData } = useSettingsDirectoryQuery({
    slug: "property_categories",
    params: { data: encodeJsonToUrlParam({ limit: 100, offset: 0 }) },
  });

  const items = useMemo(
    () => (propertiesData?.response ?? []).map(mapPropertyRow),
    [propertiesData]
  );

  // Keep detail/movement items in sync after list refresh
  const syncedDetailItem = useMemo(
    () => detailItem ? (items.find((i) => i.id === detailItem.id) ?? detailItem) : null,
    [items, detailItem]
  );
  const syncedMovementItem = useMemo(
    () => movementItem ? (items.find((i) => i.id === movementItem.id) ?? movementItem) : null,
    [items, movementItem]
  );

  const totalCount = propertiesData?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  const paginationItems = useMemo(
    () => buildPaginationItems(safePage, totalPages),
    [safePage, totalPages]
  );

  const visibleRangeLabel = useMemo(() => {
    if (totalCount === 0) return isLoading ? "Загрузка..." : "Нет записей";
    const start = (safePage - 1) * PAGE_SIZE + 1;
    const end = Math.min(safePage * PAGE_SIZE, totalCount);
    return `Отображение ${start}–${end} из ${totalCount}`;
  }, [safePage, totalCount, isLoading]);

  const categoryOptions = useMemo(
    () => (categoriesData?.response ?? []).map((c) => ({
      value: c.guid,
      label: String(c.title || "—"),
    })),
    [categoriesData]
  );

  const hasActiveFilters = Boolean(searchQuery || categoryFilter || statusFilter);
  const activeFiltersCount = (categoryFilter ? 1 : 0) + (statusFilter ? 1 : 0);

  const filterSelectStyles = useMemo(() => getFilterSelectStyles(), []);
  const menuPortalTarget = typeof document !== "undefined" ? document.body : null;
  const statusFilterOptions = useMemo<FilterSelectOption[]>(
    () => PROPERTY_STATUS_ORDER.map((s) => ({ value: s, label: PROPERTY_STATUS_CONFIG[s].label })),
    []
  );

  // ── Handlers ─────────────────────────────────────────────────────────────
  const resetFilters = () => {
    setSearchQuery(""); setCategoryFilter(""); setStatusFilter(""); setCurrentPage(1);
  };

  const openCreate = () => navigate("/property/new");
  const openEdit = (item: PropertyItem) => navigate(`/property/${item.id}/edit`);

  const confirmDelete = async () => {
    if (!deletingItem) return;
    try {
      await deleteMutation.mutateAsync(deletingItem.id);
      if (detailItem?.id === deletingItem.id) setDetailItem(null);
      setDeletingItem(null);
      toast.success("Удалено");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось удалить");
    }
  };

  return (
    <>
      <PageMeta title="Имущество | HRMS" description="Учёт имущества компании" />

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="-mx-3 md:-mx-4 -mt-3 md:-mt-4">
        <div
          className="px-4 lg:px-6 py-2.5"
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: "10px", flexWrap: "wrap", backgroundColor: "#fff",
            border: "1px solid #e2e8f0", borderTop: "none",
            borderBottom: isFiltersOpen ? "none" : "1px solid #e2e8f0",
          }}
        >
          {/* View select */}
          <div className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
            {(["table", "grid"] as ViewMode[]).map((mode) => (
              <button key={mode} type="button" onClick={() => setViewMode(mode)}
                className={`inline-flex h-8 items-center gap-2 rounded-lg px-3 text-sm font-medium transition ${
                  viewMode === mode ? "bg-white text-brand-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}>
                {mode === "table" ? <><List size={16} />Таблица</> : <><LayoutGrid size={16} />Сетка</>}
              </button>
            ))}
          </div>

          {/* Right toolbar */}
          <div className="ml-auto flex items-center gap-2">
            <ExpandableSearchInput
              value={searchQuery}
              onChange={(v) => { setSearchQuery(v); setCurrentPage(1); }}
              inputId="property-search"
              placeholder="Поиск по названию, серийному номеру..."
              expandedWidth={360}
              collapsedSize={40}
              brandColor={brandColor}
            />
            <button type="button" onClick={() => setIsFiltersOpen((o) => !o)}
              aria-label={`Фильтр${activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ""}`}
              title={`Фильтр${activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ""}`}
              className={`relative inline-flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                isFiltersOpen || activeFiltersCount > 0
                  ? "border-brand-200 bg-brand-50 text-brand-600"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}>
              <SlidersHorizontal size={16} />
              {activeFiltersCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white">
                  {activeFiltersCount}
                </span>
              ) : null}
            </button>
            <Button startIcon={<Plus size={16} />} onClick={openCreate} className="h-10 rounded-xl px-4">
              Добавить
            </Button>
          </div>
        </div>

        {/* Filters panel */}
        {isFiltersOpen && (
          <div className="px-4 lg:px-6 py-3"
            style={{
              display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap",
              background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
              border: "1px solid #e2e8f0", borderTop: "1px solid #dbe4ee",
            }}>
            <div style={{ minWidth: "200px", maxWidth: "280px", flex: "0 1 280px" }}>
              <Select<FilterSelectOption, false>
                inputId="property-filter-category"
                value={categoryOptions.find((opt) => opt.value === categoryFilter) || null}
                onChange={(opt: SingleValue<FilterSelectOption>) => {
                  setCategoryFilter(opt?.value || "");
                  setCurrentPage(1);
                }}
                options={categoryOptions}
                placeholder="Все категории"
                isClearable
                styles={filterSelectStyles}
                menuPortalTarget={menuPortalTarget}
                menuPosition="fixed"
                noOptionsMessage={() => "Ничего не найдено"}
              />
            </div>
            <div style={{ minWidth: "200px", maxWidth: "280px", flex: "0 1 280px" }}>
              <Select<FilterSelectOption, false>
                inputId="property-filter-status"
                value={statusFilterOptions.find((opt) => opt.value === statusFilter) || null}
                onChange={(opt: SingleValue<FilterSelectOption>) => {
                  setStatusFilter((opt?.value || "") as PropertyStatus | "");
                  setCurrentPage(1);
                }}
                options={statusFilterOptions}
                placeholder="Все статусы"
                isSearchable={false}
                isClearable
                styles={filterSelectStyles}
                menuPortalTarget={menuPortalTarget}
                menuPosition="fixed"
                noOptionsMessage={() => "Ничего не найдено"}
              />
            </div>
            {hasActiveFilters && (
              <button type="button" onClick={resetFilters}
                className="inline-flex h-10 items-center rounded-xl border border-gray-200 bg-white px-3.5 text-sm font-medium text-gray-500 transition hover:bg-gray-50 hover:text-gray-700">
                Сбросить
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Main card ────────────────────────────────────────────────────── */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 bg-slate-50/60 px-5 py-2.5 text-xs text-gray-500">
          {visibleRangeLabel}
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 px-5 py-16 text-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            <p className="text-sm text-gray-400">Загрузка...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-5 py-16 text-center">
            <Boxes size={36} className="text-gray-300" />
            <p className="text-sm font-medium text-gray-500">Имущество не найдено</p>
            <p className="text-xs text-gray-400">
              {hasActiveFilters ? "Попробуйте изменить фильтры или сбросить их" : "Добавьте первую единицу имущества"}
            </p>
          </div>
        ) : viewMode === "table" ? (
          <PropertyTable
            items={items}
            onOpenDetail={setDetailItem}
            onEdit={openEdit}
            onMovement={setMovementItem}
            onDelete={setDeletingItem}
          />
        ) : (
          <PropertyGrid
            items={items}
            onOpenDetail={setDetailItem}
            onEdit={openEdit}
            onMovement={setMovementItem}
            onDelete={setDeletingItem}
          />
        )}
      </div>

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

      {/* ── Modals / Drawer ──────────────────────────────────────────────── */}
      <PropertyDetailDrawer
        isOpen={Boolean(syncedDetailItem)}
        item={syncedDetailItem}
        onClose={() => setDetailItem(null)}
        onEdit={openEdit}
        onMovement={setMovementItem}
        onDelete={setDeletingItem}
      />


      <MovementModal
        isOpen={Boolean(syncedMovementItem)}
        item={syncedMovementItem}
        onClose={() => setMovementItem(null)}
        onSuccess={() => {
          // If the drawer is open for the same item — sync it too
          if (detailItem && syncedMovementItem?.id === detailItem.id) {
            setDetailItem(syncedMovementItem);
          }
        }}
      />

      <Modal isOpen={Boolean(deletingItem)} onClose={() => setDeletingItem(null)}
        showCloseButton={false} className="m-4 max-w-[420px]">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900">Удалить имущество?</h3>
          <p className="mt-2 text-sm text-gray-500">
            Запись <span className="font-medium text-gray-700">«{deletingItem?.name}»</span> будет
            удалена вместе с историей. Это действие нельзя отменить.
          </p>
          <div className="mt-6 flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setDeletingItem(null)} className="px-5">Отменить</Button>
            <button type="button" onClick={confirmDelete}
              disabled={deleteMutation.isLoading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-rose-600 px-5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-60">
              {deleteMutation.isLoading ? "Удаление..." : "Удалить"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default PropertyList;
