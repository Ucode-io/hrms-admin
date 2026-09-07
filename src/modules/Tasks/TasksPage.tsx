import { useCallback, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import { useHeaderBreadcrumbItems } from "../../context/HeaderBreadcrumbContext";
import companyStore from "../../store/company.store";
import {
  useCreateTask,
  useTaskActivityQuery,
  useTasksQuery,
  useUpdateTask,
} from "../../api/services/task.service";
import {
  useSaveTaskDirectory,
  useTaskDirectoriesQuery,
  EMPTY_DIRECTORIES,
} from "../../api/services/taskDirectories.service";
import { useLocationsQuery } from "../../api/services/location.service";
import { richTextToPlain } from "../../components/form/richText";
import { VIEW_ORDER, defaultPriority, initialStatus } from "./constants";
import { ALL_SHEETS, TaskSheetSelect, useTaskSheets } from "./sheets";
import type { Task, TaskDraft, TaskFilters, TasksViewKey } from "./types";
import ViewSwitcher from "./components/ViewSwitcher";
import FiltersPanel, { FiltersToolbar } from "./components/FiltersBar";
import TaskFormModal from "./components/TaskFormModal";
import TaskDetailModal from "./components/TaskDetailModal";
import BoardView from "./views/BoardView";
import TableView from "./views/TableView";
import TimelineView from "./views/TimelineView";
import CalendarView from "./views/CalendarView";

const TASKS_BREADCRUMBS = [{ label: "Задачи", to: "/tasks" }];

const EMPTY_FILTERS: TaskFilters = {
  search: "",
  statusId: "",
  priorityId: "",
  typeId: "",
  assigneeId: "",
  locationId: "",
  tagId: "",
  departmentId: "",
};

const isViewKey = (value: string | null): value is TasksViewKey =>
  Boolean(value) && (VIEW_ORDER as string[]).includes(value as string);

export default function TasksPage() {
  useHeaderBreadcrumbItems(TASKS_BREADCRUMBS);
  const brandColor = companyStore.mainColor || "#2563eb";

  const [searchParams, setSearchParams] = useSearchParams();
  const rawView = searchParams.get("view");
  const view: TasksViewKey = isViewKey(rawView) ? rawView : "board";
  const setView = (next: TasksViewKey) => {
    setSearchParams(next === "board" ? {} : { view: next }, { replace: true });
  };

  const [filters, setFilters] = useState<TaskFilters>(EMPTY_FILTERS);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formInitialStatusId, setFormInitialStatusId] = useState<string | null>(null);

  const { data, isLoading } = useTasksQuery();
  const { data: directoriesData } = useTaskDirectoriesQuery();
  const { data: locationsData } = useLocationsQuery({ params: { limit: 200 } });
  const createMutation = useCreateTask();
  const updateMutation = useUpdateTask();
  const saveDirectory = useSaveTaskDirectory();

  const directories = directoriesData ?? EMPTY_DIRECTORIES;

  // Листы: активный определяет, какие задачи видны; «Все задачи» — без фильтра.
  const sheetsApi = useTaskSheets(companyStore.company?.guid || "");
  const { activeSheetId, sheets } = sheetsApi;

  const tasks = useMemo(() => data?.tasks ?? [], [data]);
  const employees = useMemo(() => data?.employees ?? [], [data]);

  const locations = useMemo(
    () =>
      ((locationsData?.response ?? []) as { guid: string; title?: string }[]).map((item) => ({
        id: item.guid,
        title: item.title || "Без названия",
      })),
    [locationsData?.response]
  );

  const locationTitles = useMemo(
    () => Object.fromEntries(locations.map((location) => [location.id, location.title])),
    [locations]
  );

  const sheetTasks = useMemo(
    () =>
      activeSheetId === ALL_SHEETS
        ? tasks
        : tasks.filter((task) => task.sheetId === activeSheetId),
    [tasks, activeSheetId]
  );

  /** Департамент задачи — департаменты её исполнителей. */
  const departmentsByEmployee = useMemo(
    () => Object.fromEntries(employees.map((employee) => [employee.id, employee.departmentId])),
    [employees]
  );

  const filteredTasks = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    const tagTitles = Object.fromEntries(directories.tags.map((tag) => [tag.id, tag.title]));

    return sheetTasks.filter((task) => {
      if (filters.statusId && task.statusId !== filters.statusId) return false;
      if (filters.priorityId && task.priorityId !== filters.priorityId) return false;
      if (filters.typeId && task.typeId !== filters.typeId) return false;
      if (filters.locationId && task.locationId !== filters.locationId) return false;
      if (filters.tagId && !task.tagIds.includes(filters.tagId)) return false;
      if (filters.assigneeId && !task.assigneeIds.includes(filters.assigneeId)) return false;
      if (
        filters.departmentId &&
        !task.assigneeIds.some((id) => departmentsByEmployee[id] === filters.departmentId)
      ) {
        return false;
      }
      if (search) {
        const haystack = `${task.code} ${task.title} ${richTextToPlain(task.description)} ${
          (task.locationId && locationTitles[task.locationId]) || ""
        } ${task.tagIds.map((id) => tagTitles[id] ?? "").join(" ")}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [sheetTasks, filters, directories.tags, departmentsByEmployee, locationTitles]);

  // Keep the detail modal in sync with query cache updates (inline edits).
  const openTask = openTaskId ? tasks.find((t) => t.id === openTaskId) ?? null : null;

  const { data: activity, isLoading: isActivityLoading } = useTaskActivityQuery(openTaskId);

  /** Создание тега прямо из формы задачи. */
  const createTag = useCallback(
    async (title: string) => {
      const created = await saveDirectory.mutateAsync({ kind: "tag", title });
      return created?.id ?? null;
    },
    [saveDirectory]
  );

  // Stable identities — BoardView memoizes its cards on these props.
  const openTaskDetails = useCallback((task: Task) => setOpenTaskId(task.id), []);

  const openCreateForm = useCallback((statusId: string | null = null) => {
    setEditingTask(null);
    setFormInitialStatusId(statusId);
    setIsFormOpen(true);
  }, []);

  /** Returns success — the form modal decides whether to close or stay open. */
  const submitForm = async (draft: TaskDraft): Promise<boolean> => {
    try {
      if (editingTask) {
        await updateMutation.mutateAsync({ id: editingTask.id, patch: draft });
        toast.success("Задача обновлена.");
      } else {
        await createMutation.mutateAsync(draft);
        toast.success("Задача создана.");
      }
      return true;
    } catch {
      toast.error("Не удалось сохранить задачу.");
      return false;
    }
  };

  /** Подзадача наследует лист, тип, приоритет и локацию родителя. */
  const createSubtask = async (parent: Task, title: string) => {
    await createMutation.mutateAsync({
      title,
      description: "",
      typeId: parent.typeId,
      locationId: parent.locationId,
      statusId: initialStatus(directories)?.id ?? null,
      priorityId: parent.priorityId ?? defaultPriority(directories)?.id ?? null,
      sheetId: parent.sheetId,
      assigneeIds: [],
      tagIds: [],
      startDate: null,
      deadline: parent.deadline,
      parentId: parent.id,
    });
    toast.success("Подзадача создана.");
  };

  /** Лист теперь поле задачи — переносим саму задачу, подзадачи остаются как есть. */
  const moveTaskToSheet = useCallback(
    async (task: Task, sheetId: string | null) => {
      await updateMutation.mutateAsync({ id: task.id, patch: { sheetId } });
      const sheetName = sheets.find((sheet) => sheet.id === sheetId)?.name;
      toast.success(sheetName ? `Задача перемещена в лист «${sheetName}»` : "Задача убрана из листа");
    },
    [updateMutation, sheets]
  );

  return (
    <>
      <PageMeta title="Задачи | HRMS" description="Задачи сотрудников компании" />

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="-mx-3 md:-mx-4 -mt-3 md:-mt-4">
        <div
          className="flex flex-wrap items-center gap-3 px-4 py-2.5 lg:px-6"
          style={{
            backgroundColor: "#fff",
            border: "1px solid #e2e8f0",
            borderTop: "none",
            borderBottom: isFiltersOpen ? "none" : "1px solid #e2e8f0",
          }}
        >
          <ViewSwitcher value={view} onChange={setView} />
          <TaskSheetSelect api={sheetsApi} />

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <FiltersToolbar
              filters={filters}
              brandColor={brandColor}
              isOpen={isFiltersOpen}
              onToggle={() => setIsFiltersOpen((open) => !open)}
              onChange={setFilters}
            />
            <Button
              startIcon={<Plus size={16} />}
              onClick={() => openCreateForm()}
              className="h-10 rounded-xl px-4"
            >
              Новая задача
            </Button>
          </div>
        </div>

        {isFiltersOpen && (
          <FiltersPanel
            filters={filters}
            employees={employees}
            directories={directories}
            locations={locations}
            onChange={setFilters}
          />
        )}
      </div>

      {/* ── Active view ─────────────────────────────────────────────────── */}
      <div className={!isLoading && view === "calendar" ? "-mx-3 -mb-3 md:-mx-4 md:-mb-4" : "mt-4"}>
        {isLoading ? (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {Array.from({ length: 4 }).map((_, columnIndex) => (
              <div
                key={columnIndex}
                className="min-w-[280px] flex-1 space-y-2.5 rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-white/[0.02]"
              >
                <div className="h-5 w-32 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
                {Array.from({ length: 3 }).map((_, cardIndex) => (
                  <div
                    key={cardIndex}
                    className="h-24 animate-pulse rounded-xl bg-gray-200/70 dark:bg-white/10"
                  />
                ))}
              </div>
            ))}
          </div>
        ) : view === "board" ? (
          <BoardView
            tasks={filteredTasks}
            employees={employees}
            allTasks={tasks}
            directories={directories}
            locationTitles={locationTitles}
            onOpenTask={openTaskDetails}
            onAddTask={openCreateForm}
          />
        ) : view === "table" ? (
          <TableView
            tasks={filteredTasks}
            employees={employees}
            allTasks={tasks}
            directories={directories}
            locationTitles={locationTitles}
            onOpenTask={openTaskDetails}
          />
        ) : view === "timeline" ? (
          <TimelineView
            tasks={filteredTasks}
            employees={employees}
            directories={directories}
            onOpenTask={openTaskDetails}
          />
        ) : (
          <CalendarView
            tasks={filteredTasks}
            employees={employees}
            directories={directories}
            onOpenTask={openTaskDetails}
          />
        )}
      </div>

      {/* ── Task detail (Jira-style, edits save inline) ─────────────────── */}
      {openTask && (
        <TaskDetailModal
          task={openTask}
          employees={employees}
          tasks={tasks}
          directories={directories}
          locations={locations}
          activity={activity}
          isActivityLoading={isActivityLoading}
          sheets={sheets}
          onMoveToSheet={(sheetId) => moveTaskToSheet(openTask, sheetId)}
          onCreateTag={createTag}
          onOpenTask={openTaskDetails}
          onCreateSubtask={(title) => createSubtask(openTask, title)}
          onClose={() => setOpenTaskId(null)}
        />
      )}

      {/* ── Create modal ────────────────────────────────────────────────── */}
      <TaskFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingTask(null);
        }}
        onSubmit={submitForm}
        isSubmitting={createMutation.isLoading || updateMutation.isLoading}
        employees={employees}
        tasks={tasks}
        task={editingTask}
        directories={directories}
        locations={locations}
        sheets={sheets}
        initialSheetId={activeSheetId === ALL_SHEETS ? null : activeSheetId}
        initialStatusId={formInitialStatusId}
        onCreateTag={createTag}
      />
    </>
  );
}
