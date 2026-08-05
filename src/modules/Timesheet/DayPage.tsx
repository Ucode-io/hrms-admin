import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ChevronLeft, ChevronRight, Clock, PencilLine } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
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
import { formatDateRu, formatDuration, shiftDays } from "./constants";
import { EmployeeAvatar, SourceBadge } from "./components/badges";
import DayTimeline from "./components/DayTimeline";
import SummaryCards, { type SummaryItem } from "./components/SummaryCards";
import {
  EntriesSkeleton,
  Skeleton,
  SummaryCardsSkeleton,
  TimelineSkeleton,
} from "./components/DaySkeletons";

export default function TimesheetDayPage() {
  const { employeeId = "", date = "" } = useParams();
  const navigate = useNavigate();
  const brandColor = companyStore.mainColor || "#2563eb";
  /** Общая подсветка строки таблицы и её сегмента на таймлайне. */
  const [hoveredEntryId, setHoveredEntryId] = useState<string | null>(null);

  const { data, isError, error, isPreviousData } = useTimesheetDayQuery(employeeId, date);

  /**
   * Пока грузится соседний день, в `data` лежит предыдущий: сотрудник тот же —
   * его шапку показываем сразу, а цифры дня уже чужие, поэтому на их месте
   * скелетон. Из-за этого страница не схлопывается в спиннер на каждый клик по
   * стрелке даты.
   */
  const employee =
    data && (!data.employee.employeeId || data.employee.employeeId === employeeId)
      ? data.employee
      : null;
  const dayData = data && !isPreviousData ? data : null;
  const day = dayData?.day ?? null;
  const entries = dayData?.entries ?? [];

  useHeaderBreadcrumbItems(
    useMemo(
      () => [
        { label: "Табель времени", to: "/timesheet" },
        {
          label: employee ? `${employee.name} — ${formatDateRu(date)}` : formatDateRu(date),
          to: `/timesheet/${employeeId}/${date}`,
        },
      ],
      [employee, employeeId, date]
    )
  );

  const summaryItems = useMemo<SummaryItem[]>(() => {
    if (!dayData) return [];
    const { day } = dayData;
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
  }, [dayData, brandColor]);

  if (isError && !data) {
    return (
      <div className="rounded-2xl border border-error-200 bg-error-50 px-5 py-8 text-center text-sm text-error-600 dark:border-error-500/30 dark:bg-error-500/10">
        {error instanceof Error ? error.message : "Не удалось загрузить день табеля."}
      </div>
    );
  }

  return (
    <>
      <PageMeta
        title={`${employee ? `${employee.name} — ` : ""}${formatDateRu(date)} | Табель времени`}
        description="Детализация отработанного времени за день"
      />

      {/* ── Шапка сотрудника ────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-center gap-4">
          {employee ? (
            <>
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
            </>
          ) : (
            <>
              <Skeleton className="h-[52px] w-[52px] rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-44" />
                <Skeleton className="h-3.5 w-32" />
              </div>
            </>
          )}

          {/* Соседние дни: разбор дня почти всегда продолжается вчера/завтра.
              Переключатель тот же, что в «Время → Посещаемость». */}
          <div
            className="ml-auto"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "3px",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              backgroundColor: "#f8fafc",
              height: "38px",
            }}
          >
            <button
              type="button"
              onClick={() => navigate(`/timesheet/${employeeId}/${shiftDays(date, -1)}`)}
              className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-transparent text-slate-600 transition hover:border-slate-200 hover:bg-white"
              aria-label="Предыдущий день"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[150px] px-3 text-center text-[13px] font-semibold text-slate-700">
              {formatDateRu(date)}
            </span>
            <button
              type="button"
              onClick={() => navigate(`/timesheet/${employeeId}/${shiftDays(date, 1)}`)}
              className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-transparent text-slate-600 transition hover:border-slate-200 hover:bg-white"
              aria-label="Следующий день"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4">
        {day ? <SummaryCards items={summaryItems} /> : <SummaryCardsSkeleton />}
      </div>

      {/* ── Таймлайн дня ────────────────────────────────────────────────── */}
      <div className="mt-4">
        {day ? (
          <DayTimeline
            date={date}
            entries={entries}
            hoveredEntryId={hoveredEntryId}
            onHoverEntry={setHoveredEntryId}
          />
        ) : (
          <TimelineSkeleton />
        )}
      </div>

      {/* ── Записи дня ──────────────────────────────────────────────────── */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <h2 className="border-b border-gray-100 px-5 py-3.5 text-sm font-semibold text-gray-800 dark:border-gray-800 dark:text-white/90">
          Записи времени за {formatDateRu(date)}
        </h2>

        {!day ? (
          <EntriesSkeleton />
        ) : entries.length === 0 ? (
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
                  <TableRow
                    key={entry.id}
                    // Подсветка связывает строку с её сегментом на таймлайне —
                    // в обе стороны, поэтому состояние живёт на странице.
                    onMouseEnter={() => setHoveredEntryId(entry.id)}
                    onMouseLeave={() => setHoveredEntryId(null)}
                    className={`transition-colors ${
                      hoveredEntryId === entry.id
                        ? "bg-brand-50/70 dark:bg-brand-500/10"
                        : "hover:bg-gray-50 dark:hover:bg-white/[0.03]"
                    }`}
                  >
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
    </>
  );
}
