import { SOURCE_META, TIMESHEET_SOURCE_LABEL, entryEndDate, formatDateRu, sourceToEmployee } from "./constants";
import type { TimesheetEntry } from "./types";
import { translate } from "../../i18n";
import type { ZoneInterval } from "../../utils/wallClock";

// Функция, а не константа: `translate` читает язык в момент вызова, а модуль
// импортируется один раз на загрузку страницы.
const columns = () => [
  "Сотрудник",
  "Департамент",
  "Дата",
  "Начало",
  "Окончание",
  translate("wall_clock.csv_timezone"),
  "Часы",
  "Проект",
  "Задача",
  "Источник",
  "Причина",
];

/** Экранирование по RFC 4180: кавычка удваивается, поле берётся в кавычки. */
const escapeCell = (value: string): string => `"${String(value ?? "").replace(/"/g, '""')}"`;

/**
 * Часы числом, а не строкой «7ч 30м»: файл открывают в Excel и по этой колонке
 * считают. Десятичный разделитель — запятая, как ждёт локализованный Excel.
 */
const hoursCell = (seconds: number): string =>
  (Math.round((seconds / 3600) * 100) / 100).toFixed(2).replace(".", ",");

/**
 * Время в файле — по месту сотрудника, а не того, кто скачал (ADR-0014, п. 8):
 * файл пересылают дальше, а пояс скачавшего в нём не записан. Поэтому рядом
 * колонка с поясом. Без пояса сотрудника время остаётся в поясе табеля.
 *
 * Время — чистое «HH:MM», без меток суток: файл читают Excel и импорт. «Дата» —
 * местная дата начала, она может разойтись с датой табеля; конец раньше
 * начала — значит, следующие сутки.
 */
export const buildTimesheetCsv = (
  entries: TimesheetEntry[],
  zoneOf: (employeeId: string, date: string) => ZoneInterval | null
): string => {
  const rows = entries.map((entry) => {
    const zone = entry.employeeId ? zoneOf(entry.employeeId, entry.date) : null;
    const start = entry.startTime ? sourceToEmployee(entry.date, entry.startTime, zone?.timezone ?? null) : null;
    const end = entry.endTime ? sourceToEmployee(entryEndDate(entry), entry.endTime, zone?.timezone ?? null) : null;
    return [
      entry.employeeName,
      entry.department,
      formatDateRu(start?.date ?? entry.date),
      start?.time ?? "",
      end?.time ?? "",
      zone?.timezone ?? TIMESHEET_SOURCE_LABEL,
      hoursCell(entry.durationSeconds),
      entry.projectName,
      entry.taskName,
      SOURCE_META[entry.source]?.label ?? entry.source,
      entry.reason,
    ]
      .map(escapeCell)
      .join(";");
  });

  return [columns().map(escapeCell).join(";"), ...rows].join("\r\n");
};

/** BOM обязателен: без него Excel читает файл как ANSI и ломает кириллицу. */
const BOM = "\uFEFF";

export const downloadCsv = (csv: string, filename: string): void => {
  const blob = new Blob([`${BOM}${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
