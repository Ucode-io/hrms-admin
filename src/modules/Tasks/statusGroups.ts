import type { MessageKey } from "../../i18n/messages";

// Группы статусов задач.
//
// Отдельный файл, а не часть constants.ts: его импортирует и сервис
// справочников (нормализация ответа сервера), и настройки — тянуть туда весь
// модуль задач ради трёх ключей незачем.
//
// Групп ровно три и они не настраиваются: от группы зависят даты, которые
// проставляет сервер (`beginAt`, `completedAt`). Статусов внутри группы
// сколько угодно — они и дают колонки доски.

import type { TaskStatusGroup } from "./types";

export const STATUS_GROUP_ORDER: TaskStatusGroup[] = ["todo", "in_progress", "completed"];

export const STATUS_GROUP_META: Record<
  TaskStatusGroup,
  { labelKey: MessageKey; hintKey: MessageKey; color: string }
> = {
  todo: {
    labelKey: "tasks.status_group.todo.label",
    hintKey: "tasks.status_group.todo.hint",
    color: "#94a3b8",
  },
  in_progress: {
    labelKey: "tasks.status_group.in_progress.label",
    hintKey: "tasks.status_group.in_progress.hint",
    color: "#0ba5ec",
  },
  completed: {
    labelKey: "tasks.status_group.completed.label",
    hintKey: "tasks.status_group.completed.hint",
    color: "#12b76a",
  },
};

/**
 * Группа из ответа сервера. Написания вроде «in process» приводятся к одному
 * ключу, неизвестное значение — к `fallback`: до бэкфилла `status_group` пустой
 * и группу подставляет legacy-флаг `isFinal`.
 */
export const normalizeStatusGroup = (
  value: unknown,
  fallback: TaskStatusGroup = "todo"
): TaskStatusGroup => {
  if (typeof value !== "string") return fallback;
  const key = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!key) return fallback;
  if (key === "in_process" || key === "inprocess" || key === "inprogress") return "in_progress";
  if (key === "done" || key === "complete") return "completed";
  return (STATUS_GROUP_ORDER as string[]).includes(key) ? (key as TaskStatusGroup) : fallback;
};
