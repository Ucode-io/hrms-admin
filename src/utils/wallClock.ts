/**
 * Настенные часы сотрудника → часы того, кто смотрит (ADR-0014).
 *
 * В базе `event_time`, `check_in_time`, время смены — местные строки без зоны
 * (ADR-0005). Пересчёт идёт только в точке вывода: вся арифметика (ночная
 * смена, длительности, опоздания) остаётся на местных строках, иначе бакинская
 * смена 20:00–23:30 в Ташкенте стала бы ночной 21:00–00:30.
 *
 * Здесь только чистые функции; запрос поясов — `useEmployeeTimeZones`.
 */

/** Отрезок дат, на котором у сотрудника один пояс (ответ `resolve_time_zones`). */
export type ZoneInterval = {
  from: string;
  to: string;
  timezone: string;
  regions_id: string | null;
  region_title: string | null;
};

const DAY = 1440;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;
const CLOCK_PATTERN = /^(\d{1,2}):(\d{2})/;

// Форматтер на зону создаётся один раз: ячеек на экране сотни, а конструктор
// Intl.DateTimeFormat — самое дорогое во всём пересчёте.
const formatters = new Map<string, Intl.DateTimeFormat>();
const formatterFor = (timeZone: string): Intl.DateTimeFormat => {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
};

/**
 * Понимает ли зону `Intl` этого браузера. Сервер сверяет имя со своим `Intl`,
 * но справочники ICU у Node и браузера не обязаны совпадать, а незнакомое имя
 * роняет `Intl` прямо на рендере (ADR-0005, п. 2). Такая зона считается
 * неизвестной.
 */
export const isKnownTimeZone = (timeZone: string): boolean => {
  if (!timeZone) return false;
  try {
    formatterFor(timeZone);
    return true;
  } catch {
    return false;
  }
};

const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
/**
 * Пояс того, кто смотрит, — зона браузера, без настроек (ADR-0014, п. 1).
 * Устройство, которое пояс не определило, отдаёт имя вроде `Etc/Unknown`, и
 * `Intl` на нём бросает — тогда UTC: иначе падал бы каждый экран со временем.
 */
export const VIEWER_TIME_ZONE = isKnownTimeZone(browserTimeZone) ? browserTimeZone : "UTC";

const wallParts = (timeZone: string, instant: number) => {
  const parts: Record<string, number> = {};
  for (const part of formatterFor(timeZone).formatToParts(instant)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  return parts;
};

/** Смещение зоны от UTC в минутах в данный момент. */
export const offsetMinutes = (timeZone: string, instant: number): number => {
  const p = wallParts(timeZone, instant);
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute);
  return Math.round((wall - Math.floor(instant / 60000) * 60000) / 60000);
};

export const minutesOfClock = (time: string | null | undefined): number | null => {
  const match = CLOCK_PATTERN.exec(String(time ?? "").trim());
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes < DAY ? minutes : null;
};

/** «HH:MM» из минут; вне 0…24 ч берётся по модулю суток. */
export const clockOfMinutes = (minutes: number): string => {
  const wrapped = ((minutes % DAY) + DAY) % DAY;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
};

/** Момент (UTC, мс) настенного времени `date` + `minutes` в зоне. */
export const wallToInstant = (date: string, minutes: number, timeZone: string): number => {
  const match = DATE_PATTERN.exec(date);
  if (!match) return NaN;
  const naive = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, minutes);
  // Два прохода: смещение берётся в момент, уже сдвинутый на первое приближение,
  // — так переход на летнее время не уводит результат на час.
  const first = naive - offsetMinutes(timeZone, naive) * 60000;
  return naive - offsetMinutes(timeZone, first) * 60000;
};

// ponytail: кеш растёт на «зона × дата», которые открывали за сессию, — это
// сотни строк. Понадобится предел — чистить по размеру.
const dayOffsets = new Map<string, number>();

/**
 * Смещение зоны на дату — в полдень, один раз на пару «зона × дата». Ячеек на
 * экране тысячи, а смещение внутри суток меняется только в день перевода
 * часов (см. ponytail у `toViewerClock`).
 */
export const offsetOnDate = (timeZone: string, date: string): number => {
  const key = `${timeZone}|${date}`;
  let offset = dayOffsets.get(key);
  if (offset === undefined) {
    offset = offsetMinutes(timeZone, wallToInstant(date, 12 * 60, timeZone));
    dayOffsets.set(key, offset);
  }
  return offset;
};

export type ViewerClock = {
  /** «HH:MM» у смотрящего. */
  time: string;
  /** Минуты от полуночи даты строки у смотрящего: могут выйти за 0…1440. */
  minutes: number;
  /** Сдвиг через полночь из-за пересчёта: «+1», «−1» (ADR-0014, п. 4). */
  dayShift: number;
  /** Момент UTC — ключ сортировки в общих списках. */
  instant: number;
  /** Разница смещений смотрящего и сотрудника; 0 — серой строки нет. */
  diff: number;
};

/**
 * Местное время строки → время смотрящего.
 *
 * Считается на дату строки, даже если событие случилось на следующих сутках
 * (уход с ночной смены в 06:00): метка «+1» означает сдвиг из-за пересчёта, а
 * не календарную дату события.
 * ponytail: смещения обеих зон берутся в полдень даты строки; время по ту
 * сторону перевода часов в сам день перевода сдвинется на час. Таких поясов у
 * компаний сейчас нет.
 */
export const toViewerClock = (
  date: string,
  time: string | null | undefined,
  employeeTimeZone: string,
  viewerTimeZone: string = VIEWER_TIME_ZONE,
): ViewerClock | null => {
  const local = minutesOfClock(time);
  const match = DATE_PATTERN.exec(date);
  if (local === null || !match) return null;
  const day = `${match[1]}-${match[2]}-${match[3]}`;
  const employeeOffset = offsetOnDate(employeeTimeZone, day);
  const diff = offsetOnDate(viewerTimeZone, day) - employeeOffset;
  const instant = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, local) - employeeOffset * 60000;
  const minutes = local + diff;
  return { time: clockOfMinutes(minutes), minutes, dayShift: Math.floor(minutes / DAY), instant, diff };
};

/** «+1», «−1» или пусто. */
export const dayShiftLabel = (dayShift: number): string =>
  dayShift > 0 ? `+${dayShift}` : dayShift < 0 ? `−${-dayShift}` : "";

/** «10:00», «00:30 +1», «23:30 −1» — время с меткой суток одной строкой. */
export const formatClock = (clock: ViewerClock): string => {
  const shift = dayShiftLabel(clock.dayShift);
  return shift ? `${clock.time} ${shift}` : clock.time;
};

/**
 * Время, посчитанное на дату `from`, с меткой суток относительно даты `to`.
 * Только табель: у его записей дата конца известна, и метка там — календарные
 * сутки от дня строки, а не сдвиг от пересчёта (ADR-0014, п. 4, исключение).
 */
export const rebaseClock = (clock: ViewerClock, from: string, to: string): ViewerClock => {
  const days = Math.round((Date.parse(from.slice(0, 10)) - Date.parse(to.slice(0, 10))) / 86400000) || 0;
  return { ...clock, minutes: clock.minutes + days * DAY, dayShift: clock.dayShift + days };
};

/** «UTC+4», «UTC+5:30» — подпись зоны без региона. */
export const utcOffsetLabel = (timeZone: string, instant: number): string => {
  const offset = offsetMinutes(timeZone, instant);
  const abs = Math.abs(offset);
  const minutes = abs % 60;
  return `UTC${offset < 0 ? "−" : "+"}${Math.floor(abs / 60)}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""}`;
};

/**
 * Подпись местного времени: название региона, а без него — смещение.
 * Локализованных названий городов для IANA-зон у платформы нет
 * (`Intl.DisplayNames` зоны не поддерживает), поэтому берётся `region_title`.
 */
export const zoneLabel = (zone: ZoneInterval, instant: number): string =>
  zone.region_title?.trim() || utcOffsetLabel(zone.timezone, instant);

/** Интервал, покрывающий дату. */
export const zoneOn = (intervals: ZoneInterval[] | undefined, date: string): ZoneInterval | null =>
  intervals?.find((zone) => zone.from <= date && date <= zone.to) ?? null;

/** «Сейчас» и «сегодня» по часам зоны. */
export const nowInZone = (timeZone: string, now: number = Date.now()): { date: string; time: string } => {
  const p = wallParts(timeZone, now);
  return {
    date: `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`,
    time: clockOfMinutes((p.hour % 24) * 60 + p.minute),
  };
};
