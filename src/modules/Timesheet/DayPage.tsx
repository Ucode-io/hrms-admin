import { useMemo } from "react";
import { Link, useParams } from "react-router";
import { ChevronLeft, Clock, PencilLine } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import Spinner from "../../components/ui/Spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { useHeaderBreadcrumbItems } from "../../context/HeaderBreadcrumbContext";
import companyStore from "../../store/company.store";
import { useTimesheetDayQuery } from "../../api/services/timesheet.service";
import {
  BAR_SCALE_SECONDS,
  SOURCE_META,
  SOURCE_ORDER,
  formatDateRu,
  formatDuration,
  isWeekend,
  shiftDays,
} from "./constants";
import { EmployeeAvatar, SourceBadge } from "./components/badges";
import SummaryCards, { type SummaryItem } from "./components/SummaryCards";
import type { TimesheetHistoryDay } from "./types";

/** Мини-полоса дня в журнале — та же шкала, что и в таймлайне. */
function HistoryBar({ day }: { day: TimesheetHistoryDay }) {
  let offset = 0;
  return (
    <span className="relative block h-2 w-28 overflow-hidden rounded bg-gray-200 dark:bg-white/15">
      {SOURCE_ORDER.map((source) => {
        const seconds = day.bySource?.[source] ?? 0;
        if (seconds <= 0) return null;
        const width = Math.min(100 - offset, (seconds / BAR_SCALE_SECONDS) * 100);
        const left = offset;
        offset += width;
        return (
          <span
            key={source}
            className="absolute inset-y-0 rounded"
            style={{
              left: `${left}%`,
              width: `${width}%`,
              backgroundColor: SOURCE_META[source].bar,
            }}
          />
        );
      })}
    </span>
  );
}

export default function TimesheetDayPage() {
  const { employeeId = "", date = "" } = useParams();
  const brandColor = companyStore.mainColor || "#2563eb";

  const { data, isLoading, isError, error } = useTimesheetDayQuery(employeeId, date);

  useHeaderBreadcrumbItems(
    useMemo(
      () => [
        { label: "Табель времени", to: "/timesheet" },
        {
          label: data ? `${data.employee.name} — ${formatDateRu(date)}` : formatDateRu(date),
          to: `/timesheet/${employeeId}/${date}`,
        },
      ],
      [data, employeeId, date]
    )
  );

  const summaryItems = useMemo<SummaryItem[]>(() => {
    if (!data) return [];
    const { day } = data;
    const percent =
      day.planSeconds > 0 ? Math.round((day.workedSeconds / day.planSeconds) * 100) : 0;

    return [
      {
        label: "Отработано",
        value: formatDuration(day.workedSeconds),
        hint: `${day.entryCount} записей`,
        color: brandColor,
      },
      {
        label: "План",
        value: day.planSeconds > 0 ? formatDuration(day.planSeconds) : "Выходной",
        hint: day.planSeconds > 0 ? `Выполнено ${percent}%` : undefined,
      },
      {
        label: "Начало – Окончание",
        // Рабочий день Time Doctor может заканчиваться уже за полночь. Без
        // пометки «+1» такое окончание читается как «закончил до начала».
        value:
          day.firstStart && day.lastEnd
            ? `${day.firstStart.slice(11, 16)} – ${day.lastEnd.slice(11, 16)}${
                day.lastEnd.slice(0, 10) > day.date ? " (+1)" : ""
              }`
            : "—",
      },
      { label: "Перерывы", value: formatDuration(day.breakSeconds) },
      {
        label: "Статус дня",
        value: day.absence || day.holiday || (day.isDayOff ? "Выходной" : "Рабочий день"),
      },
    ];
  }, [data, brandColor]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-2xl border border-error-200 bg-error-50 px-5 py-8 text-center text-sm text-error-600 dark:border-error-500/30 dark:bg-error-500/10">
        {error instanceof Error ? error.message : "Не удалось загрузить день табеля."}
      </div>
    );
  }

  const { employee, day, entries, byProject, history } = data;
  const maxProjectSeconds = Math.max(1, ...byProject.map((group) => group.totalSeconds));

  return (
    <>
      <PageMeta
        title={`${employee.name} — ${formatDateRu(date)} | Табель времени`}
        description="Детализация отработанного времени за день"
      />

      {/* ── Шапка сотрудника ────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-center gap-4">
          <Link
            to="/timesheet"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
          >
            <ChevronLeft size={15} />
            Табель
          </Link>

          <EmployeeAvatar
            name={employee.name}
            photo={employee.photo}
            seed={employee.employeeId}
            size={52}
          />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-gray-800 dark:text-white/90">
              {employee.name}
            </h1>
            <p className="truncate text-sm text-gray-500 dark:text-gray-400">
              {[employee.position, employee.department].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>

          {/* Соседние дни: разбор дня почти всегда продолжается вчера/завтра. */}
          <div className="ml-auto flex items-center gap-2">
            <Link
              to={`/timesheet/${employeeId}/${shiftDays(date, -1)}`}
              className="inline-flex h-9 items-center rounded-lg border border-gray-200 px-3 text-sm text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
            >
              ← {formatDateRu(shiftDays(date, -1))}
            </Link>
            <span className="rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-500 dark:bg-brand-500/15">
              {formatDateRu(date)}
            </span>
            <Link
              to={`/timesheet/${employeeId}/${shiftDays(date, 1)}`}
              className="inline-flex h-9 items-center rounded-lg border border-gray-200 px-3 text-sm text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
            >
              {formatDateRu(shiftDays(date, 1))} →
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <SummaryCards items={summaryItems} />
      </div>

      {/* ── Разбивка по проектам ────────────────────────────────────────── */}
      {byProject.length > 0 && (
        <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <h2 className="mb-4 text-sm font-semibold text-gray-800 dark:text-white/90">
            Распределение по проектам
          </h2>
          <div className="space-y-4">
            {byProject.map((group) => (
              <div key={group.projectId || group.projectName}>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-medium text-gray-700 dark:text-gray-200">
                    {group.projectName}
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-gray-800 dark:text-white/90">
                    {formatDuration(group.totalSeconds)}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded bg-gray-200 dark:bg-white/15">
                  <span
                    className="block h-full rounded"
                    style={{
                      width: `${(group.totalSeconds / maxProjectSeconds) * 100}%`,
                      backgroundColor: brandColor,
                    }}
                  />
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                  {group.tasks.map((task) => (
                    <span
                      key={task.taskId || task.taskName}
                      className="text-xs text-gray-500 dark:text-gray-400"
                    >
                      {task.taskName} — {formatDuration(task.seconds)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Записи дня ──────────────────────────────────────────────────── */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <h2 className="border-b border-gray-100 px-5 py-3.5 text-sm font-semibold text-gray-800 dark:border-gray-800 dark:text-white/90">
          Записи времени за {formatDateRu(date)}
        </h2>

        {entries.length === 0 ? (
          <div className="py-14 text-center">
            <Clock size={26} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {day.absence || (day.isDayOff ? "Выходной день" : "Записей за этот день нет")}
            </p>
          </div>
        ) : (
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-gray-800">
                <TableRow>
                  {["Начало", "Окончание", "Длительность", "Проект", "Задача", "Источник", "Причина"].map(
                    (header) => (
                      <TableCell
                        key={header}
                        isHeader
                        className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400"
                      >
                        {header}
                      </TableCell>
                    )
                  )}
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap px-5 py-3 text-sm text-gray-600 dark:text-gray-300">
                      {entry.startTime || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-5 py-3 text-sm text-gray-600 dark:text-gray-300">
                      {entry.endTime || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-5 py-3 text-sm font-semibold text-gray-800 dark:text-white/90">
                      {formatDuration(entry.durationSeconds)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-5 py-3 text-sm text-gray-600 dark:text-gray-300">
                      {entry.projectName || "—"}
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate px-5 py-3 text-sm text-gray-600 dark:text-gray-300">
                      {entry.taskName || "—"}
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
                    <TableCell
                      className="max-w-[240px] truncate px-5 py-3 text-xs text-gray-500 dark:text-gray-400"
                      title={entry.reason || undefined}
                    >
                      {entry.reason || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* ── Журнал последних дней ───────────────────────────────────────── */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <h2 className="border-b border-gray-100 px-5 py-3.5 text-sm font-semibold text-gray-800 dark:border-gray-800 dark:text-white/90">
          Последние дни — {employee.name}
        </h2>
        <div className="max-w-full overflow-x-auto">
          <Table>
            <TableHeader className="border-b border-gray-100 dark:border-gray-800">
              <TableRow>
                {["Дата", "", "Отработано", "План", "Записей", "Примечание"].map((header, index) => (
                  <TableCell
                    key={header || index}
                    isHeader
                    className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400"
                  >
                    {header}
                  </TableCell>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
              {history.map((item) => (
                <TableRow
                  key={item.date}
                  className={`transition hover:bg-gray-50 dark:hover:bg-white/[0.03] ${
                    item.date === date ? "bg-brand-50/50 dark:bg-brand-500/10" : ""
                  }`}
                >
                  <TableCell className="whitespace-nowrap px-5 py-2.5 text-sm">
                    <Link
                      to={`/timesheet/${employeeId}/${item.date}`}
                      className={`font-medium hover:text-brand-500 ${
                        isWeekend(item.date)
                          ? "text-rose-500"
                          : "text-gray-700 dark:text-gray-200"
                      }`}
                    >
                      {formatDateRu(item.date)}
                    </Link>
                  </TableCell>
                  <TableCell className="px-5 py-2.5">
                    <HistoryBar day={item} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-5 py-2.5 text-sm font-semibold text-gray-800 dark:text-white/90">
                    {formatDuration(item.workedSeconds)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-5 py-2.5 text-sm text-gray-500 dark:text-gray-400">
                    {item.planHours > 0 ? formatDuration(item.planHours * 3600) : "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-5 py-2.5 text-sm text-gray-500 dark:text-gray-400">
                    {item.entryCount || "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-5 py-2.5 text-xs text-gray-500 dark:text-gray-400">
                    {item.absence || item.holiday || (item.isDayOff ? "Выходной" : "—")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
