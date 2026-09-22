import { useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import PageMeta from "../../../../components/common/PageMeta";
import DateInput from "../../../../components/form/DateInput";
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
import { useTranslation } from "../../../../i18n";
import type { MessageKey } from "../../../../i18n/messages";

type CalendarCell = {
  key: string;
  day: number | null;
  dateKey: string | null;
};

const MONTH_NAME_KEYS: MessageKey[] = [
  "settings_holiday_policies.month_january",
  "settings_holiday_policies.month_february",
  "settings_holiday_policies.month_march",
  "settings_holiday_policies.month_april",
  "settings_holiday_policies.month_may",
  "settings_holiday_policies.month_june",
  "settings_holiday_policies.month_july",
  "settings_holiday_policies.month_august",
  "settings_holiday_policies.month_september",
  "settings_holiday_policies.month_october",
  "settings_holiday_policies.month_november",
  "settings_holiday_policies.month_december",
];

const WEEKDAY_SHORT_KEYS: MessageKey[] = [
  "settings_holiday_policies.weekday_mon",
  "settings_holiday_policies.weekday_tue",
  "settings_holiday_policies.weekday_wed",
  "settings_holiday_policies.weekday_thu",
  "settings_holiday_policies.weekday_fri",
  "settings_holiday_policies.weekday_sat",
  "settings_holiday_policies.weekday_sun",
];

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
  const { t } = useTranslation();
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
      toast.error(t("settings_holiday_policies.title_required"));
      return;
    }

    if (!preparedDate) {
      toast.error(t("settings_holiday_policies.date_required"));
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
        toast.success(t("settings_holiday_policies.holiday_updated"));
      } else {
        await createDayMutation.mutateAsync(payload);
        toast.success(t("settings_holiday_policies.holiday_added"));
      }
      closeHolidayModal();
    } catch (error) {
      console.error("Failed to save holiday day:", error);
      toast.error(t("settings_holiday_policies.holiday_save_error"));
    }
  };

  const handleHolidayDelete = async () => {
    if (!editingHoliday) return;

    try {
      await deleteDayMutation.mutateAsync({
        guid: editingHoliday.guid,
        policyGuid,
      });
      toast.success(t("settings_holiday_policies.holiday_deleted"));
      closeHolidayModal();
    } catch (error) {
      console.error("Failed to delete holiday day:", error);
      toast.error(t("settings_holiday_policies.holiday_delete_error"));
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
      toast.error(t("settings_holiday_policies.title_required"));
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
      toast.success(t("settings_holiday_policies.policy_updated"));
      closePolicyEditModal();
    } catch (error) {
      console.error("Failed to update holiday policy:", error);
      toast.error(t("settings_holiday_policies.policy_update_error"));
    }
  };

  const handlePolicyDelete = async () => {
    if (!policy) return;

    try {
      await deletePolicyMutation.mutateAsync(policy.guid);
      toast.success(t("settings_holiday_policies.policy_deleted"));
      navigate("/settings/holiday-policies");
    } catch (error) {
      console.error("Failed to delete holiday policy:", error);
      toast.error(t("settings_holiday_policies.policy_delete_error"));
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
        {t("settings_holiday_policies.policy_id_missing")}
      </div>
    );
  }

  const policyTitleText = String(policy?.title || t("settings_holiday_policies.policy_default_title"));

  return (
    <>
      <PageMeta title={t("settings_holiday_policies.page_title")} description={t("settings_holiday_policies.page_description")} />

      <div className="space-y-4">
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
              aria-label={t("settings_holiday_policies.prev_year")}
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
              aria-label={t("settings_holiday_policies.next_year")}
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
                aria-label={t("settings_holiday_policies.policy_actions")}
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
                  {t("settings_holiday_policies.edit_policy")}
                </DropdownItem>
                <DropdownItem
                  onClick={() => {
                    setIsPolicyDeleteModalOpen(true);
                    setIsActionsMenuOpen(false);
                  }}
                  className="rounded-lg px-3 py-2 text-sm text-error-600 hover:bg-error-50 hover:text-error-700"
                >
                  {t("settings_holiday_policies.delete_policy")}
                </DropdownItem>
              </Dropdown>
            </div>

            <Button className="h-10" startIcon={<Plus size={16} />} onClick={() => openCreateHolidayModal()}>
              {t("settings_holiday_policies.new_holiday")}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {MONTH_NAME_KEYS.map((monthKey, monthIndex) => {
            const monthLabel = t(monthKey);
            const cells = buildMonthCells(currentYear, monthIndex);
            return (
              <div
                key={`month-${currentYear}-${monthIndex}`}
                className="rounded-2xl border border-gray-200 bg-white p-4"
              >
                <h3 className="mb-3 text-center text-xl font-semibold text-gray-900">{monthLabel}</h3>

                <div className="mb-2 grid grid-cols-7 gap-1">
                  {WEEKDAY_SHORT_KEYS.map((dayKey) => (
                    <div
                      key={`${monthKey}-${dayKey}`}
                      className="py-1 text-center text-sm font-semibold text-gray-600"
                    >
                      {t(dayKey)}
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
                        title={holiday ? String(holiday.title || t("settings_holiday_policies.holiday_default_title")) : t("settings_holiday_policies.add_holiday")}
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
            {t("settings_holiday_policies.loading_holidays")}
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-2">
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm border border-[#86EFAC] bg-[#DCFCE7]" />
                {t("settings_holiday_policies.non_working_holidays")}
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm border border-[#FCD34D] bg-[#FEF9C3]" />
                {t("settings_holiday_policies.working_holidays")}
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm border border-[#93C5FD] bg-[#DBEAFE]" />
                {t("settings_holiday_policies.workday_transfers")}
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
            {editingHoliday ? t("settings_holiday_policies.edit_holiday") : t("settings_holiday_policies.add_holiday")}
          </h3>
          <button
            type="button"
            onClick={closeHolidayModal}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label={t("settings_holiday_policies.close")}
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
            {t("settings_holiday_policies.working_holiday_checkbox")}
          </label>

          <div className="space-y-2">
            <label htmlFor="holiday-title" className="block text-sm font-medium text-gray-700">
              {t("settings_holiday_policies.title")}
            </label>
            <input
              id="holiday-title"
              value={holidayTitle}
              onChange={(event) => setHolidayTitle(event.target.value)}
              placeholder={t("settings_holiday_policies.enter_title")}
              className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="holiday-date" className="block text-sm font-medium text-gray-700">
              {t("settings_holiday_policies.date")}
            </label>
            <DateInput
              id="holiday-date"
              value={holidayDate}
              onChange={setHolidayDate}
              className="h-11 w-full rounded-lg border border-gray-300 px-3 pr-10 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
            />
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={isWeekendTransfer}
                onChange={(event) => setIsWeekendTransfer(event.target.checked)}
                className="h-5 w-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500/30"
              />
              {t("settings_holiday_policies.weekend_transfer_checkbox")}
            </label>

            <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={isWorkdayTransfer}
                onChange={(event) => setIsWorkdayTransfer(event.target.checked)}
                className="h-5 w-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500/30"
              />
              {t("settings_holiday_policies.workday_transfer_checkbox")}
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
                {t("settings_holiday_policies.delete")}
              </Button>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={closeHolidayModal} className="min-w-[96px] px-3 py-2 text-sm">
              {t("settings_holiday_policies.cancel")}
            </Button>
            <Button onClick={handleHolidaySubmit} disabled={isHolidaySaving} className="min-w-[110px] px-3 py-2 text-sm">
              {isHolidaySaving ? t("settings_holiday_policies.saving") : t("settings_holiday_policies.save")}
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
          <h3 className="text-xl font-semibold text-gray-900">{t("settings_holiday_policies.edit_policy_title")}</h3>
          <button
            type="button"
            onClick={closePolicyEditModal}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label={t("settings_holiday_policies.close")}
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <div>
            <label htmlFor="policy-title" className="mb-1.5 block text-sm font-medium text-gray-700">
              {t("settings_holiday_policies.title")}
            </label>
            <input
              id="policy-title"
              value={policyTitle}
              onChange={(event) => setPolicyTitle(event.target.value)}
              placeholder={t("settings_holiday_policies.enter_title")}
              className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-4 py-3">
          <Button variant="outline" onClick={closePolicyEditModal} className="min-w-[96px] px-3 py-2 text-sm">
            {t("settings_holiday_policies.cancel")}
          </Button>
          <Button onClick={handlePolicySave} disabled={isPolicySaving} className="min-w-[110px] px-3 py-2 text-sm">
            {isPolicySaving ? t("settings_holiday_policies.saving") : t("settings_holiday_policies.save")}
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
            <h3 className="text-base font-semibold text-gray-900">{t("settings_holiday_policies.delete_policy_title")}</h3>
            <button
              type="button"
              onClick={() => setIsPolicyDeleteModalOpen(false)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              aria-label={t("settings_holiday_policies.close")}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="space-y-3 px-4 py-4 text-center">
          <p className="text-sm text-gray-500">
            {t("settings_holiday_policies.irreversible_action")}
          </p>
          <p className="text-sm text-gray-700">
            {t("settings_holiday_policies.confirm_delete_policy", { name: policyTitleText })}
          </p>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsPolicyDeleteModalOpen(false)}
              className="w-full justify-center px-3 py-2 text-sm"
            >
              {t("settings_holiday_policies.cancel")}
            </Button>
            <Button
              onClick={handlePolicyDelete}
              disabled={deletePolicyMutation.isLoading}
              className="w-full justify-center bg-error-600 px-3 py-2 text-sm hover:bg-error-700"
            >
              {deletePolicyMutation.isLoading ? t("settings_holiday_policies.deleting") : t("settings_holiday_policies.delete")}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
