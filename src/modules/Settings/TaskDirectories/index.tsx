import { useState } from "react";
import { GripVertical, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import PageMeta from "../../../components/common/PageMeta";
import Button from "../../../components/ui/button/Button";
import { Modal } from "../../../components/ui/modal";
import {
  useDeleteTaskDirectory,
  useSaveTaskDirectory,
  useTaskDirectoriesQuery,
} from "../../../api/services/taskDirectories.service";
import type { TaskDirectoryItem, TaskDirectoryKind } from "../../Tasks/types";

/**
 * Справочники модуля «Задачи»: статусы, приоритеты, типы и теги.
 *
 * Флаги `is_initial` / `is_default` уникальны в пределах компании — их снимает
 * сервер, поэтому после сохранения справочники перечитываются целиком.
 *
 * Листы задач здесь не редактируются: их заводят прямо в тулбаре доски, где они
 * и нужны.
 */

type TabKey = Extract<TaskDirectoryKind, "status" | "priority" | "type" | "tag">;

const TABS: {
  key: TabKey;
  title: string;
  hint: string;
  hasIcon: boolean;
  flag?: { field: "isInitial" | "isDefault"; label: string; hint: string };
  extraFlag?: { field: "isFinal"; label: string; hint: string };
}[] = [
  {
    key: "status",
    title: "Статусы",
    hint: "Колонки доски. Порядок задаёт порядок колонок.",
    hasIcon: false,
    flag: {
      field: "isInitial",
      label: "Стартовый",
      hint: "В этот статус попадает новая задача. Может быть только один.",
    },
    extraFlag: {
      field: "isFinal",
      label: "Завершающий",
      hint: "При переходе сюда проставляется дата окончания. Их может быть несколько.",
    },
  },
  {
    key: "priority",
    title: "Приоритеты",
    hint: "Порядок задаёт сортировку «по важности».",
    hasIcon: true,
    flag: {
      field: "isDefault",
      label: "По умолчанию",
      hint: "Подставляется новой задаче. Может быть только один.",
    },
  },
  { key: "type", title: "Типы", hint: "Задача, ошибка, доработка…", hasIcon: true },
  { key: "tag", title: "Теги", hint: "Метки задач с собственным цветом.", hasIcon: false },
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
  isInitial: boolean;
  isFinal: boolean;
  isDefault: boolean;
};

const emptyDraft = (): DraftItem => ({
  title: "",
  color: PALETTE[1],
  icon: "",
  isInitial: false,
  isFinal: false,
  isDefault: false,
});

const toDraft = (item: TaskDirectoryItem): DraftItem => ({
  id: item.id,
  title: item.title,
  color: item.color || PALETTE[0],
  icon: item.icon,
  isInitial: item.isInitial,
  isFinal: item.isFinal,
  isDefault: item.isDefault,
});

export default function TaskDirectoriesSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("status");
  const [draft, setDraft] = useState<DraftItem | null>(null);
  const [toDelete, setToDelete] = useState<TaskDirectoryItem | null>(null);

  const { data, isLoading, isError } = useTaskDirectoriesQuery();
  const saveMutation = useSaveTaskDirectory();
  const deleteMutation = useDeleteTaskDirectory();

  const tab = TABS.find((item) => item.key === activeTab) ?? TABS[0];
  const items: TaskDirectoryItem[] =
    (data && data[`${tab.key === "status" ? "statuses" : `${tab.key}s`}` as keyof typeof data]) ||
    [];

  const handleSave = async () => {
    if (!draft || !draft.title.trim()) return;

    try {
      await saveMutation.mutateAsync({
        kind: tab.key,
        id: draft.id,
        title: draft.title.trim(),
        color: draft.color,
        icon: tab.hasIcon ? draft.icon : undefined,
        isInitial: draft.isInitial,
        isFinal: draft.isFinal,
        isDefault: draft.isDefault,
      });
      setDraft(null);
      toast.success("Сохранено.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить.");
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;

    try {
      await deleteMutation.mutateAsync({ kind: tab.key, id: toDelete.id });
      setToDelete(null);
      toast.success("Удалено.");
    } catch (error) {
      // Сервер не даёт удалить статус, приоритет или тип, пока на нём есть задачи.
      toast.error(error instanceof Error ? error.message : "Не удалось удалить.");
    }
  };

  return (
    <>
      <PageMeta title="Справочники задач | Настройки" description="Статусы, приоритеты, типы и теги задач" />

      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Справочники задач</h1>
          <p className="mt-1 text-sm text-gray-500">
            Статусы, приоритеты, типы и теги — их видит вся компания
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
              {item.title}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
            <div>
              <p className="text-[15px] font-semibold text-gray-900">{tab.title}</p>
              <p className="mt-0.5 text-xs text-gray-500">{tab.hint}</p>
            </div>
            <Button
              size="sm"
              className="h-9"
              startIcon={<Plus size={15} />}
              onClick={() => setDraft(emptyDraft())}
            >
              Добавить
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-gray-500">
              <Loader2 size={16} className="animate-spin" />
              Загружаем справочники...
            </div>
          ) : isError ? (
            <p className="px-6 py-12 text-center text-sm text-error-500">
              Не удалось загрузить справочники. Обновите страницу.
            </p>
          ) : items.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-gray-500">
              Пока пусто — добавьте первый элемент
            </p>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setDraft(toDraft(item))}
                className="flex w-full items-center gap-3 border-b border-gray-50 px-4 py-3 text-left transition last:border-b-0 hover:bg-gray-50"
              >
                <GripVertical size={14} className="shrink-0 text-gray-300" />
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color || "#94a3b8" }}
                />
                <span className="min-w-0 flex-1 truncate text-sm text-gray-800">{item.title}</span>

                {item.isInitial && (
                  <span className="rounded-md bg-blue-light-50 px-2 py-0.5 text-[11px] font-medium text-blue-light-600">
                    стартовый
                  </span>
                )}
                {item.isFinal && (
                  <span className="rounded-md bg-success-50 px-2 py-0.5 text-[11px] font-medium text-success-700">
                    завершающий
                  </span>
                )}
                {item.isDefault && (
                  <span className="rounded-md bg-blue-light-50 px-2 py-0.5 text-[11px] font-medium text-blue-light-600">
                    по умолчанию
                  </span>
                )}

                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(event) => {
                    event.stopPropagation();
                    setToDelete(item);
                  }}
                  className="shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-error-50 hover:text-error-600"
                  aria-label={`Удалить «${item.title}»`}
                >
                  <Trash2 size={15} />
                </span>
              </button>
            ))
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
                {draft.id ? "Изменить" : "Добавить"} · {tab.title.toLowerCase()}
              </h2>
            </div>

            <div className="space-y-4 px-6 pb-5">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                  Название
                </label>
                <input
                  autoFocus
                  value={draft.title}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                  placeholder="Например: В работе"
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[13px] outline-none transition focus:border-brand-300"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-slate-700">Цвет</label>
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
                    Иконка
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
                      {tab.flag.label}
                    </span>
                    <span className="block text-[12px] text-slate-400">{tab.flag.hint}</span>
                  </span>
                </label>
              )}

              {tab.extraFlag && (
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={draft.isFinal}
                    onChange={(event) => setDraft({ ...draft, isFinal: event.target.checked })}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>
                    <span className="block text-[13px] font-medium text-slate-700">
                      {tab.extraFlag.label}
                    </span>
                    <span className="block text-[12px] text-slate-400">{tab.extraFlag.hint}</span>
                  </span>
                </label>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
              <Button variant="outline" className="h-10" onClick={() => setDraft(null)}>
                Отмена
              </Button>
              <Button
                className="h-10"
                disabled={!draft.title.trim() || saveMutation.isLoading}
                onClick={handleSave}
              >
                Сохранить
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
          <h2 className="text-lg font-semibold text-gray-900">Удалить?</h2>
          <p className="mt-2 text-sm text-gray-500">
            «{toDelete?.title}» будет удалён. Если на нём есть задачи, сервер не даст этого
            сделать — сначала переведите их.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
          <Button variant="outline" className="h-11" onClick={() => setToDelete(null)}>
            Отмена
          </Button>
          <Button
            className="h-11 !bg-error-500 hover:!bg-error-600"
            disabled={deleteMutation.isLoading}
            onClick={handleDelete}
          >
            Удалить
          </Button>
        </div>
      </Modal>
    </>
  );
}
