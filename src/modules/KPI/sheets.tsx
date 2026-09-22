import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { Check, ChevronDown, GripVertical, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { Modal } from "../../components/ui/modal";
import reportsService from "../../api/services/reports.service";

// ─────────────────────────────────────────────────────────────────────────────
// Листы KPI (как листы в Google Sheets): каждый лист держит свой набор KPI.
// Источник правды — API (kpi_sheets_get / kpi_sheets_save): сами листы,
// привязка kpiId → sheetId и лист по умолчанию хранятся в БД per-company.
// KPI без привязки принадлежат листу по умолчанию (defaultSheetId), поэтому
// существующие KPI не «пропадают» при появлении листов. Активный лист — это
// UI-предпочтение, оно остаётся в localStorage. Пока миграция БД не применена
// (supported=false), хук откатывается на localStorage (прежнее поведение).
// ─────────────────────────────────────────────────────────────────────────────

export type KpiSheet = {
  id: string;
  name: string;
  color: string | null;
};

type StoredSheetsState = {
  sheets: KpiSheet[];
  activeSheetId: string;
  /** Лист, которому принадлежат KPI без явной привязки. */
  defaultSheetId: string;
  /** kpiId → sheetId (только явные привязки). */
  assignments: Record<string, string>;
};

const STORAGE_PREFIX = "kpi-sheets::";

export const SHEET_COLOR_OPTIONS: { value: string | null; label: string }[] = [
  { value: null, label: "Без цвета" },
  { value: "#3b82f6", label: "Синий" },
  { value: "#10b981", label: "Зелёный" },
  { value: "#f59e0b", label: "Жёлтый" },
  { value: "#ef4444", label: "Красный" },
  { value: "#8b5cf6", label: "Фиолетовый" },
  { value: "#ec4899", label: "Розовый" },
];

const makeSheetId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sheet-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
};

const createDefaultState = (): StoredSheetsState => {
  const sheet: KpiSheet = { id: makeSheetId(), name: "Лист 1", color: null };
  return {
    sheets: [sheet],
    activeSheetId: sheet.id,
    defaultSheetId: sheet.id,
    assignments: {},
  };
};

const sanitizeState = (raw: unknown): StoredSheetsState => {
  if (!raw || typeof raw !== "object") return createDefaultState();
  const value = raw as Partial<StoredSheetsState>;

  const sheets: KpiSheet[] = Array.isArray(value.sheets)
    ? value.sheets
        .map((sheet) => ({
          id: typeof sheet?.id === "string" ? sheet.id : "",
          name: typeof sheet?.name === "string" && sheet.name.trim() ? sheet.name : "Лист",
          color: typeof sheet?.color === "string" ? sheet.color : null,
        }))
        .filter((sheet) => sheet.id)
    : [];
  if (sheets.length === 0) return createDefaultState();

  const sheetIds = new Set(sheets.map((sheet) => sheet.id));
  const defaultSheetId =
    typeof value.defaultSheetId === "string" && sheetIds.has(value.defaultSheetId)
      ? value.defaultSheetId
      : sheets[0].id;
  const activeSheetId =
    typeof value.activeSheetId === "string" && sheetIds.has(value.activeSheetId)
      ? value.activeSheetId
      : defaultSheetId;

  const assignments: Record<string, string> = {};
  if (value.assignments && typeof value.assignments === "object") {
    for (const [kpiId, sheetId] of Object.entries(value.assignments)) {
      if (typeof sheetId === "string" && sheetIds.has(sheetId)) {
        assignments[kpiId] = sheetId;
      }
    }
  }

  return { sheets, activeSheetId, defaultSheetId, assignments };
};

const loadSheetsState = (storageKey: string): StoredSheetsState => {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return createDefaultState();
    return sanitizeState(JSON.parse(raw));
  } catch {
    return createDefaultState();
  }
};

const saveSheetsState = (storageKey: string, state: StoredSheetsState): void => {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // localStorage может быть недоступен (private mode) — листы просто не переживут перезагрузку.
  }
};

const nextSheetName = (sheets: KpiSheet[]): string => {
  const taken = new Set(sheets.map((sheet) => sheet.name.trim().toLowerCase()));
  let index = sheets.length + 1;
  while (taken.has(`лист ${index}`)) index += 1;
  return `Лист ${index}`;
};

const ACTIVE_PREFIX = "kpi-sheets-active::";

const loadActiveSheetId = (companyId: string): string => {
  try {
    return window.localStorage.getItem(`${ACTIVE_PREFIX}${companyId || "default"}`) || "";
  } catch {
    return "";
  }
};

const saveActiveSheetId = (companyId: string, sheetId: string): void => {
  try {
    window.localStorage.setItem(`${ACTIVE_PREFIX}${companyId || "default"}`, sheetId);
  } catch {
    // localStorage недоступен — активный лист просто не переживёт перезагрузку.
  }
};

type SheetsMode = "loading" | "server" | "local";

export function useKpiSheets(companyId: string) {
  const storageKey = `${STORAGE_PREFIX}${companyId || "default"}`;
  const [state, setState] = useState<StoredSheetsState>(() => loadSheetsState(storageKey));
  // "server" — источник правды БД; "local" — фолбэк на localStorage, пока
  // миграция листов не применена; "loading" — идёт первичная загрузка.
  const [mode, setMode] = useState<SheetsMode>("loading");
  const modeRef = useRef<SheetsMode>("loading");
  modeRef.current = mode;

  // Гидратация из API при монтировании и смене компании.
  const companyRef = useRef(companyId);
  useEffect(() => {
    let cancelled = false;
    companyRef.current = companyId;
    setMode("loading");

    reportsService
      .kpiSheetsGet()
      .then((result) => {
        if (cancelled) return;
        if (!result?.supported || !Array.isArray(result.sheets) || result.sheets.length === 0) {
          // БД ещё не знает о листах — работаем как раньше, из localStorage.
          setState(loadSheetsState(storageKey));
          setMode("local");
          return;
        }
        const sheets: KpiSheet[] = result.sheets.map((sheet) => ({
          id: sheet.guid,
          name: sheet.name || "Лист",
          color: sheet.color || null,
        }));
        const defaultSheetId =
          result.default_sheet_id && sheets.some((s) => s.id === result.default_sheet_id)
            ? result.default_sheet_id
            : sheets[0].id;
        const storedActive = loadActiveSheetId(companyId);
        const activeSheetId = sheets.some((s) => s.id === storedActive)
          ? storedActive
          : defaultSheetId;
        const assignments: Record<string, string> = {};
        for (const [kpiId, sheetId] of Object.entries(result.assignments || {})) {
          if (typeof sheetId === "string" && sheets.some((s) => s.id === sheetId)) {
            assignments[kpiId] = sheetId;
          }
        }
        setState({ sheets, activeSheetId, defaultSheetId, assignments });
        setMode("server");
      })
      .catch(() => {
        if (cancelled) return;
        // Сеть/сервер недоступны — не теряем работоспособность: localStorage.
        setState(loadSheetsState(storageKey));
        setMode("local");
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, storageKey]);

  // Персист: в server-режиме — дебаунс-сохранение всего состояния в БД; в
  // local-режиме — старое поведение через localStorage. В "loading" не пишем,
  // чтобы не затереть серверное состояние оптимистичным дефолтом.
  useEffect(() => {
    if (modeRef.current === "loading") return;
    saveActiveSheetId(companyRef.current, state.activeSheetId);

    if (modeRef.current === "local") {
      saveSheetsState(storageKey, state);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      reportsService
        .kpiSheetsSave({
          sheets: state.sheets.map((sheet, index) => ({
            guid: sheet.id,
            name: sheet.name,
            color: sheet.color,
            sort_order: index,
          })),
          default_sheet_id: state.defaultSheetId,
          assignments: state.assignments,
        })
        .catch(() => {
          // Ошибка сохранения не должна ломать UI — состояние остаётся локально.
        });
    }, 500);
    return () => window.clearTimeout(timeoutId);
  }, [storageKey, state]);

  const { sheets, activeSheetId, defaultSheetId, assignments } = state;

  const sheetIds = useMemo(() => new Set(sheets.map((sheet) => sheet.id)), [sheets]);

  const selectSheet = useCallback((sheetId: string) => {
    setState((prev) =>
      prev.sheets.some((sheet) => sheet.id === sheetId) && prev.activeSheetId !== sheetId
        ? { ...prev, activeSheetId: sheetId }
        : prev
    );
  }, []);

  const addSheet = useCallback(() => {
    setState((prev) => {
      const sheet: KpiSheet = { id: makeSheetId(), name: nextSheetName(prev.sheets), color: null };
      return { ...prev, sheets: [...prev.sheets, sheet], activeSheetId: sheet.id };
    });
  }, []);

  const renameSheet = useCallback((sheetId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setState((prev) => ({
      ...prev,
      sheets: prev.sheets.map((sheet) =>
        sheet.id === sheetId ? { ...sheet, name: trimmed } : sheet
      ),
    }));
  }, []);

  const setSheetColor = useCallback((sheetId: string, color: string | null) => {
    setState((prev) => ({
      ...prev,
      sheets: prev.sheets.map((sheet) =>
        sheet.id === sheetId ? { ...sheet, color } : sheet
      ),
    }));
  }, []);

  const deleteSheet = useCallback((sheetId: string) => {
    setState((prev) => {
      if (prev.sheets.length <= 1) return prev;
      const index = prev.sheets.findIndex((sheet) => sheet.id === sheetId);
      if (index < 0) return prev;

      const sheets = prev.sheets.filter((sheet) => sheet.id !== sheetId);
      // KPI удалённого листа возвращаются в лист по умолчанию (явная привязка
      // снимается). Если удалили сам лист по умолчанию — им становится первый.
      const assignments: Record<string, string> = {};
      for (const [kpiId, assignedSheetId] of Object.entries(prev.assignments)) {
        if (assignedSheetId !== sheetId) assignments[kpiId] = assignedSheetId;
      }
      const defaultSheetId =
        prev.defaultSheetId === sheetId ? sheets[0].id : prev.defaultSheetId;
      const activeSheetId =
        prev.activeSheetId === sheetId
          ? sheets[Math.min(index, sheets.length - 1)].id
          : prev.activeSheetId;

      return { sheets, activeSheetId, defaultSheetId, assignments };
    });
  }, []);

  const reorderSheets = useCallback((activeId: string, overId: string) => {
    setState((prev) => {
      const from = prev.sheets.findIndex((sheet) => sheet.id === activeId);
      const to = prev.sheets.findIndex((sheet) => sheet.id === overId);
      if (from < 0 || to < 0 || from === to) return prev;
      return { ...prev, sheets: arrayMove(prev.sheets, from, to) };
    });
  }, []);

  const moveKpiToSheet = useCallback((kpiId: string, sheetId: string) => {
    setState((prev) => {
      if (!prev.sheets.some((sheet) => sheet.id === sheetId)) return prev;
      const assignments = { ...prev.assignments };
      if (sheetId === prev.defaultSheetId) {
        delete assignments[kpiId];
      } else {
        assignments[kpiId] = sheetId;
      }
      return { ...prev, assignments };
    });
  }, []);

  const clearKpiAssignment = useCallback((kpiId: string) => {
    setState((prev) => {
      if (!(kpiId in prev.assignments)) return prev;
      const assignments = { ...prev.assignments };
      delete assignments[kpiId];
      return { ...prev, assignments };
    });
  }, []);

  const sheetIdOf = useCallback(
    (kpiId: string): string => {
      const assigned = assignments[kpiId];
      return assigned && sheetIds.has(assigned) ? assigned : defaultSheetId;
    },
    [assignments, sheetIds, defaultSheetId]
  );

  const isDefaultActive = activeSheetId === defaultSheetId;

  return {
    sheets,
    activeSheetId,
    defaultSheetId,
    isDefaultActive,
    assignments,
    selectSheet,
    addSheet,
    renameSheet,
    setSheetColor,
    deleteSheet,
    reorderSheets,
    moveKpiToSheet,
    clearKpiAssignment,
    sheetIdOf,
  };
}

export type KpiSheetsApi = ReturnType<typeof useKpiSheets>;

// ─────────────────────────────────────────────────────────────────────────────
// Компактный выбор листа (рядом с переключателем вида).
// Заменяет нижнюю панель: выбор, добавление, переименование, цвет, порядок и
// удаление листов живут в одном выпадающем меню, органично встающем рядом с
// сегментированным переключателем «Таблица / Сетка».
// ─────────────────────────────────────────────────────────────────────────────

function SortableSheetRow({ sheet,
  isActive,
  isRenaming,
  isMenuOpen,
  canDelete,
  onSelect,
  onToggleMenu,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onSetColor,
  onRequestDelete,
}: {
  sheet: KpiSheet;
  isActive: boolean;
  isRenaming: boolean;
  isMenuOpen: boolean;
  canDelete: boolean;
  onSelect: () => void;
  onToggleMenu: () => void;
  onStartRename: () => void;
  onCommitRename: (name: string) => void;
  onCancelRename: () => void;
  onSetColor: (color: string | null) => void;
  onRequestDelete: () => void;
}) {
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({
    id: sheet.id,
  });
  const [renameValue, setRenameValue] = useState(sheet.name);

  useEffect(() => {
    if (isRenaming) setRenameValue(sheet.name);
  }, [isRenaming, sheet.name]);

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    ...(isDragging ? { zIndex: 5, position: "relative" as const } : {}),
  };

  const handleRenameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onCommitRename(renameValue);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onCancelRename();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? "rounded-lg bg-white shadow-md ring-1 ring-blue-200" : ""}
    >
      <div
        className={`group/row flex items-center gap-1.5 rounded-lg px-1.5 py-1 transition ${
          isActive ? "bg-blue-50" : "hover:bg-slate-50"
        }`}
      >
        <button
          type="button"
          // Drag только за «ручку» — иначе жест конфликтует с выбором/меню.
          {...attributes}
          {...listeners}
          className="inline-flex h-6 w-4 shrink-0 cursor-grab items-center justify-center text-slate-300 opacity-0 transition hover:text-slate-500 group-hover/row:opacity-100 active:cursor-grabbing"
          aria-label="Переместить лист"
        >
          <GripVertical size={13} />
        </button>

        <span
          aria-hidden="true"
          className={`h-2.5 w-2.5 shrink-0 rounded-full border ${
            sheet.color ? "border-transparent" : "border-slate-300"
          }`}
          style={sheet.color ? { backgroundColor: sheet.color } : undefined}
        />

        {isRenaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={() => onCommitRename(renameValue)}
            onFocus={(event) => event.currentTarget.select()}
            className="h-6 min-w-0 flex-1 rounded-md border border-blue-300 bg-white px-1.5 text-[13px] font-medium text-slate-900 outline-none"
            aria-label="Название листа"
          />
        ) : (
          <button
            type="button"
            onClick={onSelect}
            onDoubleClick={onStartRename}
            className={`min-w-0 flex-1 truncate text-left text-[13px] ${
              isActive ? "font-semibold text-slate-900" : "font-medium text-slate-700"
            }`}
            title={sheet.name}
          >
            {sheet.name}
          </button>
        )}

        {isActive && !isRenaming ? (
          <Check size={14} className="shrink-0 text-blue-500" />
        ) : null}

        {!isRenaming ? (
          <button
            type="button"
            onClick={onToggleMenu}
            className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-200/70 hover:text-slate-600 ${
              isMenuOpen ? "bg-slate-200/70 text-slate-600" : "opacity-0 group-hover/row:opacity-100"
            }`}
            aria-label={`Действия с листом ${sheet.name}`}
          >
            <MoreHorizontal size={14} />
          </button>
        ) : null}
      </div>

      {isMenuOpen && !isRenaming ? (
        <div className="mb-1 ml-6 mr-1 mt-0.5 rounded-lg border border-slate-100 bg-slate-50/70 p-1.5">
          <button
            type="button"
            onClick={onStartRename}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-medium text-slate-700 transition hover:bg-white"
          >
            <Pencil size={13} />
            Переименовать
          </button>

          <div className="flex items-center gap-1.5 px-2 py-1.5">
            {SHEET_COLOR_OPTIONS.map((option) => {
              const isSelected = (sheet.color || null) === option.value;
              return (
                <button
                  key={option.value || "none"}
                  type="button"
                  onClick={() => onSetColor(option.value)}
                  title={option.label}
                  aria-label={option.label}
                  className={`h-4 w-4 rounded-full border transition hover:scale-110 ${
                    isSelected ? "ring-2 ring-blue-500 ring-offset-1" : ""
                  } ${option.value ? "border-transparent" : "border-slate-300"}`}
                  style={
                    option.value
                      ? { backgroundColor: option.value }
                      : {
                          background:
                            "linear-gradient(to top right, #fff 44%, #cbd5e1 44%, #cbd5e1 56%, #fff 56%)",
                        }
                  }
                />
              );
            })}
          </div>

          <button
            type="button"
            disabled={!canDelete}
            onClick={onRequestDelete}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-medium text-rose-600 transition hover:bg-white disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
          >
            <Trash2 size={13} />
            Удалить
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function KpiSheetSelect({ api }: { api: KpiSheetsApi }) {
  const { sheets, activeSheetId, defaultSheetId } = api;
  const activeSheet = useMemo(
    () => sheets.find((sheet) => sheet.id === activeSheetId) || sheets[0],
    [sheets, activeSheetId]
  );

  const [open, setOpen] = useState(false);
  const [renamingSheetId, setRenamingSheetId] = useState<string | null>(null);
  const [openMenuSheetId, setOpenMenuSheetId] = useState<string | null>(null);
  const [sheetToDelete, setSheetToDelete] = useState<KpiSheet | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const closePanel = useCallback(() => {
    setOpen(false);
    setRenamingSheetId(null);
    setOpenMenuSheetId(null);
  }, []);

  // Клик вне выпадашки — закрыть. Модалка удаления живёт вне wrapper, поэтому
  // её открытие закрывает панель, что здесь и нужно.
  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (event: globalThis.MouseEvent) => {
      if (wrapperRef.current?.contains(event.target as Node)) return;
      closePanel();
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open, closePanel]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      api.reorderSheets(String(active.id), String(over.id));
    },
    [api]
  );

  const commitRename = useCallback(
    (sheetId: string, name: string) => {
      api.renameSheet(sheetId, name);
      setRenamingSheetId(null);
    },
    [api]
  );

  const selectSheet = useCallback(
    (sheetId: string) => {
      api.selectSheet(sheetId);
      closePanel();
    },
    [api, closePanel]
  );

  const deleteTargetName = useMemo(() => {
    if (!sheetToDelete) return "";
    if (sheetToDelete.id !== defaultSheetId) {
      return sheets.find((sheet) => sheet.id === defaultSheetId)?.name || "";
    }
    return sheets.find((sheet) => sheet.id !== sheetToDelete.id)?.name || "";
  }, [sheetToDelete, sheets, defaultSheetId]);

  return (
    <>
      <div ref={wrapperRef} className="relative">
        <button
          type="button"
          onClick={() => (open ? closePanel() : setOpen(true))}
          aria-haspopup="menu"
          aria-expanded={open}
          title={activeSheet?.name}
          // Оформление общее с селектом листа в задачах: тулбары страниц
          // должны читаться одинаково.
          className="inline-flex h-10 max-w-[220px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <span
            aria-hidden="true"
            className={`h-2.5 w-2.5 shrink-0 rounded-full border ${
              activeSheet?.color ? "border-transparent" : "border-slate-300"
            }`}
            style={activeSheet?.color ? { backgroundColor: activeSheet.color } : undefined}
          />
          <span className="truncate">{activeSheet?.name || "Лист"}</span>
          <ChevronDown
            size={15}
            className={`shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open ? (
          <div className="absolute left-0 top-full z-40 mt-1.5 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
            <div className="flex items-center justify-between px-2 pb-1.5 pt-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Листы
              </span>
              <button
                type="button"
                onClick={() => {
                  api.addSheet();
                  setOpenMenuSheetId(null);
                }}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] font-semibold text-blue-600 transition hover:bg-blue-50"
              >
                <Plus size={13} />
                Добавить
              </button>
            </div>

            <div className="max-h-[280px] overflow-y-auto">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={sheets.map((sheet) => sheet.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {sheets.map((sheet) => (
                    <SortableSheetRow
                      key={sheet.id}
                      sheet={sheet}
                      isActive={sheet.id === activeSheetId}
                      isRenaming={renamingSheetId === sheet.id}
                      isMenuOpen={openMenuSheetId === sheet.id}
                      canDelete={sheets.length > 1}
                      onSelect={() => selectSheet(sheet.id)}
                      onToggleMenu={() =>
                        setOpenMenuSheetId((prev) => (prev === sheet.id ? null : sheet.id))
                      }
                      onStartRename={() => {
                        setRenamingSheetId(sheet.id);
                        setOpenMenuSheetId(null);
                      }}
                      onCommitRename={(name) => commitRename(sheet.id, name)}
                      onCancelRename={() => setRenamingSheetId(null)}
                      onSetColor={(color) => {
                        api.setSheetColor(sheet.id, color);
                        setOpenMenuSheetId(null);
                      }}
                      onRequestDelete={() => {
                        setSheetToDelete(sheet);
                        setOpenMenuSheetId(null);
                      }}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>

            <p className="border-t border-slate-100 px-2 pb-1 pt-1.5 text-[11px] text-slate-400">
              Двойной клик по названию — переименовать
            </p>
          </div>
        ) : null}
      </div>

      <Modal
        isOpen={Boolean(sheetToDelete)}
        onClose={() => setSheetToDelete(null)}
        className="mx-4 w-full max-w-md p-5 sm:p-6"
        showCloseButton={false}
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-slate-900">Удалить лист?</h3>
            <p className="text-sm text-slate-500">
              Сами KPI не удаляются
              {deleteTargetName ? (
                <>
                  {" "}— они переместятся в лист{" "}
                  <span className="font-medium text-slate-700">«{deleteTargetName}»</span>
                </>
              ) : null}
              .
            </p>
            {sheetToDelete ? (
              <p className="text-sm font-medium text-slate-700">{sheetToDelete.name}</p>
            ) : null}
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setSheetToDelete(null)}
              className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => {
                if (sheetToDelete) api.deleteSheet(sheetToDelete.id);
                setSheetToDelete(null);
              }}
              className="inline-flex h-10 items-center rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700"
            >
              Удалить
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
