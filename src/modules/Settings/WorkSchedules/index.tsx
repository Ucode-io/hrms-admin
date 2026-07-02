import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useQuery, useQueryClient } from "react-query";
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
import reportsService, {
  type SaveWorkScheduleDayInput,
  type WorkSchedule,
  type WorkScheduleDay,
  type WorkScheduleDayCode,
} from "../../../api/services/reports.service";

const WORK_SCHEDULES_QUERY_KEY = "WORK_SCHEDULES";
const PAGE_SIZE = 20;

type DayDef = {
  code: WorkScheduleDayCode;
  label: string;
  defaultWorkStart: string;
  defaultWorkEnd: string;
  defaultLunchStart: string;
  defaultLunchEnd: string;
  defaultDayOff: boolean;
};

type DaySchedule = {
  code: WorkScheduleDayCode;
  label: string;
  workStart: string;
  workEnd: string;
  lunchStart: string;
  lunchEnd: string;
  isDayOff: boolean;
};

const DAY_DEFS: DayDef[] = [
  { code: "mon", label: "Понедельник", defaultWorkStart: "09:00", defaultWorkEnd: "18:00", defaultLunchStart: "13:00", defaultLunchEnd: "14:00", defaultDayOff: false },
  { code: "tue", label: "Вторник", defaultWorkStart: "09:00", defaultWorkEnd: "18:00", defaultLunchStart: "13:00", defaultLunchEnd: "14:00", defaultDayOff: false },
  { code: "wed", label: "Среда", defaultWorkStart: "09:00", defaultWorkEnd: "18:00", defaultLunchStart: "13:00", defaultLunchEnd: "14:00", defaultDayOff: false },
  { code: "thu", label: "Четверг", defaultWorkStart: "09:00", defaultWorkEnd: "18:00", defaultLunchStart: "13:00", defaultLunchEnd: "14:00", defaultDayOff: false },
  { code: "fri", label: "Пятница", defaultWorkStart: "09:00", defaultWorkEnd: "18:00", defaultLunchStart: "13:00", defaultLunchEnd: "14:00", defaultDayOff: false },
  { code: "sat", label: "Суббота", defaultWorkStart: "", defaultWorkEnd: "", defaultLunchStart: "", defaultLunchEnd: "", defaultDayOff: true },
  { code: "sun", label: "Воскресенье", defaultWorkStart: "", defaultWorkEnd: "", defaultLunchStart: "", defaultLunchEnd: "", defaultDayOff: true },
];

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const timeToMinutes = (value: string): number | null => {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
};

const roundHours = (value: number): number => Math.round(value * 10) / 10;

// Mirrors computeDayHours in udevs-hrms-reports/src/methods/work-schedules-common.js
const computeDayHours = (day: DaySchedule): { workHours: number; breakHours: number } => {
  if (day.isDayOff) return { workHours: 0, breakHours: 0 };

  const start = timeToMinutes(day.workStart);
  const end = timeToMinutes(day.workEnd);
  if (start == null || end == null || end <= start) {
    return { workHours: 0, breakHours: 0 };
  }

  const lunchStart = timeToMinutes(day.lunchStart);
  const lunchEnd = timeToMinutes(day.lunchEnd);
  let breakMinutes = 0;
  if (lunchStart != null && lunchEnd != null && lunchEnd > lunchStart) {
    breakMinutes = lunchEnd - lunchStart;
  }

  const workMinutes = Math.max(0, end - start - breakMinutes);
  return { workHours: roundHours(workMinutes / 60), breakHours: roundHours(breakMinutes / 60) };
};

const formatHours = (value: number): string => value.toFixed(1);

const formatHoursWithComma = (value: number): string => value.toFixed(1).replace(".", ",");

const buildDefaultDays = (): DaySchedule[] =>
  DAY_DEFS.map((day) => ({
    code: day.code,
    label: day.label,
    workStart: day.defaultWorkStart,
    workEnd: day.defaultWorkEnd,
    lunchStart: day.defaultLunchStart,
    lunchEnd: day.defaultLunchEnd,
    isDayOff: day.defaultDayOff,
  }));

const resolveDaysFromSchedule = (schedule: WorkSchedule): DaySchedule[] => {
  const byCode = new Map<WorkScheduleDayCode, WorkScheduleDay>();
  for (const day of schedule.days || []) {
    if (day?.day) byCode.set(day.day, day);
  }

  return DAY_DEFS.map((def) => {
    const matched = byCode.get(def.code);
    if (!matched) {
      return {
        code: def.code,
        label: def.label,
        workStart: "",
        workEnd: "",
        lunchStart: "",
        lunchEnd: "",
        isDayOff: true,
      };
    }

    return {
      code: def.code,
      label: def.label,
      workStart: matched.work_start_time || "",
      workEnd: matched.work_end_time || "",
      lunchStart: matched.lunch_start_time || "",
      lunchEnd: matched.lunch_end_time || "",
      isDayOff: Boolean(matched.is_day_off) || !matched.work_start_time || !matched.work_end_time,
    };
  });
};

const sumWorkHours = (days: DaySchedule[]): number =>
  roundHours(days.reduce((total, day) => total + computeDayHours(day).workHours, 0));

function TimeField({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  onChange: (next: string) => void;
}) {
  return (
    <input
      type="time"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 w-[110px] rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-sm font-semibold text-gray-700 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 disabled:cursor-not-allowed disabled:opacity-50"
    />
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
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingItem, setEditingItem] = useState<WorkSchedule | null>(null);
  const [itemToDelete, setItemToDelete] = useState<WorkSchedule | null>(null);
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

  const { data, isLoading, isFetching } = useQuery(
    [WORK_SCHEDULES_QUERY_KEY, currentPage, debouncedSearch],
    () =>
      reportsService.getWorkSchedules({
        limit: PAGE_SIZE,
        offset: (currentPage - 1) * PAGE_SIZE,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      }),
    { keepPreviousData: true }
  );

  const items = data?.schedules || [];
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

  const loadEditData = async (item: WorkSchedule) => {
    setIsModalLoading(true);

    try {
      const result = await reportsService.getWorkSchedules({ guid: item.guid });
      const schedule = result.schedules[0] || item;

      setEditingItem(schedule);
      setTitle(schedule.title || "");
      setIsRemote(Boolean(schedule.is_remote));
      setDays(resolveDaysFromSchedule(schedule));
    } catch (error) {
      console.error("Failed to load work schedule details:", error);
      toast.error("Не удалось загрузить данные графика.");
      setEditingItem(item);
      setTitle(item.title || "");
      setIsRemote(Boolean(item.is_remote));
      setDays(resolveDaysFromSchedule(item));
    } finally {
      setIsModalLoading(false);
    }
  };

  const openEditModal = (item: WorkSchedule) => {
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

  const updateDayValue = (
    dayCode: WorkScheduleDayCode,
    field: "workStart" | "workEnd" | "lunchStart" | "lunchEnd",
    value: string
  ) => {
    setDays((prev) =>
      prev.map((day) => (day.code === dayCode ? { ...day, [field]: value } : day))
    );
  };

  const toggleDayOff = (dayCode: WorkScheduleDayCode) => {
    setDays((prev) =>
      prev.map((day) => {
        if (day.code !== dayCode) return day;
        const nextDayOff = !day.isDayOff;
        if (nextDayOff) {
          return { ...day, isDayOff: true };
        }
        const def = DAY_DEFS.find((d) => d.code === dayCode);
        return {
          ...day,
          isDayOff: false,
          workStart: day.workStart || def?.defaultWorkStart || "09:00",
          workEnd: day.workEnd || def?.defaultWorkEnd || "18:00",
          lunchStart: day.lunchStart || def?.defaultLunchStart || "",
          lunchEnd: day.lunchEnd || def?.defaultLunchEnd || "",
        };
      })
    );
  };

  const handleSubmit = async () => {
    if (isModalLoading || isSaving) return;

    const preparedTitle = title.trim();
    if (!preparedTitle) {
      toast.error("Название графика обязательно.");
      return;
    }

    const invalidDay = days.find((day) => {
      if (day.isDayOff) return false;
      const start = timeToMinutes(day.workStart);
      const end = timeToMinutes(day.workEnd);
      return start == null || end == null || end <= start;
    });

    if (invalidDay) {
      toast.error(`${invalidDay.label}: конец рабочего дня должен быть позже начала.`);
      return;
    }

    const payloadDays: SaveWorkScheduleDayInput[] = days.map((day) => ({
      day: day.code,
      is_day_off: day.isDayOff,
      work_start_time: day.isDayOff ? null : day.workStart || null,
      work_end_time: day.isDayOff ? null : day.workEnd || null,
      lunch_start_time: day.isDayOff ? null : day.lunchStart || null,
      lunch_end_time: day.isDayOff ? null : day.lunchEnd || null,
    }));

    setIsSaving(true);

    try {
      await reportsService.saveWorkSchedule({
        ...(editingItem ? { guid: editingItem.guid } : {}),
        title: preparedTitle,
        is_remote: isRemote,
        days: payloadDays,
      });

      toast.success(editingItem ? "Рабочий график обновлен." : "Рабочий график создан.");
      closeUpsertModal();

      await queryClient.invalidateQueries([WORK_SCHEDULES_QUERY_KEY]);
    } catch (error) {
      console.error("Failed to save work schedule:", error);
      toast.error("Не удалось сохранить рабочий график.");
    } finally {
      setIsSaving(false);
    }
  };

  const openDeleteModal = (item: WorkSchedule) => {
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

    setIsDeleting(true);
    try {
      await reportsService.deleteWorkSchedule(itemToDelete.guid);
      toast.success("Рабочий график удален.");
      closeDeleteModal();
      await queryClient.invalidateQueries([WORK_SCHEDULES_QUERY_KEY]);
    } catch (error) {
      console.error("Failed to delete work schedule:", error);
      toast.error("Не удалось удалить рабочий график.");
    } finally {
      setIsDeleting(false);
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
                            <span className="font-semibold">{item.title || "Без названия"}</span>
                            {item.is_remote && (
                              <span className="inline-flex items-center rounded-md border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
                                Удаленно
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
        className="mx-4 w-full max-w-[980px] overflow-hidden rounded-2xl border border-gray-200 shadow-xl"
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

                <div className="max-h-[460px] overflow-y-auto">
                  <table className="min-w-full">
                    <thead className="border-b border-gray-200 bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Будний день</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Начало</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Конец</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Обед с</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Обед по</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Часов</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Выходной</th>
                      </tr>
                    </thead>
                    <tbody>
                      {days.map((day) => {
                        const { workHours } = computeDayHours(day);
                        return (
                          <tr key={day.code} className="border-b border-gray-100 last:border-b-0">
                            <td className="px-3 py-2 text-sm font-semibold text-gray-900">{day.label}</td>
                            <td className="px-3 py-2">
                              <TimeField
                                value={day.workStart}
                                disabled={day.isDayOff}
                                onChange={(next) => updateDayValue(day.code, "workStart", next)}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <TimeField
                                value={day.workEnd}
                                disabled={day.isDayOff}
                                onChange={(next) => updateDayValue(day.code, "workEnd", next)}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <TimeField
                                value={day.lunchStart}
                                disabled={day.isDayOff}
                                onChange={(next) => updateDayValue(day.code, "lunchStart", next)}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <TimeField
                                value={day.lunchEnd}
                                disabled={day.isDayOff}
                                onChange={(next) => updateDayValue(day.code, "lunchEnd", next)}
                              />
                            </td>
                            <td className="px-3 py-2 text-sm font-semibold text-gray-700">
                              {day.isDayOff ? "—" : `${formatHoursWithComma(workHours)} ч`}
                            </td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() => toggleDayOff(day.code)}
                                aria-label="Выходной день"
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
                                  day.isDayOff ? "bg-brand-500" : "bg-gray-200"
                                }`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                    day.isDayOff ? "translate-x-4" : "translate-x-1"
                                  }`}
                                />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="border-t border-gray-200 bg-gray-50">
                      <tr>
                        <td className="px-3 py-2 text-xs font-semibold text-gray-500" colSpan={5}>
                          Общее
                        </td>
                        <td className="px-3 py-2 text-xs font-semibold text-gray-700">
                          {formatHoursWithComma(totalWorkedInModal)} ч
                        </td>
                        <td className="px-3 py-2" />
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
              ? `Вы уверены, что хотите удалить "${itemToDelete.title}"?`
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
              disabled={isDeleting}
              className="w-full justify-center bg-error-600 px-3 py-2 text-sm hover:bg-error-700"
            >
              {isDeleting ? "Удаление..." : "Удалить"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
