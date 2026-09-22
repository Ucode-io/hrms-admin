/**
 * Часовые пояса — IANA-именами, а не «GMT+05:00».
 *
 * Строки вида «GMT+05:00» лежали в `locations.timezone` и `companies.timezone`
 * до миграции `2026_09_21_regions.sql`: `Intl.DateTimeFormat` падает на них с
 * `Invalid time zone specified`, поэтому зоной они были только на вид
 * (ADR-0005, п. 2).
 *
 * Список берётся у платформы (`Intl.supportedValuesOf`), а не пишется руками:
 * зоны — справочник tzdata, он приезжает с браузером и сам отыгрывает переносы.
 * Имена в нём зависят от движка (Node 22 отдаёт `Asia/Calcutta`, свежий Chrome —
 * `Asia/Kolkata`), поэтому сохранённое значение может в списке не найтись:
 * `ensureOption`/`selected*Option` показывают его собственной меткой, а не
 * теряют. Для `Intl` оба имени равнозначны.
 */
export type TimezoneOption = {
  value: string;
  label: string;
};

export const DEFAULT_TIMEZONE = "Asia/Tashkent";

/** «Asia/Tashkent (UTC+05:00)». Платформа пишет смещение как «GMT+05:00» — это
 *  ровно тот мёртвый формат, что вычищен из БД, поэтому префикс меняем. */
const toOption = (timezone: string, now: Date): TimezoneOption => {
  const offset = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "longOffset",
  })
    .formatToParts(now)
    .find((part) => part.type === "timeZoneName")?.value;

  return {
    value: timezone,
    label: offset ? `${timezone} (${offset.replace("GMT", "UTC")})` : timezone,
  };
};

// ponytail: 418 зон × свой `Intl.DateTimeFormat` — ~70 мс, а кода-сплиттинга в
// админке нет. Считаем при первом обращении, чтобы платили только настройки.
let cache: TimezoneOption[] | null = null;

export const getTimezoneOptions = (): TimezoneOption[] => {
  if (!cache) {
    const now = new Date();
    cache = Intl.supportedValuesOf("timeZone").map((timezone) =>
      toOption(timezone, now)
    );
  }

  return cache;
};
