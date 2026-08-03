import { useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { AlertCircle, Paperclip, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "../../../components/ui/modal";
import { MAX_ATTACHMENT_SIZE, formatFileSize, readFiles } from "../fileUtils";
import type {
  Task,
  TaskAttachment,
  TaskDirectories,
  TaskDraft,
  TaskEmployee,
} from "../types";
import { defaultPriority, initialStatus as pickInitialStatus } from "../constants";
import type { TaskSheet } from "../sheets";
import type { LocationOption } from "./fields/LocationField";
import SheetField from "./fields/SheetField";
import RichTextEditor from "../../../components/form/RichTextEditor";
import { isRichTextEmpty, sanitizeRichText } from "../../../components/form/richText";
import AttachmentsGrid from "./attachments/AttachmentsGrid";
import AutoTextarea from "./ui/AutoTextarea";
import StatusField from "./fields/StatusField";
import PriorityField from "./fields/PriorityField";
import TypeField from "./fields/TypeField";
import LocationField from "./fields/LocationField";
import AssigneeField from "./fields/AssigneeField";
import DateField from "./fields/DateField";
import ParentField from "./fields/ParentField";
import TagsField from "./fields/TagsField";

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Resolves to `true` when the task was saved. */
  onSubmit: (draft: TaskDraft) => Promise<boolean> | boolean;
  isSubmitting?: boolean;
  employees: TaskEmployee[];
  /** Every task — the parent picker needs the full list. */
  tasks: Task[];
  /** When set — edit mode, otherwise create. */
  task?: Task | null;
  /** Справочники компании: статусы, приоритеты, типы, теги. */
  directories: TaskDirectories;
  locations: LocationOption[];
  sheets: TaskSheet[];
  /** Лист, в который попадёт новая задача (активный в тулбаре). */
  initialSheetId?: string | null;
  /** Preselected status for "add to column". */
  initialStatusId?: string | null;
  /** Preselected parent for "add a subtask". */
  initialParentId?: string | null;
  /** Создание тега на лету из поля тегов. */
  onCreateTag?: (title: string) => Promise<string | null>;
}

/**
 * Пустой черновик. Статус и приоритет берутся из справочника (флаги
 * `isInitial` / `isDefault`), а не из констант — их задают в настройках.
 * Поля «Завершена» здесь нет: дату ставит сервер при переходе в финальный статус.
 */
const emptyDraft = (
  directories: TaskDirectories,
  statusId: string | null,
  parentId: string | null = null,
  sheetId: string | null = null
): TaskDraft => ({
  title: "",
  description: "",
  typeId: directories.types[0]?.id ?? null,
  locationId: null,
  statusId: statusId ?? pickInitialStatus(directories)?.id ?? null,
  priorityId: defaultPriority(directories)?.id ?? null,
  sheetId,
  assigneeIds: [],
  tagIds: [],
  startDate: null,
  deadline: null,
  parentId,
  checklist: [],
  attachments: [],
});

/**
 * Quick-create modal in the Linear/Jira mould: the task *is* its title, so the
 * title takes the whole first line and every other attribute is an optional
 * chip below it — no labels, no eight-row form to scroll through.
 */
export default function TaskFormModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  employees,
  tasks,
  task,
  directories,
  locations,
  sheets,
  initialSheetId = null,
  initialStatusId = null,
  initialParentId = null,
  onCreateTag,
}: TaskFormModalProps) {
  const [draft, setDraft] = useState<TaskDraft>(() =>
    emptyDraft(directories, initialStatusId, initialParentId, initialSheetId)
  );
  const [touched, setTouched] = useState(false);
  const [createAnother, setCreateAnother] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  const isEdit = Boolean(task);

  /** Перетаскивание работает по всей модалке; клик — только по кнопке. */
  const addFilesRef = useRef<(files: File[]) => void>(() => {});
  const {
    getRootProps: getDropRootProps,
    getInputProps: getDropInputProps,
    isDragActive,
    open: openFilePicker,
  } = useDropzone({
    onDrop: (files: File[]) => addFilesRef.current(files),
    noClick: true,
    noKeyboard: true,
  });

  useEffect(() => {
    if (!isOpen) return;
    setTouched(false);
    setDraft(
      task
        ? {
            title: task.title,
            description: task.description,
            typeId: task.typeId,
            locationId: task.locationId,
            statusId: task.statusId,
            priorityId: task.priorityId,
            sheetId: task.sheetId,
            assigneeIds: task.assigneeIds,
            tagIds: task.tagIds,
            startDate: task.startDate,
            deadline: task.deadline,
            parentId: task.parentId,
            checklist: task.checklist,
            attachments: task.attachments,
          }
        : emptyDraft(directories, initialStatusId, initialParentId, initialSheetId)
    );
    setShowAttachments(false);
    // Autofocus after the modal paints.
    const timer = window.setTimeout(() => titleRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [isOpen, task, directories, initialStatusId, initialParentId, initialSheetId]);

  const patch = (partial: Partial<TaskDraft>) => setDraft((prev) => ({ ...prev, ...partial }));

  const attachments = draft.attachments ?? [];

  /** Files are read to data URLs here and travel with the draft on submit. */
  addFilesRef.current = (files: File[]) => void addFiles(files);

  const addFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const { accepted, rejected } = await readFiles(files);
    rejected.forEach((reason) => toast.error(`Файл не добавлен: ${reason}`));
    if (accepted.length === 0) return;
    const staged: TaskAttachment[] = accepted.map((file, index) => ({
      ...file,
      id: `draft-${Date.now()}-${index}`,
      uploadedById: null,
      uploadedAt: new Date().toISOString(),
    }));
    patch({ attachments: [...attachments, ...staged] });
  };

  const titleError = touched && !draft.title.trim();
  const lastDate = draft.deadline;
  const datesInverted =
    Boolean(draft.startDate) && Boolean(lastDate) && lastDate! < draft.startDate!;

  const handleSubmit = async () => {
    setTouched(true);
    if (!draft.title.trim() || isSubmitting) return;

    const saved = await onSubmit({
      ...draft,
      title: draft.title.trim(),
      description: isRichTextEmpty(draft.description) ? "" : sanitizeRichText(draft.description),
    });
    if (!saved) return;

    if (createAnother && !isEdit) {
      // Сохраняем контекст колонки, приоритета, тегов и места — чистим содержание.
      setDraft({
        ...emptyDraft(directories, draft.statusId, draft.parentId, draft.sheetId),
        typeId: draft.typeId,
        locationId: draft.locationId,
        priorityId: draft.priorityId,
        tagIds: draft.tagIds,
      });
      setTouched(false);
      titleRef.current?.focus();
    } else {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      showCloseButton={false}
      className="mx-4 w-full max-w-[620px] overflow-hidden rounded-2xl border border-gray-200 p-0 shadow-xl dark:border-gray-700"
    >
      <div
        {...getDropRootProps()}
        className="relative flex max-h-[88vh] flex-col"
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void handleSubmit();
          }
        }}
      >
        <input {...getDropInputProps()} />

        {isDragActive && (
          <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-400 bg-brand-50/90 text-brand-600 dark:bg-brand-500/20">
            <Upload size={26} />
            <span className="text-sm font-medium">Отпустите файлы</span>
            <span className="text-theme-xs">
              Изображения и документы до {formatFileSize(MAX_ATTACHMENT_SIZE)}
            </span>
          </div>
        )}
        <header className="flex shrink-0 items-center justify-between gap-3 px-5 pb-1 pt-4">
          <div className="flex items-center gap-2">
            {isEdit && (
              <span className="rounded-md bg-brand-50 px-2 py-1 text-theme-xs font-semibold uppercase tracking-wide text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                {task?.code}
              </span>
            )}
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {isEdit ? "Редактирование задачи" : draft.parentId ? "Новая подзадача" : "Новая задача"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/5"
            aria-label="Закрыть"
          >
            <X size={17} />
          </button>
        </header>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-1">
          <AutoTextarea
            ref={titleRef}
            value={draft.title}
            onChange={(event) => patch({ title: event.target.value })}
            onKeyDown={(event) => {
              // The title is a single line — Enter must not grow it.
              if (event.key === "Enter" && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
                event.preventDefault();
              }
            }}
            minHeight={36}
            maxHeight={120}
            placeholder="Название задачи"
            className={`rounded-lg bg-transparent px-1 py-1 text-lg font-semibold leading-snug text-gray-900 placeholder:text-gray-300 focus:outline-hidden dark:text-white/90 dark:placeholder:text-gray-600 ${
              titleError ? "ring-1 ring-error-400" : ""
            }`}
          />
          {titleError && (
            <p className="mb-1 flex items-center gap-1.5 px-1 text-theme-xs text-error-500">
              <AlertCircle size={13} />
              Укажите название задачи
            </p>
          )}

          <div className="mt-2">
            <RichTextEditor
              value={draft.description}
              onChange={(description) => patch({ description })}
              minHeight={120}
              placeholder="Добавьте описание, критерии приёмки, ссылки..."
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
            <TypeField
              value={draft.typeId}
              types={directories.types}
              onChange={(typeId) => patch({ typeId })}
              variant="chip"
            />
            <StatusField
              value={draft.statusId}
              statuses={directories.statuses}
              onChange={(statusId) => patch({ statusId })}
              variant="chip"
            />
            <PriorityField
              value={draft.priorityId}
              priorities={directories.priorities}
              onChange={(priorityId) => patch({ priorityId })}
              variant="chip"
            />
            <AssigneeField
              value={draft.assigneeIds}
              employees={employees}
              onChange={(assigneeIds) => patch({ assigneeIds })}
              variant="chip"
              placeholder="Исполнители"
            />
            <LocationField
              value={draft.locationId}
              locations={locations}
              onChange={(locationId) => patch({ locationId })}
              variant="chip"
            />
            <DateField
              value={draft.startDate}
              onChange={(startDate) => patch({ startDate })}
              variant="chip"
              placeholder="Начало"
            />
            <DateField
              value={draft.deadline}
              onChange={(deadline) => patch({ deadline })}
              variant="chip"
              placeholder="Дедлайн"
            />
            <ParentField
              value={draft.parentId}
              types={directories.types}
              tasks={tasks}
              taskId={task?.id ?? null}
              onChange={(parentId) => patch({ parentId })}
              variant="chip"
            />
            <TagsField
              value={draft.tagIds}
              tags={directories.tags}
              onChange={(tagIds) => patch({ tagIds })}
              onCreateTag={onCreateTag}
              variant="chip"
            />
            <SheetField
              value={draft.sheetId}
              sheets={sheets}
              onChange={(sheetId) => patch({ sheetId })}
              variant="chip"
            />

            {/* The attachment area is heavy, so it stays folded until asked for. */}
            {!showAttachments && attachments.length === 0 && (
              <button
                type="button"
                onClick={() => setShowAttachments(true)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 text-sm text-gray-400 transition hover:border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-white/5"
              >
                <Paperclip size={15} />
                Файлы
              </button>
            )}
          </div>

          {(showAttachments || attachments.length > 0) && (
            <div className="mt-3">
              <div className="mb-2.5 flex items-center gap-2">
                <h4 className="text-sm font-semibold text-gray-800 dark:text-white/90">
                  Вложения
                </h4>
                <button
                  type="button"
                  onClick={openFilePicker}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1 text-theme-xs font-medium text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
                >
                  <Upload size={13} />
                  Загрузить
                </button>
              </div>
              <AttachmentsGrid
                attachments={attachments}
                onPickFiles={openFilePicker}
                onRemove={(attachmentId) =>
                  patch({ attachments: attachments.filter((file) => file.id !== attachmentId) })
                }
              />
            </div>
          )}

          {datesInverted && (
            <p className="mt-2.5 flex items-center gap-1.5 text-theme-xs text-warning-600 dark:text-orange-400">
              <AlertCircle size={13} />
              Дедлайн раньше даты начала
            </p>
          )}

        </div>

        <footer className="flex shrink-0 items-center gap-3 border-t border-gray-200 px-5 py-3.5 dark:border-gray-700">
          {!isEdit && (
            <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <input
                type="checkbox"
                checked={createAnother}
                onChange={(event) => setCreateAnother(event.target.checked)}
                className="h-4 w-4 cursor-pointer rounded border-gray-300 text-brand-500 focus:ring-brand-500/20"
              />
              Создать ещё одну
            </label>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3.5 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Сохранение..." : isEdit ? "Сохранить" : "Создать задачу"}
              <kbd className="hidden rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-medium sm:inline">
                ⌘↵
              </kbd>
            </button>
          </div>
        </footer>
      </div>
    </Modal>
  );
}
