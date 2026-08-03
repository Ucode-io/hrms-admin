// Листы задач.
//
// Раньше листы жили в localStorage вместе с картой «задача → лист». Теперь это
// серверный справочник (`hrms_task_sheets`), а принадлежность листу — поле
// задачи `sheetId`. Поэтому здесь остались только выбор активного листа
// (локальное состояние экрана) и операции над справочником.
//
// Порядок листов задаётся `sortOrder` справочника и меняется в настройках —
// перетаскивания внутри выпадашки больше нет.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  useDeleteTaskDirectory,
  useSaveTaskDirectory,
  useTaskDirectoriesQuery,
} from "../../api/services/taskDirectories.service";
import { Modal } from "../../components/ui/modal";
import Button from "../../components/ui/button/Button";

export type TaskSheet = {
  id: string;
  name: string;
};

/** Псевдо-лист «Все задачи»: задачи без привязки к листу тоже надо где-то видеть. */
export const ALL_SHEETS = "__all__";

const STORAGE_PREFIX = "tasks-active-sheet::";

export function useTaskSheets(companyId: string) {
  const storageKey = `${STORAGE_PREFIX}${companyId || "default"}`;
  const { data: directories } = useTaskDirectoriesQuery();
  const saveMutation = useSaveTaskDirectory();
  const deleteMutation = useDeleteTaskDirectory();

  const sheets = useMemo<TaskSheet[]>(
    () => (directories?.sheets ?? []).map((sheet) => ({ id: sheet.id, name: sheet.title })),
    [directories?.sheets]
  );

  // Активный лист — состояние экрана, а не данные: держим его локально, чтобы
  // возврат на страницу открывал тот же лист.
  const [activeSheetId, setActiveSheetId] = useState<string>(
    () => window.localStorage.getItem(storageKey) || ALL_SHEETS
  );

  const keyRef = useRef(storageKey);
  useEffect(() => {
    if (keyRef.current === storageKey) return;
    keyRef.current = storageKey;
    setActiveSheetId(window.localStorage.getItem(storageKey) || ALL_SHEETS);
  }, [storageKey]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, activeSheetId);
  }, [storageKey, activeSheetId]);

  // Лист могли удалить в другой вкладке — не оставляем экран пустым.
  useEffect(() => {
    if (activeSheetId === ALL_SHEETS) return;
    if (sheets.length > 0 && !sheets.some((sheet) => sheet.id === activeSheetId)) {
      setActiveSheetId(ALL_SHEETS);
    }
  }, [sheets, activeSheetId]);

  const selectSheet = useCallback((sheetId: string) => setActiveSheetId(sheetId), []);

  const addSheet = useCallback(async () => {
    const name = `Лист ${sheets.length + 1}`;
    const created = await saveMutation.mutateAsync({ kind: "sheet", title: name });
    if (created) setActiveSheetId(created.id);
    return created;
  }, [saveMutation, sheets.length]);

  const renameSheet = useCallback(
    (sheetId: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      return saveMutation.mutateAsync({ kind: "sheet", id: sheetId, title: trimmed });
    },
    [saveMutation]
  );

  const deleteSheet = useCallback(
    async (sheetId: string) => {
      await deleteMutation.mutateAsync({ kind: "sheet", id: sheetId });
      setActiveSheetId((current) => (current === sheetId ? ALL_SHEETS : current));
    },
    [deleteMutation]
  );

  return {
    sheets,
    activeSheetId,
    isAllSheets: activeSheetId === ALL_SHEETS,
    selectSheet,
    addSheet,
    renameSheet,
    deleteSheet,
    isSaving: saveMutation.isLoading || deleteMutation.isLoading,
  };
}

export type TaskSheetsApi = ReturnType<typeof useTaskSheets>;

/** Компактный выбор листа рядом с переключателем вида. */
export function TaskSheetSelect({ api }: { api: TaskSheetsApi }) {
  const { sheets, activeSheetId } = api;
  const [open, setOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [sheetToDelete, setSheetToDelete] = useState<TaskSheet | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const activeName =
    activeSheetId === ALL_SHEETS
      ? "Все задачи"
      : sheets.find((sheet) => sheet.id === activeSheetId)?.name || "Все задачи";

  const closePanel = useCallback(() => {
    setOpen(false);
    setRenamingId(null);
    setMenuFor(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (event: MouseEvent) => {
      if (wrapperRef.current?.contains(event.target as Node)) return;
      closePanel();
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open, closePanel]);

  const commitRename = async (sheetId: string) => {
    await api.renameSheet(sheetId, renameValue);
    setRenamingId(null);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        <span className="max-w-[160px] truncate">{activeName}</span>
        <ChevronDown size={14} className="text-slate-400" />
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-1 w-64 rounded-xl border border-gray-200 bg-white py-1 shadow-theme-lg dark:border-gray-700 dark:bg-gray-900">
          <button
            type="button"
            onClick={() => {
              api.selectSheet(ALL_SHEETS);
              closePanel();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5"
          >
            <span className="flex-1 truncate">Все задачи</span>
            {activeSheetId === ALL_SHEETS && <Check size={14} className="text-brand-500" />}
          </button>

          {sheets.map((sheet) => (
            <div key={sheet.id} className="group relative flex items-center">
              {renamingId === sheet.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  onBlur={() => commitRename(sheet.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") commitRename(sheet.id);
                    if (event.key === "Escape") setRenamingId(null);
                  }}
                  className="m-1 h-8 w-full rounded-lg border border-brand-300 px-2 text-sm outline-none"
                />
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      api.selectSheet(sheet.id);
                      closePanel();
                    }}
                    className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5"
                  >
                    <span className="min-w-0 flex-1 truncate">{sheet.name}</span>
                    {activeSheetId === sheet.id && <Check size={14} className="text-brand-500" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMenuFor(menuFor === sheet.id ? null : sheet.id)}
                    className="mr-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-100 dark:hover:bg-white/10"
                    aria-label={`Действия с листом ${sheet.name}`}
                  >
                    <MoreHorizontal size={14} />
                  </button>
                </>
              )}

              {menuFor === sheet.id && (
                <div className="absolute right-1 top-9 z-40 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-theme-lg dark:border-gray-700 dark:bg-gray-900">
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingId(sheet.id);
                      setRenameValue(sheet.name);
                      setMenuFor(null);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5"
                  >
                    <Pencil size={13} />
                    Переименовать
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSheetToDelete(sheet);
                      setMenuFor(null);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-error-600 transition hover:bg-error-50"
                  >
                    <Trash2 size={13} />
                    Удалить
                  </button>
                </div>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={async () => {
              await api.addSheet();
              closePanel();
            }}
            className="mt-1 flex w-full items-center gap-2 border-t border-gray-100 px-3 py-2 text-left text-sm text-gray-500 transition hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/5"
          >
            <Plus size={14} />
            Новый лист
          </button>
        </div>
      )}

      <Modal
        isOpen={Boolean(sheetToDelete)}
        onClose={() => setSheetToDelete(null)}
        showCloseButton={false}
        className="mx-4 w-full max-w-[420px] overflow-hidden rounded-2xl"
      >
        <div className="px-6 pb-2 pt-6">
          <h3 className="text-lg font-semibold text-gray-900">Удалить лист?</h3>
          <p className="mt-2 text-sm text-gray-500">
            Лист «{sheetToDelete?.name}» будет удалён. Задачи останутся — они просто
            перестанут быть привязаны к листу.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
          <Button variant="outline" className="h-10" onClick={() => setSheetToDelete(null)}>
            Отмена
          </Button>
          <Button
            className="h-10 !bg-error-500 hover:!bg-error-600"
            disabled={api.isSaving}
            onClick={async () => {
              if (!sheetToDelete) return;
              try {
                await api.deleteSheet(sheetToDelete.id);
                toast.success("Лист удалён.");
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "Не удалось удалить лист."
                );
              }
              setSheetToDelete(null);
            }}
          >
            Удалить
          </Button>
        </div>
      </Modal>
    </div>
  );
}
