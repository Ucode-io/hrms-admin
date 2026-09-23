import { useEffect, useRef, useState } from "react";
import { GitBranch, Link2Off, Plus } from "lucide-react";
import {
  chipStyle,
  dotStyle,
  findDirectoryItem,
  formatTaskDate,
  isFinalStatus,
  isTaskOverdue,
} from "../constants";
import type { Task, TaskDirectories, TaskEmployee } from "../types";
import { AvatarStack, TypeIcon } from "./badges";
import { useTranslation } from "../../../i18n";

interface SubtasksSectionProps {
  subtasks: Task[];
  employees: TaskEmployee[];
  directories: TaskDirectories;
  onOpenTask: (task: Task) => void;
  onCreate: (title: string) => void;
  onDetach: (subtaskId: string) => void;
  isCreating?: boolean;
}

/**
 * Children of the open task. The list is derived from `parentId`, so detaching
 * a row only breaks the link — the task itself stays on the board.
 */
export default function SubtasksSection({
  subtasks,
  employees,
  directories,
  onOpenTask,
  onCreate,
  onDetach,
  isCreating,
}: SubtasksSectionProps) {
  const { t } = useTranslation();
  const [isInputOpen, setIsInputOpen] = useState(false);
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isInputOpen) inputRef.current?.focus();
  }, [isInputOpen]);

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setTitle("");
    onCreate(trimmed);
  };

  // «Готово» определяется флагом статуса, а не его названием.
  const doneCount = subtasks.filter((task) => isFinalStatus(directories, task.statusId)).length;
  const progress = subtasks.length ? (doneCount / subtasks.length) * 100 : 0;

  return (
    <section className="mt-7">
      <div className="mb-2.5 flex items-center gap-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-white/90">
          <GitBranch size={15} className="text-gray-400" />
          {t("tasks.subtasks.title")}
        </h4>
        {subtasks.length > 0 && (
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
              <span
                className="block h-full rounded-full bg-success-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </span>
            <span className="text-theme-xs font-medium text-gray-400">
              {doneCount}/{subtasks.length}
            </span>
          </span>
        )}
      </div>

      <div className="space-y-1">
        {subtasks.map((subtask) => {
          const status = findDirectoryItem(directories.statuses, subtask.statusId);
          const isDone = isFinalStatus(directories, subtask.statusId);
          const assignees = subtask.assigneeIds
            .map((id) => employees.find((employee) => employee.id === id))
            .filter((employee): employee is TaskEmployee => Boolean(employee));
          const overdue = isTaskOverdue(subtask, directories);

          return (
            <div
              key={subtask.id}
              className="group flex items-center gap-2.5 rounded-lg border border-gray-100 px-2.5 py-2 transition hover:border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/5"
            >
              <TypeIcon type={findDirectoryItem(directories.types, subtask.typeId)} size={14} />
              <button
                type="button"
                onClick={() => onOpenTask(subtask)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                title={`${subtask.code} · ${subtask.title}`}
              >
                <span className="shrink-0 text-theme-xs font-semibold uppercase tracking-wide text-gray-400">
                  {subtask.code}
                </span>
                <span
                  className={`min-w-0 flex-1 truncate text-sm ${
                    isDone ? "text-gray-400 line-through" : "text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {subtask.title}
                </span>
              </button>

              <span
                className={`hidden shrink-0 text-theme-xs sm:inline ${
                  overdue ? "font-medium text-error-600" : "text-gray-400"
                }`}
              >
                {formatTaskDate(subtask.deadline)}
              </span>
              <span
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-theme-xs font-medium"
                style={chipStyle(status.color)}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={dotStyle(status.color)} />
                {status.title}
              </span>
              <AvatarStack employees={assignees} size={20} max={2} />

              <button
                type="button"
                onClick={() => onDetach(subtask.id)}
                aria-label={t("tasks.subtasks.detach")}
                title={t("tasks.subtasks.detach_title")}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-400 opacity-0 transition hover:bg-error-50 hover:text-error-600 focus:opacity-100 group-hover:opacity-100 dark:hover:bg-error-500/10"
              >
                <Link2Off size={13} />
              </button>
            </div>
          );
        })}
      </div>

      {isInputOpen ? (
        <div className="mt-1.5 flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
              if (event.key === "Escape") {
                setTitle("");
                setIsInputOpen(false);
              }
            }}
            onBlur={() => {
              if (!title.trim()) setIsInputOpen(false);
            }}
            placeholder={t("tasks.subtasks.input_placeholder")}
            className="h-9 flex-1 rounded-lg border border-brand-300 bg-transparent px-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:text-white/90"
          />
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={submit}
            disabled={!title.trim() || isCreating}
            className="inline-flex h-9 items-center rounded-lg bg-brand-500 px-3 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-40"
          >
            {t("tasks.subtasks.create")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsInputOpen(true)}
          className="mt-1 inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-sm text-gray-500 transition hover:bg-gray-50 hover:text-brand-600 dark:text-gray-400 dark:hover:bg-white/5"
        >
          <Plus size={15} />
          {t("tasks.subtasks.add")}
        </button>
      )}
    </section>
  );
}
