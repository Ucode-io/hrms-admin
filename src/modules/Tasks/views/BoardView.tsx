import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useMoveTask } from "../../../api/services/task.service";
import { dotStyle } from "../constants";
import type { Task, TaskDirectories, TaskDirectoryItem, TaskEmployee } from "../types";
import TaskCard from "../components/TaskCard";
import { useTranslation } from "../../../i18n";

interface BoardViewProps {
  tasks: Task[];
  employees: TaskEmployee[];
  /** Unfiltered list — parent/subtask markers must not depend on the filters. */
  allTasks: Task[];
  /** Колонки доски = статусы компании, поэтому они приходят пропсом. */
  directories: TaskDirectories;
  locationTitles: Record<string, string>;
  onOpenTask: (task: Task) => void;
  onAddTask: (statusId: string) => void;
}

interface TaskRelations {
  subtaskCounts: Record<string, number>;
  codeById: Record<string, string>;
}

/** Ключ — id статуса: набор колонок теперь задаётся справочником. */
type ColumnMap = Record<string, string[]>;

const byOrder = (a: Task, b: Task) => a.order - b.order;

const buildColumns = (tasks: Task[], statuses: TaskDirectoryItem[]): ColumnMap => {
  const columns: ColumnMap = Object.fromEntries(statuses.map((status) => [status.id, []]));
  [...tasks].sort(byOrder).forEach((task) => {
    if (task.statusId && columns[task.statusId]) columns[task.statusId].push(task.id);
  });
  return columns;
};

const sameArrangement = (a: ColumnMap, b: ColumnMap) => {
  const keys = Object.keys(b);
  if (keys.length !== Object.keys(a).length) return false;
  return keys.every(
    (statusId) =>
      a[statusId]?.length === b[statusId].length &&
      b[statusId].every((id, index) => id === a[statusId][index])
  );
};

/**
 * Memoized on purpose: the library re-renders the whole tree on every drag
 * frame, and unmemoized cards make the drag (and the drop animation) stutter.
 * Every prop below must stay referentially stable between renders.
 */
const DraggableTaskCard = memo(function DraggableTaskCard({
  task,
  assignees,
  directories,
  locationTitle,
  subtaskCount,
  parentCode,
  index,
  onOpen,
}: {
  task: Task;
  assignees: TaskEmployee[];
  directories: TaskDirectories;
  locationTitle: string;
  subtaskCount: number;
  parentCode: string | null;
  index: number;
  onOpen: (task: Task) => void;
}) {
  const handleClick = useCallback(() => onOpen(task), [onOpen, task]);

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        // `mb-2.5` instead of a `gap` on the column: the library sizes its
        // placeholder from the card's box *including margins* and knows
        // nothing about flex `gap`, so a gap-based layout reserves too little
        // room mid-drag and everything jumps on drop.
        // No transform-based classes here either — the library drives
        // `transform` inline and a Tailwind rotate/scale would fight it.
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`mb-2.5 ${snapshot.isDragging ? "shadow-theme-lg" : ""}`}
        >
          <TaskCard
            task={task}
            assignees={assignees}
            directories={directories}
            locationTitle={locationTitle}
            subtaskCount={subtaskCount}
            parentCode={parentCode}
            onClick={handleClick}
          />
        </div>
      )}
    </Draggable>
  );
});

const BoardColumn = memo(function BoardColumn({
  status,
  tasks,
  employees,
  directories,
  locationTitles,
  relations,
  onOpenTask,
  onAddTask,
}: {
  status: TaskDirectoryItem;
  tasks: Task[];
  employees: TaskEmployee[];
  directories: TaskDirectories;
  locationTitles: Record<string, string>;
  relations: TaskRelations;
  onOpenTask: (task: Task) => void;
  onAddTask: (statusId: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex min-w-[280px] flex-1 flex-col rounded-2xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-white/[0.02]">
      <div className="flex items-center justify-between px-3.5 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={dotStyle(status.color)} />
          <span className="text-sm font-semibold text-gray-800 dark:text-white/90">
            {status.title}
          </span>
          <span className="rounded-md bg-white px-1.5 py-0.5 text-theme-xs font-medium text-gray-500 ring-1 ring-gray-200 dark:bg-white/5 dark:text-gray-400 dark:ring-gray-700">
            {tasks.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onAddTask(status.id)}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-400 transition hover:bg-white hover:text-brand-500 dark:hover:bg-white/10"
          aria-label={t("tasks.board.add_column_aria", { status: status.title })}
        >
          <Plus size={15} />
        </button>
      </div>

      <Droppable droppableId={status.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex flex-1 flex-col rounded-b-2xl px-3 pb-0.5 ${
              snapshot.isDraggingOver ? "bg-brand-50/60 dark:bg-brand-500/5" : ""
            }`}
          >
            {tasks.map((task, index) => (
              <DraggableTaskCard
                key={task.id}
                task={task}
                index={index}
                assignees={task.assigneeIds
                  .map((id) => employees.find((e) => e.id === id))
                  .filter((e): e is TaskEmployee => Boolean(e))}
                directories={directories}
                locationTitle={(task.locationId && locationTitles[task.locationId]) || ""}
                subtaskCount={relations.subtaskCounts[task.id] ?? 0}
                parentCode={(task.parentId && relations.codeById[task.parentId]) || null}
                onOpen={onOpenTask}
              />
            ))}
            {provided.placeholder}
            {tasks.length === 0 && !snapshot.isDraggingOver && (
              <div className="rounded-xl border border-dashed border-gray-200 py-6 text-center text-theme-xs text-gray-400 dark:border-gray-700">
                {t("tasks.board.no_tasks")}
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
});

export default function BoardView({
  tasks,
  employees,
  allTasks,
  directories,
  locationTitles,
  onOpenTask,
  onAddTask,
}: BoardViewProps) {
  const { t } = useTranslation();
  const moveMutation = useMoveTask();
  const statuses = directories.statuses;
  // Local column order so the drop lands instantly, without waiting for the
  // mutation + refetch round trip.
  const [columns, setColumns] = useState<ColumnMap>(() => buildColumns(tasks, statuses));

  // Resync only when the incoming data actually rearranges the board. Bailing
  // out on an identical arrangement keeps the post-mutation refetch from
  // re-rendering every card mid drop-animation (that looked like a freeze).
  useEffect(() => {
    const next = buildColumns(tasks, statuses);
    setColumns((prev) => (sameArrangement(prev, next) ? prev : next));
  }, [tasks, statuses]);

  const tasksById = useMemo(
    () => Object.fromEntries(tasks.map((task) => [task.id, task])),
    [tasks]
  );

  const relations = useMemo<TaskRelations>(() => {
    const subtaskCounts: Record<string, number> = {};
    const codeById: Record<string, string> = {};
    for (const task of allTasks) {
      codeById[task.id] = task.code;
      if (task.parentId) subtaskCounts[task.parentId] = (subtaskCounts[task.parentId] ?? 0) + 1;
    }
    return { subtaskCounts, codeById };
  }, [allTasks]);

  const columnTasks = useMemo<Record<string, Task[]>>(
    () =>
      Object.fromEntries(
        statuses.map((status) => [
          status.id,
          (columns[status.id] ?? []).map((id) => tasksById[id]).filter(Boolean),
        ])
      ),
    [columns, statuses, tasksById]
  );

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      const { draggableId, source, destination } = result;
      if (!destination) return;

      const from = source.droppableId;
      const to = destination.droppableId;
      if (from === to && source.index === destination.index) return;

      // Synchronous local move — the library needs the new arrangement on the
      // very next render to animate the drop into its final slot.
      setColumns((prev) => {
        const next: ColumnMap = { ...prev, [from]: [...(prev[from] ?? [])] };
        next[from].splice(source.index, 1);
        if (from !== to) next[to] = [...(prev[to] ?? [])];
        next[to].splice(destination.index, 0, draggableId);
        return next;
      });

      moveMutation
        .mutateAsync({ id: draggableId, statusId: to, order: destination.index })
        .catch(() => {
          toast.error(t("tasks.board.move_error"));
          setColumns(buildColumns(tasks, statuses));
        });
    },
    [moveMutation, tasks, statuses]
  );

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {statuses.map((status) => (
          <BoardColumn
            key={status.id}
            status={status}
            tasks={columnTasks[status.id] ?? []}
            employees={employees}
            directories={directories}
            locationTitles={locationTitles}
            relations={relations}
            onOpenTask={onOpenTask}
            onAddTask={onAddTask}
          />
        ))}
      </div>
    </DragDropContext>
  );
}
