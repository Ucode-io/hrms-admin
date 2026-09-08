import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import ruLocale from "@fullcalendar/core/locales/ru";
import type { DatesSetArg, EventClickArg, EventContentArg, EventInput } from "@fullcalendar/core";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { findDirectoryItem, isTaskOverdue } from "../constants";
import type { Task, TaskDirectories, TaskEmployee } from "../types";
import { AvatarStack } from "../components/badges";

interface CalendarViewProps {
  tasks: Task[];
  employees: TaskEmployee[];
  directories: TaskDirectories;
  onOpenTask: (task: Task) => void;
  onCreateTask: (deadline: string) => void;
}

interface HoveredCalendarCell {
  date: string;
  left: number;
  top: number;
}

type FullCalendarViewKey = "timeGridDay" | "timeGridWeek" | "dayGridMonth";
type CalendarViewKey = FullCalendarViewKey | "year";

const VIEW_TABS: { key: CalendarViewKey; label: string }[] = [
  { key: "timeGridDay", label: "День" },
  { key: "timeGridWeek", label: "Неделя" },
  { key: "dayGridMonth", label: "Месяц" },
  { key: "year", label: "Год" },
];

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const sameDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const monthDays = (year: number, month: number) => {
  const first = new Date(year, month, 1, 12);
  const offsetFromMonday = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offsetFromMonday, 12);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
};

const titleForView = (view: CalendarViewKey, date: Date) => {
  if (view === "year") return { primary: "", secondary: String(date.getFullYear()) };
  if (view === "timeGridDay") {
    const dayAndMonth = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(date);
    return { primary: dayAndMonth, secondary: String(date.getFullYear()) };
  }
  return { primary: MONTHS[date.getMonth()], secondary: String(date.getFullYear()) };
};

function MiniMonth({ value, onSelect }: { value: Date; onSelect: (date: Date) => void }) {
  const today = new Date();
  const days = monthDays(value.getFullYear(), value.getMonth());
  return (
    <div className="tasks-mini-month" aria-label={`${MONTHS[value.getMonth()]} ${value.getFullYear()}`}>
      <div className="tasks-mini-month__weekdays" aria-hidden="true">
        {WEEKDAYS.map((day) => <span key={day}>{day.slice(0, 1)}</span>)}
      </div>
      <div className="tasks-mini-month__days">
        {days.map((date) => {
          const isOutside = date.getMonth() !== value.getMonth();
          const isToday = sameDay(date, today);
          const isSelected = sameDay(date, value);
          return (
            <button
              key={`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`}
              type="button"
              className={`${isOutside ? "is-outside" : ""} ${isToday ? "is-today" : ""} ${isSelected && !isToday ? "is-selected" : ""}`}
              onClick={() => onSelect(date)}
              aria-current={isToday ? "date" : undefined}
              aria-label={date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function YearView({ value, onSelect }: { value: Date; onSelect: (date: Date) => void }) {
  const today = new Date();
  const year = value.getFullYear();
  return (
    <div className="tasks-year-grid">
      {MONTHS.map((monthName, month) => (
        <section key={monthName} className="tasks-year-month">
          <button type="button" className="tasks-year-month__title" onClick={() => onSelect(new Date(year, month, 1, 12))}>
            {monthName}
          </button>
          <div className="tasks-year-month__weekdays" aria-hidden="true">
            {WEEKDAYS.map((day) => <span key={day}>{day.slice(0, 1)}</span>)}
          </div>
          <div className="tasks-year-month__days">
            {monthDays(year, month).map((date) => {
              const isOutside = date.getMonth() !== month;
              const isToday = sameDay(date, today);
              return (
                <button
                  key={`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`}
                  type="button"
                  className={`${isOutside ? "is-outside" : ""} ${isToday ? "is-today" : ""}`}
                  onClick={() => onSelect(date)}
                  aria-current={isToday ? "date" : undefined}
                  aria-label={date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function CalendarView({ tasks, employees, directories, onOpenTask, onCreateTask }: CalendarViewProps) {
  const calendarRef = useRef<FullCalendar>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<CalendarViewKey>("dayGridMonth");
  const [visibleDate, setVisibleDate] = useState(() => new Date());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [hoveredCell, setHoveredCell] = useState<HoveredCalendarCell | null>(null);

  useEffect(() => {
    const node = wrapperRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => calendarRef.current?.getApi().updateSize());
    observer.observe(node);
    return () => observer.disconnect();
  }, [view]);

  useEffect(() => {
    if (selectedTask && !tasks.some((task) => task.id === selectedTask.id)) setSelectedTask(null);
  }, [selectedTask, tasks]);

  const employeeById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);
  const events = useMemo<EventInput[]>(() => tasks.filter((task) => task.deadline).map((task) => ({
    id: task.id,
    title: task.title,
    start: task.deadline as string,
    allDay: true,
    extendedProps: { task },
  })), [tasks]);
  const selectedStatus = selectedTask ? findDirectoryItem(directories.statuses, selectedTask.statusId) : null;

  const runApi = (action: "prev" | "next" | "today") => {
    if (view === "year") {
      setVisibleDate((current) => action === "today"
        ? new Date()
        : new Date(current.getFullYear() + (action === "next" ? 1 : -1), current.getMonth(), 1, 12));
      return;
    }
    const api = calendarRef.current?.getApi();
    if (!api) return;
    api[action]();
    setVisibleDate(api.getDate());
  };

  const switchView = (next: CalendarViewKey, date = visibleDate) => {
    setHoveredCell(null);
    if (next === view && next !== "year") {
      calendarRef.current?.getApi().gotoDate(date);
      setVisibleDate(date);
      return;
    }
    setVisibleDate(date);
    setView(next);
  };

  const handleDatesSet = (arg: DatesSetArg) => setVisibleDate(arg.view.calendar.getDate());

  const handleCalendarMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    const wrapper = wrapperRef.current;
    const target = event.target as HTMLElement;
    if (!wrapper || target.closest(".tasks-calendar-cell-add")) return;

    const wrapperRect = wrapper.getBoundingClientRect();
    const dayCell = target.closest<HTMLElement>(".fc-daygrid-day[data-date]");
    if (dayCell?.dataset.date) {
      const rect = dayCell.getBoundingClientRect();
      const next = {
        date: dayCell.dataset.date,
        left: rect.right - wrapperRect.left - 34,
        top: rect.top - wrapperRect.top + 5,
      };
      setHoveredCell((current) =>
        current?.date === next.date && current.left === next.left && current.top === next.top ? current : next
      );
      return;
    }

    const column = Array.from(wrapper.querySelectorAll<HTMLElement>(".fc-timegrid-col[data-date]")).find((node) => {
      const rect = node.getBoundingClientRect();
      return event.clientX >= rect.left && event.clientX <= rect.right;
    });
    const slot = Array.from(wrapper.querySelectorAll<HTMLElement>(".fc-timegrid-slot-lane[data-time]")).find((node) => {
      const rect = node.getBoundingClientRect();
      return event.clientY >= rect.top && event.clientY <= rect.bottom;
    });

    if (!column?.dataset.date || !slot) {
      setHoveredCell(null);
      return;
    }

    const columnRect = column.getBoundingClientRect();
    const slotRect = slot.getBoundingClientRect();
    const next = {
      date: column.dataset.date,
      left: columnRect.right - wrapperRect.left - 34,
      top: slotRect.top - wrapperRect.top + 4,
    };
    setHoveredCell((current) =>
      current?.date === next.date && current.left === next.left && current.top === next.top ? current : next
    );
  };
  const handleEventClick = (info: EventClickArg) => {
    const task = info.event.extendedProps.task as Task | undefined;
    if (!task) return;
    setSelectedTask(task);
    if (view !== "timeGridDay") onOpenTask(task);
  };

  const renderEvent = (arg: EventContentArg) => {
    const task = arg.event.extendedProps.task as Task;
    const status = findDirectoryItem(directories.statuses, task.statusId);
    const statusColor = status.color || "#94a3b8";
    const assignees = task.assigneeIds.map((id) => employeeById.get(id)).filter((employee): employee is TaskEmployee => Boolean(employee));
    const overdue = isTaskOverdue(task, directories);
    return (
      <span
        className={`flex w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 py-[3px] ${overdue ? "ring-1 ring-error-400" : ""}`}
        style={{ backgroundColor: `${statusColor}1f` }}
        title={`${task.code} · ${task.title}`}
      >
        <span className="h-full w-[3px] shrink-0 self-stretch rounded-full" style={{ backgroundColor: statusColor }} />
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-gray-700 dark:text-gray-200">{task.title}</span>
        {assignees.length > 0 && <AvatarStack employees={assignees} size={16} max={2} />}
      </span>
    );
  };

  const title = titleForView(view, visibleDate);
  const weekday = new Intl.DateTimeFormat("ru-RU", { weekday: "long" }).format(visibleDate);
  const isTimeGrid = view === "timeGridDay" || view === "timeGridWeek";

  return (
    <div className={`tasks-calendar-shell ${view === "dayGridMonth" ? "tasks-calendar-shell--month" : ""} bg-white dark:bg-gray-950`}>
      <div className="tasks-calendar-topbar">
        <div className="tasks-calendar-view-switcher" role="tablist" aria-label="Вид календаря">
          {VIEW_TABS.map((tab) => (
            <button key={tab.key} type="button" role="tab" aria-selected={view === tab.key} onClick={() => switchView(tab.key)} className={view === tab.key ? "is-active" : ""}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="tasks-calendar-heading">
        <div>
          <h2>
            {title.primary && <strong>{title.primary}</strong>}
            {title.primary && " "}
            <span>{title.secondary}</span>
          </h2>
          {view === "timeGridDay" && <p>{weekday}</p>}
        </div>
        <div className="tasks-calendar-navigation" aria-label="Навигация по календарю">
          <button type="button" onClick={() => runApi("prev")} aria-label="Предыдущий период"><ChevronLeft size={17} /></button>
          <button type="button" className="tasks-calendar-navigation__today" onClick={() => runApi("today")}>Сегодня</button>
          <button type="button" onClick={() => runApi("next")} aria-label="Следующий период"><ChevronRight size={17} /></button>
        </div>
      </div>

      {view === "year" ? (
        <YearView value={visibleDate} onSelect={(date) => switchView("dayGridMonth", date)} />
      ) : (
        <div className={`tasks-calendar-content ${view === "timeGridDay" ? "tasks-calendar-day-layout" : ""}`}>
          <div
            ref={wrapperRef}
            className="tasks-fullcalendar"
            onMouseMove={handleCalendarMouseMove}
            onMouseLeave={() => setHoveredCell(null)}
          >
            <FullCalendar
              key={view}
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView={view as FullCalendarViewKey}
              initialDate={visibleDate}
              locale={ruLocale}
              headerToolbar={false}
              events={events}
              eventClick={handleEventClick}
              eventContent={renderEvent}
              dayMaxEvents={view === "dayGridMonth" ? 3 : false}
              moreLinkClick="popover"
              moreLinkContent={(arg) => `Ещё ${arg.num}`}
              firstDay={1}
              height={view === "dayGridMonth" ? "auto" : "100%"}
              expandRows={!isTimeGrid}
              eventDisplay="block"
              displayEventTime={false}
              allDayText="весь день"
              noEventsText="Нет задач в этом периоде"
              slotMinTime="00:00:00"
              slotMaxTime="24:00:00"
              scrollTime="02:30:00"
              slotDuration="01:00:00"
              slotLabelInterval="01:00:00"
              slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
              nowIndicator
              stickyHeaderDates
              dayHeaders={view !== "timeGridDay"}
              dayHeaderContent={(arg) => {
                if (view !== "timeGridWeek") return arg.text.toUpperCase();
                const shortWeekday = new Intl.DateTimeFormat("ru-RU", { weekday: "short" })
                  .format(arg.date)
                  .replace(".", "");
                return (
                  <span className="tasks-calendar-week-header">
                    <span>{shortWeekday}</span>
                    <b className={sameDay(arg.date, new Date()) ? "is-today" : ""}>
                      {arg.date.getDate()}
                    </b>
                  </span>
                );
              }}
              datesSet={handleDatesSet}
            />
            {hoveredCell && (
              <button
                type="button"
                className="tasks-calendar-cell-add"
                style={{ left: hoveredCell.left, top: hoveredCell.top }}
                title="Новая задача"
                aria-label={`Создать задачу на ${new Date(`${hoveredCell.date}T12:00:00`).toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}`}
                data-date={hoveredCell.date}
                onClick={(event) => {
                  event.stopPropagation();
                  const deadline = hoveredCell.date;
                  setHoveredCell(null);
                  onCreateTask(deadline);
                }}
              >
                <Plus size={15} strokeWidth={2.25} aria-hidden="true" />
              </button>
            )}
          </div>
          {view === "timeGridDay" && (
            <aside className="tasks-calendar-inspector">
              <MiniMonth value={visibleDate} onSelect={(date) => switchView("timeGridDay", date)} />
              {selectedTask ? (
                <div className="tasks-calendar-inspector__task">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: selectedStatus?.color || "#94a3b8" }} />
                    <span>{selectedStatus?.title || "Без статуса"}</span>
                  </div>
                  <strong>{selectedTask.title}</strong>
                  <span>{selectedTask.code}</span>
                  <button type="button" onClick={() => onOpenTask(selectedTask)}>Открыть задачу</button>
                </div>
              ) : (
                <div className="tasks-calendar-inspector__empty">
                  <CalendarDays size={28} strokeWidth={1.5} />
                  <span>Выберите задачу</span>
                </div>
              )}
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
