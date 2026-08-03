import { ChevronLeft, ChevronRight, Clock, PencilLine } from "lucide-react";
import { Link } from "react-router";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { formatDateRu, formatDuration } from "../constants";
import { EmployeeAvatar, SourceBadge } from "../components/badges";
import type { TimesheetEntry } from "../types";

interface TableViewProps {
  entries: TimesheetEntry[];
  total: number;
  limit: number;
  offset: number;
  isFetching: boolean;
  onOffsetChange: (offset: number) => void;
}

const HEADERS = [
  "Сотрудник",
  "Дата",
  "Отработано",
  "Начало",
  "Окончание",
  "Проект",
  "Задача",
  "Причина",
  "Источник",
];

export default function TableView({
  entries,
  total,
  limit,
  offset,
  isFetching,
  onOffsetChange,
}: TableViewProps) {
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);
  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center dark:border-gray-800 dark:bg-white/[0.03]">
        <Clock size={28} className="mx-auto mb-3 text-gray-300" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          За выбранный период записей времени нет
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Проверьте период и фильтры или дождитесь синхронизации Time Doctor
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="max-w-full overflow-x-auto">
        <Table>
          <TableHeader className="border-b border-gray-100 dark:border-gray-800">
            <TableRow>
              {HEADERS.map((header) => (
                <TableCell
                  key={header}
                  isHeader
                  className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400"
                >
                  {header}
                </TableCell>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
            {entries.map((entry) => (
              <TableRow
                key={entry.id}
                className="transition hover:bg-gray-50 dark:hover:bg-white/[0.03]"
              >
                <TableCell className="whitespace-nowrap px-5 py-3">
                  {/* Строка ведёт в детализацию дня: у самой записи Time Doctor
                      своей страницы нет, а разбираются всегда с днём целиком. */}
                  <Link
                    to={`/timesheet/${entry.employeeId ?? ""}/${entry.date}`}
                    className="flex items-center gap-2.5"
                  >
                    <EmployeeAvatar
                      name={entry.employeeName}
                      photo={entry.employeePhoto}
                      seed={entry.employeeId ?? entry.mappingId}
                    />
                    <span className="flex flex-col">
                      <span className="text-sm font-medium text-gray-800 hover:text-brand-500 dark:text-white/90">
                        {entry.employeeName || "—"}
                      </span>
                      {entry.department && (
                        <span className="text-xs text-gray-400">{entry.department}</span>
                      )}
                    </span>
                  </Link>
                </TableCell>

                <TableCell className="whitespace-nowrap px-5 py-3 text-sm text-gray-600 dark:text-gray-300">
                  {formatDateRu(entry.date)}
                </TableCell>

                <TableCell className="whitespace-nowrap px-5 py-3 text-sm font-semibold text-gray-800 dark:text-white/90">
                  {formatDuration(entry.durationSeconds)}
                </TableCell>

                {/* Записи до мая 2026 приходили без времени начала — только
                    суммарная длительность за день. */}
                <TableCell className="whitespace-nowrap px-5 py-3 text-sm text-gray-600 dark:text-gray-300">
                  {entry.startTime || "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap px-5 py-3 text-sm text-gray-600 dark:text-gray-300">
                  {entry.endTime || "—"}
                </TableCell>

                <TableCell className="whitespace-nowrap px-5 py-3 text-sm text-gray-600 dark:text-gray-300">
                  {entry.projectName || "—"}
                </TableCell>
                <TableCell className="max-w-[220px] truncate px-5 py-3 text-sm text-gray-600 dark:text-gray-300">
                  {entry.taskName || "—"}
                </TableCell>

                <TableCell
                  className="max-w-[220px] truncate px-5 py-3 text-xs text-gray-500 dark:text-gray-400"
                  title={entry.reason || undefined}
                >
                  {entry.reason || "—"}
                </TableCell>

                <TableCell className="whitespace-nowrap px-5 py-3">
                  <span className="inline-flex items-center gap-1.5">
                    <SourceBadge source={entry.source} />
                    {entry.isEdited && (
                      <PencilLine
                        size={13}
                        className="text-amber-500"
                        aria-label="Запись правили в Time Doctor"
                      />
                    )}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-3 dark:border-gray-800">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {isFetching ? "Загрузка…" : `Показано ${from}–${to} из ${total}`}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!canPrev}
            onClick={() => onOffsetChange(Math.max(0, offset - limit))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700"
            aria-label="Предыдущая страница"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            disabled={!canNext}
            onClick={() => onOffsetChange(offset + limit)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700"
            aria-label="Следующая страница"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
