import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import type { StylesConfig } from "react-select";
import { Modal } from "../../../components/ui/modal";
import EmployeeInfiniteSelect from "../../../components/autocomplete/EmployeeInfiniteSelect";
import TimeInput from "../../../components/form/TimeInput";
import { ViewerTimeHint } from "../../../components/common/WallTime";
import companyStore from "../../../store/company.store";
import { COMPANY_ID, useCreateSettingsDirectoryItem } from "../../../api/services/settingsDirectory.service";
import hickvisionService, { type LatenessResult } from "../../../api/services/hickvision.service";
import { useShiftsQuery } from "../../../api/services/shift.service";
import { crossesMidnight, formatShiftTime, shiftKind, timeToMinutes } from "../../Shifts/constants";
import { useTranslation } from "../../../i18n";
import { useEmployeeTimeZones } from "../../../hooks/useEmployeeTimeZones";
import { nowInZone } from "../../../utils/wallClock";

// Ручная отметка HRMS: общая для «Списка» посещаемости и модалки дня в табеле.
// Только создание — правки существующей строки в интерфейсе нет.

type SelectOption = { value: string; label: string };

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DELAY_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const getEmployeeSelectStyles = (): StylesConfig<SelectOption, false> => ({
  control: (base, state) => ({
    ...base,
    minHeight: "40px",
    borderColor: state.isFocused ? "#cbd5e1" : "#e2e8f0",
    borderRadius: "0.5rem",
    boxShadow: "none",
    "&:hover": {
      borderColor: "#cbd5e1",
    },
  }),
  valueContainer: (base) => ({ ...base, padding: "0 10px", fontSize: "13px" }),
  input: (base) => ({ ...base, margin: 0, padding: 0, fontSize: "13px" }),
  indicatorsContainer: (base) => ({ ...base, height: "38px" }),
  option: (base, state) => ({
    ...base,
    fontSize: "13px",
    cursor: "pointer",
    backgroundColor: state.isSelected ? "#e2e8f0" : state.isFocused ? "#f8fafc" : "white",
    color: "#111827",
    padding: "8px 10px",
  }),
  menu: (base) => ({
    ...base,
    zIndex: 100000,
    borderRadius: "0.5rem",
    border: "1px solid #e5e7eb",
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 100000,
  }),
  singleValue: (base) => ({ ...base, fontSize: "13px" }),
  placeholder: (base) => ({ ...base, fontSize: "13px", color: "#94a3b8" }),
});

const normalizeTime = (value: string | null | undefined): string => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return TIME_PATTERN.test(trimmed) ? trimmed : "";
};

const normalizeDelayTimeForPayload = (value: string | null | undefined): string => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return DELAY_TIME_PATTERN.test(trimmed) ? trimmed : "00:00";
};

const toIsoDate = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseIsoDate = (value: string): Date | null => {
  if (!ISO_DATE_PATTERN.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  return parsed;
};

type Draft = {
  employeeGuid: string;
  date: Date | null;
  checkInTime: string;
  checkOutTime: string;
};

const nowClock = (): string => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
};

export type AttendanceMarkModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Дата формы по умолчанию, «ГГГГ-ММ-ДД». */
  defaultDate: string;
  /** Сотрудник заранее — из табеля; в «Списке» его выбирают в форме. */
  employee?: { guid: string; label: string };
  /**
   * Уже известные приход и уход дня. Ручная строка перекрывает строку
   * турникета целиком, поэтому чинить Missing Mark надо, сохранив и приход.
   */
  initialTimes?: { checkIn: string; checkOut: string };
  onSaved?: () => void;
};

export default function AttendanceMarkModal({
  isOpen,
  onClose,
  defaultDate,
  employee,
  initialTimes,
  onSaved,
}: AttendanceMarkModalProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<Draft>(() => ({
    employeeGuid: "",
    date: parseIsoDate(defaultDate) || new Date(),
    checkInTime: nowClock(),
    checkOutTime: "",
  }));
  const [formError, setFormError] = useState("");
  // «Сейчас» в форме ещё не правили руками — его можно пересобрать по часам
  // выбранного сотрудника (ADR-0014, п. 2).
  const [draftTimeIsDefault, setDraftTimeIsDefault] = useState(true);
  const createMutation = useCreateSettingsDirectoryItem("attendance");
  const isSaving = createMutation.isLoading;
  const brandColor = companyStore.mainColor;
  const menuPortalTarget = typeof document !== "undefined" ? document.body : undefined;

  // Каждое открытие — с чистого листа: сотрудник и времена из пропсов.
  useEffect(() => {
    if (!isOpen) return;
    setDraft({
      employeeGuid: employee?.guid ?? "",
      date: parseIsoDate(defaultDate) || new Date(),
      checkInTime: initialTimes ? initialTimes.checkIn : nowClock(),
      checkOutTime: initialTimes?.checkOut ?? "",
    });
    setDraftTimeIsDefault(!initialTimes);
    setFormError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const draftDate = draft.date ? toIsoDate(draft.date) : "";
  const draftZones = useEmployeeTimeZones([draft.employeeGuid], draftDate, draftDate);
  const draftZone = draft.employeeGuid ? draftZones.zoneOf(draft.employeeGuid, draftDate) : null;
  const draftTimeZone = draftZone?.timezone ?? "";

  // Сотрудника выбрали в открытой форме — «сейчас» и «сегодня» пересобираются
  // по его часам, пока админ не поправил поле руками.
  useEffect(() => {
    if (!isOpen || !draftTimeIsDefault || !draftTimeZone) return;
    const now = nowInZone(draftTimeZone);
    const defaultIsToday = defaultDate === toIsoDate(new Date());
    setDraft((prev) => ({
      ...prev,
      checkInTime: now.time,
      ...(defaultIsToday ? { date: parseIsoDate(now.date) } : {}),
    }));
  }, [isOpen, draftTimeIsDefault, draftTimeZone, defaultDate]);

  // Смена сотрудника на выбранную дату (решение 16): по ней форма показывает,
  // с чем сверяется опоздание, и понимает, что уход раньше прихода — это уже
  // следующие сутки ночной смены. Новая ручная отметка без смены не ставится.
  const draftShiftsQuery = useShiftsQuery(
    { from: draftDate, to: draftDate },
    isOpen && Boolean(draftDate) && Boolean(draft.employeeGuid)
  );
  const draftShift = useMemo(
    () => (draftShiftsQuery.data?.response ?? []).find((shift) => shift.user_base_id === draft.employeeGuid) ?? null,
    [draftShiftsQuery.data, draft.employeeGuid]
  );
  const draftShiftPending = draftShiftsQuery.isLoading || draftShiftsQuery.isFetching;
  const draftCheckOutNextDay = useMemo(() => {
    const checkIn = timeToMinutes(draft.checkInTime);
    const checkOut = timeToMinutes(draft.checkOutTime);
    if (checkOut == null) return false;
    if (checkIn != null) return checkOut <= checkIn;
    // Один уход: следующие сутки — только у ночной смены и раньше её начала.
    const start = timeToMinutes(draftShift?.start_time);
    return Boolean(draftShift && crossesMidnight(draftShift) && start != null && checkOut < start);
  }, [draft.checkInTime, draft.checkOutTime, draftShift]);

  const close = () => {
    if (isSaving) return;
    onClose();
  };

  const handleSave = async () => {
    const employeeGuid = String(draft.employeeGuid || "").trim();
    if (!employeeGuid) {
      setFormError(t("absence_calendar.validation.employee"));
      return;
    }

    if (!draft.date) {
      setFormError(t("attendance.validation.date"));
      return;
    }

    const checkInTime = normalizeTime(draft.checkInTime);
    const checkOutTime = normalizeTime(draft.checkOutTime);

    if (!checkInTime && !checkOutTime) {
      setFormError(t("attendance.validation.time"));
      return;
    }

    if (draftShiftPending) {
      setFormError(t("attendance.shift_loading"));
      return;
    }
    if (!draftShift) {
      setFormError(t("attendance.no_shift"));
      return;
    }

    const date = toIsoDate(draft.date);
    const companiesId = companyStore.company?.guid || COMPANY_ID;

    let lateness: LatenessResult;
    try {
      lateness = await hickvisionService.computeLateness({
        user_base_id: employeeGuid,
        companies_id: companiesId,
        date,
        check_in_time: checkInTime,
      });
    } catch (latenessError) {
      console.error("Attendance lateness error:", latenessError);
      setFormError(t("attendance.schedule_error"));
      return;
    }

    try {
      await createMutation.mutateAsync({
        user_base_id: employeeGuid,
        companies_id: companiesId,
        date,
        ...(checkInTime ? { check_in_time: checkInTime } : {}),
        ...(checkOutTime ? { check_out_time: checkOutTime } : {}),
        delay_time: normalizeDelayTimeForPayload(lateness.delay_time),
        status: ["accepted"],
        action_status: [lateness.action_status],
        source_type: ["manual"],
      });
      onSaved?.();
      onClose();
    } catch (saveError) {
      console.error("Attendance save error:", saveError);
      setFormError(t("attendance.save_error"));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={close} className="max-w-xl w-full p-0 overflow-visible">
      <div className="border-b border-slate-200 px-6 py-5">
        <h4 className="m-0 text-[22px] font-bold text-slate-900">{t("attendance.add_title")}</h4>
      </div>

      <div className="space-y-4 px-6 py-5">
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
            {t("absence_request.employee")}
          </label>
          <EmployeeInfiniteSelect
            value={draft.employeeGuid}
            onChange={(value) =>
              setDraft((prev) => ({
                ...prev,
                employeeGuid: value,
              }))
            }
            fallbackLabel={employee?.label ?? ""}
            placeholder={t("autocomplete.select_employee")}
            styles={getEmployeeSelectStyles()}
            menuPortalTarget={menuPortalTarget}
            classNamePrefix="attendance-employee-select"
          />
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
              {t("attendance.date")}
            </label>
            <DatePicker
              selected={draft.date}
              onChange={(date) => {
                setDraftTimeIsDefault(false);
                setDraft((prev) => ({
                  ...prev,
                  date,
                }));
              }}
              dateFormat="dd.MM.yyyy"
              placeholderText={t("common.date_placeholder")}
              showMonthDropdown
              showYearDropdown
              dropdownMode="select"
              wrapperClassName="w-full"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-slate-300"
            />
            {draft.employeeGuid && draftDate ? (
              draftShiftPending ? (
                <p className="mt-1 text-[12px] text-slate-400">{t("attendance.shift_loading")}</p>
              ) : draftShift ? (
                <p className="mt-1 text-[12px] font-medium text-slate-600">
                  {t("attendance.shift_of_day", { range: formatShiftTime(draftShift) })}
                  {shiftKind(draftShift) === "remote" ? ` · ${t("attendance.shift_remote")}` : ""}
                </p>
              ) : (
                <p className="mt-1 text-[12px] font-medium text-amber-700">
                  {t("attendance.no_shift")}{" "}
                  <Link to="/shifts" className="underline">{t("sidebar.work_schedule")}</Link>
                </p>
              )
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
              {t("attendance.check_in_time")}
            </label>
            <TimeInput
              value={draft.checkInTime}
              onChange={(next) => {
                setDraftTimeIsDefault(false);
                setDraft((prev) => ({
                  ...prev,
                  checkInTime: next,
                }));
              }}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-slate-300"
            />
            {draft.employeeGuid ? <ViewerTimeHint date={draftDate} time={draft.checkInTime} zones={draftZone ? [draftZone] : []} status={draftZones.status} /> : null}
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
              {t("attendance.check_out_time")}
              {draftCheckOutNextDay ? (
                <span className="ml-1.5 rounded-full bg-violet-50 px-1.5 py-0.5 text-[11px] font-semibold text-violet-700">
                  {t("attendance.next_day")}
                </span>
              ) : null}
            </label>
            <TimeInput
              value={draft.checkOutTime}
              onChange={(next) =>
                setDraft((prev) => ({
                  ...prev,
                  checkOutTime: next,
                }))
              }
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-slate-300"
            />
            {draft.employeeGuid ? <ViewerTimeHint date={draftDate} time={draft.checkOutTime} zones={draftZone ? [draftZone] : []} status={draftZones.status} /> : null}
          </div>
        </div>

        {formError ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-600">
            {formError}
          </div>
        ) : null}
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
        <button
          type="button"
          onClick={close}
          disabled={isSaving}
          className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t("common.cancel")}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="h-9 rounded-lg border border-transparent px-4 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ backgroundColor: brandColor }}
        >
          {isSaving ? t("common.saving") : t("common.save")}
        </button>
      </div>
    </Modal>
  );
}
