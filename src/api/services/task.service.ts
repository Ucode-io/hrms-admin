// Данные модуля «Задачи».
//
// Мок-слой снят: всё идёт через методы `task_*` в udevs-hrms-reports
// (`tasksApi.ts`). Сигнатуры хуков сохранены с этапа мока — компоненты к ним
// не переписывались.
//
// Частичных методов на сервере нет: `task_save` сохраняет задачу целиком,
// поэтому мутации чек-листа и вложений берут текущую задачу из кэша, меняют
// нужный массив и отправляют результат.

import { useRef } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "react-query";
import authStore from "../../store/auth.store";
import {
  tasksApi,
  type ApiTask,
  type ApiTaskInput,
} from "./tasksApi";
import type {
  ChecklistItem,
  Task,
  TaskActivity,
  TaskAttachment,
  TaskDraft,
  TaskEmployee,
} from "../../modules/Tasks/types";
import { translate } from "../../i18n";

/** Вложение до того, как сервер присвоил ему id и автора. */
export type NewAttachment = Omit<TaskAttachment, "id" | "uploadedById" | "uploadedAt">;

export const TASKS_KEY = ["tasks"];
export const taskActivityKey = (taskId: string) => ["task-activity", taskId];

/** Цвет аватара выводим из id — сервер его не хранит. */
const AVATAR_COLORS = [
  "#465fff",
  "#12b76a",
  "#f79009",
  "#f04438",
  "#7c4dff",
  "#0ba5ec",
];

const colorFromId = (id: string): string => {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash + id.charCodeAt(index)) % AVATAR_COLORS.length;
  }
  return AVATAR_COLORS[hash];
};

const toTask = (api: ApiTask): Task => ({
  id: api.id,
  code: api.code,
  title: api.title,
  description: api.description,
  typeId: api.typeId,
  statusId: api.statusId,
  priorityId: api.priorityId,
  locationId: api.locationId,
  sheetId: api.sheetId,
  assigneeIds: api.assigneeIds,
  tagIds: api.tagIds,
  startDate: api.startDate,
  endDate: api.endDate,
  deadline: api.deadline,
  beginAt: api.beginAt,
  createdAt: api.createdAt ?? "",
  updatedAt: api.updatedAt ?? "",
  completedAt: api.completedAt,
  parentId: api.parentId,
  checklist: api.checklist,
  attachments: api.attachments,
  commentCount: api.commentCount,
  order: api.order,
});

const currentUserId = (): string | null => authStore.user_data?.guid ?? null;

/** Задача → payload сохранения: сервер ждёт полный набор полей. */
const toInput = (task: Task, patch: Partial<Task> = {}): ApiTaskInput => {
  const next = { ...task, ...patch };

  return {
    id: next.id,
    title: next.title,
    description: next.description,
    typeId: next.typeId,
    statusId: next.statusId,
    priorityId: next.priorityId,
    locationId: next.locationId,
    sheetId: next.sheetId,
    parentId: next.parentId,
    assigneeIds: next.assigneeIds,
    tagIds: next.tagIds,
    checklist: next.checklist,
    attachments: next.attachments,
    startDate: next.startDate,
    deadline: next.deadline,
    authorId: currentUserId(),
  };
};

type TasksSnapshot = { tasks: Task[]; employees: TaskEmployee[] };

/** Текущая задача из кэша: без неё нечего отправлять в полное сохранение. */
const taskFromCache = (queryClient: QueryClient, id: string): Task => {
  const snapshot = queryClient.getQueryData<TasksSnapshot>(TASKS_KEY);
  const task = snapshot?.tasks.find((item) => item.id === id);
  if (!task) throw new Error(translate("tasks.errors.not_in_cache"));
  return task;
};

/**
 * Мгновенно применяет правку к кэшу и возвращает прежний снимок для отката.
 * Без этого смена статуса или исполнителя «залипала» до ответа сервера.
 */
const applyOptimisticPatch = (
  queryClient: QueryClient,
  id: string,
  patch: Partial<Task>
): TasksSnapshot | undefined => {
  const previous = queryClient.getQueryData<TasksSnapshot>(TASKS_KEY);
  if (!previous) return undefined;

  queryClient.setQueryData<TasksSnapshot>(TASKS_KEY, {
    ...previous,
    tasks: previous.tasks.map((task) => (task.id === id ? { ...task, ...patch } : task)),
  });

  return previous;
};

export const taskService = {
  list: async (): Promise<TasksSnapshot> => {
    const { tasks, employees } = await tasksApi.list();

    return {
      tasks: tasks.map(toTask),
      employees: employees.map((employee) => ({
        ...employee,
        color: colorFromId(employee.id),
      })),
    };
  },

  create: async (draft: TaskDraft): Promise<Task> =>
    toTask(
      await tasksApi.save({
        title: draft.title,
        description: draft.description,
        typeId: draft.typeId,
        statusId: draft.statusId,
        priorityId: draft.priorityId,
        locationId: draft.locationId,
        sheetId: draft.sheetId,
        parentId: draft.parentId,
        assigneeIds: draft.assigneeIds,
        tagIds: draft.tagIds,
        checklist: draft.checklist ?? [],
        attachments: draft.attachments ?? [],
        startDate: draft.startDate,
        deadline: draft.deadline,
        authorId: currentUserId(),
      })
    ),

  save: async (task: Task, patch: Partial<Task> = {}): Promise<Task> =>
    toTask(await tasksApi.save(toInput(task, patch))),

  remove: (id: string): Promise<string> => tasksApi.remove(id),

  move: async (id: string, statusId: string, order: number): Promise<Task> =>
    toTask(await tasksApi.move({ id, statusId, order, authorId: currentUserId() })),

  activity: async (taskId: string): Promise<TaskActivity> => {
    const { comments, history } = await tasksApi.activity(taskId);

    return {
      comments: comments.map((comment) => ({
        id: comment.id,
        authorId: comment.authorId,
        text: comment.text,
        createdAt: comment.createdAt ?? "",
      })),
      history: history.map((entry) => ({
        id: entry.id,
        kind: entry.kind as TaskActivity["history"][number]["kind"],
        text: entry.text,
        authorId: entry.authorId,
        at: entry.at ?? "",
      })),
    };
  },
};

export const useTasksQuery = () =>
  useQuery({ queryKey: TASKS_KEY, queryFn: taskService.list });

/** Комментарии и история открытой задачи — отдельным запросом. */
export const useTaskActivityQuery = (taskId: string | null) =>
  useQuery({
    queryKey: taskActivityKey(taskId ?? ""),
    queryFn: () => taskService.activity(taskId as string),
    enabled: Boolean(taskId),
  });

const useInvalidateTasks = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries(TASKS_KEY);
};

export const useCreateTask = () => {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: (draft: TaskDraft) => taskService.create(draft),
    onSuccess: invalidate,
  });
};

type UpdateVariables = { id: string; patch: Partial<Task> };

export const useUpdateTask = () => {
  const queryClient = useQueryClient();
  // Снимок задачи ДО оптимистичной правки: полное сохранение должно уйти от
  // прежнего состояния, иначе патч наложился бы дважды.
  const beforePatch = useRef(new Map<string, Task>());

  return useMutation<Task, unknown, UpdateVariables, { previous?: TasksSnapshot }>({
    mutationFn: ({ id, patch }) => {
      const task = beforePatch.current.get(id) ?? taskFromCache(queryClient, id);
      beforePatch.current.delete(id);
      return taskService.save(task, patch);
    },
    onMutate: ({ id, patch }) => {
      const task = taskFromCache(queryClient, id);
      beforePatch.current.set(id, task);
      return { previous: applyOptimisticPatch(queryClient, id, patch) };
    },
    onError: (_error, variables, context) => {
      beforePatch.current.delete(variables.id);
      if (context?.previous) queryClient.setQueryData(TASKS_KEY, context.previous);
    },
    // Синхронизируемся с сервером в фоне: он мог доложить своё (например,
    // проставить дату окончания при переходе в финальный статус).
    onSettled: () => queryClient.invalidateQueries(TASKS_KEY),
  });
};

export const useDeleteTask = () => {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: (id: string) => taskService.remove(id),
    onSuccess: invalidate,
  });
};

export const useMoveTask = () => {
  const invalidate = useInvalidateTasks();
  return useMutation({
    // onSettled, а не onSuccess: доска держит своё состояние колонок во время
    // перетаскивания, промежуточная запись в кэш заставляла бы карточку прыгать.
    mutationFn: ({ id, statusId, order }: { id: string; statusId: string; order: number }) =>
      taskService.move(id, statusId, order),
    onSettled: invalidate,
  });
};

export const useAddTaskComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      tasksApi.addComment({ taskId: id, authorId: currentUserId(), text }),
    onSuccess: (_comment, variables) => {
      // Комментарий влияет и на счётчик в списке, и на ленту открытой задачи.
      queryClient.invalidateQueries(taskActivityKey(variables.id));
      queryClient.invalidateQueries(TASKS_KEY);
    },
  });
};

/**
 * Чек-лист и вложения живут контейнерами внутри задачи — сохраняем её целиком.
 * Правка так же применяется к кэшу сразу: галочка в чек-листе не должна ждать
 * ответа сервера.
 */
const useTaskContainerMutation = <TVariables extends { id: string }>(
  build: (task: Task, variables: TVariables) => Partial<Task>
) => {
  const queryClient = useQueryClient();
  const pending = useRef(new Map<string, { task: Task; patch: Partial<Task> }>());

  return useMutation<Task, unknown, TVariables, { previous?: TasksSnapshot }>({
    mutationFn: (variables) => {
      const prepared = pending.current.get(variables.id);
      pending.current.delete(variables.id);
      const task = prepared?.task ?? taskFromCache(queryClient, variables.id);
      return taskService.save(task, prepared?.patch ?? build(task, variables));
    },
    onMutate: (variables) => {
      const task = taskFromCache(queryClient, variables.id);
      const patch = build(task, variables);
      pending.current.set(variables.id, { task, patch });
      return { previous: applyOptimisticPatch(queryClient, variables.id, patch) };
    },
    onError: (_error, variables, context) => {
      pending.current.delete(variables.id);
      if (context?.previous) queryClient.setQueryData(TASKS_KEY, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries(TASKS_KEY),
  });
};

const createChecklistItem = (text: string): ChecklistItem => ({
  id: `chk_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
  text,
  done: false,
});

export const useAddChecklistItem = () =>
  useTaskContainerMutation<{ id: string; text: string }>((task, { text }) => ({
    checklist: [...task.checklist, createChecklistItem(text)],
  }));

export const useToggleChecklistItem = () =>
  useTaskContainerMutation<{ id: string; itemId: string }>((task, { itemId }) => ({
    checklist: task.checklist.map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item
    ),
  }));

export const useDeleteChecklistItem = () =>
  useTaskContainerMutation<{ id: string; itemId: string }>((task, { itemId }) => ({
    checklist: task.checklist.filter((item) => item.id !== itemId),
  }));

export const useAddAttachments = () =>
  useTaskContainerMutation<{ id: string; files: NewAttachment[] }>((task, { files }) => ({
    attachments: [
      ...task.attachments,
      ...files.map((file, index) => ({
        ...file,
        id: `att_${Date.now().toString(36)}${index}`,
        uploadedById: currentUserId(),
        uploadedAt: new Date().toISOString(),
      })),
    ],
  }));

export const useDeleteAttachment = () =>
  useTaskContainerMutation<{ id: string; attachmentId: string }>(
    (task, { attachmentId }) => ({
      attachments: task.attachments.filter((item) => item.id !== attachmentId),
    })
  );
