import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useQueryClient } from "react-query";
import {
  MoreHorizontal,
  Plus,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import PageMeta from "../../../components/common/PageMeta";
import Button from "../../../components/ui/button/Button";
import { Modal } from "../../../components/ui/modal";
import { Dropdown } from "../../../components/ui/dropdown/Dropdown";
import { DropdownItem } from "../../../components/ui/dropdown/DropdownItem";
import Pagination from "../../../components/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import httpRequest from "../../../api/httpRequest";
import settingsDirectoryService, {
  type SettingsDirectoryItem,
  useDeleteSettingsDirectoryItem,
  useSettingsDirectoryQuery,
} from "../../../api/services/settingsDirectory.service";

const WORK_SCHEDULE_SLUG = "work_schedule";
const WORK_SCHEDULE_DAYS_SLUG = "work_schedule_days";
const PAGE_SIZE = 20;

type UnknownRecord = Record<string, unknown>;

type DayDef = {
  key: string;
  code: string;
  label: string;
  defaultWork: number;
};

type DaySchedule = {
  key: string;
  code: string;
  label: string;
  breakHours: number;
  workHours: number;
  guid?: string;
};

type WorkScheduleItem = SettingsDirectoryItem & {
  total_work_hours?: number;
  total_break_hours?: number;
  is_default?: boolean;
  default?: boolean;
};

type WorkScheduleDayItem = {
  guid: string;
  day?: string[] | string;
  break_hours?: number;
  work_hours?: number;
  work_schedule_id?: string;
  [key: string]: unknown;
};

const DAY_DEFS: DayDef[] = [
  { key: "monday", code: "mon", label: "Понедельник", defaultWork: 8 },
  { key: "tuesday", code: "tue", label: "Вторник", defaultWork: 8 },
  { key: "wednesday", code: "wed", label: "Среда", defaultWork: 8 },
  { key: "thursday", code: "thu", label: "Четверг", defaultWork: 8 },
  { key: "friday", code: "fri", label: "Пятница", defaultWork: 8 },
  { key: "saturday", code: "sat", label: "Суббота", defaultWork: 0 },
  { key: "sunday", code: "sun", label: "Воскресенье", defaultWork: 0 },
];

const HOURS_STEP = 0.5;
const MIN_HOURS = 0;
const MAX_HOURS = 24;

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clampHours = (value: number): number => {
  const rounded = Math.round(value * 2) / 2;
  return Math.max(MIN_HOURS, Math.min(MAX_HOURS, rounded));
};

const formatHours = (value: number): string => {
  return value.toFixed(1);
};

const formatHoursWithComma = (value: number): string => {
  return value.toFixed(1).replace(".", ",");
};

const buildDefaultDays = (): DaySchedule[] => {
  return DAY_DEFS.map((day) => ({
    key: day.key,
    code: day.code,
    label: day.label,
    breakHours: 0,
    workHours: day.defaultWork,
  }));
};

const sumBreakHours = (days: DaySchedule[]): number => {
  return days.reduce((total, day) => total + day.breakHours, 0);
};

const sumWorkHours = (days: DaySchedule[]): number => {
  return days.reduce((total, day) => total + day.workHours, 0);
};

const isDefaultSchedule = (item: WorkScheduleItem): boolean => {
  return Boolean(item.is_default ?? item.default ?? (item as UnknownRecord).by_default);
};

const normalizeDayCode = (value: unknown): string => {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
};

const resolveDaysFromRecords = (records: WorkScheduleDayItem[]): DaySchedule[] => {
  const defaults = buildDefaultDays();

  return defaults.map((defaultDay) => {
    const matched = records.find((record) => normalizeDayCode(record.day) === defaultDay.code);
    if (!matched) return defaultDay;

    return {
      ...defaultDay,
      guid: typeof matched.guid === "string" ? matched.guid : undefined,
      breakHours: clampHours(toNumber(matched.break_hours, defaultDay.breakHours)),
      workHours: clampHours(toNumber(matched.work_hours, defaultDay.workHours)),
    };
  });
};

const extractGuidFromResponse = (response: unknown): string | null => {
  if (!response || typeof response !== "object") return null;

  const asRecord = response as UnknownRecord;
  if (typeof asRecord.guid === "string" && asRecord.guid) {
    return asRecord.guid;
  }

  const nested = asRecord.response;
  if (nested && typeof nested === "object") {
    const nestedGuid = (nested as UnknownRecord).guid;
    if (typeof nestedGuid === "string" && nestedGuid) {
      return nestedGuid;
    }
  }

  return null;
};

const createWorkScheduleDay = (payload: {
  day: string[];
  break_hours: number;
  work_hours: number;
  work_schedule_id: string;
}) => {
  return httpRequest.post(`/v2/items/${WORK_SCHEDULE_DAYS_SLUG}`, { data: payload });
};

const updateWorkScheduleDay = (
  guid: string,
  payload: {
    id: string;
    guid: string;
    day: string[];
    break_hours: number;
    work_hours: number;
    work_schedule_id: string;
  }
) => {
  return httpRequest.put(`/v2/items/${WORK_SCHEDULE_DAYS_SLUG}/${guid}`, { data: payload });
};

function HoursControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5">
      <span className="min-w-[40px] text-left text-sm font-semibold leading-none text-gray-700">
        {formatHoursWithComma(value)}
      </span>
      <span className="text-sm font-semibold text-gray-500">час</span>
      <div className="inline-flex overflow-hidden rounded-md border border-gray-200 bg-white">
        <button
          type="button"
          onClick={() => onChange(clampHours(value - HOURS_STEP))}
          className="inline-flex h-7 w-7 items-center justify-center text-gray-500 transition hover:bg-gray-100"
          aria-label="Уменьшить"
        >
          -
        </button>
        <button
          type="button"
          onClick={() => onChange(clampHours(value + HOURS_STEP))}
          className="inline-flex h-7 w-7 items-center justify-center border-l border-gray-200 text-gray-500 transition hover:bg-gray-100"
          aria-label="Увеличить"
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function WorkSchedulesSettingsPage() {
  const queryClient = useQueryClient();

  const [currentPage, setCurrentPage] = useState(1);
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [isUpsertModalOpen, setIsUpsertModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<WorkScheduleItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<WorkScheduleItem | null>(null);
  const [title, setTitle] = useState("");
  const [days, setDays] = useState<DaySchedule[]>(buildDefaultDays());
  const [isRemote, setIsRemote] = useState(false);
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

  const queryParams = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset: (currentPage - 1) * PAGE_SIZE,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    }),
    [currentPage, debouncedSearch]
  );

  const { data, isLoading, isFetching } = useSettingsDirectoryQuery({
    slug: WORK_SCHEDULE_SLUG,
    params: queryParams,
  });
  const deleteMutation = useDeleteSettingsDirectoryItem(WORK_SCHEDULE_SLUG);

  const items = (data?.response || []) as WorkScheduleItem[];
  const totalCount = data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const visibleFrom = totalCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const visibleTo = Math.min(currentPage * PAGE_SIZE, totalCount);

  const resetForm = () => {
    setTitle("");
    setDays(buildDefaultDays());
    setIsRemote(false);
    setIsModalLoading(false);
  };

  const openCreateModal = () => {
    setEditingItem(null);
    resetForm();
    setIsUpsertModalOpen(true);
    setOpenActionsFor(null);
  };

  const loadEditData = async (item: WorkScheduleItem) => {
    setIsModalLoading(true);

    try {
      const [scheduleData, scheduleDaysData] = await Promise.all([
        settingsDirectoryService.getByGuid(WORK_SCHEDULE_SLUG, item.guid),
        settingsDirectoryService.getList(WORK_SCHEDULE_DAYS_SLUG, {
          limit: 100,
          offset: 0,
          work_schedule_id: item.guid,
        }),
      ]);

      const scheduleItem = ((scheduleData || item) as WorkScheduleItem);
      const dayRecords = (scheduleDaysData.response || []) as unknown as WorkScheduleDayItem[];

      setEditingItem(scheduleItem);
      setTitle(String(scheduleItem.title || ""));
      setIsRemote(
        Boolean(
          (scheduleItem as UnknownRecord).is_remote ??
            (scheduleItem as UnknownRecord).use_workday_time ??
            (scheduleItem as UnknownRecord).use_time_range ??
            (scheduleItem as UnknownRecord).has_time_range
        )
      );
      setDays(resolveDaysFromRecords(dayRecords));
    } catch (error) {
      console.error("Failed to load work schedule details:", error);
      toast.error("Не удалось загрузить данные графика.");
      setEditingItem(item);
      setTitle(String(item.title || ""));
      setDays(buildDefaultDays());
      setIsRemote(false);
    } finally {
      setIsModalLoading(false);
    }
  };

  const openEditModal = (item: WorkScheduleItem) => {
    setEditingItem(item);
    setIsUpsertModalOpen(true);
    setOpenActionsFor(null);
    void loadEditData(item);
  };

  const closeUpsertModal = () => {
    setIsUpsertModalOpen(false);
    setEditingItem(null);
    resetForm();
  };

  const updateDayValue = (dayKey: string, field: "breakHours" | "workHours", value: number) => {
    setDays((prev) =>
      prev.map((day) =>
        day.key === dayKey
          ? {
              ...day,
              [field]: value,
            }
          : day
      )
    );
  };

  const handleSubmit = async () => {
    if (isModalLoading || isSaving) return;

    const preparedTitle = title.trim();
    if (!preparedTitle) {
      toast.error("Название графика обязательно.");
      return;
    }

    const totalBreakHours = Number(sumBreakHours(days).toFixed(1));
    const totalWorkHours = Number(sumWorkHours(days).toFixed(1));

    setIsSaving(true);

    try {
      let workScheduleGuid = editingItem?.guid || "";

      if (editingItem) {
        await settingsDirectoryService.update(WORK_SCHEDULE_SLUG, editingItem.guid, {
          ...editingItem,
          title: preparedTitle,
          total_work_hours: totalWorkHours,
          total_break_hours: totalBreakHours,
          is_remote: isRemote,
        });
      } else {
        const createResponse = await settingsDirectoryService.create(WORK_SCHEDULE_SLUG, {
          title: preparedTitle,
          total_work_hours: totalWorkHours,
          total_break_hours: totalBreakHours,
          is_remote: isRemote,
        });

        const createdGuid = extractGuidFromResponse(createResponse);
        if (!createdGuid) {
          throw new Error("Work schedule guid not returned from create response");
        }
        workScheduleGuid = createdGuid;
      }

      if (!workScheduleGuid) {
        throw new Error("Work schedule guid is missing");
      }

      await Promise.all(
        days.map((day) => {
          const payload = {
            day: [day.code],
            break_hours: Number(day.breakHours.toFixed(1)),
            work_hours: Number(day.workHours.toFixed(1)),
            work_schedule_id: workScheduleGuid,
          };

          if (editingItem && day.guid) {
            return updateWorkScheduleDay(day.guid, {
              ...payload,
              id: day.guid,
              guid: day.guid,
            });
          }

          return createWorkScheduleDay(payload);
        })
      );

      toast.success(editingItem ? "Рабочий график обновлен." : "Рабочий график создан.");
      closeUpsertModal();

      await queryClient.invalidateQueries(["SETTINGS_DIRECTORY", WORK_SCHEDULE_SLUG]);
    } catch (error) {
      console.error("Failed to save work schedule:", error);
      toast.error("Не удалось сохранить рабочий график.");
    } finally {
      setIsSaving(false);
    }
  };

  const openDeleteModal = (item: WorkScheduleItem) => {
    setItemToDelete(item);
    setIsDeleteModalOpen(true);
    setOpenActionsFor(null);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setItemToDelete(null);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    try {
      await deleteMutation.mutateAsync(itemToDelete.guid);
      toast.success("Рабочий график удален.");
      closeDeleteModal();
    } catch (error) {
      console.error("Failed to delete work schedule:", error);
      toast.error("Не удалось удалить рабочий график.");
    }
  };

  const toggleActionsMenu = (guid: string) => {
    setOpenActionsFor((prev) => (prev === guid ? null : guid));
  };

  const totalWorkedInModal = sumWorkHours(days);

  return (
    <>
      <PageMeta title="Графики работы | Настройки" description="Управление рабочими графиками" />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold text-gray-900">Графики работы</h1>
          <Button className="h-11" startIcon={<Plus size={16} />} onClick={openCreateModal}>
            Добавить
          </Button>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 p-4">
            <label className="relative block">
              <Search
                size={18}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Поиск..."
                className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-11 pr-4 text-sm text-gray-700 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
              />
            </label>
          </div>

          <div className="px-4 py-3 text-sm font-medium text-gray-500">
            Отображение {visibleFrom} - {visibleTo} из {totalCount}
          </div>

          {isFetching && <div className="px-4 pb-2 text-xs text-gray-400">Обновление...</div>}

          <div className="max-w-full overflow-x-auto border-t border-gray-100">
            <Table>
              <TableHeader className="border-b border-gray-100">
                <TableRow>
                  <TableCell isHeader className="min-w-[280px] px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                    Название
                  </TableCell>
                  <TableCell isHeader className="min-w-[220px] px-4 py-3 text-right text-theme-xs font-medium text-gray-500">
                    Перерывы еженедельно (часов)
                  </TableCell>
                  <TableCell isHeader className="min-w-[240px] px-4 py-3 text-right text-theme-xs font-medium text-gray-500">
                    Работает еженедельно (часов)
                  </TableCell>
                  <TableCell isHeader className="px-4 py-3 text-right text-theme-xs font-medium text-gray-500">
                    Действия
                  </TableCell>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-gray-100">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <TableRow key={`work-schedule-skeleton-${index}`}>
                      <TableCell className="px-4 py-4">
                        <div className="h-4 w-44 animate-pulse rounded bg-gray-200" />
                      </TableCell>
                      <TableCell className="px-4 py-4 text-right">
                        <div className="ml-auto h-4 w-14 animate-pulse rounded bg-gray-200" />
                      </TableCell>
                      <TableCell className="px-4 py-4 text-right">
                        <div className="ml-auto h-4 w-14 animate-pulse rounded bg-gray-200" />
                      </TableCell>
                      <TableCell className="px-4 py-4 text-right">
                        <div className="ml-auto h-4 w-16 animate-pulse rounded bg-gray-200" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="px-4 py-10 text-center text-sm text-gray-500">
                      Графики работы не найдены
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => {
                    const weeklyBreaks = toNumber(item.total_break_hours, 0);
                    const weeklyWorked = toNumber(item.total_work_hours, 0);

                    return (
                      <TableRow key={item.guid} className="transition-colors hover:bg-gray-50">
                        <TableCell className="px-4 py-3 text-sm text-gray-900">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{String(item.title || "Без названия")}</span>
                            {isDefaultSchedule(item) && (
                              <span className="inline-flex items-center rounded-md border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
                                По умолчанию
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                          {formatHours(weeklyBreaks)}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                          {formatHours(weeklyWorked)}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="relative flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => toggleActionsMenu(item.guid)}
                              className="dropdown-toggle rounded-md p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                              aria-label="Открыть действия"
                              ref={(el) => {
                                actionButtonRefs.current[item.guid] = el;
                              }}
                            >
                              <MoreHorizontal size={16} />
                            </button>

                            <Dropdown
                              isOpen={openActionsFor === item.guid}
                              onClose={() => setOpenActionsFor(null)}
                              className="w-40 p-1"
                              usePortal
                              anchorEl={actionButtonRefs.current[item.guid]}
                            >
                              <DropdownItem
                                onClick={() => openEditModal(item)}
                                className="rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-500"
                              >
                                Изменить
                              </DropdownItem>
                              <DropdownItem
                                onClick={() => openDeleteModal(item)}
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

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            limit={PAGE_SIZE}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>

      <Modal
        isOpen={isUpsertModalOpen}
        onClose={closeUpsertModal}
        showCloseButton={false}
        className="mx-4 w-full max-w-[900px] overflow-hidden rounded-2xl border border-gray-200 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h3 className="text-xl font-semibold text-gray-900">
            {editingItem ? "Изменить рабочий график" : "Новый рабочий график"}
          </h3>
          <button
            type="button"
            onClick={closeUpsertModal}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 px-4 py-3">
          {isModalLoading ? (
            <div className="space-y-3">
              <div className="h-9 w-full animate-pulse rounded-lg bg-gray-100" />
              <div className="h-72 animate-pulse rounded-xl bg-gray-100" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label htmlFor="work-schedule-title" className="block text-sm font-medium text-gray-700">
                  Название
                </label>
                <input
                  id="work-schedule-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Введите название"
                  autoFocus
                  className="h-9 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
                />
              </div>

              <div className="rounded-xl border border-gray-200">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-3 py-2.5">
                  <h4 className="text-lg font-semibold text-gray-900">Рабочий график</h4>

                  <button
                    type="button"
                    onClick={() => setIsRemote((prev) => !prev)}
                    className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700"
                  >
                    Удаленно
                    <span
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
                        isRemote ? "bg-brand-500" : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                          isRemote ? "translate-x-4" : "translate-x-1"
                        }`}
                      />
                    </span>
                  </button>
                </div>

                <div className="max-h-[420px] overflow-y-auto">
                  <table className="min-w-full">
                    <thead className="border-b border-gray-200 bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Будний день</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Часы перерыва</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Отработанные часы</th>
                      </tr>
                    </thead>
                    <tbody>
                      {days.map((day) => (
                        <tr key={day.key} className="border-b border-gray-100 last:border-b-0">
                          <td className="px-3 py-2 text-sm font-semibold text-gray-900">{day.label}</td>
                          <td className="px-3 py-2">
                            <HoursControl
                              value={day.breakHours}
                              onChange={(next) => updateDayValue(day.key, "breakHours", next)}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <HoursControl
                              value={day.workHours}
                              onChange={(next) => updateDayValue(day.key, "workHours", next)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-gray-200 bg-gray-50">
                      <tr>
                        <td className="px-3 py-2 text-xs font-semibold text-gray-500">Общее</td>
                        <td className="px-3 py-2 text-xs font-semibold text-gray-500">-</td>
                        <td className="px-3 py-2 text-xs font-semibold text-gray-700">
                          {formatHoursWithComma(totalWorkedInModal)} час
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-4 py-2.5">
          <Button
            onClick={handleSubmit}
            disabled={isSaving || isModalLoading}
            className="min-w-[110px] px-3 py-2 text-sm"
          >
            {isSaving ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        showCloseButton={false}
        className="mx-4 w-full max-w-[340px] overflow-hidden rounded-2xl border border-gray-200 p-0 shadow-xl"
      >
        <div className="border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">Удалить график</h3>
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
            {itemToDelete
              ? `Вы уверены, что хотите удалить "${String(itemToDelete.title)}"?`
              : "Вы уверены, что хотите удалить этот график?"}
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
