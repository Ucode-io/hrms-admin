import { useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import PageMeta from "../../../../components/common/PageMeta";
import Button from "../../../../components/ui/button/Button";
import { Modal } from "../../../../components/ui/modal";
import { Dropdown } from "../../../../components/ui/dropdown/Dropdown";
import { DropdownItem } from "../../../../components/ui/dropdown/DropdownItem";
import {
  type HolidayPolicyDay,
  useCreateHolidayPolicyDay,
  useDeleteHolidayPolicy,
  useDeleteHolidayPolicyDay,
  useHolidayPolicyDaysQuery,
  useHolidayPolicyQuery,
  useUpdateHolidayPolicy,
  useUpdateHolidayPolicyDay,
} from "../../../../api/services/holidayPolicy.service";

type CalendarCell = {
  key: string;
  day: number | null;
  dateKey: string | null;
};

const MONTH_NAMES = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

const WEEKDAY_SHORT_NAMES = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const pad = (value: number): string => String(value).padStart(2, "0");

const toDateKey = (year: number, monthIndex: number, day: number): string => {
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
};

const getYearFromDateString = (value: string): number | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getFullYear();
};

const buildMonthCells = (year: number, monthIndex: number): CalendarCell[] => {
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const firstWeekdayIndex = (firstDay.getDay() + 6) % 7;

  const cells: CalendarCell[] = [];

  for (let index = 0; index < firstWeekdayIndex; index += 1) {
    cells.push({
      key: `blank-start-${year}-${monthIndex}-${index}`,
      day: null,
      dateKey: null,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      key: `day-${year}-${monthIndex}-${day}`,
      day,
      dateKey: toDateKey(year, monthIndex, day),
    });
  }

  while (cells.length % 7 !== 0) {
    const tailIndex = cells.length;
    cells.push({
      key: `blank-end-${year}-${monthIndex}-${tailIndex}`,
      day: null,
      dateKey: null,
    });
  }

  return cells;
};

const resolveHolidayTypeClassName = (holiday: HolidayPolicyDay): string => {
  if (holiday.is_workday_transfer) {
    return "border-[#93C5FD] bg-[#DBEAFE] text-[#1D4ED8]";
  }
  if (holiday.is_working_holiday) {
    return "border-[#FCD34D] bg-[#FEF9C3] text-[#A16207]";
  }
  return "border-[#86EFAC] bg-[#DCFCE7] text-[#15803D]";
};

export default function HolidayPolicyDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const policyGuid = String(id || "");
  const currentYearValue = new Date().getFullYear();
  const [currentYear, setCurrentYear] = useState(currentYearValue);

  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<HolidayPolicyDay | null>(null);
  const [holidayTitle, setHolidayTitle] = useState("");
  const [holidayDate, setHolidayDate] = useState("");
  const [isWorkingHoliday, setIsWorkingHoliday] = useState(false);
  const [isWeekendTransfer, setIsWeekendTransfer] = useState(false);
  const [isWorkdayTransfer, setIsWorkdayTransfer] = useState(false);

  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [isPolicyDeleteModalOpen, setIsPolicyDeleteModalOpen] = useState(false);
  const [policyTitle, setPolicyTitle] = useState("");

  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const actionButtonRef = useRef<HTMLButtonElement | null>(null);

  const { data: policy, isLoading: isPolicyLoading } = useHolidayPolicyQuery({
    guid: policyGuid,
    querySettings: {
      enabled: Boolean(policyGuid),
    },
  });
  const { data: policyDaysData, isLoading: isPolicyDaysLoading } = useHolidayPolicyDaysQuery({
    policyGuid,
    querySettings: {
      enabled: Boolean(policyGuid),
    },
  });

  const updatePolicyMutation = useUpdateHolidayPolicy();
  const deletePolicyMutation = useDeleteHolidayPolicy();
  const createDayMutation = useCreateHolidayPolicyDay();
  const updateDayMutation = useUpdateHolidayPolicyDay();
  const deleteDayMutation = useDeleteHolidayPolicyDay();

  const allPolicyDays = useMemo(() => policyDaysData?.response || [], [policyDaysData?.response]);

  const policyDaysInCurrentYear = useMemo(
    () =>
      allPolicyDays.filter((item) => {
        const dayYear = getYearFromDateString(String(item.date || ""));
        return dayYear === currentYear;
      }),
    [allPolicyDays, currentYear]
  );

  const policyDayByDate = useMemo(() => {
    return new Map(policyDaysInCurrentYear.map((item) => [String(item.date), item]));
  }, [policyDaysInCurrentYear]);

  const resetHolidayForm = () => {
    setHolidayTitle("");
    setHolidayDate("");
    setIsWorkingHoliday(false);
    setIsWeekendTransfer(false);
    setIsWorkdayTransfer(false);
  };

  const openCreateHolidayModal = (dateValue?: string) => {
    setEditingHoliday(null);
    resetHolidayForm();
    if (dateValue) {
      setHolidayDate(dateValue);
    } else {
      setHolidayDate(`${currentYear}-01-01`);
    }
    setIsHolidayModalOpen(true);
  };

  const openEditHolidayModal = (holiday: HolidayPolicyDay) => {
    setEditingHoliday(holiday);
    setHolidayTitle(String(holiday.title || ""));
    setHolidayDate(String(holiday.date || ""));
    setIsWorkingHoliday(Boolean(holiday.is_working_holiday));
    setIsWeekendTransfer(Boolean(holiday.is_weekend_transfer));
    setIsWorkdayTransfer(Boolean(holiday.is_workday_transfer));
    setIsHolidayModalOpen(true);
  };

  const closeHolidayModal = () => {
    setIsHolidayModalOpen(false);
    setEditingHoliday(null);
    resetHolidayForm();
  };

  const handleHolidaySubmit = async () => {
    const preparedTitle = holidayTitle.trim();
    const preparedDate = holidayDate.trim();

    if (!preparedTitle) {
      toast.error("Название обязательно.");
      return;
    }

    if (!preparedDate) {
      toast.error("Дата обязательна.");
      return;
    }

    const payload = {
      holiday_policies_id: policyGuid,
      title: preparedTitle,
      date: preparedDate,
      is_working_holiday: isWorkingHoliday,
      is_weekend_transfer: isWeekendTransfer,
      is_workday_transfer: isWorkdayTransfer,
    };

    try {
      if (editingHoliday) {
        await updateDayMutation.mutateAsync({
          guid: editingHoliday.guid,
          policyGuid,
          data: {
            ...editingHoliday,
            ...payload,
          },
        });
        toast.success("Праздник обновлен.");
      } else {
        await createDayMutation.mutateAsync(payload);
        toast.success("Праздник добавлен.");
      }
      closeHolidayModal();
    } catch (error) {
      console.error("Failed to save holiday day:", error);
      toast.error("Не удалось сохранить праздник.");
    }
  };

  const handleHolidayDelete = async () => {
    if (!editingHoliday) return;

    try {
      await deleteDayMutation.mutateAsync({
        guid: editingHoliday.guid,
        policyGuid,
      });
      toast.success("Праздник удален.");
      closeHolidayModal();
    } catch (error) {
      console.error("Failed to delete holiday day:", error);
      toast.error("Не удалось удалить праздник.");
    }
  };

  const openPolicyEditModal = () => {
    if (!policy) return;
    setPolicyTitle(String(policy.title || ""));
    setIsPolicyModalOpen(true);
    setIsActionsMenuOpen(false);
  };

  const closePolicyEditModal = () => {
    setIsPolicyModalOpen(false);
    setPolicyTitle("");
  };

  const handlePolicySave = async () => {
    if (!policy) return;
    const preparedTitle = policyTitle.trim();

    if (!preparedTitle) {
      toast.error("Название обязательно.");
      return;
    }

    try {
      await updatePolicyMutation.mutateAsync({
        guid: policy.guid,
        data: {
          ...policy,
          title: preparedTitle,
        },
      });
      toast.success("Политика обновлена.");
      closePolicyEditModal();
    } catch (error) {
      console.error("Failed to update holiday policy:", error);
      toast.error("Не удалось обновить политику.");
    }
  };

  const handlePolicyDelete = async () => {
    if (!policy) return;

    try {
      await deletePolicyMutation.mutateAsync(policy.guid);
      toast.success("Политика удалена.");
      navigate("/settings/holiday-policies");
    } catch (error) {
      console.error("Failed to delete holiday policy:", error);
      toast.error("Не удалось удалить политику.");
    }
  };

  const handleDayClick = (dateKey: string) => {
    const existing = policyDayByDate.get(dateKey);
    if (existing) {
      openEditHolidayModal(existing);
      return;
    }
    openCreateHolidayModal(dateKey);
  };

  const isHolidaySaving =
    createDayMutation.isLoading || updateDayMutation.isLoading || deleteDayMutation.isLoading;
  const isPolicySaving = updatePolicyMutation.isLoading;

  if (!policyGuid) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500">
        Идентификатор политики не указан.
      </div>
    );
  }

  const policyTitleText = String(policy?.title || "Политика праздников");

  return (
    <>
      <PageMeta title="Политика праздников | Настройки" description="Календарь праздничных дней" />

      <div className="space-y-4">
        <Link
          to="/settings/holiday-policies"
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-gray-700"
        >
          <ChevronLeft size={16} />
          Назад
        </Link>

        {isPolicyLoading ? (
          <div className="space-y-2">
            <div className="h-8 w-72 animate-pulse rounded bg-gray-200" />
            <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
          </div>
        ) : (
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold text-gray-900">
              {policyTitleText}
            </h1>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition hover:bg-gray-100"
              onClick={() => setCurrentYear((prev) => prev - 1)}
              aria-label="Предыдущий год"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              className="inline-flex h-8 items-center rounded-md px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
              onClick={() => setCurrentYear(currentYearValue)}
            >
              {currentYear}
            </button>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition hover:bg-gray-100"
              onClick={() => setCurrentYear((prev) => prev + 1)}
              aria-label="Следующий год"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                className="dropdown-toggle inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-700 transition hover:bg-gray-100"
                onClick={() => setIsActionsMenuOpen((prev) => !prev)}
                ref={actionButtonRef}
                aria-label="Действия политики"
              >
                <MoreHorizontal size={18} />
              </button>
              <Dropdown
                isOpen={isActionsMenuOpen}
                onClose={() => setIsActionsMenuOpen(false)}
                className="w-44 p-1"
                usePortal
                anchorEl={actionButtonRef.current}
              >
                <DropdownItem
                  onClick={openPolicyEditModal}
                  className="rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-500"
                >
                  Изменить политику
                </DropdownItem>
                <DropdownItem
                  onClick={() => {
                    setIsPolicyDeleteModalOpen(true);
                    setIsActionsMenuOpen(false);
                  }}
                  className="rounded-lg px-3 py-2 text-sm text-error-600 hover:bg-error-50 hover:text-error-700"
                >
                  Удалить политику
                </DropdownItem>
              </Dropdown>
            </div>

            <Button className="h-10" startIcon={<Plus size={16} />} onClick={() => openCreateHolidayModal()}>
              Новый праздник
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {MONTH_NAMES.map((monthLabel, monthIndex) => {
            const cells = buildMonthCells(currentYear, monthIndex);
            return (
              <div
                key={`month-${currentYear}-${monthIndex}`}
                className="rounded-2xl border border-gray-200 bg-white p-4"
              >
                <h3 className="mb-3 text-center text-xl font-semibold text-gray-900">{monthLabel}</h3>

                <div className="mb-2 grid grid-cols-7 gap-1">
                  {WEEKDAY_SHORT_NAMES.map((dayLabel) => (
                    <div
                      key={`${monthLabel}-${dayLabel}`}
                      className="py-1 text-center text-sm font-semibold text-gray-600"
                    >
                      {dayLabel}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {cells.map((cell) => {
                    if (!cell.day || !cell.dateKey) {
                      return <div key={cell.key} className="h-9 rounded-md" />;
                    }

                    const holiday = policyDayByDate.get(cell.dateKey);
                    const hasHoliday = Boolean(holiday);

                    return (
                      <button
                        key={cell.key}
                        type="button"
                        onClick={() => handleDayClick(cell.dateKey as string)}
                        className={[
                          "h-9 rounded-md border text-sm font-medium transition",
                          hasHoliday
                            ? resolveHolidayTypeClassName(holiday as HolidayPolicyDay)
                            : "border-transparent text-gray-700 hover:border-gray-200 hover:bg-gray-50",
                        ].join(" ")}
                        title={holiday ? String(holiday.title || "Праздник") : "Добавить праздник"}
                      >
                        {cell.day}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {isPolicyDaysLoading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-500">
            Загрузка праздников...
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-2">
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm border border-[#86EFAC] bg-[#DCFCE7]" />
                Нерабочие праздники
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm border border-[#FCD34D] bg-[#FEF9C3]" />
                Рабочие праздники
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm border border-[#93C5FD] bg-[#DBEAFE]" />
                Дни отработок
              </span>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={isHolidayModalOpen}
        onClose={closeHolidayModal}
        showCloseButton={false}
        className="mx-4 w-full max-w-[920px] overflow-hidden rounded-2xl border border-gray-200 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3.5">
          <h3 className="text-2xl font-semibold text-gray-900">
            {editingHoliday ? "Изменить праздник" : "Добавить праздник"}
          </h3>
          <button
            type="button"
            onClick={closeHolidayModal}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label="Закрыть"
          >
            <X size={22} />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={isWorkingHoliday}
              onChange={(event) => setIsWorkingHoliday(event.target.checked)}
              className="h-5 w-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500/30"
            />
            Рабочий праздник
          </label>

          <div className="space-y-2">
            <label htmlFor="holiday-title" className="block text-sm font-medium text-gray-700">
              Название
            </label>
            <input
              id="holiday-title"
              value={holidayTitle}
              onChange={(event) => setHolidayTitle(event.target.value)}
              placeholder="Введите название"
              className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="holiday-date" className="block text-sm font-medium text-gray-700">
              Дата
            </label>
            <div className="relative">
              <CalendarDays
                size={18}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                id="holiday-date"
                type="date"
                value={holidayDate}
                onChange={(event) => setHolidayDate(event.target.value)}
                className="h-11 w-full rounded-lg border border-gray-300 px-3 pr-10 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={isWeekendTransfer}
                onChange={(event) => setIsWeekendTransfer(event.target.checked)}
                className="h-5 w-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500/30"
              />
              Перенос выходного дня
            </label>

            <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={isWorkdayTransfer}
                onChange={(event) => setIsWorkdayTransfer(event.target.checked)}
                className="h-5 w-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500/30"
              />
              Перенос рабочего дня
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
          <div>
            {editingHoliday ? (
              <Button
                variant="outline"
                className="border-error-200 text-error-600 hover:bg-error-50"
                onClick={handleHolidayDelete}
                disabled={isHolidaySaving}
              >
                Удалить
              </Button>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={closeHolidayModal} className="min-w-[96px] px-3 py-2 text-sm">
              Отмена
            </Button>
            <Button onClick={handleHolidaySubmit} disabled={isHolidaySaving} className="min-w-[110px] px-3 py-2 text-sm">
              {isHolidaySaving ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isPolicyModalOpen}
        onClose={closePolicyEditModal}
        showCloseButton={false}
        className="mx-4 w-full max-w-[620px] overflow-hidden rounded-2xl border border-gray-200 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3.5">
          <h3 className="text-xl font-semibold text-gray-900">Изменить политику праздников</h3>
          <button
            type="button"
            onClick={closePolicyEditModal}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <div>
            <label htmlFor="policy-title" className="mb-1.5 block text-sm font-medium text-gray-700">
              Название
            </label>
            <input
              id="policy-title"
              value={policyTitle}
              onChange={(event) => setPolicyTitle(event.target.value)}
              placeholder="Введите название"
              className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-4 py-3">
          <Button variant="outline" onClick={closePolicyEditModal} className="min-w-[96px] px-3 py-2 text-sm">
            Отмена
          </Button>
          <Button onClick={handlePolicySave} disabled={isPolicySaving} className="min-w-[110px] px-3 py-2 text-sm">
            {isPolicySaving ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={isPolicyDeleteModalOpen}
        onClose={() => setIsPolicyDeleteModalOpen(false)}
        showCloseButton={false}
        className="mx-4 w-full max-w-[340px] overflow-hidden rounded-2xl border border-gray-200 p-0 shadow-xl"
      >
        <div className="border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">Удалить политику</h3>
            <button
              type="button"
              onClick={() => setIsPolicyDeleteModalOpen(false)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              aria-label="Закрыть"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="space-y-3 px-4 py-4 text-center">
          <p className="text-sm text-gray-500">
            Это действие нельзя отменить.
          </p>
          <p className="text-sm text-gray-700">
            {`Вы уверены, что хотите удалить "${policyTitleText}"?`}
          </p>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsPolicyDeleteModalOpen(false)}
              className="w-full justify-center px-3 py-2 text-sm"
            >
              Отмена
            </Button>
            <Button
              onClick={handlePolicyDelete}
              disabled={deletePolicyMutation.isLoading}
              className="w-full justify-center bg-error-600 px-3 py-2 text-sm hover:bg-error-700"
            >
              {deletePolicyMutation.isLoading ? "Удаление..." : "Удалить"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
