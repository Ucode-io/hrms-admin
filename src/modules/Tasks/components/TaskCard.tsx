import { CalendarDays, CheckSquare, GitBranch, MessageSquare, Paperclip } from "lucide-react";
import { findDirectoryItem, formatTaskDate, isTaskOverdue } from "../constants";
import type { Task, TaskDirectories, TaskEmployee } from "../types";
import { AvatarStack, LocationBadge, PriorityBadge, TagBadge, TypeIcon } from "./badges";

interface TaskCardProps {
  task: Task;
  assignees: TaskEmployee[];
  /** Справочники компании: из них берутся подписи, цвета и иконки. */
  directories: TaskDirectories;
  /** Название локации — сама она живёт в справочнике HRMS. */
  locationTitle?: string;
  /** How many tasks point at this one as their parent. */
  subtaskCount?: number;
  /** Set when the task itself is a subtask — shown as a small marker. */
  parentCode?: string | null;
  onClick?: () => void;
}

export default function TaskCard({
  task,
  assignees,
  directories,
  locationTitle = "",
  subtaskCount = 0,
  parentCode = null,
  onClick,
}: TaskCardProps) {
  const overdue = isTaskOverdue(task, directories);
  const doneItems = task.checklist.filter((item) => item.done).length;
  const type = findDirectoryItem(directories.types, task.typeId);
  const priority = findDirectoryItem(directories.priorities, task.priorityId);

  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-xl border border-gray-200 bg-white p-3 shadow-theme-xs transition hover:border-brand-300 hover:shadow-theme-sm dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <TypeIcon type={type} size={14} />
          <span className="truncate text-theme-xs font-medium uppercase tracking-wide text-gray-400">
            {task.code}
          </span>
          {parentCode && (
            <span
              className="inline-flex shrink-0 items-center gap-0.5 rounded bg-gray-100 px-1 text-[10px] font-medium text-gray-500 dark:bg-white/10 dark:text-gray-400"
              title={`Подзадача ${parentCode}`}
            >
              <GitBranch size={9} />
              {parentCode}
            </span>
          )}
        </span>
        <span className="shrink-0">
          <PriorityBadge priority={priority} />
        </span>
      </div>

      <p className="mt-1.5 text-sm font-medium text-gray-800 dark:text-white/90">{task.title}</p>

      {locationTitle && (
        <div className="mt-1.5">
          <LocationBadge location={locationTitle} />
        </div>
      )}

      {task.tagIds.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1 overflow-hidden">
          {task.tagIds.map((tagId) => (
            <TagBadge key={tagId} tag={findDirectoryItem(directories.tags, tagId)} />
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <AvatarStack employees={assignees} />
          <span
            className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-theme-xs ${
              overdue ? "font-medium text-error-600" : "text-gray-500 dark:text-gray-400"
            }`}
            title={`Дедлайн: ${formatTaskDate(task.deadline)}`}
          >
            <CalendarDays size={13} />
            {formatTaskDate(task.deadline)}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2 text-theme-xs text-gray-400">
          {subtaskCount > 0 && (
            <span className="inline-flex items-center gap-1" title="Подзадачи">
              <GitBranch size={13} />
              {subtaskCount}
            </span>
          )}
          {task.checklist.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <CheckSquare size={13} />
              {doneItems}/{task.checklist.length}
            </span>
          )}
          {task.attachments.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Paperclip size={13} />
              {task.attachments.length}
            </span>
          )}
          {task.commentCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <MessageSquare size={13} />
              {task.commentCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
