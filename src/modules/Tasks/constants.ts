// Работа со справочниками модуля и общие хелперы представлений.
//
// Статусы, приоритеты, типы и теги приходят с сервера, поэтому подписи и цвета
// больше не константы: их достают из `TaskDirectories` по id. Функции ниже —
// единственное место, где решается, что показывать, если справочник ещё не
// загрузился или элемент удалили.

import type { MessageKey } from "../../i18n/messages";
import type {
  Task,
  TaskDirectories,
  TaskDirectoryItem,
  TaskStatusGroup,
  TasksViewKey,
} from "./types";

/** Заглушка для id, которого нет в справочнике (элемент удалили). */
const UNKNOWN: TaskDirectoryItem = {
  id: "",
  title: "—",
  color: "#94a3b8",
  icon: "",
  group: "todo",
  isInitial: false,
  isDefault: false,
  sortOrder: 0,
};

export const findDirectoryItem = (
  items: TaskDirectoryItem[],
  id: string | null | undefined
): TaskDirectoryItem => items.find((item) => item.id === id) ?? UNKNOWN;

export const statusOf = (directories: TaskDirectories, id: string | null | undefined) =>
  findDirectoryItem(directories.statuses, id);

export const priorityOf = (directories: TaskDirectories, id: string | null | undefined) =>
  findDirectoryItem(directories.priorities, id);

export const typeOf = (directories: TaskDirectories, id: string | null | undefined) =>
  findDirectoryItem(directories.types, id);

export const tagOf = (directories: TaskDirectories, id: string | null | undefined) =>
  findDirectoryItem(directories.tags, id);

/** Статус новой задачи: помеченный `isInitial`, иначе первый по порядку. */
export const initialStatus = (directories: TaskDirectories): TaskDirectoryItem | null =>
  directories.statuses.find((item) => item.isInitial) ?? directories.statuses[0] ?? null;

/** Приоритет новой задачи. */
export const defaultPriority = (directories: TaskDirectories): TaskDirectoryItem | null =>
  directories.priorities.find((item) => item.isDefault) ?? directories.priorities[0] ?? null;

/** Группа статуса задачи: от неё зависят даты, которые ставит сервер. */
export const statusGroupOf = (
  directories: TaskDirectories,
  statusId: string | null | undefined
): TaskStatusGroup => statusOf(directories, statusId).group;

/** «Работа закончена»: по таким статусам сервер проставляет дату окончания. */
export const isFinalStatus = (
  directories: TaskDirectories,
  statusId: string | null | undefined
): boolean => statusGroupOf(directories, statusId) === "completed";

/** Статусы одной группы — колонки доски внутри секции. */
export const statusesOfGroup = (
  directories: TaskDirectories,
  group: TaskStatusGroup
): TaskDirectoryItem[] => directories.statuses.filter((item) => item.group === group);

/**
 * Цвет элемента справочника → инлайновые стили плашки. Палитра приходит из
 * настроек, поэтому классов Tailwind тут быть не может.
 */
export const chipStyle = (color: string): React.CSSProperties => ({
  backgroundColor: `${color || UNKNOWN.color}1f`,
  color: color || UNKNOWN.color,
});

export const dotStyle = (color: string): React.CSSProperties => ({
  backgroundColor: color || UNKNOWN.color,
});

export const VIEW_ORDER: TasksViewKey[] = ["board", "table", "timeline", "calendar"];

export const VIEW_META: Record<TasksViewKey, { labelKey: MessageKey }> = {
  board: { labelKey: "tasks.views.board" },
  table: { labelKey: "tasks.views.table" },
  timeline: { labelKey: "tasks.views.timeline" },
  calendar: { labelKey: "tasks.views.calendar" },
};

export const formatTaskDate = (value: string | null | undefined): string => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
};

/** Просрочка считается по дедлайну и только у незавершённых задач. */
export const isTaskOverdue = (
  task: { deadline: string | null; statusId: string | null },
  directories: TaskDirectories
): boolean => {
  if (!task.deadline || isFinalStatus(directories, task.statusId)) return false;
  const due = new Date(task.deadline);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
};

/**
 * Полоса задачи на диаграмме. `endDate` появляется только после завершения,
 * поэтому у активных задач правый край — дедлайн.
 */
export const taskDateSpan = (
  task: Pick<Task, "startDate" | "endDate" | "deadline">
): { start: string | null; end: string | null } => {
  const start = task.startDate ?? task.endDate ?? task.deadline;
  const end = task.endDate ?? task.deadline ?? task.startDate;
  return { start, end };
};

/** Direct children of a task, in board order. */
export const subtasksOf = (tasks: Task[], parentId: string): Task[] =>
  tasks.filter((task) => task.parentId === parentId).sort((a, b) => a.order - b.order);

/**
 * Ids of a task and everything under it. Used to keep the parent picker from
 * offering an option that would close the graph into a cycle.
 */
export const descendantIds = (tasks: Task[], rootId: string): Set<string> => {
  const result = new Set<string>([rootId]);
  let frontier = [rootId];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const task of tasks) {
      if (task.parentId && frontier.includes(task.parentId) && !result.has(task.id)) {
        result.add(task.id);
        next.push(task.id);
      }
    }
    frontier = next;
  }
  return result;
};

export const getInitials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
