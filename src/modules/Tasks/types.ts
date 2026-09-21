// Доменные типы модуля «Задачи».
//
// Статусы, приоритеты, типы, теги и листы — справочники компании, а не
// объединения строк: их правят в настройках, поэтому в задаче лежат id, а
// подписи и цвета берутся из `TaskDirectories`.

export type TaskDirectoryKind = "status" | "priority" | "type" | "tag" | "sheet";

/**
 * Группа статуса. Групп ровно три и они не настраиваются: от группы зависят
 * даты, которые проставляет сервер (`beginAt` и `completedAt`), а сколько
 * угодно статусов внутри группы задаёт компания.
 */
export type TaskStatusGroup = "todo" | "in_progress" | "completed";

export interface TaskDirectoryItem {
  id: string;
  title: string;
  /** `#RRGGBB`; пустая строка — цвет не задан. */
  color: string;
  /** Ключ иконки lucide (типы и приоритеты). */
  icon: string;
  /** Только у статусов: группа доски. У остальных справочников — `"todo"`. */
  group: TaskStatusGroup;
  /** Статус новой задачи — ровно один на компанию. */
  isInitial: boolean;
  /** Приоритет новой задачи — ровно один на компанию. */
  isDefault: boolean;
  sortOrder: number;
}

export interface TaskDirectories {
  statuses: TaskDirectoryItem[];
  priorities: TaskDirectoryItem[];
  types: TaskDirectoryItem[];
  tags: TaskDirectoryItem[];
  sheets: TaskDirectoryItem[];
}

export interface TaskEmployee {
  id: string;
  name: string;
  position: string;
  /** Avatar background color (hex). Initials are derived from `name`. */
  color: string;
  positionId?: string | null;
  /** Департамент нужен фильтру «задачи департамента» — у задачи своего поля нет. */
  departmentId?: string | null;
  department?: string;
  photo?: string;
}

export interface TaskComment {
  id: string;
  authorId: string | null;
  text: string;
  createdAt: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface TaskAttachment {
  id: string;
  name: string;
  /** Size in bytes. */
  size: number;
  mime: string;
  /** Stage 1: a data URL kept in the mock store; a CDN link once the API lands. */
  url: string;
  uploadedById: string | null;
  uploadedAt: string | null;
}

export type TaskHistoryKind =
  | "created"
  | "status"
  | "assignee"
  | "priority"
  | "dates"
  | "attachment"
  | "type"
  | "location"
  | "parent"
  | "comment"
  | "updated";

export interface TaskHistoryEntry {
  id: string;
  kind: TaskHistoryKind;
  /**
   * Готовая безличная фраза со значениями: «статус: «В работе» → «Готово»».
   * Названия подставил сервер в момент записи — переименование статуса задним
   * числом историю не переписывает.
   */
  text: string;
  authorId: string | null;
  at: string;
}

/** Комментарии и история одной задачи — грузятся при открытии карточки. */
export interface TaskActivity {
  comments: TaskComment[];
  history: TaskHistoryEntry[];
}

export interface Task {
  id: string;
  /** Человекочитаемый код, «TASK-001». Генерирует сервер. */
  code: string;
  title: string;
  /** HTML: выводить через `sanitizeRichText`, искать по `richTextToPlain`. */
  description: string;
  typeId: string | null;
  statusId: string | null;
  priorityId: string | null;
  /** Филиал — существующий справочник HRMS (`locations`). */
  locationId: string | null;
  sheetId: string | null;
  /** Исполнителей может быть несколько; первый ведёт стопку аватаров. */
  assigneeIds: string[];
  tagIds: string[];
  startDate: string | null;
  /**
   * Фактическое окончание работ. **Не редактируется**: сервер проставляет его
   * при переходе в финальный статус и очищает при возврате.
   */
  endDate: string | null;
  /** Крайний срок; просрочка и календарь считаются по нему. */
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
  /**
   * Когда работа началась. **Не редактируется**: сервер ставит его при
   * переходе в статус группы «В работе» и очищает при возврате в «К выполнению».
   */
  beginAt: string | null;
  completedAt: string | null;
  /**
   * Родительская задача. Подзадач как поля нет — это задачи, у которых
   * `parentId` указывает сюда (см. `subtasksOf` в constants.ts).
   */
  parentId: string | null;
  checklist: ChecklistItem[];
  attachments: TaskAttachment[];
  /** Счётчик для карточки доски; сами комментарии грузит `task_activity_get`. */
  commentCount: number;
  /** Позиция внутри колонки доски. */
  order: number;
}

/**
 * То, что отдаёт форма. `endDate` здесь нет намеренно — дату окончания ставит
 * сервер по финальному статусу.
 */
export interface TaskDraft {
  title: string;
  description: string;
  typeId: string | null;
  locationId: string | null;
  statusId: string | null;
  priorityId: string | null;
  sheetId: string | null;
  assigneeIds: string[];
  tagIds: string[];
  startDate: string | null;
  deadline: string | null;
  parentId: string | null;
  checklist?: ChecklistItem[];
  /** Файлы, выбранные до создания задачи — сохраняются вместе с ней. */
  attachments?: TaskAttachment[];
}

export interface TaskFilters {
  search: string;
  statusId: string;
  priorityId: string;
  typeId: string;
  assigneeId: string;
  locationId: string;
  tagId: string;
  /** Считается по департаменту исполнителя — своего поля у задачи нет. */
  departmentId: string;
}

export type TasksViewKey = "board" | "table" | "timeline" | "calendar";
