import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import PageMeta from "../../components/common/PageMeta";
import Spinner from "../../components/ui/Spinner";
import { useHeaderBreadcrumbItems } from "../../context/HeaderBreadcrumbContext";
import companyStore from "../../store/company.store";
import {
  fetchTimesheetList,
  useTimesheetListQuery,
  useTimesheetTimelineQuery,
} from "../../api/services/timesheet.service";
import {
  DEFAULT_VIEW,
  SOURCE_META,
  SOURCE_ORDER,
  formatDuration,
  rangeForScale,
  toIsoDate,
} from "./constants";
import FiltersPanel, { EMPTY_FILTERS, FiltersToolbar } from "./components/FiltersBar";
import {
  PeriodRangeNavigator,
  PeriodScaleTabs,
} from "./components/PeriodNavigator";
import ViewSwitcher from "./components/ViewSwitcher";
import { SourceLegend } from "./components/badges";
import TableView from "./views/TableView";
import TimelineView from "./views/TimelineView";
import { buildTimesheetCsv, downloadCsv } from "./exportCsv";
import ManualTimeModal from "./components/ManualTimeModal";
import ConfirmDeleteModal from "./components/ConfirmDeleteModal";
import ApprovalProcessModal from "../../components/approvals/ApprovalProcessModal";
import ApprovalProgressButton from "../../components/approvals/ApprovalProgressButton";
import {
  useDeleteManualTime,
  useSaveManualTime,
  type ManualTimeSavePayload,
} from "../../api/services/manualTime.service";
import { useManualTimeApproval } from "./useManualTimeApproval";
import type {
  ManualTimeStatus,
  TimelineScale,
  TimesheetEntry,
  TimesheetFilters,
  TimesheetView,
} from "./types";

const STATUS_META: Record<ManualTimeStatus, { label: string; className: string }> = {
  pending: { label: "Ожидает", className: "bg-amber-100 text-amber-700" },
  approved: { label: "Подтверждено", className: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Отклонено", className: "bg-rose-100 text-rose-700" },
};

const BREADCRUMBS = [{ label: "Табель времени", to: "/timesheet" }];

const PAGE_SIZE = 100;

/** Верхняя граница экспорта — примерно два месяца по всей компании. */
const EXPORT_LIMIT = 2000;

const isView = (value: string | null): value is TimesheetView =>
  value === "table" || value === "timeline";

const isScale = (value: string | null): value is TimelineScale =>
  value === "day" || value === "week" || value === "month";

export default function TimesheetPage() {
  useHeaderBreadcrumbItems(BREADCRUMBS);
  const brandColor = companyStore.mainColor || "#2563eb";

  // Представление, масштаб и период живут в URL: ссылкой на конкретную неделю
  // делятся, и возврат со страницы дня не сбрасывает то, что уже отлистали.
  const [searchParams, setSearchParams] = useSearchParams();
  const rawView = searchParams.get("view");
  const rawScale = searchParams.get("scale");
  const rawAnchor = searchParams.get("date");

  const view: TimesheetView = isView(rawView) ? rawView : DEFAULT_VIEW;
  const scale: TimelineScale = isScale(rawScale) ? rawScale : "week";
  const anchor = rawAnchor && /^\d{4}-\d{2}-\d{2}$/.test(rawAnchor)
    ? rawAnchor
    : toIsoDate(new Date());

  const patchParams = (patch: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => next.set(key, value));
    setSearchParams(next, { replace: true });
  };

  const [filters, setFilters] = useState<TimesheetFilters>(EMPTY_FILTERS);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  // Поиск уходит на сервер, поэтому печатать по букве в запрос нельзя.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search.trim()), 350);
    return () => clearTimeout(timer);
  }, [filters.search]);

  const queryFilters = useMemo<TimesheetFilters>(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch]
  );

  const range = useMemo(() => rangeForScale(scale, anchor), [scale, anchor]);

  // Смена периода или фильтров возвращает таблицу на первую страницу: иначе
  // offset от прошлой выборки указывал бы в пустоту.
  useEffect(() => {
    setOffset(0);
  }, [range.from, range.to, queryFilters]);

  const listQuery = useTimesheetListQuery(
    range,
    queryFilters,
    { limit: PAGE_SIZE, offset },
    view === "table"
  );
  const timelineQuery = useTimesheetTimelineQuery(range, queryFilters, view === "timeline");

  const activeQuery = view === "table" ? listQuery : timelineQuery;

  // Таймлайн приходит страницами: строки склеиваем, а всё остальное (даты,
  // итоги, справочники) сервер повторяет в каждой странице одинаковым — берём
  // из первой, чтобы шапка не скакала при подгрузке.
  // Ссылку на массив страниц берём как есть, без `?? []`: подстановка нового
  // пустого массива на каждом рендере сбрасывала бы мемоизацию строк.
  const timelinePages = timelineQuery.data?.pages;
  const timelineHead = timelinePages?.[0] ?? null;
  const timelineRows = useMemo(
    () => (timelinePages ?? []).flatMap((page) => page?.rows ?? []),
    [timelinePages]
  );

  const data = view === "table" ? listQuery.data ?? null : timelineHead;

  // Справочники фильтров приходят с обоими методами — берём из того ответа,
  // который уже есть, чтобы селекты не пустели при переключении представления.
  const employees = data?.employees ?? listQuery.data?.employees ?? [];
  const projects = data?.projects ?? listQuery.data?.projects ?? [];
  const tasks = data?.tasks ?? listQuery.data?.tasks ?? [];
  const totals = data?.totals ?? null;

  // ── Ручное время ────────────────────────────────────────────────────────
  const [manualModalEntry, setManualModalEntry] = useState<TimesheetEntry | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualError, setManualError] = useState("");
  const [entryToDelete, setEntryToDelete] = useState<TimesheetEntry | null>(null);

  const saveManual = useSaveManualTime();
  const deleteManual = useDeleteManualTime();

  const tableEntries = useMemo(
    () => listQuery.data?.entries ?? [],
    [listQuery.data?.entries]
  );

  const approval = useManualTimeApproval(
    tableEntries,
    (entry) =>
      entry.departmentId ??
      employees.find((item) => item.employeeId === entry.employeeId)?.departmentId
  );

  const openManualModal = (entry: TimesheetEntry | null) => {
    setManualError("");
    setManualModalEntry(entry);
    setIsManualModalOpen(true);
  };

  const handleManualSubmit = async (payload: ManualTimeSavePayload) => {
    try {
      setManualError("");
      await saveManual.mutateAsync(payload);
      setIsManualModalOpen(false);
      setManualModalEntry(null);
      toast.success(
        payload.guid ? "Запись обновлена и снова ждёт согласования." : "Запись отправлена на согласование."
      );
    } catch (error) {
      setManualError(
        error instanceof Error ? error.message : "Не удалось сохранить запись."
      );
    }
  };

  /** Удаление необратимо для пользователя, поэтому всегда через подтверждение. */
  const confirmDelete = async () => {
    if (!entryToDelete) return;
    try {
      await deleteManual.mutateAsync(entryToDelete.id);
      setEntryToDelete(null);
      toast.success("Запись удалена.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось удалить запись.");
    }
  };


  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await fetchTimesheetList(range, queryFilters, EXPORT_LIMIT);
      const entries = result?.entries ?? [];
      if (entries.length === 0) {
        toast.error("За выбранный период нечего экспортировать.");
        return;
      }
      downloadCsv(
        buildTimesheetCsv(entries),
        `Табель_${range.from}_${range.to}.csv`
      );
      if ((result?.total ?? 0) > entries.length) {
        toast.warning(
          `Выгружено ${entries.length} из ${result?.total} записей — сузьте период или фильтры.`
        );
      } else {
        toast.success(`Выгружено записей: ${entries.length}.`);
      }
    } catch {
      toast.error("Не удалось выгрузить табель.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <PageMeta
        title="Табель времени | HRMS"
        description="Учёт отработанного времени сотрудников по данным Time Doctor"
      />

      {/* ── Тулбар ──────────────────────────────────────────────────────── */}
      <div className="-mx-3 -mt-3 md:-mx-4 md:-mt-4">
        {/* Фон тулбара задан классами, а не инлайном: строка периода и
            переключатели внутри имеют тёмные варианты, и прибитый белый фон
            делал бы их нечитаемыми в тёмной теме. */}
        <div
          className={`flex flex-wrap items-center gap-3 border-x border-gray-200 bg-white px-4 py-2.5 dark:border-gray-800 dark:bg-gray-900 lg:px-6 ${
            isFiltersOpen ? "" : "border-b"
          }`}
        >
          <ViewSwitcher value={view} onChange={(next) => patchParams({ view: next })} />

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <FiltersToolbar
              filters={filters}
              brandColor={brandColor}
              isOpen={isFiltersOpen}
              onToggle={() => setIsFiltersOpen((open) => !open)}
              onChange={setFilters}
            />
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              title="Выгрузить в CSV"
              className="inline-flex h-[38px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <Download size={16} />
              {isExporting ? "Выгрузка…" : "Экспорт"}
            </button>
          </div>
        </div>

        {isFiltersOpen && (
          <FiltersPanel
            filters={filters}
            brandColor={brandColor}
            employees={employees}
            projects={projects}
            tasks={tasks}
            onChange={setFilters}
          />
        )}
      </div>

      {/* ── Период и активное представление ─────────────────────────────── */}
      {/* Период живёт в шапке карточки, как строка периодов в KPI: масштаб
          слева, даты справа. В верхнем тулбаре он занимал всю середину строки
          и вытеснял фильтры на вторую строку на ноутбуке. */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <PeriodScaleTabs
            scale={scale}
            onScaleChange={(next) => patchParams({ scale: next })}
          />

          <div className="flex flex-wrap items-center gap-3">
            {view === "timeline" && (
              <SourceLegend sources={SOURCE_ORDER.filter((source) => source !== "other")} />
            )}
            <PeriodRangeNavigator
              scale={scale}
              anchor={anchor}
              onAnchorChange={(next) => patchParams({ date: next })}
            />
          </div>
        </div>

        <div className="p-3 md:p-4">
        {activeQuery.isError ? (
          <div className="rounded-2xl border border-error-200 bg-error-50 px-5 py-8 text-center text-sm text-error-600 dark:border-error-500/30 dark:bg-error-500/10">
            {activeQuery.error instanceof Error
              ? activeQuery.error.message
              : "Не удалось загрузить табель."}
          </div>
        ) : activeQuery.isLoading ? (
          <div className="flex justify-center rounded-2xl border border-gray-200 bg-white py-20 dark:border-gray-800 dark:bg-white/[0.03]">
            <Spinner />
          </div>
        ) : view === "table" ? (
          <TableView
            entries={listQuery.data?.entries ?? []}
            total={listQuery.data?.total ?? 0}
            limit={PAGE_SIZE}
            offset={offset}
            isFetching={listQuery.isFetching}
            onOffsetChange={setOffset}
            renderManualStatus={(entry) => {
              const meta = STATUS_META[entry.status ?? "pending"];
              return (
                <span
                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${meta.className}`}
                  title={entry.reviewComment || undefined}
                >
                  {meta.label}
                </span>
              );
            }}
            renderManualActions={(entry) => {
              const { process, total, approved } = approval.stagesOf(entry);
              const isPending = (entry.status ?? "pending") === "pending";

              return (
                <span className="inline-flex items-center justify-end gap-1.5">
                  {isPending && (
                    <>
                      <ApprovalProgressButton
                        approvedStages={approved}
                        totalStages={total || 1}
                        onClick={() => void approval.confirm(entry)}
                        disabled={approval.isReviewing}
                        label="Подтвердить"
                      />
                      <button
                        type="button"
                        onClick={() => void approval.review(entry, "rejected")}
                        disabled={approval.isReviewing}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[12px] font-semibold text-rose-600 transition hover:bg-rose-100 disabled:opacity-60"
                      >
                        Отклонить
                      </button>
                      <button
                        type="button"
                        onClick={() => openManualModal(entry)}
                        className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-[12px] font-medium text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
                      >
                        Изменить
                      </button>
                    </>
                  )}
                  {!isPending && process && (
                    // Финализированную запись всё равно можно раскрыть: модалка
                    // в режиме истории показывает, кто и когда одобрял.
                    <button
                      type="button"
                      onClick={() => approval.openApproval(entry)}
                      className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-[12px] font-medium text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
                    >
                      Согласование
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setEntryToDelete(entry)}
                    disabled={deleteManual.isLoading}
                    title="Удалить запись"
                    className="rounded-lg border border-gray-200 p-1.5 text-gray-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60 dark:border-gray-700"
                  >
                    <Trash2 size={14} />
                  </button>
                </span>
              );
            }}
          />
        ) : (
          <TimelineView
            dates={timelineHead?.dates ?? []}
            rows={timelineRows}
            total={timelineHead?.total ?? 0}
            isLoadingMore={timelineQuery.isFetchingNextPage}
            hasMore={Boolean(timelineQuery.hasNextPage)}
            onLoadMore={() => {
              if (timelineQuery.hasNextPage && !timelineQuery.isFetchingNextPage) {
                void timelineQuery.fetchNextPage();
              }
            }}
            scale={scale}
          />
        )}
        </div>

        {/* Легенда источников под таблицей — те же цвета, что у бейджей. */}
        {view === "table" && totals && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-gray-100 px-4 py-3 dark:border-gray-800">
          {SOURCE_ORDER.filter((source) => totals.bySource[source] > 0).map((source) => (
            <span
              key={source}
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"
            >
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: SOURCE_META[source].color }}
              />
                {SOURCE_META[source].label}: {formatDuration(totals.bySource[source])}
              </span>
            ))}
          </div>
        )}
      </div>

      <ManualTimeModal
        isOpen={isManualModalOpen}
        onClose={() => {
          if (saveManual.isLoading) return;
          setIsManualModalOpen(false);
          setManualModalEntry(null);
        }}
        employees={employees}
        projects={projects}
        tasks={tasks}
        entry={manualModalEntry}
        defaultDate={anchor}
        isSaving={saveManual.isLoading}
        error={manualError}
        onSubmit={(payload) => void handleManualSubmit(payload)}
      />

      <ApprovalProcessModal {...approval.modalProps} />

      <ConfirmDeleteModal
        entry={entryToDelete}
        isDeleting={deleteManual.isLoading}
        onCancel={() => setEntryToDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
