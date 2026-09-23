import type { TimelineScale, TimesheetSource, TimesheetView } from "./types";
import { translate, getLocale, monthNames, weekdayNames } from "../../i18n";
import type { MessageKey } from "../../i18n/messages";

/** Таймлайн идёт первым и открывается по умолчанию — с него читают день. */
export const VIEW_ORDER: TimesheetView[] = ["timeline", "table"];

export const DEFAULT_VIEW: TimesheetView = "timeline";

/**
 * Подписи — геттеры: переводятся в момент чтения, поэтому потребители
 * по-прежнему пишут `META[key].label` и видят текущий язык.
 */
const labelOf = (key: MessageKey) => ({
  get label() {
    return translate(key);
  },
});

export const VIEW_META: Record<TimesheetView, { label: string }> = {
  table: labelOf("tasks.views.table"),
  timeline: labelOf("timesheet.view.timeline"),
};

export const SCALE_ORDER: TimelineScale[] = ["day", "week", "month"];

export const SCALE_META: Record<TimelineScale, { label: string }> = {
  day: labelOf("timesheet.scale.day"),
  week: labelOf("timesheet.scale.week"),
  month: labelOf("timesheet.scale.month"),
};

/**
 * Источники записи.
 *
 * `bar` — заливка сегмента в полосе, `color` — текст бейджа и подписи.
 * Разные значения нужны потому, что у заливки и текста разные требования к
 * контрасту: тон, читаемый как подпись, в полосе кричит, а тон, спокойный в
 * полосе, в подписи не читается.
 *
 * Ручное время и мобильное — это такое же отработанное время, поэтому в полосе
 * они светлые оттенки того же синего, что и трекер: полоса читается как одна
 * масса «отработано», а источник виден вторым планом. Раньше ручное было
 * оранжевым и выглядело как ошибка, хотя ничего аномального в нём нет.
 */
const sourceMeta = (source: TimesheetSource, color: string, bar: string) => ({
  get label() {
    return translate(`timesheet.source.${source}.label`);
  },
  get short() {
    return translate(`timesheet.source.${source}.short`);
  },
  color,
  bar,
});

export const SOURCE_META: Record<
  TimesheetSource,
  { label: string; short: string; color: string; bar: string }
> = {
  tracker: sourceMeta("tracker", "#2563eb", "#2563eb"),
  manual: sourceMeta("manual", "#4b7bc8", "#9dbcf0"),
  mobile: sourceMeta("mobile", "#6d5bc7", "#b3a8e8"),
  break: sourceMeta("break", "#94a3b8", "#cbd5e1"),
  // Ручное время HRMS — такое же отработанное, поэтому в полосе тот же синий
  // ряд, но темнее мобильного: по бейджу его отличают от правки в Time Doctor.
  hrms_manual: sourceMeta("hrms_manual", "#0e7490", "#7dd3e8"),
  other: sourceMeta("other", "#64748b", "#cbd5e1"),
};

export const SOURCE_ORDER: TimesheetSource[] = [
  "tracker",
  "manual",
  "mobile",
  "break",
  "hrms_manual",
  "other",
];

/** Месяц по индексу 0–11 в текущей локали: «Январь». */
export const monthName = (month: number): string => monthNames(getLocale())[month];
/** Короткий месяц без точки и в нижнем регистре: «янв». */
export const monthShort = (month: number): string =>
  monthNames(getLocale(), "short")[month].replace(/\.$/, "").toLowerCase();
/** Короткий день недели по `Date.getDay()` (0 — воскресенье): «пн». */
export const weekdayShort = (day: number): string =>
  weekdayNames(getLocale())[(day + 6) % 7].replace(/\.$/, "").toLowerCase();

const pad = (value: number) => String(value).padStart(2, "0");

export const toIsoDate = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/**
 * ISO-дата → Date локальной полуночи.
 *
 * `new Date("2026-06-15")` разобрал бы строку как UTC и в минусовых поясах дал
 * бы предыдущий день; явные аргументы этого избегают.
 */
export const fromIsoDate = (iso: string): Date => {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

export const shiftDays = (iso: string, days: number): string => {
  const date = fromIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
};

/** Понедельник недели, в которую попадает дата. */
export const startOfWeek = (iso: string): string => {
  const date = fromIsoDate(iso);
  const dow = date.getDay();
  date.setDate(date.getDate() + (dow === 0 ? -6 : 1 - dow));
  return toIsoDate(date);
};

export const startOfMonth = (iso: string): string => {
  const date = fromIsoDate(iso);
  return toIsoDate(new Date(date.getFullYear(), date.getMonth(), 1));
};

export const endOfMonth = (iso: string): string => {
  const date = fromIsoDate(iso);
  return toIsoDate(new Date(date.getFullYear(), date.getMonth() + 1, 0));
};

/** Диапазон запроса для выбранного масштаба и опорной даты. */
export const rangeForScale = (
  scale: TimelineScale,
  anchor: string
): { from: string; to: string } => {
  if (scale === "day") return { from: anchor, to: anchor };
  if (scale === "month") return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
  const from = startOfWeek(anchor);
  return { from, to: shiftDays(from, 6) };
};

/** Сдвиг периода кнопками «назад/вперёд» — шаг равен самому периоду. */
export const shiftAnchor = (
  scale: TimelineScale,
  anchor: string,
  direction: 1 | -1
): string => {
  if (scale === "day") return shiftDays(anchor, direction);
  if (scale === "week") return shiftDays(anchor, direction * 7);
  const date = fromIsoDate(anchor);
  return toIsoDate(new Date(date.getFullYear(), date.getMonth() + direction, 1));
};

export const formatRangeLabel = (scale: TimelineScale, range: { from: string; to: string }) => {
  const from = fromIsoDate(range.from);
  const to = fromIsoDate(range.to);

  if (scale === "month") return `${monthName(from.getMonth())} ${from.getFullYear()}`;
  if (scale === "day") {
    return `${from.getDate()} ${monthShort(from.getMonth())} ${from.getFullYear()}`;
  }
  return `${from.getDate()} ${monthShort(from.getMonth())} – ${to.getDate()} ${monthShort(
    to.getMonth()
  )} ${to.getFullYear()}`;
};

export const formatDateRu = (iso: string): string => {
  if (!iso) return "—";
  const date = fromIsoDate(iso);
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
};

export const formatDayHeader = (iso: string): string => {
  const date = fromIsoDate(iso);
  return `${weekdayShort(date.getDay())}, ${date.getDate()} ${monthShort(date.getMonth())}`;
};

export const isWeekend = (iso: string): boolean => {
  const dow = fromIsoDate(iso).getDay();
  return dow === 0 || dow === 6;
};

export const isToday = (iso: string): boolean => iso === toIsoDate(new Date());

/**
 * Секунды → «7ч 30м». Ноль показываем прочерком, чтобы таблица не рябила.
 *
 * Округляем до минут ДО деления на часы: иначе 162ч 59м 40с превращались в
 * «162ч 60м» — минуты округлялись вверх, а час за ними не переносился.
 */
export const formatDuration = (seconds: number): string => {
  const totalMinutes = Math.max(0, Math.round(seconds / 60));
  if (totalMinutes === 0) return "—";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return translate("timesheet.duration.minutes", { minutes });
  return translate("timesheet.duration.hours_minutes", { hours, minutes: pad(minutes) });
};

export const formatHours = (hours: number): string => formatDuration(hours * 3600);

export const getInitials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

const AVATAR_COLORS = [
  "#2563eb",
  "#16a34a",
  "#ea580c",
  "#dc2626",
  "#65a30d",
  "#4f46e5",
  "#0891b2",
  "#db2777",
];

/** Цвет аватара детерминирован по id — он не должен меняться между рендерами. */
export const avatarColor = (seed: string): string => {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

/**
 * Шкала полосы в таймлайне. Растягивать полосу по максимуму строки нельзя:
 * колонки перестали бы сравниваться между собой. 10 часов — потолок, всё
 * сверх него упирается в край.
 */
export const BAR_SCALE_SECONDS = 10 * 3600;
