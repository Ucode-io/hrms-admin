import { SOURCE_META, formatDateRu } from "./constants";
import type { TimesheetEntry } from "./types";

const COLUMNS = [
  "Сотрудник",
  "Департамент",
  "Дата",
  "Начало",
  "Окончание",
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

export const buildTimesheetCsv = (entries: TimesheetEntry[]): string => {
  const rows = entries.map((entry) =>
    [
      entry.employeeName,
      entry.department,
      formatDateRu(entry.date),
      entry.startTime,
      entry.endTime,
      hoursCell(entry.durationSeconds),
      entry.projectName,
      entry.taskName,
      SOURCE_META[entry.source]?.label ?? entry.source,
      entry.reason,
    ]
      .map(escapeCell)
      .join(";")
  );

  return [COLUMNS.map(escapeCell).join(";"), ...rows].join("\r\n");
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
