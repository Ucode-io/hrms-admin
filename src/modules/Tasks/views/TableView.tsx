import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, GitBranch, ListTodo } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { findDirectoryItem, formatTaskDate, isTaskOverdue } from "../constants";
import type { Task, TaskDirectories, TaskEmployee } from "../types";
import { AvatarStack, PriorityBadge, StatusBadge, TypeBadge } from "../components/badges";

interface TableViewProps {
  tasks: Task[];
  employees: TaskEmployee[];
  /** Unfiltered list — subtask counts must not depend on the filters. */
  allTasks: Task[];
  directories: TaskDirectories;
  locationTitles: Record<string, string>;
  onOpenTask: (task: Task) => void;
}

type SortKey =
  | "code"
  | "title"
  | "type"
  | "status"
  | "priority"
  | "assignee"
  | "location"
  | "startDate"
  | "endDate"
  | "deadline"
  | "updatedAt";

const HEADERS: { key: SortKey; label: string }[] = [
  { key: "code", label: "Код" },
  { key: "title", label: "Название" },
  { key: "type", label: "Тип" },
  { key: "status", label: "Статус" },
  { key: "priority", label: "Приоритет" },
  { key: "assignee", label: "Исполнители" },
  { key: "location", label: "Локация" },
  { key: "startDate", label: "Начало" },
  { key: "endDate", label: "Завершена" },
  { key: "deadline", label: "Дедлайн" },
  { key: "updatedAt", label: "Обновлена" },
];

const formatDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function TableView({
  tasks,
  employees,
  allTasks,
  directories,
  locationTitles,
  onOpenTask,
}: TableViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>("code");
  const [sortAsc, setSortAsc] = useState(true);

  const employeeById = (id: string | null) =>
    (id && employees.find((e) => e.id === id)) || null;

  const subtaskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const task of allTasks) {
      if (task.parentId) counts[task.parentId] = (counts[task.parentId] ?? 0) + 1;
    }
    return counts;
  }, [allTasks]);

  const sorted = useMemo(() => {
    const value = (task: Task): string | number => {
      switch (sortKey) {
        case "code":
          return task.code;
        case "title":
          return task.title.toLowerCase();
        case "type":
          return findDirectoryItem(directories.types, task.typeId).sortOrder;
        case "status":
          return findDirectoryItem(directories.statuses, task.statusId).sortOrder;
        case "priority":
          return findDirectoryItem(directories.priorities, task.priorityId).sortOrder;
        case "assignee":
          return employeeById(task.assigneeIds[0] ?? null)?.name ?? "￿"; // unassigned last
        case "location":
          return (
            (task.locationId && locationTitles[task.locationId]?.toLowerCase()) || "￿"
          ); // без локации — в конец
        case "startDate":
          return task.startDate ?? "9999";
        case "endDate":
          return task.endDate ?? "9999";
        case "deadline":
          return task.deadline ?? "9999";
        case "updatedAt":
          return task.updatedAt;
      }
    };
    return [...tasks].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortAsc ? cmp : -cmp;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, employees, sortKey, sortAsc, directories, locationTitles]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="max-w-full overflow-x-auto">
        <Table>
          <TableHeader className="border-b border-gray-100 dark:border-gray-800">
            <TableRow>
              {HEADERS.map(({ key, label }) => (
                <TableCell
                  key={key}
                  isHeader
                  className="whitespace-nowrap px-4 py-3 text-left text-theme-xs font-medium text-gray-500"
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(key)}
                    className="inline-flex items-center gap-1 transition hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    {label}
                    {sortKey === key ? (
                      sortAsc ? (
                        <ArrowUp size={12} />
                      ) : (
                        <ArrowDown size={12} />
                      )
                    ) : (
                      <ArrowUpDown size={12} className="opacity-40" />
                    )}
                  </button>
                </TableCell>
              ))}
              <TableCell
                isHeader
                className="whitespace-nowrap px-4 py-3 text-left text-theme-xs font-medium text-gray-500"
              >
                Прогресс
              </TableCell>
            </TableRow>
          </TableHeader>

          <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={HEADERS.length + 1} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <ListTodo size={36} className="text-gray-300" />
                    <p className="text-sm font-medium text-gray-500">Задачи не найдены</p>
                    <p className="text-xs text-gray-400">Попробуйте изменить фильтры</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((task) => {
                const assignees = task.assigneeIds
                  .map((id) => employeeById(id))
                  .filter((e): e is TaskEmployee => Boolean(e));
                const overdue = isTaskOverdue(task, directories);
                const doneItems = task.checklist.filter((item) => item.done).length;
                const subtaskCount = subtaskCounts[task.id] ?? 0;

                return (
                  <TableRow
                    key={task.id}
                    className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                    onClick={() => onOpenTask(task)}
                  >
                    <TableCell className="whitespace-nowrap px-4 py-3 text-theme-xs font-medium uppercase tracking-wide text-gray-400">
                      {task.code}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm font-medium text-gray-800 dark:text-white/90">
                      <span className="flex items-center gap-2">
                        {task.parentId && (
                          <GitBranch
                            size={13}
                            className="shrink-0 text-gray-300"
                            aria-label="Подзадача"
                          />
                        )}
                        <span className="min-w-0">{task.title}</span>
                        {subtaskCount > 0 && (
                          <span
                            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-theme-xs font-medium text-gray-500 dark:bg-white/10 dark:text-gray-400"
                            title="Подзадачи"
                          >
                            <GitBranch size={11} />
                            {subtaskCount}
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <TypeBadge type={findDirectoryItem(directories.types, task.typeId)} />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <StatusBadge status={findDirectoryItem(directories.statuses, task.statusId)} />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <PriorityBadge priority={findDirectoryItem(directories.priorities, task.priorityId)} />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <AvatarStack employees={assignees} size={26} max={2} />
                        {assignees.length === 0 ? (
                          <span className="text-gray-400">Не назначен</span>
                        ) : assignees.length === 1 ? (
                          assignees[0].name
                        ) : (
                          `${assignees[0].name} +${assignees.length - 1}`
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {(task.locationId && locationTitles[task.locationId]) || (
                        <span className="text-gray-300 dark:text-gray-600">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {formatTaskDate(task.startDate)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {formatTaskDate(task.endDate)}
                    </TableCell>
                    <TableCell
                      className={`whitespace-nowrap px-4 py-3 text-sm ${
                        overdue ? "font-medium text-error-600" : "text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      {formatTaskDate(task.deadline)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 py-3 text-theme-xs text-gray-400">
                      {formatDateTime(task.updatedAt)}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      {task.checklist.length > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
                            <div
                              className="h-full rounded-full bg-success-500"
                              style={{ width: `${(doneItems / task.checklist.length) * 100}%` }}
                            />
                          </div>
                          <span className="text-theme-xs text-gray-400">
                            {doneItems}/{task.checklist.length}
                          </span>
                        </div>
                      ) : (
                        <span className="text-theme-xs text-gray-300 dark:text-gray-600">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
