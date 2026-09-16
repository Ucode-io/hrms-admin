// Форма смены.
//
// Сотрудник необязателен: пустое поле — это Open Shift, заявленная потребность
// без исполнителя, а не недозаполненный черновик. Поэтому «Количество человек»
// осмысленно только при пустом сотруднике: оно создаёт N одинаковых открытых
// слотов, а не пишется полем в одну запись.
//
// Повтора-переключателя нет: чипы дней недели видны всегда. Пустые чипы —
// каждый день диапазона; диапазон по умолчанию схлопнут в одну дату, поэтому
// обычное создание остаётся созданием одного дня.

import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "../../../components/ui/modal";
import {
  WEEKDAY_CHIPS,
  datesInRange,
  formatDateRu,
  fromIsoDate,
  normalizeTime,
} from "../constants";
import type { Shift, ShiftInput } from "../../../api/services/shift.service";
import type { ShiftEmployee } from "../types";

type Directory = { guid: string; title: string };

interface ShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Запись в правку; `null` — создание. */
  shift: Shift | null;
  /** Предзаполнение при создании кликом по пустой ячейке. */
  defaults: { date: string; employeeId: string | null };
  employees: ShiftEmployee[];
  positions: Directory[];
  locations: Directory[];
  projectSuggestions: string[];
  isSaving: boolean;
  isDeleting: boolean;
  error: string;
  onSubmit: (rows: ShiftInput[], guid: string | null) => void;
  onDelete: (guid: string) => void;
}

const inputClass =
  "h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-brand-300 disabled:bg-gray-50 disabled:text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:disabled:bg-gray-800";

const labelClass = "mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400";

const MAX_HEADCOUNT = 50;

export default function ShiftModal({
  isOpen,
  onClose,
  shift,
  defaults,
  employees,
  positions,
  locations,
  projectSuggestions,
  isSaving,
  isDeleting,
  error,
  onSubmit,
  onDelete,
}: ShiftModalProps) {
  const [employeeId, setEmployeeId] = useState("");
  const [headcount, setHeadcount] = useState("1");
  // «Время от–до» или «Часов в день»: второе задаёт длительность, не говоря,
  // когда именно работать. Заполнено всегда ровно одно из двух.
  const [timeMode, setTimeMode] = useState<"range" | "hours">("range");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [hours, setHours] = useState("8");
  const [dateFrom, setDateFrom] = useState(defaults.date);
  const [dateTo, setDateTo] = useState(defaults.date);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [positionId, setPositionId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [project, setProject] = useState("");
  const [comment, setComment] = useState("");
  const [formError, setFormError] = useState("");

  const isEditing = Boolean(shift?.guid);

  /**
   * Список сотрудников нужен форме ровно один раз — подставить должность и
   * локацию при открытии. В зависимостях эффекта ему делать нечего: react-query
   * отдаёт новый массив на каждом перезапросе (фокус окна, инвалидация после
   * сохранения), и форма сбрасывалась бы прямо под руками у человека.
   */
  const employeesRef = useRef(employees);
  employeesRef.current = employees;

  // Пересобираем при каждом открытии, иначе прошлый черновик всплывает поверх
  // новой записи.
  useEffect(() => {
    if (!isOpen) return;
    setFormError("");
    setHeadcount("1");
    setWeekdays([]);

    if (shift) {
      const savedHours = Number(shift.hours_per_day);
      const hasHours = Number.isFinite(savedHours) && savedHours > 0;
      setEmployeeId(shift.user_base_id ?? "");
      setTimeMode(hasHours ? "hours" : "range");
      setHours(hasHours ? String(savedHours) : "8");
      setStartTime(normalizeTime(shift.start_time) || "09:00");
      setEndTime(normalizeTime(shift.end_time) || "18:00");
      setDateFrom(shift.date);
      setDateTo(shift.date);
      setPositionId(shift.positions_id ?? "");
      setLocationId(shift.locations_id ?? "");
      setProject(shift.project ?? "");
      setComment(shift.comment ?? "");
      return;
    }

    // Создание: должность и локацию подставляем из карточки сотрудника, но
    // дальше они живут в смене — грид группирует по ним, а не по карточке.
    const employee = employeesRef.current.find((item) => item.id === defaults.employeeId);
    setEmployeeId(defaults.employeeId ?? "");
    setTimeMode("range");
    setStartTime("09:00");
    setEndTime("18:00");
    setHours("8");
    setDateFrom(defaults.date);
    setDateTo(defaults.date);
    setPositionId(employee?.positionId ?? "");
    setLocationId(employee?.locationId ?? "");
    setProject("");
    setComment("");
  }, [isOpen, shift, defaults]);

  /**
   * Дни недели, которые вообще встречаются в выбранном диапазоне.
   *
   * Чипы остальных гасим: иначе получается тупик — диапазон в один день,
   * человек отмечает субботу, и форма отказывается сохраняться, не показывая
   * выхода. Дешевле не пустить в невозможное состояние, чем ругаться на него.
   */
  const availableDows = useMemo(() => {
    const set = new Set<number>();
    if (!dateFrom) return set;
    const to = dateTo && dateTo >= dateFrom ? dateTo : dateFrom;
    datesInRange(dateFrom, to).forEach((iso) => set.add(fromIsoDate(iso).getDay()));
    return set;
  }, [dateFrom, dateTo]);

  // Сузили диапазон — отметки, которым больше нет соответствия, снимаем сами:
  // иначе они остались бы невидимо выбранными и снова блокировали сохранение.
  useEffect(() => {
    setWeekdays((current) => {
      const next = current.filter((dow) => availableDows.has(dow));
      return next.length === current.length ? current : next;
    });
  }, [availableDows]);

  const targetDates = useMemo(() => {
    if (!dateFrom) return [];
    const to = dateTo && dateTo >= dateFrom ? dateTo : dateFrom;
    const all = datesInRange(dateFrom, to);
    if (weekdays.length === 0) return all;
    return all.filter((iso) => weekdays.includes(fromIsoDate(iso).getDay()));
  }, [dateFrom, dateTo, weekdays]);

  const slots = employeeId ? 1 : Math.min(Math.max(Number(headcount) || 1, 1), MAX_HEADCOUNT);
  const plannedCount = targetDates.length * slots;

  const toggleWeekday = (dow: number) => {
    setWeekdays((current) =>
      current.includes(dow) ? current.filter((item) => item !== dow) : [...current, dow]
    );
  };

  const handleSubmit = () => {
    setFormError("");

    if (!dateFrom) {
      setFormError("Укажите дату начала.");
      return;
    }
    if (targetDates.length === 0) {
      setFormError("В выбранном диапазоне нет ни одного из отмеченных дней недели.");
      return;
    }
    const hoursValue = Number(hours);
    const usesHours = timeMode === "hours";

    if (!usesHours) {
      if (!startTime || !endTime) {
        setFormError("Укажите время начала и окончания.");
        return;
      }
      // Равные концы — это не «сутки», а почти наверняка опечатка: 09:00–09:00
      // прочиталось бы как переход через полночь длиной в 24 часа.
      if (startTime === endTime) {
        setFormError("Начало и окончание совпадают.");
        return;
      }
    }

    if (usesHours && (!Number.isFinite(hoursValue) || hoursValue <= 0 || hoursValue > 24)) {
      setFormError("Часов в день должно быть от 1 до 24.");
      return;
    }

    const base = {
      user_base_id: employeeId || null,
      // Время суток и длительность взаимоисключающи: смена либо стоит в
      // конкретных часах, либо задана объёмом. Записывать оба значения нельзя —
      // иначе непонятно, какое из них правда.
      start_time: usesHours ? null : startTime,
      end_time: usesHours ? null : endTime,
      hours_per_day: usesHours ? hoursValue : null,
      positions_id: positionId || null,
      locations_id: locationId || null,
      project: project.trim() || null,
      comment: comment.trim() || null,
    };

    if (isEditing) {
      onSubmit([{ ...base, date: targetDates[0] }], shift?.guid ?? null);
      return;
    }

    const rows: ShiftInput[] = [];
    targetDates.forEach((date) => {
      for (let index = 0; index < slots; index += 1) {
        rows.push({ ...base, date });
      }
    });
    onSubmit(rows, null);
  };

  const isBusy = isSaving || isDeleting;
  const visibleError = formError || error;

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-[560px] p-5 lg:p-6">
      <h4 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
        {isEditing ? `Смена — ${formatDateRu(shift?.date ?? "")}` : "Новая смена"}
      </h4>

      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Сотрудник</label>
            <select
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
              className={inputClass}
            >
              <option value="">— Открытая смена —</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
            {/* <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
              Без сотрудника смена станет открытой — её видно в строке «Открытые».
            </p> */}
          </div>

          {/* Должность стоит рядом с сотрудником, а не среди прочих полей:
              у открытой смены она — единственное, чем описан нужный человек. */}
          <div>
            <label className={labelClass}>Должность</label>
            <select
              value={positionId}
              onChange={(event) => setPositionId(event.target.value)}
              className={inputClass}
            >
              <option value="">— Не указана —</option>
              {positions.map((item) => (
                <option key={item.guid} value={item.guid}>
                  {item.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Количество имеет смысл только у открытой смены: назначенная —
            всегда один человек, у него не может быть двух смен в день. */}
        <div>
          <label className={labelClass}>Количество человек</label>
          <input
            type="number"
            min={1}
            max={MAX_HEADCOUNT}
            value={headcount}
            disabled={Boolean(employeeId) || isEditing}
            onChange={(event) => setHeadcount(event.target.value)}
            className={inputClass}
          />
          {/* <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
            {employeeId
              ? "Сотрудник выбран — смена одна."
              : isEditing
                ? "При правке меняется только эта смена."
                : "Создаст столько открытых слотов на каждую дату."}
          </p> */}
        </div>

        <div>
          <div className="mb-2.5 inline-flex rounded-xl border border-gray-200 p-[3px] dark:border-gray-700">
              {(
                [
                  ["range", "Время от–до"],
                  ["hours", "Часов в день"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setTimeMode(mode)}
                  className={`h-8 rounded-lg px-3 text-[12px] font-semibold transition ${
                    timeMode === mode
                      ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400"
                      : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-white/5"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {timeMode === "range" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Начало</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Окончание</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                    className={inputClass}
                  />
                  {endTime <= startTime && (
                    <p className="mt-1 text-[11px] font-medium text-violet-600 dark:text-violet-400">
                      Переходит через полночь — смена считается ночной.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label className={labelClass}>Часов в день</label>
                <input
                  type="number"
                  min={1}
                  max={24}
                  step="0.5"
                  value={hours}
                  onChange={(event) => setHours(event.target.value)}
                  className={inputClass}
                />
                {/* Честно предупреждаем: у такой смены нет места на сутках,
                    поэтому на таймлайне она отдельной полосой, а не отрезком. */}
                <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                  Время суток не задано: на таймлайне такая смена показана без
                  привязки к часам и ночной считаться не может.
                </p>
              </div>
            )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Дата начала</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value);
                // Диапазон схлопнут по умолчанию: обычное создание — один день.
                if (!dateTo || dateTo < event.target.value) setDateTo(event.target.value);
              }}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Дата окончания</label>
            <input
              type="date"
              value={dateTo}
              min={dateFrom}
              disabled={isEditing}
              onChange={(event) => setDateTo(event.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {!isEditing && (
          <div>
            <label className={labelClass}>Повторяется по дням недели</label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_CHIPS.map((chip) => {
                const isActive = weekdays.includes(chip.dow);
                const isAvailable = availableDows.has(chip.dow);
                return (
                  <button
                    key={chip.dow}
                    type="button"
                    disabled={!isAvailable}
                    title={isAvailable ? undefined : "В выбранном диапазоне такого дня нет"}
                    onClick={() => toggleWeekday(chip.dow)}
                    className={`h-8 w-11 rounded-lg border text-[12px] font-semibold transition ${
                      !isAvailable
                        ? "cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-600"
                        : isActive
                          ? "border-brand-300 bg-brand-50 text-brand-600 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-400"
                          : "border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5"
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11px] text-gray-400 dark:text-gray-500">
              {availableDows.size <= 1
                ? "Диапазон — один день. Чтобы повторять по дням недели, сдвиньте дату окончания."
                : weekdays.length === 0
                  ? "Ни один день не отмечен — смена встанет на каждую дату диапазона."
                  : "Смена встанет только на отмеченные дни внутри диапазона."}
            </p>
          </div>
        )}

        <div>
          <label className={labelClass}>Локация</label>
          <select
            value={locationId}
            onChange={(event) => setLocationId(event.target.value)}
            className={inputClass}
          >
            <option value="">— Не указана —</option>
            {locations.map((item) => (
              <option key={item.guid} value={item.guid}>
                {item.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Проект</label>
          <input
            type="text"
            value={project}
            list="shift-project-suggestions"
            placeholder="Название проекта…"
            onChange={(event) => setProject(event.target.value)}
            className={inputClass}
          />
          {/* Справочника проектов в HRMS нет — подсказки собираем из того, что
              уже вводили в смены этого периода. */}
          <datalist id="shift-project-suggestions">
            {projectSuggestions.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </div>

        <div>
          <label className={labelClass}>Комментарий</label>
          <textarea
            rows={2}
            value={comment}
            placeholder="Необязательно…"
            onChange={(event) => setComment(event.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          />
        </div>

        {visibleError && (
          <div className="rounded-xl border border-error-200 bg-error-50 px-3 py-2 text-[13px] text-error-600 dark:border-error-500/30 dark:bg-error-500/10">
            {visibleError}
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
        <div>
          {isEditing && (
            <button
              type="button"
              onClick={() => shift?.guid && onDelete(shift.guid)}
              disabled={isBusy}
              className="rounded-xl border border-rose-200 px-3.5 py-2 text-[13px] font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-60 dark:border-rose-500/30 dark:hover:bg-rose-500/10"
            >
              {isDeleting ? "Удаление…" : "Удалить смену"}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isEditing && plannedCount > 1 && (
            <span className="text-[12px] text-gray-400 dark:text-gray-500">
              Будет создано: {plannedCount}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="rounded-xl border border-gray-200 px-4 py-2 text-[13px] font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
          >
            Отменить
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isBusy}
            className="rounded-xl bg-brand-500 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
          >
            {isSaving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
