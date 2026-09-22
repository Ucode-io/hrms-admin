import { useState, type CSSProperties } from "react";
import { useQueryClient } from "react-query";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import PageMeta from "../../../components/common/PageMeta";
import Button from "../../../components/ui/button/Button";
import { Modal } from "../../../components/ui/modal";
import {
  TASK_DIRECTORIES_KEY,
  taskDirectoriesService,
  useDeleteTaskDirectory,
  useSaveTaskDirectory,
  useTaskDirectoriesQuery,
} from "../../../api/services/taskDirectories.service";
import { STATUS_GROUP_META, STATUS_GROUP_ORDER } from "../../Tasks/statusGroups";
import type {
  TaskDirectories,
  TaskDirectoryItem,
  TaskDirectoryKind,
  TaskStatusGroup,
} from "../../Tasks/types";
import { useTranslation } from "../../../i18n";
import type { MessageKey } from "../../../i18n/messages";

/**
 * Справочники модуля «Задачи»: статусы, приоритеты, типы и теги.
 *
 * Статусы разложены по трём группам (`todo` / `in_progress` / `completed`):
 * группа определяет, какие даты сервер проставит задаче при переходе, поэтому
 * статус заводится сразу внутрь группы, а не помечается флагом «завершающий».
 *
 * Флаги `is_initial` / `is_default` уникальны в пределах компании — их снимает
 * сервер, поэтому после сохранения справочники перечитываются целиком.
 *
 * Листы задач здесь не редактируются: их заводят прямо в тулбаре доски, где они
 * и нужны.
 */

type TabKey = Extract<TaskDirectoryKind, "status" | "priority" | "type" | "tag">;

/**
 * `listKey` задан явно, а не как `key + "s"`: из «priority» получилось бы
 * «prioritys», и вкладка приоритетов всегда была бы пустой, хотя справочник
 * загружен.
 */
const TABS: {
  key: TabKey;
  listKey: keyof TaskDirectories;
  titleKey: MessageKey;
  hintKey: MessageKey;
  hasIcon: boolean;
  flag?: { field: "isInitial" | "isDefault"; labelKey: MessageKey; hintKey: MessageKey };
}[] = [
  {
    key: "status",
    listKey: "statuses",
    titleKey: "settings_misc.task_directories.tab_statuses",
    hintKey: "settings_misc.task_directories.tab_statuses_hint",
    hasIcon: false,
    flag: {
      field: "isInitial",
      labelKey: "settings_misc.task_directories.flag_initial_label",
      hintKey: "settings_misc.task_directories.flag_initial_hint",
    },
  },
  {
    key: "priority",
    listKey: "priorities",
    titleKey: "settings_misc.task_directories.tab_priorities",
    hintKey: "settings_misc.task_directories.tab_priorities_hint",
    hasIcon: true,
    flag: {
      field: "isDefault",
      labelKey: "settings_misc.task_directories.flag_default_label",
      hintKey: "settings_misc.task_directories.flag_default_hint",
    },
  },
  {
    key: "type",
    listKey: "types",
    titleKey: "settings_misc.task_directories.tab_types",
    hintKey: "settings_misc.task_directories.tab_types_hint",
    hasIcon: true,
  },
  {
    key: "tag",
    listKey: "tags",
    titleKey: "settings_misc.task_directories.tab_tags",
    hintKey: "settings_misc.task_directories.tab_tags_hint",
    hasIcon: false,
  },
];

const PALETTE = [
  "#94a3b8",
  "#0ba5ec",
  "#12b76a",
  "#f79009",
  "#f04438",
  "#7c4dff",
  "#465fff",
  "#ec4899",
];

/** Ключи иконок lucide, которые понимает `badges.tsx`. */
const ICON_KEYS = [
  "square-check",
  "bug",
  "sparkles",
  "users",
  "flask-conical",
  "chevron-down",
  "equal",
  "chevron-up",
  "chevrons-up",
];

type DraftItem = {
  id?: string;
  title: string;
  color: string;
  icon: string;
  group: TaskStatusGroup;
  isInitial: boolean;
  isDefault: boolean;
};

const emptyDraft = (group: TaskStatusGroup = "todo"): DraftItem => ({
  title: "",
  color: PALETTE[1],
  icon: "",
  group,
  isInitial: false,
  isDefault: false,
});

const toDraft = (item: TaskDirectoryItem): DraftItem => ({
  id: item.id,
  title: item.title,
  color: item.color || PALETTE[0],
  icon: item.icon,
  group: item.group,
  isInitial: item.isInitial,
  isDefault: item.isDefault,
});

/**
 * Новый порядок вкладки после перетаскивания.
 *
 * `scope` — список, внутри которого шло перетаскивание: у статусов это одна
 * группа, у остальных справочников — вся вкладка. Элементы вне `scope` остаются
 * на своих местах, а `sortOrder` пересчитывается по всей вкладке, чтобы
 * значения не пересекались между группами.
 *
 * Чистая функция и экспортируется отдельно от компонента: перестановка — это то,
 * что реально может сломаться, и её нужно уметь проверить без событий мыши.
 */
export const reorderDirectoryItems = (
  items: TaskDirectoryItem[],
  scope: TaskDirectoryItem[],
  activeId: string,
  overId: string
): { nextList: TaskDirectoryItem[]; changed: TaskDirectoryItem[] } | null => {
  if (activeId === overId) return null;

  const from = scope.findIndex((item) => item.id === activeId);
  const to = scope.findIndex((item) => item.id === overId);
  if (from < 0 || to < 0) return null;

  const queue = arrayMove(scope, from, to);
  const scopeIds = new Set(scope.map((item) => item.id));
  let cursor = 0;

  const nextList = items
    .map((item) => (scopeIds.has(item.id) ? queue[cursor++] ?? item : item))
    .map((item, index) => ({ ...item, sortOrder: index }));

  return {
    nextList,
    changed: nextList.filter((item, index) => items[index]?.id !== item.id),
  };
};

/**
 * Строка справочника: перетаскивается за ручку.
 *
 * Слушатели drag висят только на ручке, а не на всей строке — иначе клик по
 * строке (открыть редактор) и по корзине конфликтовали бы с началом
 * перетаскивания.
 */
function SortableDirectoryRow({
  item,
  onEdit,
  onDelete,
}: {
  item: TaskDirectoryItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({
    id: item.id,
  });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    ...(isDragging ? { zIndex: 5, position: "relative" as const } : {}),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex w-full items-center gap-3 border-b border-gray-50 bg-white px-4 py-3 last:border-b-0 ${
        isDragging ? "shadow-md" : "hover:bg-gray-50"
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab text-gray-300 transition hover:text-gray-500 active:cursor-grabbing"
        aria-label={t("settings_misc.task_directories.drag_aria", { title: item.title })}
      >
        <GripVertical size={14} />
      </button>

      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: item.color || "#94a3b8" }}
        />
        <span className="min-w-0 flex-1 truncate text-sm text-gray-800">{item.title}</span>

        {item.isInitial && (
          <span className="rounded-md bg-blue-light-50 px-2 py-0.5 text-[11px] font-medium text-blue-light-600">
            {t("settings_misc.task_directories.badge_initial")}
          </span>
        )}
        {item.isDefault && (
          <span className="rounded-md bg-blue-light-50 px-2 py-0.5 text-[11px] font-medium text-blue-light-600">
            {t("settings_misc.task_directories.badge_default")}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={onDelete}
        className="shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-error-50 hover:text-error-600"
        aria-label={t("settings_misc.task_directories.delete_aria", { title: item.title })}
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

export default function TaskDirectoriesSettingsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>("status");
  const [draft, setDraft] = useState<DraftItem | null>(null);
  const [toDelete, setToDelete] = useState<TaskDirectoryItem | null>(null);

  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useTaskDirectoriesQuery();
  const saveMutation = useSaveTaskDirectory();
  const deleteMutation = useDeleteTaskDirectory();

  // Порог в 4px: без него любое нажатие на ручку считалось бы началом
  // перетаскивания и «съедало» бы фокус. Клавиатурный сенсор — не только
  // доступность: порядок можно менять с клавиатуры (Space — взять, стрелки —
  // двигать, Space — положить).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const tab = TABS.find((item) => item.key === activeTab) ?? TABS[0];
  const items: TaskDirectoryItem[] = data?.[tab.listKey] ?? [];

  const handleSave = async () => {
    if (!draft || !draft.title.trim()) return;

    try {
      await saveMutation.mutateAsync({
        kind: tab.key,
        id: draft.id,
        title: draft.title.trim(),
        color: draft.color,
        icon: tab.hasIcon ? draft.icon : undefined,
        group: tab.key === "status" ? draft.group : undefined,
        isInitial: draft.isInitial,
        isDefault: draft.isDefault,
      });
      setDraft(null);
      toast.success(t("settings_misc.task_directories.toast_saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("settings_misc.task_directories.toast_save_failed"));
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;

    try {
      await deleteMutation.mutateAsync({ kind: tab.key, id: toDelete.id });
      setToDelete(null);
      toast.success(t("settings_misc.task_directories.toast_deleted"));
    } catch (error) {
      // Сервер не даёт удалить статус, приоритет или тип, пока на нём есть задачи.
      toast.error(error instanceof Error ? error.message : t("settings_misc.task_directories.toast_delete_failed"));
    }
  };

  /**
   * Сохранение нового порядка.
   *
   * Сначала пишем результат в кэш: без этого строка отпрыгивала бы на место до
   * ответа сервера. Затем сохраняем только сдвинувшиеся элементы — частичного
   * метода нет, `task_directory_save` перезаписывает элемент целиком, поэтому в
   * запрос уходят все поля, а не один `sortOrder` (иначе сервер обнулил бы цвет
   * и снял флаг «стартовый»).
   */
  const handleDragEnd = async (event: DragEndEvent, scope: TaskDirectoryItem[]) => {
    const { active, over } = event;
    if (!over) return;

    const result = reorderDirectoryItems(items, scope, String(active.id), String(over.id));
    if (!result || result.changed.length === 0) return;

    const { nextList, changed } = result;
    const previousData = data;

    queryClient.setQueryData(TASK_DIRECTORIES_KEY, {
      ...(previousData ?? {}),
      [tab.listKey]: nextList,
    });

    try {
      for (const item of changed) {
        await taskDirectoriesService.save({
          kind: tab.key,
          id: item.id,
          title: item.title,
          color: item.color,
          icon: tab.hasIcon ? item.icon : undefined,
          group: tab.key === "status" ? item.group : undefined,
          isInitial: item.isInitial,
          isDefault: item.isDefault,
          sortOrder: item.sortOrder,
        });
      }
    } catch (error) {
      if (previousData) queryClient.setQueryData(TASK_DIRECTORIES_KEY, previousData);
      toast.error(error instanceof Error ? error.message : t("settings_misc.task_directories.toast_reorder_failed"));
    } finally {
      queryClient.invalidateQueries(TASK_DIRECTORIES_KEY);
    }
  };

  /** Сортируемый список: и плоская вкладка, и группа статусов рисуются им. */
  const renderList = (list: TaskDirectoryItem[]) => (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={(event) => {
        void handleDragEnd(event, list);
      }}
    >
      <SortableContext
        items={list.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        {list.map((item) => (
          <SortableDirectoryRow
            key={item.id}
            item={item}
            onEdit={() => setDraft(toDraft(item))}
            onDelete={() => setToDelete(item)}
          />
        ))}
      </SortableContext>
    </DndContext>
  );

  return (
    <>
      <PageMeta title={t("settings_misc.task_directories.page_title")} description={t("settings_misc.task_directories.page_description")} />

      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t("settings_misc.task_directories.heading")}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t("settings_misc.task_directories.subheading")}
          </p>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setActiveTab(item.key);
                setDraft(null);
              }}
              className={`shrink-0 rounded-xl border px-3.5 py-2 text-sm font-medium transition ${
                item.key === activeTab
                  ? "border-brand-500 bg-brand-50 text-brand-600"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              {t(item.titleKey)}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
            <div>
              <p className="text-[15px] font-semibold text-gray-900">{t(tab.titleKey)}</p>
              <p className="mt-0.5 text-xs text-gray-500">{t(tab.hintKey)}</p>
            </div>
            {/* У статусов кнопка добавления живёт в каждой группе: без выбора
                группы непонятно, какие даты будет ставить новый статус. */}
            {tab.key !== "status" && (
              <Button
                size="sm"
                className="h-9"
                startIcon={<Plus size={15} />}
                onClick={() => setDraft(emptyDraft())}
              >
                {t("settings_misc.task_directories.add_button")}
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-gray-500">
              <Loader2 size={16} className="animate-spin" />
              {t("settings_misc.task_directories.loading")}
            </div>
          ) : isError ? (
            <p className="px-6 py-12 text-center text-sm text-error-500">
              {t("settings_misc.task_directories.load_error")}
            </p>
          ) : tab.key === "status" ? (
            STATUS_GROUP_ORDER.map((group) => {
              const meta = STATUS_GROUP_META[group];
              const groupItems = items.filter((item) => item.group === group);

              return (
                <div key={group} className="border-b border-gray-100 last:border-b-0">
                  <div className="flex items-center justify-between gap-3 bg-gray-50/70 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-[13px] font-semibold text-gray-800">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: meta.color }}
                        />
                        {t(meta.labelKey)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-gray-500">{t(meta.hintKey)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDraft(emptyDraft(group))}
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-[12px] font-medium text-gray-600 transition hover:border-brand-300 hover:text-brand-600"
                    >
                      <Plus size={14} />
                      {t("settings_misc.task_directories.add_status_button")}
                    </button>
                  </div>

                  {groupItems.length === 0 ? (
                    <p className="px-4 py-4 text-[13px] text-gray-400">
                      {t("settings_misc.task_directories.group_empty")}
                    </p>
                  ) : (
                    renderList(groupItems)
                  )}
                </div>
              );
            })
          ) : items.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-gray-500">
              {t("settings_misc.task_directories.list_empty")}
            </p>
          ) : (
            renderList(items)
          )}
        </div>
      </div>

      {/* Редактор элемента */}
      <Modal
        isOpen={Boolean(draft)}
        onClose={() => setDraft(null)}
        showCloseButton={false}
        className="mx-4 w-full max-w-[480px] overflow-visible rounded-2xl"
      >
        {draft && (
          <>
            <div className="px-6 pb-2 pt-6">
              <h2 className="text-lg font-semibold text-gray-900">
                {t("settings_misc.task_directories.modal_title", {
                  action: draft.id ? t("settings_misc.task_directories.modal_edit") : t("settings_misc.task_directories.modal_add"),
                  tab: t(tab.titleKey).toLowerCase(),
                })}
              </h2>
            </div>

            <div className="space-y-4 px-6 pb-5">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                  {t("settings_misc.task_directories.field_title")}
                </label>
                <input
                  autoFocus
                  value={draft.title}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                  placeholder={t("settings_misc.task_directories.field_title_placeholder")}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[13px] outline-none transition focus:border-brand-300"
                />
              </div>

              {tab.key === "status" && (
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                    {t("settings_misc.task_directories.field_group")}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {STATUS_GROUP_ORDER.map((group) => (
                      <button
                        key={group}
                        type="button"
                        onClick={() => setDraft({ ...draft, group })}
                        className={`rounded-lg border px-2 py-2 text-[12px] font-medium transition ${
                          draft.group === group
                            ? "border-brand-500 bg-brand-50 text-brand-600"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {t(STATUS_GROUP_META[group].labelKey)}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[12px] text-slate-400">
                    {t(STATUS_GROUP_META[draft.group].hintKey)}
                  </p>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-slate-700">{t("settings_misc.task_directories.field_color")}</label>
                <div className="flex flex-wrap gap-2">
                  {PALETTE.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setDraft({ ...draft, color })}
                      className={`h-7 w-7 rounded-full ring-offset-2 transition ${
                        draft.color === color ? "ring-2 ring-brand-500" : ""
                      }`}
                      style={{ backgroundColor: color }}
                      aria-label={color}
                    />
                  ))}
                </div>
              </div>

              {tab.hasIcon && (
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                    {t("settings_misc.task_directories.field_icon")}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {ICON_KEYS.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setDraft({ ...draft, icon })}
                        className={`rounded-lg border px-2 py-1 text-[11px] transition ${
                          draft.icon === icon
                            ? "border-brand-500 bg-brand-50 text-brand-600"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {tab.flag && (
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={draft[tab.flag.field]}
                    onChange={(event) =>
                      setDraft({ ...draft, [tab.flag!.field]: event.target.checked })
                    }
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>
                    <span className="block text-[13px] font-medium text-slate-700">
                      {t(tab.flag.labelKey)}
                    </span>
                    <span className="block text-[12px] text-slate-400">{t(tab.flag.hintKey)}</span>
                  </span>
                </label>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
              <Button variant="outline" className="h-10" onClick={() => setDraft(null)}>
                {t("settings_misc.task_directories.cancel_button")}
              </Button>
              <Button
                className="h-10"
                disabled={!draft.title.trim() || saveMutation.isLoading}
                onClick={handleSave}
              >
                {t("settings_misc.task_directories.save_button")}
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* Удаление */}
      <Modal
        isOpen={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        showCloseButton={false}
        className="mx-4 w-full max-w-[440px] overflow-hidden rounded-2xl"
      >
        <div className="px-6 pb-2 pt-6">
          <h2 className="text-lg font-semibold text-gray-900">{t("settings_misc.task_directories.delete_modal_title")}</h2>
          <p className="mt-2 text-sm text-gray-500">
            {t("settings_misc.task_directories.delete_modal_body", { title: toDelete?.title ?? "" })}
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
          <Button variant="outline" className="h-11" onClick={() => setToDelete(null)}>
            {t("settings_misc.task_directories.cancel_button")}
          </Button>
          <Button
            className="h-11 !bg-error-500 hover:!bg-error-600"
            disabled={deleteMutation.isLoading}
            onClick={handleDelete}
          >
            {t("settings_misc.task_directories.delete_button")}
          </Button>
        </div>
      </Modal>
    </>
  );
}
