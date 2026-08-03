import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import ruLocale from "@fullcalendar/core/locales/ru";
import type { EventClickArg, EventContentArg, EventInput } from "@fullcalendar/core";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { findDirectoryItem, isTaskOverdue } from "../constants";
import type { Task, TaskDirectories, TaskEmployee } from "../types";
import { AvatarStack, PriorityIcon } from "../components/badges";

interface CalendarViewProps {
  tasks: Task[];
  employees: TaskEmployee[];
  directories: TaskDirectories;
  onOpenTask: (task: Task) => void;
}

type CalendarViewKey = "dayGridMonth" | "dayGridWeek" | "listMonth";

const VIEW_TABS: { key: CalendarViewKey; label: string }[] = [
  { key: "dayGridMonth", label: "Месяц" },
  { key: "dayGridWeek", label: "Неделя" },
  { key: "listMonth", label: "Список" },
];

export default function CalendarView({
  tasks,
  employees,
  directories,
  onOpenTask,
}: CalendarViewProps) {
  const calendarRef = useRef<FullCalendar>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<CalendarViewKey>("dayGridMonth");
  const [title, setTitle] = useState("");

  // FullCalendar only re-measures on window resize, but this container also
  // changes width when the app sidebar collapses — watch the element itself.
  useEffect(() => {
    const node = wrapperRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => calendarRef.current?.getApi().updateSize());
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const employeeById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees]
  );

  // The calendar answers "what is due when", so a task sits on its deadline only.
  const events = useMemo<EventInput[]>(
    () =>
      tasks
        .filter((task) => task.deadline)
        .map((task) => ({
          id: task.id,
          title: task.title,
          start: task.deadline as string,
          allDay: true,
          extendedProps: { task },
        })),
    [tasks]
  );

  const withoutDeadline = tasks.length - events.length;

  const runApi = (action: "prev" | "next" | "today") => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    api[action]();
    setTitle(api.view.title);
  };

  const switchView = (next: CalendarViewKey) => {
    setView(next);
    const api = calendarRef.current?.getApi();
    if (!api) return;
    api.changeView(next);
    setTitle(api.view.title);
  };

  const handleEventClick = (info: EventClickArg) => {
    const task = info.event.extendedProps.task as Task | undefined;
    if (task) onOpenTask(task);
  };

  /** Compact chip: status color, code, title and who is on it. */
  const renderEvent = (arg: EventContentArg) => {
    const task = arg.event.extendedProps.task as Task;
    const status = findDirectoryItem(directories.statuses, task.statusId);
    const statusColor = status.color || "#94a3b8";
    const assignees = task.assigneeIds
      .map((id) => employeeById.get(id))
      .filter((employee): employee is TaskEmployee => Boolean(employee));
    const overdue = isTaskOverdue(task, directories);

    if (arg.view.type === "listMonth") {
      return (
        <span className="flex min-w-0 items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: statusColor }} />
          <span className="shrink-0 text-theme-xs font-semibold uppercase text-gray-400">
            {task.code}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-gray-700 dark:text-gray-200">
            {task.title}
          </span>
          <PriorityIcon
            priority={findDirectoryItem(directories.priorities, task.priorityId)}
            size={14}
          />
          <AvatarStack employees={assignees} size={20} max={3} />
        </span>
      );
    }

    return (
      <span
        className={`flex w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 py-[3px] ${
          overdue ? "ring-1 ring-error-400" : ""
        }`}
        style={{ backgroundColor: `${statusColor}1f` }}
        title={`${task.code} · ${task.title}`}
      >
        <span
          className="h-full w-[3px] shrink-0 self-stretch rounded-full"
          style={{ backgroundColor: statusColor }}
        />
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-gray-700 dark:text-gray-200">
          {task.title}
        </span>
        {assignees.length > 0 && <AvatarStack employees={assignees} size={16} max={2} />}
      </span>
    );
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => runApi("prev")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/5"
            aria-label="Назад"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            onClick={() => runApi("today")}
            className="h-8 rounded-lg border border-gray-200 px-3 text-sm text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
          >
            Сегодня
          </button>
          <button
            type="button"
            onClick={() => runApi("next")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/5"
            aria-label="Вперёд"
          >
            <ChevronRight size={15} />
          </button>
        </div>

        <span className="text-sm font-semibold capitalize text-gray-800 dark:text-white/90">
          {title}
        </span>

        <div className="ml-auto inline-flex rounded-xl border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-white/5">
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => switchView(tab.key)}
              className={`h-7 rounded-lg px-3 text-theme-xs font-medium transition ${
                view === tab.key
                  ? "bg-white text-brand-600 shadow-theme-xs dark:bg-gray-900 dark:text-brand-400"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={wrapperRef} className="tasks-fullcalendar px-2 py-2">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, listPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale={ruLocale}
          headerToolbar={false}
          events={events}
          eventClick={handleEventClick}
          eventContent={renderEvent}
          // Days can hold many tasks — cap the rows and let "+N ещё" open a popover.
          dayMaxEvents={3}
          moreLinkClick="popover"
          moreLinkContent={(arg) => `+${arg.num} ещё`}
          firstDay={1}
          height="auto"
          expandRows
          eventDisplay="block"
          displayEventTime={false}
          noEventsText="Нет задач в этом периоде"
          datesSet={(arg) => setTitle(arg.view.title)}
        />
      </div>

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
        <span className="ml-auto inline-flex items-center gap-1.5 text-theme-xs text-gray-400">
          <CalendarDays size={13} />
          {withoutDeadline > 0
            ? `Без дедлайна: ${withoutDeadline} — не показаны`
            : "Задача показана на дату своего дедлайна"}
        </span>
      </div>
    </div>
  );
}
