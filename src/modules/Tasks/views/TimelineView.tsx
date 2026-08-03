import { useMemo, useState } from "react";
import { ChartGantt, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
  PILL_GROUP,
  PILL_ICON_BUTTON,
  PILL_LABEL,
  pillButton,
} from "../../../components/common/toolbarPill";
import { findDirectoryItem, formatTaskDate, isTaskOverdue, taskDateSpan } from "../constants";
import type { Task, TaskDirectories, TaskEmployee } from "../types";
import { AvatarStack, EmployeeAvatar } from "../components/badges";

interface TimelineViewProps {
  tasks: Task[];
  employees: TaskEmployee[];
  directories: TaskDirectories;
  onOpenTask: (task: Task) => void;
}

const LABEL_WIDTH = 300;
const ROW_HEIGHT = 38;
const UNASSIGNED = "__unassigned__";
const EMPTY_GROUP = "__empty__";

const WEEKDAY_FORMAT = new Intl.DateTimeFormat("ru-RU", { weekday: "short" });
const DAY_MONTH_FORMAT = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });
const MONTH_FORMAT = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" });

type ScaleKey = "week" | "month" | "quarter";

const SCALES: Record<ScaleKey, { label: string; pxPerDay: number }> = {
  week: { label: "Неделя", pxPerDay: 96 },
  month: { label: "Месяц", pxPerDay: 34 },
  quarter: { label: "Квартал", pxPerDay: 11 },
};

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const addDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

/** Monday-based week start. */
const startOfWeek = (date: Date) => {
  const copy = startOfDay(date);
  const shift = (copy.getDay() + 6) % 7;
  return addDays(copy, -shift);
};

const parseDate = (value: string | null): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : startOfDay(date);
};

const daysBetween = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / DAY_MS);

/** Visible date window for the current scale + cursor. */
const buildRange = (scale: ScaleKey, cursor: Date): { start: Date; end: Date } => {
  if (scale === "week") {
    const start = startOfWeek(cursor);
    return { start, end: addDays(start, 6) };
  }
  if (scale === "month") {
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    return { start, end: new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0) };
  }
  const quarterMonth = Math.floor(cursor.getMonth() / 3) * 3;
  return {
    start: new Date(cursor.getFullYear(), quarterMonth, 1),
    end: new Date(cursor.getFullYear(), quarterMonth + 3, 0),
  };
};

interface Column {
  key: string;
  /** Days covered — 1 per day column, up to 7 for a week column. */
  days: number;
  offset: number;
  title: string;
  subtitle?: string;
  isWeekend: boolean;
}

interface Row {
  task: Task;
  offset: number;
  span: number;
  cutStart: boolean;
  cutEnd: boolean;
}

interface Group {
  id: string;
  /** Заголовок группы: имя сотрудника, должность или департамент. */
  title: string;
  /** Аватар показываем только в группировке по исполнителям. */
  employee: TaskEmployee | null;
  rows: Row[];
}

/**
 * По чему раскладывать строки. Должность и департамент берутся у исполнителя —
 * своих полей у задачи для этого нет.
 */
type GroupKey = "none" | "assignee" | "position" | "department";

const GROUPS: Record<GroupKey, string> = {
  none: "Без группировки",
  assignee: "По исполнителям",
  position: "По должностям",
  department: "По департаментам",
};

export default function TimelineView({
  tasks,
  employees,
  directories,
  onOpenTask,
}: TimelineViewProps) {
  const [scale, setScale] = useState<ScaleKey>("month");
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [groupBy, setGroupBy] = useState<GroupKey>("assignee");
  const [collapsed, setCollapsed] = useState<string[]>([]);

  const { pxPerDay } = SCALES[scale];
  const range = useMemo(() => buildRange(scale, cursor), [scale, cursor]);
  const totalDays = daysBetween(range.start, range.end) + 1;

  const columns = useMemo<Column[]>(() => {
    // Day columns stay readable up to a month; a quarter switches to weeks.
    if (scale === "quarter") {
      const result: Column[] = [];
      let weekStart = startOfWeek(range.start);
      while (weekStart <= range.end) {
        const weekEnd = addDays(weekStart, 6);
        const visibleStart = weekStart < range.start ? range.start : weekStart;
        const visibleEnd = weekEnd > range.end ? range.end : weekEnd;
        result.push({
          key: visibleStart.toISOString(),
          offset: daysBetween(range.start, visibleStart),
          days: daysBetween(visibleStart, visibleEnd) + 1,
          title: DAY_MONTH_FORMAT.format(visibleStart),
          isWeekend: false,
        });
        weekStart = addDays(weekStart, 7);
      }
      return result;
    }

    return Array.from({ length: totalDays }, (_, index) => {
      const date = addDays(range.start, index);
      return {
        key: date.toISOString(),
        offset: index,
        days: 1,
        title: String(date.getDate()),
        subtitle: WEEKDAY_FORMAT.format(date),
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
      };
    });
  }, [scale, range, totalDays]);

  const today = startOfDay(new Date());
  const todayOffset =
    today >= range.start && today <= range.end ? daysBetween(range.start, today) : null;

  const rows = useMemo<Row[]>(
    () =>
      tasks
        .map((task): Row | null => {
          // The bar spans start → planned end; the deadline stands in when the
          // task has no end date of its own.
          const span = taskDateSpan(task);
          const start = parseDate(span.start);
          const end = parseDate(span.end);
          if (!start || !end || end < range.start || start > range.end) return null;

          const clampedStart = start < range.start ? range.start : start;
          const clampedEnd = end > range.end ? range.end : end;
          return {
            task,
            offset: daysBetween(range.start, clampedStart),
            span: daysBetween(clampedStart, clampedEnd) + 1,
            cutStart: start < range.start,
            cutEnd: end > range.end,
          };
        })
        .filter((row): row is Row => row !== null)
        .sort(
          (a, b) =>
            a.offset - b.offset || b.span - a.span || a.task.code.localeCompare(b.task.code)
        ),
    [tasks, range]
  );

  const groups = useMemo<Group[]>(() => {
    if (groupBy === "none") return [{ id: "all", title: "", employee: null, rows }];

    const employeeById = new Map(employees.map((employee) => [employee.id, employee]));

    /** Ключи группы для одной задачи; общая задача попадает в каждую — это чтение загрузки. */
    const keysOf = (assigneeIds: string[]): { id: string; title: string }[] => {
      if (assigneeIds.length === 0) {
        return [
          {
            id: UNASSIGNED,
            title:
              groupBy === "assignee"
                ? "Без исполнителя"
                : groupBy === "position"
                  ? "Без должности"
                  : "Без департамента",
          },
        ];
      }

      const keys = new Map<string, string>();
      assigneeIds.forEach((id) => {
        const employee = employeeById.get(id);
        if (groupBy === "assignee") {
          keys.set(id, employee?.name ?? "Неизвестный сотрудник");
          return;
        }
        if (groupBy === "position") {
          keys.set(employee?.positionId || EMPTY_GROUP, employee?.position || "Без должности");
          return;
        }
        keys.set(employee?.departmentId || EMPTY_GROUP, employee?.department || "Без департамента");
      });

      return [...keys.entries()].map(([id, title]) => ({ id, title }));
    };

    const byKey = new Map<string, Group>();
    for (const row of rows) {
      for (const key of keysOf(row.task.assigneeIds)) {
        const existing = byKey.get(key.id);
        if (existing) {
          existing.rows.push(row);
        } else {
          byKey.set(key.id, {
            id: key.id,
            title: key.title,
            employee: groupBy === "assignee" ? employeeById.get(key.id) ?? null : null,
            rows: [row],
          });
        }
      }
    }

    // Группы «без …» всегда в конце — это остаток, а не полноценная группа.
    const isTail = (id: string) => id === UNASSIGNED || id === EMPTY_GROUP;

    return [...byKey.values()].sort((a, b) => {
      if (isTail(a.id) !== isTail(b.id)) return isTail(a.id) ? 1 : -1;
      return a.title.localeCompare(b.title);
    });
  }, [rows, groupBy, employees]);

  const undatedCount = useMemo(
    () => tasks.filter((task) => !task.startDate && !task.endDate && !task.deadline).length,
    [tasks]
  );

  // Заглавная только первая буква: Intl отдаёт «август 2026 г.», а CSS
  // `capitalize` поднимал регистр у каждого слова и давал «Август 2026 Г.».
  const rawTitle =
    scale === "quarter"
      ? `${Math.floor(range.start.getMonth() / 3) + 1}-й квартал ${range.start.getFullYear()}`
      : scale === "week"
        ? `${DAY_MONTH_FORMAT.format(range.start)} — ${DAY_MONTH_FORMAT.format(range.end)}`
        : MONTH_FORMAT.format(range.start);
  const title = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);

  const shift = (direction: 1 | -1) => {
    setCursor((current) => {
      if (scale === "week") return addDays(current, 7 * direction);
      const months = scale === "month" ? 1 : 3;
      return new Date(current.getFullYear(), current.getMonth() + months * direction, 1);
    });
  };

  const gridWidth = totalDays * pxPerDay;

  const renderRow = (row: Row, key: string) => {
    const { task, offset, span, cutStart, cutEnd } = row;
    const status = findDirectoryItem(directories.statuses, task.statusId);
    const statusColor = status.color || "#94a3b8";
    const overdue = isTaskOverdue(task, directories);
    const done = task.checklist.filter((item) => item.done).length;
    const progress = task.checklist.length ? (done / task.checklist.length) * 100 : 0;
    const assignees = task.assigneeIds
      .map((id) => employees.find((employee) => employee.id === id))
      .filter((employee): employee is TaskEmployee => Boolean(employee));
    const width = Math.max(span * pxPerDay - 4, 12);

    return (
      <div
        key={key}
        className="flex border-b border-gray-50 last:border-b-0 hover:bg-gray-50/60 dark:border-gray-800/60 dark:hover:bg-white/[0.02]"
      >
        <button
          type="button"
          onClick={() => onOpenTask(task)}
          className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-gray-100 bg-white px-4 text-left transition hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-white/5"
          style={{ width: LABEL_WIDTH, height: ROW_HEIGHT }}
          title={`${task.code} · ${task.title}`}
        >
          <span className="shrink-0 text-theme-xs font-semibold uppercase tracking-wide text-gray-400">
            {task.code}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-gray-700 dark:text-gray-300">
            {task.title}
          </span>
          {groupBy !== "assignee" && <AvatarStack employees={assignees} size={20} max={2} />}
        </button>

        <div className="relative shrink-0" style={{ width: gridWidth, height: ROW_HEIGHT }}>
          <button
            type="button"
            onClick={() => onOpenTask(task)}
            title={`${task.code} · ${task.title}\n${status.title} · ${formatTaskDate(
              task.startDate
            )} — ${formatTaskDate(task.endDate)}\nДедлайн: ${formatTaskDate(task.deadline)}`}
            className={`absolute top-1/2 flex h-[22px] -translate-y-1/2 items-center overflow-hidden shadow-theme-xs transition hover:brightness-105 ${
              cutStart ? "rounded-l-none" : "rounded-l-md"
            } ${cutEnd ? "rounded-r-none" : "rounded-r-md"} ${
              overdue ? "ring-1 ring-error-400 ring-offset-1" : ""
            }`}
            style={{ left: offset * pxPerDay + 2, width, backgroundColor: statusColor }}
          >
            {/* Checklist progress reads as a darker fill inside the bar. */}
            {progress > 0 && (
              <span
                className="absolute inset-y-0 left-0 bg-black/15"
                style={{ width: `${progress}%` }}
              />
            )}
            {width > 60 && (
              <span className="relative truncate px-2 text-[11px] font-medium text-white">
                {task.title}
              </span>
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
        <div className={PILL_GROUP}>
          <button
            type="button"
            onClick={() => shift(-1)}
            className={PILL_ICON_BUTTON}
            aria-label="Назад"
          >
            <ChevronLeft size={16} />
          </button>
          {/* Подпись периода — она же «вернуться к сегодня»: отдельная кнопка
              рядом со стрелками загромождала бы тулбар. */}
          <button
            type="button"
            onClick={() => setCursor(startOfDay(new Date()))}
            title="Вернуться к текущему периоду"
            className={`${PILL_LABEL} h-[30px] rounded-[8px] border border-transparent transition hover:border-slate-200 hover:bg-white dark:hover:border-gray-600 dark:hover:bg-white/10`}
          >
            {title}
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            className={PILL_ICON_BUTTON}
            aria-label="Вперёд"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className={PILL_GROUP}>
            {(Object.keys(SCALES) as ScaleKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setScale(key)}
                className={pillButton(scale === key)}
              >
                {SCALES[key].label}
              </button>
            ))}
          </div>

          <select
            value={groupBy}
            onChange={(event) => {
              setGroupBy(event.target.value as GroupKey);
              // Свёрнутые группы принадлежали прежней разбивке.
              setCollapsed([]);
            }}
            aria-label="Группировка"
            className={`h-[38px] cursor-pointer rounded-[12px] border px-2.5 text-[13px] font-semibold transition focus:outline-hidden ${
              groupBy === "none"
                ? "border-slate-200 bg-slate-50 text-slate-600 hover:bg-white dark:border-gray-700 dark:bg-white/5 dark:text-gray-300"
                : "border-brand-200 bg-brand-50 text-brand-600 dark:border-brand-500/30 dark:bg-brand-500/10"
            }`}
          >
            {(Object.keys(GROUPS) as GroupKey[]).map((key) => (
              <option key={key} value={key}>
                {GROUPS[key]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16">
          <ChartGantt size={36} className="text-gray-300" />
          <p className="text-sm font-medium text-gray-500">Нет задач в этом периоде</p>
          <p className="text-xs text-gray-400">Задачи без дат не отображаются на графике</p>
        </div>
      ) : (
        <div className="custom-scrollbar max-w-full overflow-x-auto">
          <div className="relative" style={{ width: LABEL_WIDTH + gridWidth }}>
            {/* Header */}
            <div className="flex border-b border-gray-100 dark:border-gray-800">
              <div
                className="sticky left-0 z-20 shrink-0 border-r border-gray-100 bg-white px-4 py-2 text-theme-xs font-medium text-gray-500 dark:border-gray-800 dark:bg-gray-900"
                style={{ width: LABEL_WIDTH }}
              >
                Задача
              </div>
              {columns.map((column) => {
                const isToday =
                  todayOffset !== null &&
                  todayOffset >= column.offset &&
                  todayOffset < column.offset + column.days;
                return (
                  <div
                    key={column.key}
                    className={`shrink-0 border-l border-gray-50 py-1.5 text-center dark:border-gray-800/60 ${
                      isToday
                        ? "bg-brand-50 dark:bg-brand-500/10"
                        : column.isWeekend
                          ? "bg-gray-50 dark:bg-white/[0.02]"
                          : ""
                    }`}
                    style={{ width: column.days * pxPerDay }}
                  >
                    <div
                      className={`text-theme-xs font-medium ${
                        isToday ? "text-brand-500" : "text-gray-600 dark:text-gray-300"
                      }`}
                    >
                      {column.title}
                    </div>
                    {column.subtitle && (
                      <div className="text-[10px] text-gray-400">{column.subtitle}</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Rows */}
            <div className="relative">
              {/* Weekend shading behind every row */}
              <div
                className="pointer-events-none absolute inset-y-0 flex"
                style={{ left: LABEL_WIDTH, width: gridWidth }}
              >
                {columns.map((column) => (
                  <div
                    key={column.key}
                    className={`h-full shrink-0 border-l border-gray-50 dark:border-gray-800/50 ${
                      column.isWeekend ? "bg-gray-50/60 dark:bg-white/[0.02]" : ""
                    }`}
                    style={{ width: column.days * pxPerDay }}
                  />
                ))}
              </div>

              {/* Today marker */}
              {todayOffset !== null && (
                <div
                  className="pointer-events-none absolute inset-y-0 z-[5] w-0.5 bg-brand-500/70"
                  style={{ left: LABEL_WIDTH + todayOffset * pxPerDay + pxPerDay / 2 }}
                />
              )}

              {groups.map((group) => (
                <div key={group.id}>
                  {groupBy !== "none" && (
                    <div className="flex border-b border-gray-100 bg-gray-50/80 dark:border-gray-800 dark:bg-white/[0.02]">
                      <button
                        type="button"
                        onClick={() =>
                          setCollapsed((ids) =>
                            ids.includes(group.id)
                              ? ids.filter((id) => id !== group.id)
                              : [...ids, group.id]
                          )
                        }
                        className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-gray-100 bg-gray-50 px-4 py-2 text-left dark:border-gray-800 dark:bg-gray-900"
                        style={{ width: LABEL_WIDTH }}
                      >
                        <ChevronDown
                          size={14}
                          className={`shrink-0 text-gray-400 transition ${
                            collapsed.includes(group.id) ? "-rotate-90" : ""
                          }`}
                        />
                        {/* Аватар осмыслен только у группировки по исполнителям */}
                        {groupBy === "assignee" && (
                          <EmployeeAvatar employee={group.employee} size={22} />
                        )}
                        <span
                          className="min-w-0 flex-1 truncate text-sm font-medium text-gray-700 dark:text-gray-200"
                          title={group.title}
                        >
                          {group.title}
                        </span>
                        <span className="shrink-0 rounded-full bg-gray-200 px-1.5 text-[10px] font-semibold text-gray-600 dark:bg-white/10 dark:text-gray-300">
                          {group.rows.length}
                        </span>
                      </button>
                      <div className="shrink-0" style={{ width: gridWidth }} />
                    </div>
                  )}

                  {!collapsed.includes(group.id) &&
                    group.rows.map((row) => renderRow(row, `${group.id}-${row.task.id}`))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 border-t border-gray-100 px-4 py-2.5 dark:border-gray-800">
        {directories.statuses.map((status) => (
          <span
            key={status.id}
            className="inline-flex items-center gap-1.5 text-theme-xs text-gray-500 dark:text-gray-400"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: status.color || "#94a3b8" }}
            />
            {status.title}
          </span>
        ))}
        {undatedCount > 0 && (
          <span className="ml-auto text-theme-xs text-gray-400">
            Без дат: {undatedCount} — не показаны на графике
          </span>
        )}
      </div>
    </div>
  );
}
