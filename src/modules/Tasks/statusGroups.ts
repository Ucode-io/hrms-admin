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
  { label: string; hint: string; color: string }
> = {
  todo: {
    label: "К выполнению",
    hint: "Задача заведена, но к ней не приступали. Возврат сюда очищает даты начала и окончания.",
    color: "#94a3b8",
  },
  in_progress: {
    label: "В работе",
    hint: "При переходе сюда проставляется дата начала работ.",
    color: "#0ba5ec",
  },
  completed: {
    label: "Завершено",
    hint: "При переходе сюда проставляется дата окончания.",
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
