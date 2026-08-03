// Клиент методов задач в reports-шлюзе.
//
// Слой сознательно «серверный»: возвращает ровно то, что отдают методы
// (`statusId`, `priorityId`, `locationId`, `assigneeIds`, `tagIds`), без
// доменных типов модуля. Перекладывание в доменную модель живёт в
// task.service.ts — так видно границу и проще было заменять мок.

import { invokeTasksMethod } from "./taskDirectories.service";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const str = (value: unknown): string => (typeof value === "string" ? value : "");
const nullableStr = (value: unknown): string | null =>
  typeof value === "string" && value ? value : null;
const num = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const strList = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(str).filter(Boolean) : [];

export type ApiChecklistItem = { id: string; text: string; done: boolean };

export type ApiAttachment = {
  id: string;
  name: string;
  size: number;
  mime: string;
  url: string;
  uploadedById: string | null;
  uploadedAt: string | null;
};

export type ApiTask = {
  id: string;
  code: string;
  title: string;
  description: string;
  typeId: string | null;
  statusId: string | null;
  sheetId: string | null;
  parentId: string | null;
  priorityId: string | null;
  locationId: string | null;
  assigneeIds: string[];
  tagIds: string[];
  checklist: ApiChecklistItem[];
  attachments: ApiAttachment[];
  startDate: string | null;
  /** Пишет сервер по финальному статусу — в форме не редактируется. */
  endDate: string | null;
  deadline: string | null;
  completedAt: string | null;
  order: number;
  commentCount: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ApiTaskEmployee = {
  id: string;
  name: string;
  position: string;
  positionId: string | null;
  departmentId: string | null;
  department: string;
  photo: string;
};

export type ApiComment = {
  id: string;
  authorId: string | null;
  text: string;
  createdAt: string | null;
};

export type ApiHistoryEntry = {
  id: string;
  authorId: string | null;
  kind: string;
  text: string;
  at: string | null;
};

const mapChecklist = (raw: unknown): ApiChecklistItem[] =>
  Array.isArray(raw)
    ? raw.filter(isRecord).map((item) => ({
        id: str(item.id),
        text: str(item.text),
        done: Boolean(item.done),
      }))
    : [];

const mapAttachments = (raw: unknown): ApiAttachment[] =>
  Array.isArray(raw)
    ? raw.filter(isRecord).map((item) => ({
        id: str(item.id),
        name: str(item.name),
        size: num(item.size),
        mime: str(item.mime),
        url: str(item.url),
        uploadedById: nullableStr(item.uploadedById),
        uploadedAt: nullableStr(item.uploadedAt),
      }))
    : [];

export const mapApiTask = (raw: unknown): ApiTask | null => {
  if (!isRecord(raw) || !str(raw.id)) return null;

  return {
    id: str(raw.id),
    code: str(raw.code),
    title: str(raw.title),
    description: str(raw.description),
    typeId: nullableStr(raw.typeId),
    statusId: nullableStr(raw.statusId),
    sheetId: nullableStr(raw.sheetId),
    parentId: nullableStr(raw.parentId),
    priorityId: nullableStr(raw.priorityId),
    locationId: nullableStr(raw.locationId),
    assigneeIds: strList(raw.assigneeIds),
    tagIds: strList(raw.tagIds),
    checklist: mapChecklist(raw.checklist),
    attachments: mapAttachments(raw.attachments),
    startDate: nullableStr(raw.startDate),
    endDate: nullableStr(raw.endDate),
    deadline: nullableStr(raw.deadline),
    completedAt: nullableStr(raw.completedAt),
    order: num(raw.order),
    commentCount: num(raw.commentCount),
    createdAt: nullableStr(raw.createdAt),
    updatedAt: nullableStr(raw.updatedAt),
  };
};

const mapEmployee = (raw: unknown): ApiTaskEmployee | null => {
  if (!isRecord(raw) || !str(raw.id)) return null;

  return {
    id: str(raw.id),
    name: str(raw.name),
    position: str(raw.position),
    positionId: nullableStr(raw.positionId),
    departmentId: nullableStr(raw.departmentId),
    department: str(raw.department),
    photo: str(raw.photo),
  };
};

/** Поля задачи, которые принимает `task_save`. */
export type ApiTaskInput = {
  id?: string;
  title: string;
  description?: string;
  typeId?: string | null;
  statusId?: string | null;
  sheetId?: string | null;
  parentId?: string | null;
  priorityId?: string | null;
  locationId?: string | null;
  assigneeIds?: string[];
  tagIds?: string[];
  checklist?: ApiChecklistItem[];
  attachments?: ApiAttachment[];
  startDate?: string | null;
  deadline?: string | null;
  /** Автор изменения — попадает в историю задачи. */
  authorId?: string | null;
};

const toSavePayload = (input: ApiTaskInput): Record<string, unknown> => ({
  guid: input.id,
  title: input.title,
  description: input.description,
  type_id: input.typeId,
  status_id: input.statusId,
  sheet_id: input.sheetId,
  parent_id: input.parentId,
  priority_id: input.priorityId,
  location_id: input.locationId,
  assignee_ids: input.assigneeIds ?? [],
  tag_ids: input.tagIds ?? [],
  checklist: input.checklist ?? [],
  attachments: input.attachments ?? [],
  start_date: input.startDate,
  deadline: input.deadline,
  author_id: input.authorId,
});

const requireTask = (raw: unknown): ApiTask => {
  const task = mapApiTask(raw);
  if (!task) throw new Error("Сервер вернул задачу в неожиданном формате");
  return task;
};

export const tasksApi = {
  list: async (): Promise<{ tasks: ApiTask[]; employees: ApiTaskEmployee[] }> => {
    const result = await invokeTasksMethod("task_list");

    return {
      tasks: Array.isArray(result?.tasks)
        ? result.tasks.map(mapApiTask).filter((task): task is ApiTask => Boolean(task))
        : [],
      employees: Array.isArray(result?.employees)
        ? result.employees
            .map(mapEmployee)
            .filter((item): item is ApiTaskEmployee => Boolean(item))
        : [],
    };
  },

  save: async (input: ApiTaskInput): Promise<ApiTask> =>
    requireTask((await invokeTasksMethod("task_save", toSavePayload(input)))?.task),

  move: async (params: {
    id: string;
    statusId: string;
    order: number;
    authorId?: string | null;
  }): Promise<ApiTask> =>
    requireTask(
      (
        await invokeTasksMethod("task_move", {
          guid: params.id,
          status_id: params.statusId,
          order: params.order,
          author_id: params.authorId,
        })
      )?.task
    ),

  remove: async (id: string): Promise<string> => {
    await invokeTasksMethod("task_delete", { guid: id });
    return id;
  },

  activity: async (
    taskId: string
  ): Promise<{ comments: ApiComment[]; history: ApiHistoryEntry[] }> => {
    const result = await invokeTasksMethod("task_activity_get", { task_id: taskId });

    return {
      comments: Array.isArray(result?.comments)
        ? result.comments.filter(isRecord).map((row) => ({
            id: str(row.id),
            authorId: nullableStr(row.authorId),
            text: str(row.text),
            createdAt: nullableStr(row.createdAt),
          }))
        : [],
      history: Array.isArray(result?.history)
        ? result.history.filter(isRecord).map((row) => ({
            id: str(row.id),
            authorId: nullableStr(row.authorId),
            kind: str(row.kind) || "updated",
            text: str(row.text),
            at: nullableStr(row.at),
          }))
        : [],
    };
  },

  addComment: async (params: {
    taskId: string;
    authorId: string | null;
    text: string;
  }): Promise<ApiComment> => {
    const result = await invokeTasksMethod("task_comment_add", {
      task_id: params.taskId,
      author_id: params.authorId,
      text: params.text,
    });

    const raw = result?.comment;
    if (!isRecord(raw)) throw new Error("Сервер вернул комментарий в неожиданном формате");

    return {
      id: str(raw.id),
      authorId: nullableStr(raw.authorId),
      text: str(raw.text),
      createdAt: nullableStr(raw.createdAt),
    };
  },
};
