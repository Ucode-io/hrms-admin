/**
 * Часовые пояса — IANA-именами, а не «GMT+05:00».
 *
 * Строки вида «GMT+05:00» лежали в `locations.timezone` и `companies.timezone`
 * до миграции `2026_09_21_regions.sql`: `Intl.DateTimeFormat` падает на них с
 * `Invalid time zone specified`, поэтому зоной они были только на вид
 * (ADR-0005, п. 2).
 *
 * Список короткий и покрывает страны, где компания работает. Пояс региона —
 * обычное поле, пришедший извне (заведённый через ucode напрямую) показывается
 * как есть: `ensureOption`/`selected*Option` подставляют неизвестное значение
 * собственной меткой, а не теряют его.
 */
export type TimezoneOption = {
  value: string;
  label: string;
};

export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { value: "UTC", label: "UTC" },
  { value: "Europe/Moscow", label: "Москва (Europe/Moscow)" },
  { value: "Asia/Baku", label: "Баку (Asia/Baku)" },
  { value: "Asia/Dubai", label: "Дубай (Asia/Dubai)" },
  { value: "Asia/Tashkent", label: "Ташкент (Asia/Tashkent)" },
  { value: "Asia/Almaty", label: "Алматы (Asia/Almaty)" },
  { value: "Asia/Shanghai", label: "Шанхай (Asia/Shanghai)" },
];

export const DEFAULT_TIMEZONE = "Asia/Tashkent";
