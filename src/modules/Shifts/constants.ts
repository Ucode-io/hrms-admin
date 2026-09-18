// Даты, инициалы и цвет аватара уже решены в табеле — берём оттуда, а не
// заводим второй набор тех же функций.
export {
  MONTHS_RU,
  MONTHS_SHORT_RU,
  WEEKDAYS_SHORT_RU,
  toIsoDate,
  fromIsoDate,
  shiftDays,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  formatDateRu,
  formatDayHeader,
  isWeekend,
  isToday,
  getInitials,
  avatarColor,
} from "../Timesheet/constants";

import {
  MONTHS_RU,
  MONTHS_SHORT_RU,
  endOfMonth,
  fromIsoDate,
  shiftDays,
  startOfMonth,
  startOfWeek,
  toIsoDate,
} from "../Timesheet/constants";
import type { CellKind, GroupBy, ItemBy, ShiftKind, ShiftsScale } from "./types";
import type { Shift } from "../../api/services/shift.service";

export const SCALE_ORDER: ShiftsScale[] = ["week", "month"];

export const SCALE_META: Record<ShiftsScale, { label: string }> = {
  week: { label: "Неделя" },
  month: { label: "Месяц" },
};

export const GROUP_BY_ORDER: GroupBy[] = ["employee", "position", "location", "project"];

export const GROUP_BY_META: Record<GroupBy, { label: string }> = {
  employee: { label: "Сотрудник" },
  position: { label: "Должность" },
  location: { label: "Локация" },
  project: { label: "Проект" },
};

export const ITEM_BY_ORDER: ItemBy[] = ["employee", "position"];

export const ITEM_BY_META: Record<ItemBy, { label: string }> = {
  employee: { label: "Сотрудник" },
  position: { label: "Должность" },
};

/**
 * Цвета вида смены. Те же четыре, что в прототипе — но теперь это подсказка,
 * выведенная из данных, а не хранимое поле, которое админ мог проставить
 * вразрез со временем.
 */
export const KIND_META: Record<CellKind, { label: string; color: string; soft: string }> = {
  day: { label: "Дневная", color: "#2563eb", soft: "#eff6ff" },
  night: { label: "Ночная", color: "#7c3aed", soft: "#f5f3ff" },
  remote: { label: "Удалённо", color: "#0e7490", soft: "#ecfeff" },
  off: { label: "Выходной", color: "#94a3b8", soft: "#f8fafc" },
};

/** Виды смен — то, что можно выбрать фильтром. Выходного среди них нет. */
export const KIND_ORDER: ShiftKind[] = ["day", "night", "remote"];

/** Легенда над таблицей: в ней выходной есть, потому что клетки им закрашены. */
export const LEGEND_ORDER: CellKind[] = [...KIND_ORDER, "off"];

/** Локация считается удалённой по названию — отдельного флага у `locations` нет. */
const REMOTE_LOCATION = /удал|remote|дом/i;

export const timeToMinutes = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
};

/** `HH:MM:SS` из ucode → `HH:MM` для полей ввода и подписей. */
export const normalizeTime = (value: string | null | undefined): string => {
  const minutes = timeToMinutes(value);
  if (minutes == null) return "";
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
};

/**
 * У смены задано конкретное время суток.
 *
 * Противоположность — смена, заданная длительностью («8 часов в день»): она
 * знает, сколько работать, но не когда. На часовую ось её поставить не на что,
 * и ночной она быть не может — на это опираются и таймлайн, и `shiftKind`.
 */
export const hasFixedTime = (shift: Shift): boolean =>
  timeToMinutes(shift.start_time) != null && timeToMinutes(shift.end_time) != null;

/** Длительность в часах у смены без привязки ко времени суток. */
export const hoursPerDay = (shift: Shift): number | null => {
  const raw = Number(shift.hours_per_day);
  return Number.isFinite(raw) && raw > 0 ? raw : null;
};

/** Смена переходит через полночь: конец не позже начала. */
export const crossesMidnight = (shift: Shift): boolean => {
  const start = timeToMinutes(shift.start_time);
  const end = timeToMinutes(shift.end_time);
  if (start == null || end == null) return false;
  return end <= start;
};

/**
 * Вид смены выводится, а не хранится. Ночь старше удалёнки — ночное дежурство
 * из дома важнее прочесть как ночное.
 */
export const shiftKind = (shift: Shift): ShiftKind => {
  if (crossesMidnight(shift)) return "night";
  if (REMOTE_LOCATION.test(String(shift.locations_id_data?.title ?? ""))) return "remote";
  return "day";
};

/** Длительность смены в минутах, с учётом перехода через полночь. */
export const shiftMinutes = (shift: Shift): number => {
  const hours = hoursPerDay(shift);
  if (hours != null) return Math.round(hours * 60);
  const start = timeToMinutes(shift.start_time);
  const end = timeToMinutes(shift.end_time);
  if (start == null || end == null) return 0;
  return end > start ? end - start : 24 * 60 - start + end;
};

export const formatShiftTime = (shift: Shift): string => {
  const start = normalizeTime(shift.start_time);
  const end = normalizeTime(shift.end_time);
  if (start && end) return `${start}–${end}`;
  const hours = hoursPerDay(shift);
  return hours != null ? `${hours}ч/день` : "";
};

/** Диапазон дат для масштаба. */
export const rangeForScale = (
  scale: ShiftsScale,
  anchor: string
): { from: string; to: string } => {
  if (scale === "month") return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
  const from = startOfWeek(anchor);
  return { from, to: shiftDays(from, 6) };
};

export const shiftAnchor = (
  scale: ShiftsScale,
  anchor: string,
  direction: 1 | -1
): string => {
  if (scale === "week") return shiftDays(anchor, direction * 7);
  const date = fromIsoDate(anchor);
  return toIsoDate(new Date(date.getFullYear(), date.getMonth() + direction, 1));
};

export const formatRangeLabel = (
  scale: ShiftsScale,
  range: { from: string; to: string }
): string => {
  const from = fromIsoDate(range.from);
  const to = fromIsoDate(range.to);
  if (scale === "month") return `${MONTHS_RU[from.getMonth()]} ${from.getFullYear()}`;
  return `${from.getDate()} ${MONTHS_SHORT_RU[from.getMonth()]} – ${to.getDate()} ${
    MONTHS_SHORT_RU[to.getMonth()]
  } ${to.getFullYear()}`;
};

/** Все даты диапазона включительно. */
export const datesInRange = (from: string, to: string): string[] => {
  const dates: string[] = [];
  let cursor = from;
  // Страхуемся от перевёрнутого диапазона: без потолка цикл был бы вечным.
  for (let guard = 0; cursor <= to && guard < 400; guard += 1) {
    dates.push(cursor);
    cursor = shiftDays(cursor, 1);
  }
  return dates;
};

/** `mon`…`sun` из ucode-шаблона → индекс `Date.getDay()`. */
export const DAY_CODE_TO_DOW: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

/** Чипы дней недели в форме: с понедельника, как в производственном календаре. */
export const WEEKDAY_CHIPS: { dow: number; label: string }[] = [
  { dow: 1, label: "Пн" },
  { dow: 2, label: "Вт" },
  { dow: 3, label: "Ср" },
  { dow: 4, label: "Чт" },
  { dow: 5, label: "Пт" },
  { dow: 6, label: "Сб" },
  { dow: 0, label: "Вс" },
];
