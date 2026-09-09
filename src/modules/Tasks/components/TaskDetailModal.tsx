import { useEffect, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  Check,
  ChevronRight,
  Clock,
  Copy,
  ListChecks,
  MoreHorizontal,
  Paperclip,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Modal } from "../../../components/ui/modal";
import {
  useAddAttachments,
  useAddChecklistItem,
  useAddTaskComment,
  useDeleteAttachment,
  useDeleteChecklistItem,
  useDeleteTask,
  useToggleChecklistItem,
  useUpdateTask,
} from "../../../api/services/task.service";
import { findDirectoryItem, formatTaskDate, isTaskOverdue, subtasksOf } from "../constants";
import { MAX_ATTACHMENT_SIZE, formatFileSize, readFiles } from "../fileUtils";
import type { TaskSheet } from "../sheets";
import type { Task, TaskActivity, TaskDirectories, TaskEmployee } from "../types";
import type { LocationOption } from "./fields/LocationField";
import { EmployeeAvatar, TypeIcon } from "./badges";
import AttachmentsGrid from "./attachments/AttachmentsGrid";
import SubtasksSection from "./SubtasksSection";
import AutoSaveText from "./ui/AutoSaveText";
import RichTextField from "./ui/RichTextField";
import AutoTextarea from "./ui/AutoTextarea";
import Popover from "./ui/Popover";
import { SidebarField } from "./ui/controls";
import StatusField from "./fields/StatusField";
import PriorityField from "./fields/PriorityField";
import TypeField from "./fields/TypeField";
import LocationField from "./fields/LocationField";
import AssigneeField from "./fields/AssigneeField";
import DateField from "./fields/DateField";
import ParentField from "./fields/ParentField";
import SheetField from "./fields/SheetField";
import TagsField from "./fields/TagsField";

interface TaskDetailModalProps {
  task: Task | null;
  employees: TaskEmployee[];
  /** Every task — needed for the parent picker and the subtask list. */
  tasks: Task[];
  /** Справочники компании: статусы, приоритеты, типы, теги. */
  directories: TaskDirectories;
  locations: LocationOption[];
  /** Комментарии и история — грузятся отдельным запросом при открытии. */
  activity: TaskActivity | undefined;
  isActivityLoading?: boolean;
  sheets: TaskSheet[];
  onMoveToSheet: (sheetId: string | null) => void;
  /** Создание тега на лету из поля тегов. */
  onCreateTag?: (title: string) => Promise<string | null>;
  /** Jump to another task (parent / subtask row). */
  onOpenTask: (task: Task) => void;
  /** Creates a subtask of the open task; the page owns sheet placement. */
  onCreateSubtask: (title: string) => Promise<void>;
  onDeleted?: (task: Task) => void;
  onClose: () => void;
}

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const relativeTime = (value: string): string => {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} дн назад`;
  return formatTaskDate(value);
};

function SectionTitle({
  children,
  meta,
  action,
}: {
  children: React.ReactNode;
  meta?: React.ReactNode;
  /** Кнопка в строке заголовка — например «Загрузить» у вложений. */
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <h4 className="text-sm font-semibold text-gray-800 dark:text-white/90">{children}</h4>
      {meta}
      {action && <span className="ml-auto">{action}</span>}
    </div>
  );
}

export default function TaskDetailModal({
  task,
  employees,
  tasks,
  directories,
  locations,
  activity,
  isActivityLoading = false,
  sheets,
  onMoveToSheet,
  onCreateTag,
  onOpenTask,
  onCreateSubtask,
  onDeleted,
  onClose,
}: TaskDetailModalProps) {
  const updateMutation = useUpdateTask();
  const deleteMutation = useDeleteTask();
  const addCommentMutation = useAddTaskComment();
  const toggleChecklistMutation = useToggleChecklistItem();
  const addChecklistMutation = useAddChecklistItem();
  const deleteChecklistMutation = useDeleteChecklistItem();
  const addAttachmentsMutation = useAddAttachments();
  const deleteAttachmentMutation = useDeleteAttachment();

  const [commentText, setCommentText] = useState("");
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [checklistText, setChecklistText] = useState("");
  const [isChecklistInputOpen, setIsChecklistInputOpen] = useState(false);
  const [activityTab, setActivityTab] = useState<"comments" | "history">("comments");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isCreatingSubtask, setIsCreatingSubtask] = useState(false);

  const checklistInputRef = useRef<HTMLInputElement>(null);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isChecklistInputOpen) checklistInputRef.current?.focus();
  }, [isChecklistInputOpen]);

  useEffect(() => {
    if (isComposerOpen) commentRef.current?.focus();
  }, [isComposerOpen]);

  const employeeById = useMemo(
    () => (id: string | null) => employees.find((employee) => employee.id === id) ?? null,
    [employees],
  );

  /**
   * Файлы принимает вся модалка: отдельной пунктирной зоны в секции больше нет,
   * `noClick` — диалог открывает кнопка «Загрузить».
   *
   * Обработчик держим в ref: хук обязан вызываться до раннего выхода по
   * `!task`, а сам загрузчик объявлен ниже и ссылается на задачу.
   */
  const uploadRef = useRef<(files: File[]) => void>(() => {});
  const {
    getRootProps: getDropRootProps,
    getInputProps: getDropInputProps,
    isDragActive,
    open: openFilePicker,
  } = useDropzone({
    onDrop: (files: File[]) => uploadRef.current(files),
    noClick: true,
    noKeyboard: true,
  });

  if (!task) return null;

  const overdue = isTaskOverdue(task, directories);
  const doneItems = task.checklist.filter((item) => item.done).length;
  const progress = task.checklist.length ? (doneItems / task.checklist.length) * 100 : 0;
  const currentUser = employees[0] ?? null;
  const parentTask = task.parentId ? tasks.find((item) => item.id === task.parentId) ?? null : null;
  const subtasks = subtasksOf(tasks, task.id);


  // Every control saves immediately — no explicit "Save" step.
  const patch = (partial: Partial<Task>) => {
    updateMutation.mutate(
      { id: task.id, patch: partial },
      {
        onError: () => {
          toast.error("Не удалось сохранить изменения.");
        },
      },
    );
  };

  const submitComment = () => {
    const text = commentText.trim();
    if (!text) return;
    setCommentText("");
    setIsComposerOpen(false);
    setActivityTab("comments");
    addCommentMutation.mutate(
      { id: task.id, text },
      {
        onError: () => {
          toast.error("Не удалось добавить комментарий.");
        },
      },
    );
  };

  const submitChecklistItem = () => {
    const text = checklistText.trim();
    if (!text) return;
    setChecklistText("");
    addChecklistMutation.mutate(
      { id: task.id, text },
      {
        onError: () => {
          toast.error("Не удалось добавить пункт.");
        },
      },
    );
  };

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const { accepted, rejected } = await readFiles(files);
    rejected.forEach((reason) => toast.error(`Файл не добавлен: ${reason}`));
    if (accepted.length === 0) return;
    addAttachmentsMutation.mutate(
      { id: task.id, files: accepted },
      {
        onSuccess: () => {
          toast.success(accepted.length === 1 ? "Файл прикреплён." : "Файлы прикреплены.");
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Не удалось прикрепить файл.");
        },
      },
    );
  };

  // Dropzone объявлен до раннего выхода, поэтому актуальный загрузчик отдаём ему здесь.
  uploadRef.current = (files: File[]) => void uploadFiles(files);

  const confirmDelete = async () => {
    try {
      await deleteMutation.mutateAsync(task.id);
      toast.success(
        subtasks.length > 0
          ? "Задача удалена — её подзадачи стали самостоятельными."
          : "Задача удалена."
      );
      onDeleted?.(task);
      setIsDeleteOpen(false);
      onClose();
    } catch {
      toast.error("Не удалось удалить задачу.");
    }
  };

  const createSubtask = async (title: string) => {
    setIsCreatingSubtask(true);
    try {
      await onCreateSubtask(title);
    } catch {
      toast.error("Не удалось создать подзадачу.");
    } finally {
      setIsCreatingSubtask(false);
    }
  };

  // Комментарии и история приходят отдельным запросом: в списке задач их нет.
  const comments = [...(activity?.comments ?? [])].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
  const history = [...(activity?.history ?? [])].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <>
      <Modal
        isOpen
        onClose={onClose}
        showCloseButton={false}
        className="mx-4 w-full max-w-[1060px] overflow-hidden rounded-2xl border border-gray-200 p-0 shadow-xl dark:border-gray-700"
      >
        <div {...getDropRootProps()} className="relative flex h-[86vh] flex-col">
          <input {...getDropInputProps()} />

          {/* Подсветка на всю модалку — файлы можно бросать куда угодно */}
          {isDragActive && (
            <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-400 bg-brand-50/90 text-brand-600 dark:bg-brand-500/20">
              <Upload size={26} />
              <span className="text-sm font-medium">Отпустите файлы</span>
              <span className="text-theme-xs">
                Изображения и документы до {formatFileSize(MAX_ATTACHMENT_SIZE)}
              </span>
            </div>
          )}

          {/* ── Header ──────────────────────────────────────────────── */}
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-5 py-2.5 dark:border-gray-700">
            <div className="flex min-w-0 items-center gap-2.5">
              {/* Parent breadcrumb — a subtask should say what it belongs to. */}
              {parentTask && (
                <span className="flex min-w-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onOpenTask(parentTask)}
                    title={`${parentTask.code} · ${parentTask.title}`}
                    className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-theme-xs text-gray-500 transition hover:bg-gray-100 hover:text-brand-600 dark:text-gray-400 dark:hover:bg-white/5"
                  >
                    <TypeIcon type={findDirectoryItem(directories.types, parentTask.typeId)} size={13} />
                    <span className="max-w-[160px] truncate">{parentTask.title}</span>
                  </button>
                  <ChevronRight size={13} className="shrink-0 text-gray-300" />
                </span>
              )}
              <span className="rounded-md bg-brand-50 px-2 py-1 text-theme-xs font-semibold uppercase tracking-wide text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                {task.code}
              </span>
              {overdue && (
                <span className="inline-flex items-center gap-1 rounded-md bg-error-50 px-2 py-1 text-theme-xs font-medium text-error-600 dark:bg-error-500/15">
                  <Clock size={12} />
                  Просрочена
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <Popover
                open={isMenuOpen}
                onOpenChange={setIsMenuOpen}
                placement="bottom-end"
                width={220}
                content={({ close }) => (
                  <div className="p-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(`${task.code} — ${task.title}`);
                        toast.success("Скопировано в буфер обмена.");
                        close();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5"
                    >
                      <Copy size={15} className="text-gray-400" />
                      Копировать номер
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        setIsDeleteOpen(true);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-error-600 transition hover:bg-error-50 dark:hover:bg-error-500/10"
                    >
                      <Trash2 size={15} />
                      Удалить задачу
                    </button>
                  </div>
                )}
              >
                {({ ref, props }) => (
                  <button
                    ref={ref}
                    type="button"
                    {...props}
                    aria-label="Действия"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/5"
                  >
                    <MoreHorizontal size={18} />
                  </button>
                )}
              </Popover>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/5"
                aria-label="Закрыть"
              >
                <X size={18} />
              </button>
            </div>
          </header>

          {/* ── Body ────────────────────────────────────────────────── */}
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            {/* Main column */}
            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {/* Title and description autosave on blur — no edit mode. */}
              <AutoSaveText
                value={task.title}
                onSave={(title) => patch({ title })}
                placeholder="Название задачи"
                required
                minHeight={36}
                className="text-xl font-semibold leading-snug text-gray-900 dark:text-white/90"
              />

              <section className="mt-5">
                <SectionTitle>Описание</SectionTitle>
                <RichTextField
                  value={task.description}
                  onSave={(description) => patch({ description })}
                  placeholder="Добавьте описание задачи..."
                />
              </section>

              {/* Attachments */}
              <section className="mt-7">
                <SectionTitle
                  meta={
                    task.attachments.length > 0 ? (
                      <span className="text-theme-xs font-medium text-gray-400">
                        {task.attachments.length}
                      </span>
                    ) : undefined
                  }
                  action={
                    <button
                      type="button"
                      onClick={openFilePicker}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1 text-theme-xs font-medium text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
                    >
                      <Upload size={13} />
                      Загрузить
                    </button>
                  }
                >
                  <span className="flex items-center gap-2">
                    <Paperclip size={15} className="text-gray-400" />
                    Вложения
                  </span>
                </SectionTitle>

                <AttachmentsGrid
                  attachments={task.attachments}
                  onPickFiles={openFilePicker}
                  onRemove={(attachmentId) =>
                    deleteAttachmentMutation.mutate(
                      { id: task.id, attachmentId },
                      {
                        onError: () => {
                          toast.error("Не удалось удалить файл.");
                        },
                      },
                    )
                  }
                  isUploading={addAttachmentsMutation.isLoading}
                />
              </section>

              {/* Checklist */}
              <section className="mt-7">
                <SectionTitle
                  meta={
                    task.checklist.length > 0 ? (
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                          <span
                            className="block h-full rounded-full bg-success-500 transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </span>
                        <span className="text-theme-xs font-medium text-gray-400">
                          {doneItems}/{task.checklist.length}
                        </span>
                      </span>
                    ) : undefined
                  }
                >
                  <span className="flex items-center gap-2">
                    <ListChecks size={16} className="text-gray-400" />
                    Чек-лист
                  </span>
                </SectionTitle>

                <div className="space-y-0.5">
                  {task.checklist.map((item) => (
                    <div
                      key={item.id}
                      className="group flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition hover:bg-gray-50 dark:hover:bg-white/5"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          toggleChecklistMutation.mutate({
                            id: task.id,
                            itemId: item.id,
                          })
                        }
                        aria-label={item.done ? "Снять отметку" : "Отметить выполненным"}
                        className={`inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition ${
                          item.done
                            ? "border-success-500 bg-success-500 text-white"
                            : "border-gray-300 text-transparent hover:border-success-400 dark:border-gray-600"
                        }`}
                      >
                        <Check size={12} strokeWidth={3} />
                      </button>
                      <span
                        className={`flex-1 text-sm ${
                          item.done
                            ? "text-gray-400 line-through"
                            : "text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {item.text}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          deleteChecklistMutation.mutate({
                            id: task.id,
                            itemId: item.id,
                          })
                        }
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-400 opacity-0 transition hover:bg-error-50 hover:text-error-600 focus:opacity-100 group-hover:opacity-100 dark:hover:bg-error-500/10"
                        aria-label="Удалить пункт"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>

                {isChecklistInputOpen ? (
                  <div className="mt-1.5 flex items-center gap-2">
                    <input
                      ref={checklistInputRef}
                      type="text"
                      value={checklistText}
                      onChange={(event) => setChecklistText(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") submitChecklistItem();
                        if (event.key === "Escape") {
                          setChecklistText("");
                          setIsChecklistInputOpen(false);
                        }
                      }}
                      onBlur={() => {
                        if (!checklistText.trim()) setIsChecklistInputOpen(false);
                      }}
                      placeholder="Что нужно сделать? Enter — добавить"
                      className="h-9 flex-1 rounded-lg border border-brand-300 bg-transparent px-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:text-white/90"
                    />
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={submitChecklistItem}
                      disabled={!checklistText.trim()}
                      className="inline-flex h-9 items-center rounded-lg bg-brand-500 px-3 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-40"
                    >
                      Добавить
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsChecklistInputOpen(true)}
                    className="mt-1 inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-sm text-gray-500 transition hover:bg-gray-50 hover:text-brand-600 dark:text-gray-400 dark:hover:bg-white/5"
                  >
                    <Plus size={15} />
                    Добавить пункт
                  </button>
                )}
              </section>

              {/* Subtasks */}
              <SubtasksSection
                subtasks={subtasks}
                employees={employees}
                directories={directories}
                onOpenTask={onOpenTask}
                onCreate={(title) => void createSubtask(title)}
                onDetach={(subtaskId) =>
                  updateMutation.mutate(
                    { id: subtaskId, patch: { parentId: null } },
                    {
                      onSuccess: () => {
                        toast.success("Подзадача откреплена.");
                      },
                      onError: () => {
                        toast.error("Не удалось открепить подзадачу.");
                      },
                    },
                  )
                }
                isCreating={isCreatingSubtask}
              />

              {/* Activity */}
              <section className="mt-8 pb-2">
                <div className="mb-3 flex items-center gap-1 border-b border-gray-200 dark:border-gray-700">
                  {(
                    [
                      {
                        key: "comments",
                        label: "Комментарии",
                        count: comments.length,
                      },
                      {
                        key: "history",
                        label: "История",
                        count: history.length,
                      },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActivityTab(tab.key)}
                      className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition ${
                        activityTab === tab.key
                          ? "border-brand-500 text-brand-600 dark:text-brand-400"
                          : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
                      }`}
                    >
                      {tab.label}
                      {tab.count > 0 && (
                        <span className="rounded-full bg-gray-100 px-1.5 text-theme-xs text-gray-500 dark:bg-white/10 dark:text-gray-400">
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {activityTab === "comments" ? (
                  <>
                    <div className="mb-5 flex items-start gap-2.5">
                      <EmployeeAvatar employee={currentUser} size={30} />
                      <div className="flex-1">
                        {isComposerOpen ? (
                          <>
                            <AutoTextarea
                              ref={commentRef}
                              value={commentText}
                              onChange={(event) => setCommentText(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                                  event.preventDefault();
                                  submitComment();
                                }
                                if (event.key === "Escape") {
                                  setCommentText("");
                                  setIsComposerOpen(false);
                                }
                              }}
                              minHeight={72}
                              placeholder="Напишите комментарий..."
                              className="rounded-xl border border-brand-300 bg-transparent px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:text-white/90"
                            />
                            <div className="mt-2 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={submitComment}
                                disabled={!commentText.trim()}
                                className="rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-40"
                              >
                                Отправить
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setCommentText("");
                                  setIsComposerOpen(false);
                                }}
                                className="rounded-lg px-3 py-2 text-sm text-gray-500 transition hover:bg-gray-100 dark:hover:bg-white/5"
                              >
                                Отмена
                              </button>
                              <span className="ml-auto text-theme-xs text-gray-400">
                                ⌘+Enter — отправить
                              </span>
                            </div>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setIsComposerOpen(true)}
                            className="h-10 w-full rounded-xl border border-gray-200 px-3 text-left text-sm text-gray-400 transition hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/5"
                          >
                            Напишите комментарий...
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      {isActivityLoading && comments.length === 0 && (
                        <p className="py-6 text-center text-sm text-gray-400">
                          Загружаем обсуждение...
                        </p>
                      )}
                      {!isActivityLoading && comments.length === 0 && (
                        <p className="py-2 text-sm text-gray-400">
                          Комментариев пока нет — начните обсуждение.
                        </p>
                      )}
                      {comments.map((comment) => {
                        const author = employeeById(comment.authorId);
                        return (
                          <div key={comment.id} className="flex gap-2.5">
                            <EmployeeAvatar employee={author} size={30} />
                            <div className="min-w-0 flex-1 rounded-xl bg-gray-50 px-3 py-2 dark:bg-white/5">
                              <div className="flex items-baseline gap-2">
                                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                  {author?.name ?? "Система"}
                                </span>
                                <span className="text-theme-xs text-gray-400">
                                  {relativeTime(comment.createdAt)}
                                </span>
                              </div>
                              <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-400">
                                {comment.text}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <ol className="divide-y divide-gray-50 dark:divide-gray-800/60">
                    {history.map((entry) => {
                      const author = employeeById(entry.authorId);
                      return (
                        // Фразы истории теперь со значениями («статус: «X» →
                        // «Y»») и в строку не помещаются — перенос вместо
                        // обрезки, иначе главное в записи и терялось.
                        <li key={entry.id} className="flex items-start gap-2.5 py-2">
                          <EmployeeAvatar employee={author} size={22} />
                          <span className="min-w-0 flex-1 text-sm leading-[22px] text-gray-500 dark:text-gray-400">
                            <span className="font-medium text-gray-700 dark:text-gray-200">
                              {author?.name ?? "Система"}
                            </span>
                            <span className="px-1.5 text-gray-300">·</span>
                            {entry.text}
                          </span>
                          <span className="shrink-0 pt-0.5 text-theme-xs text-gray-400">
                            {relativeTime(entry.at)}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>
            </div>

            {/* ── Sidebar ───────────────────────────────────────────── */}
            <aside className="custom-scrollbar min-h-0 w-full shrink-0 overflow-y-auto border-t border-gray-200 bg-gray-50/60 px-5 py-5 dark:border-gray-700 dark:bg-white/[0.02] lg:w-[360px] lg:border-l lg:border-t-0">
              <StatusField
                value={task.statusId}
                statuses={directories.statuses}
                onChange={(statusId) => patch({ statusId })}
                variant="lozenge"
              />

              <div className="mt-5 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
                <p className="mb-1 px-2 text-theme-xs font-semibold uppercase tracking-wide text-gray-400">
                  Детали
                </p>

                <SidebarField label="Тип">
                  <TypeField
                    value={task.typeId}
                    types={directories.types}
                    onChange={(typeId) => patch({ typeId })}
                    variant="row"
                  />
                </SidebarField>

                <SidebarField label="Исполнители">
                  <AssigneeField
                    value={task.assigneeIds}
                    employees={employees}
                    onChange={(assigneeIds) => patch({ assigneeIds })}
                    variant="row"
                  />
                </SidebarField>

                <SidebarField label="Приоритет">
                  <PriorityField
                    value={task.priorityId}
                    priorities={directories.priorities}
                    onChange={(priorityId) => patch({ priorityId })}
                    variant="row"
                  />
                </SidebarField>

                <SidebarField label="Локация">
                  <LocationField
                    value={task.locationId}
                    locations={locations}
                    onChange={(locationId) => patch({ locationId })}
                    variant="row"
                    placeholder="Указать локацию"
                  />
                </SidebarField>

                <SidebarField label="Начало">
                  <DateField
                    value={task.startDate}
                    onChange={(startDate) => patch({ startDate })}
                    variant="row"
                    placeholder="Указать дату"
                  />
                </SidebarField>

                <SidebarField label="Дедлайн">
                  <DateField
                    value={task.deadline}
                    onChange={(deadline) => patch({ deadline })}
                    variant="row"
                    placeholder="Указать дату"
                    overdue={overdue}
                  />
                </SidebarField>

                <SidebarField label="Родитель">
                  <ParentField
                    value={task.parentId}
                    types={directories.types}
                    tasks={tasks}
                    taskId={task.id}
                    onChange={(parentId) => patch({ parentId })}
                    variant="row"
                    placeholder="Выбрать задачу"
                  />
                </SidebarField>

                <SidebarField label="Лист">
                  <SheetField
                    value={task.sheetId}
                    sheets={sheets}
                    onChange={onMoveToSheet}
                    variant="row"
                  />
                </SidebarField>

                <SidebarField label="Теги">
                  <TagsField
                    value={task.tagIds}
                    tags={directories.tags}
                    onChange={(tagIds) => patch({ tagIds })}
                    onCreateTag={onCreateTag}
                    variant="row"
                  />
                </SidebarField>
              </div>

              <dl className="mt-4 space-y-1.5 px-2 text-theme-xs text-gray-400">
                <div className="flex justify-between gap-2">
                  <dt>Создана</dt>
                  <dd className="text-gray-500 dark:text-gray-400">
                    {formatDateTime(task.createdAt)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Обновлена</dt>
                  <dd className="text-gray-500 dark:text-gray-400">
                    {formatDateTime(task.updatedAt)}
                  </dd>
                </div>
                {/* Не редактируются: даты начала и окончания ставит сервер по
                    группе статуса — «В работе» и «Завершено». Показываем только
                    дату: время начала здесь не нужно, а у окончания его нет. */}
                <div className="flex justify-between gap-2">
                  <dt>Начата</dt>
                  <dd className="text-gray-500 dark:text-gray-400">
                    {task.beginAt ? formatTaskDate(task.beginAt) : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Завершена</dt>
                  <dd className="text-gray-500 dark:text-gray-400">
                    {task.endDate ? formatTaskDate(task.endDate) : "—"}
                  </dd>
                </div>

              </dl>
            </aside>
          </div>
        </div>
      </Modal>

      {/* Same reason as the preview modal: never mount it closed. */}
      {isDeleteOpen && (
        <Modal
          isOpen
          onClose={() => setIsDeleteOpen(false)}
          showCloseButton={false}
          className="mx-4 w-full max-w-[380px] overflow-hidden rounded-2xl border border-gray-200 p-0 shadow-xl dark:border-gray-700"
        >
          <div className="p-5">
            <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-error-50 text-error-500 dark:bg-error-500/15">
              <Trash2 size={20} />
            </div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white/90">
              Удалить задачу?
            </h3>
            <p className="mt-1.5 text-sm text-gray-500">
              «{task.title}» будет удалена безвозвратно. Это действие нельзя отменить.
              {subtasks.length > 0 && (
                <>
                  {" "}
                  Подзадачи ({subtasks.length}) не удаляются — они останутся на доске без
                  родителя.
                </>
              )}
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setIsDeleteOpen(false)}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/5"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteMutation.isLoading}
                className="flex-1 rounded-lg bg-error-500 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-error-600 disabled:opacity-60"
              >
                {deleteMutation.isLoading ? "Удаление..." : "Удалить"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
