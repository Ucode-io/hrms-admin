import { useEffect, useMemo, useRef, useState } from "react";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import ruLocale from "@fullcalendar/core/locales/ru";
import { CalendarDays, GraduationCap, List, MoreHorizontal, Plus, X } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import PageMeta from "../../components/common/PageMeta";
import ViewSwitcher from "../../components/common/ViewSwitcher";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import Button from "../../components/ui/button/Button";
import { Modal } from "../../components/ui/modal";
import { Dropdown } from "../../components/ui/dropdown/Dropdown";
import { DropdownItem } from "../../components/ui/dropdown/DropdownItem";
import ExpandableSearchInput from "../../components/form/ExpandableSearchInput";
import { useHeaderBreadcrumbItems } from "../../context/HeaderBreadcrumbContext";
import EmployeesPaginationFooter from "../Employees/List/components/EmployeesPaginationFooter";
import companyStore from "../../store/company.store";
import {
  type Training,
  useDeleteTraining,
  useTrainingsQuery,
} from "../../api/services/training.service";
import { useTranslation } from "../../i18n";

const PAGE_SIZE = 20;
const TRAININGS_BREADCRUMBS = [{ label: "Тренинги", to: "/trainings" }];

type PaginationItem = number | string;

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

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  draft: { label: "Черновик", className: "bg-gray-100 text-gray-600" },
  active: { label: "Активный", className: "bg-success-50 text-success-700" },
  archived: { label: "Архив", className: "bg-warning-50 text-warning-700" },
};

const resolveStatus = (training: Training) => {
  const raw = Array.isArray(training.status)
    ? String(training.status[0] || "")
    : String(training.status || "");
  return STATUS_LABELS[raw] || STATUS_LABELS.draft;
};

const resolveStatusKey = (training: Training): string => {
  const raw = Array.isArray(training.status)
    ? String(training.status[0] || "")
    : String(training.status || "");
  return STATUS_LABELS[raw] ? raw : "draft";
};

// Event colors per training status (calendar view).
const CALENDAR_STATUS_COLORS: Record<string, string> = {
  draft: "#98a2b3",
  active: "#12b76a",
  archived: "#f79009",
};

/** FullCalendar treats `end` as exclusive — pad the period's last day. */
const exclusiveEnd = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  parsed.setDate(parsed.getDate() + 1);
  return parsed.toISOString().slice(0, 10);
};

type TrainingEventProps = {
  color?: string;
  location?: string;
  trainerName?: string;
};

/** App-styled calendar event chip: soft tinted pill, status dot, title + place. */
const renderTrainingEvent = (arg: {
  event: { title: string; extendedProps: TrainingEventProps };
}) => {
  const props = arg.event.extendedProps || {};
  const color = props.color || CALENDAR_STATUS_COLORS.draft;
  const meta = props.location || props.trainerName || "";

  return (
    <div
      className="flex w-full items-center gap-1.5 overflow-hidden rounded-md border-l-2 px-1.5 py-1"
      style={{ backgroundColor: `${color}1f`, borderColor: color }}
      title={meta ? `${arg.event.title} · ${meta}` : arg.event.title}
    >
      <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-gray-800">
        {arg.event.title}
      </span>
      {meta ? (
        <span className="hidden shrink-0 truncate text-[10px] text-gray-500 sm:inline">
          {meta}
        </span>
      ) : null}
    </div>
  );
};

const formatDate = (value?: string | null): string => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const formatPeriod = (training: Training): string => {
  const start = formatDate(training.starts_at);
  const end = formatDate(training.ends_at);
  if (start && end) return `${start} — ${end}`;
  if (start) return `с ${start}`;
  if (end) return `до ${end}`;
  return "—";
};

export default function TrainingsPage() {
  const { t } = useTranslation();
  useHeaderBreadcrumbItems(TRAININGS_BREADCRUMBS);
  const navigate = useNavigate();
  const brandColor = companyStore.mainColor || "#2563eb";

  const [view, setView] = useState<"list" | "calendar">("list");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [trainingToDelete, setTrainingToDelete] = useState<Training | null>(null);
  const [openActionsFor, setOpenActionsFor] = useState<string | null>(null);
  const actionButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchValue.trim());
      setCurrentPage(1);
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchValue]);

  // The calendar renders the whole set at once; the list stays paginated.
  const queryParams = useMemo(
    () =>
      view === "calendar"
        ? {
            limit: 500,
            offset: 0,
            ...(debouncedSearch ? { search: debouncedSearch } : {}),
          }
        : {
            limit: PAGE_SIZE,
            offset: (currentPage - 1) * PAGE_SIZE,
            ...(debouncedSearch ? { search: debouncedSearch } : {}),
          },
    [view, currentPage, debouncedSearch]
  );

  const { data, isLoading } = useTrainingsQuery({ params: queryParams });
  const deleteMutation = useDeleteTraining();

  const trainings = data?.response || [];
  const totalCount = data?.count || 0;
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

  const hasActiveSearch = Boolean(debouncedSearch);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const openDeleteModal = (training: Training) => {
    setTrainingToDelete(training);
    setIsDeleteModalOpen(true);
    setOpenActionsFor(null);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setTrainingToDelete(null);
  };

  const confirmDelete = async () => {
    if (!trainingToDelete) return;

    try {
      await deleteMutation.mutateAsync(trainingToDelete.guid);
      toast.success("Тренинг удален.");
      closeDeleteModal();
    } catch (error) {
      console.error("Failed to delete training:", error);
      toast.error("Не удалось удалить тренинг.");
    }
  };

  const toggleActionsMenu = (guid: string) => {
    setOpenActionsFor((prev) => (prev === guid ? null : guid));
  };

  const calendarEvents = useMemo(
    () =>
      trainings
        .filter((training) => training.starts_at || training.ends_at)
        .map((training) => {
          const statusKey = resolveStatusKey(training);
          const color = CALENDAR_STATUS_COLORS[statusKey] || CALENDAR_STATUS_COLORS.draft;
          const start = String(training.starts_at || training.ends_at || "").slice(0, 10);

          return {
            id: training.guid,
            title: String(training.title || "Без названия"),
            start,
            end: exclusiveEnd(training.ends_at),
            allDay: true,
            backgroundColor: color,
            borderColor: color,
          };
        }),
    [trainings]
  );

  return (
    <>
      <PageMeta title="Тренинги | Обучение" description="Список тренингов компании" />

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="-mx-3 md:-mx-4 -mt-3 md:-mt-4">
        <div
          className="px-4 lg:px-6 py-2.5"
          style={{
            display: "flex", alignItems: "center", justifyContent: "flex-end",
            gap: "10px", flexWrap: "wrap", backgroundColor: "#fff",
            border: "1px solid #e2e8f0", borderTop: "none",
          }}
        >
          <ViewSwitcher
            value={view}
            onChange={setView}
            items={[
              { key: "list", label: "Список", icon: <List size={16} /> },
              { key: "calendar", label: "Календарь", icon: <CalendarDays size={16} /> },
            ]}
          />

          <div className="ml-auto flex items-center gap-2">
            <ExpandableSearchInput
              value={searchValue}
              onChange={(v) => { setSearchValue(v); setCurrentPage(1); }}
              inputId="trainings-search"
              placeholder="Поиск по названию..."
              expandedWidth={360}
              collapsedSize={40}
              brandColor={brandColor}
            />
            <Button
              startIcon={<Plus size={16} />}
              onClick={() => navigate("/trainings/new")}
              className="h-10 rounded-xl px-4"
            >
              Новый
            </Button>
          </div>
        </div>
      </div>

      {view === "calendar" ? (
        /* ── Calendar view ─────────────────────────────────────────────── */
        <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {isLoading ? (
            <div className="flex h-[520px] items-center justify-center text-sm text-gray-500">
              Загрузка...
            </div>
          ) : (
            <>
              <div className="custom-calendar">
                <FullCalendar
                  plugins={[dayGridPlugin]}
                  initialView="dayGridMonth"
                  locale={ruLocale}
                  height="auto"
                  events={calendarEvents}
                  dayMaxEventRows={3}
                  eventContent={renderTrainingEvent}
                  eventClick={(info) => navigate(`/trainings/${info.event.id}`)}
                  headerToolbar={{ left: "prev,next", center: "title", right: "today" }}
                />
              </div>
              <div className="flex flex-wrap items-center gap-4 border-t border-gray-100 px-6 py-4">
                <span className="text-xs font-medium text-gray-400">Статусы:</span>
                {Object.entries(STATUS_LABELS).map(([key, meta]) => (
                  <span key={key} className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: CALENDAR_STATUS_COLORS[key] }}
                    />
                    {meta.label}
                  </span>
                ))}
                {calendarEvents.length === 0 && (
                  <span className="ml-auto text-xs text-gray-400">
                    Нет тренингов с датами — укажите период в редакторе тренинга.
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
      <>
      {/* ── Main card ────────────────────────────────────────────────────── */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 bg-slate-50/60 px-5 py-2.5 text-xs text-gray-500">
          {visibleRangeLabel}
        </div>

        <div className="max-w-full overflow-x-auto">
          <Table>
            <TableHeader className="border-b border-gray-100">
              <TableRow>
                <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                  Название
                </TableCell>
                <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                  Период
                </TableCell>
                <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                  Домашнее задание
                </TableCell>
                <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                  Статус
                </TableCell>
                <TableCell isHeader className="px-4 py-3 text-right text-theme-xs font-medium text-gray-500">
                  Действия
                </TableCell>
              </TableRow>
            </TableHeader>

            <TableBody className="divide-y divide-gray-100">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <TableRow key={`trainings-skeleton-${index}`}>
                    <TableCell className="px-4 py-4">
                      <div className="h-4 w-60 animate-pulse rounded bg-gray-200" />
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <div className="h-4 w-36 animate-pulse rounded bg-gray-200" />
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <div className="h-5 w-20 animate-pulse rounded-full bg-gray-200" />
                    </TableCell>
                    <TableCell className="px-4 py-4 text-right">
                      <div className="ml-auto h-4 w-16 animate-pulse rounded bg-gray-200" />
                    </TableCell>
                  </TableRow>
                ))
              ) : trainings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <GraduationCap size={36} className="text-gray-300" />
                      <p className="text-sm font-medium text-gray-500">Тренинги не найдены</p>
                      <p className="text-xs text-gray-400">
                        {hasActiveSearch ? "Попробуйте изменить запрос" : "Создайте первый тренинг"}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                trainings.map((training) => {
                  const status = resolveStatus(training);

                  return (
                    <TableRow key={training.guid} className="hover:bg-gray-50 transition-colors">
                      <TableCell className="px-4 py-3 text-sm text-gray-800">
                        <button
                          type="button"
                          onClick={() => navigate(`/trainings/${training.guid}`)}
                          className="text-left font-medium text-gray-800 transition hover:text-brand-500"
                        >
                          {String(training.title || "Без названия")}
                        </button>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-600">
                        {formatPeriod(training)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-600">
                        {training.homework_required ? "Требуется" : "—"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="relative flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => toggleActionsMenu(training.guid)}
                            className="dropdown-toggle rounded-md p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                            aria-label="Открыть действия"
                            ref={(el) => {
                              actionButtonRefs.current[training.guid] = el;
                            }}
                          >
                            <MoreHorizontal size={16} />
                          </button>

                          <Dropdown
                            isOpen={openActionsFor === training.guid}
                            onClose={() => setOpenActionsFor(null)}
                            className="w-40 p-1"
                            usePortal
                            anchorEl={actionButtonRefs.current[training.guid]}
                          >
                            <DropdownItem
                              onClick={() => navigate(`/trainings/${training.guid}`)}
                              className="rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-500"
                            >
                              Результаты
                            </DropdownItem>
                            <DropdownItem
                              onClick={() => navigate(`/trainings/${training.guid}/edit`)}
                              className="rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-500"
                            >
                              Изменить
                            </DropdownItem>
                            <DropdownItem
                              onClick={() => openDeleteModal(training)}
                              className="rounded-lg px-3 py-2 text-sm text-error-600 hover:bg-error-50 hover:text-error-700"
                            >
                              Удалить
                            </DropdownItem>
                          </Dropdown>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
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
      </>
      )}

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        showCloseButton={false}
        className="mx-4 w-full max-w-[340px] overflow-hidden rounded-2xl border border-gray-200 p-0 shadow-xl"
      >
        <div className="border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">Удалить тренинг</h3>
            <button
              type="button"
              onClick={closeDeleteModal}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              aria-label="Закрыть"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="space-y-3 px-4 py-4 text-center">
          <p className="text-sm text-gray-500">Это действие нельзя отменить.</p>
          <p className="text-sm text-gray-700">
            {trainingToDelete
              ? `Вы уверены, что хотите удалить "${String(trainingToDelete.title)}"?`
              : "Вы уверены, что хотите удалить этот тренинг?"}
          </p>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={closeDeleteModal}
              className="w-full justify-center px-3 py-2 text-sm"
            >
              Отмена
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleteMutation.isLoading}
              className="w-full justify-center bg-error-600 px-3 py-2 text-sm hover:bg-error-700"
            >
              {deleteMutation.isLoading ? "Удаление..." : "Удалить"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
