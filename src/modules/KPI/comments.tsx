import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { MessageSquare, MessageSquarePlus } from "lucide-react";
import reportsService from "../../api/services/reports.service";

// ─────────────────────────────────────────────────────────────────────────────
// Комментарии к ячейкам План/Факт (в стиле Google Sheets): у каждой ячейки может
// быть заметка. Она видна как tooltip при наведении, а написание — такое же
// лёгкое, как inline-редактирование «Факта»: клик по уголку → мини-редактор
// прямо у ячейки. Источник правды — API (kpi_comments_get / kpi_comment_save),
// заметки хранятся в БД per-company. Пока миграция не применена
// (supported=false), хук откатывается на localStorage (прежнее поведение).
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_PREFIX = "kpi-cell-comments::";

/** Стабильный ключ ячейки: столбец + id значения (leaf/bucket). */
export const cellCommentKey = (valueId: string, column: "plan" | "fact"): string =>
  `${column}:${valueId}`;

/** Разбор ключа обратно в { column, kpi_items_id } для отправки в API. */
const parseCommentKey = (key: string): { column: "plan" | "fact"; kpiItemsId: string } | null => {
  const idx = key.indexOf(":");
  if (idx < 0) return null;
  const column = key.slice(0, idx);
  const kpiItemsId = key.slice(idx + 1);
  if ((column !== "plan" && column !== "fact") || !kpiItemsId) return null;
  return { column, kpiItemsId };
};

type CommentsState = Record<string, string>;

const sanitizeState = (raw: unknown): CommentsState => {
  if (!raw || typeof raw !== "object") return {};
  const state: CommentsState = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string" && value.trim()) state[key] = value;
  }
  return state;
};

const loadState = (storageKey: string): CommentsState => {
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? sanitizeState(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
};

const saveState = (storageKey: string, state: CommentsState): void => {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // localStorage недоступен (private mode) — комментарии не переживут перезагрузку.
  }
};

type CommentsMode = "loading" | "server" | "local";

export function useKpiCellComments(companyId: string) {
  const storageKey = `${STORAGE_PREFIX}${companyId || "default"}`;
  const [state, setState] = useState<CommentsState>(() => loadState(storageKey));
  const modeRef = useRef<CommentsMode>("loading");

  // Гидратация из API при монтировании и смене компании.
  useEffect(() => {
    let cancelled = false;
    modeRef.current = "loading";

    reportsService
      .kpiCommentsGet()
      .then((result) => {
        if (cancelled) return;
        if (!result?.supported) {
          setState(loadState(storageKey));
          modeRef.current = "local";
          return;
        }
        setState(sanitizeState(result.comments || {}));
        modeRef.current = "server";
      })
      .catch(() => {
        if (cancelled) return;
        setState(loadState(storageKey));
        modeRef.current = "local";
      });

    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  // В local-режиме зеркалим состояние в localStorage (прежнее поведение).
  useEffect(() => {
    if (modeRef.current === "local") saveState(storageKey, state);
  }, [storageKey, state]);

  const getComment = useCallback((key: string): string => state[key] || "", [state]);

  const setComment = useCallback((key: string, text: string) => {
    const trimmed = text.trim();
    setState((prev) => {
      if ((prev[key] || "") === trimmed) return prev;
      const next = { ...prev };
      if (trimmed) next[key] = trimmed;
      else delete next[key];
      return next;
    });

    // В server-режиме сразу отправляем точечное изменение по ячейке.
    if (modeRef.current === "server") {
      const parsed = parseCommentKey(key);
      if (parsed) {
        reportsService
          .kpiCommentSave({
            kpi_items_id: parsed.kpiItemsId,
            column: parsed.column,
            comment: trimmed,
          })
          .catch(() => {
            // Ошибка сохранения не ломает UI — заметка остаётся в состоянии.
          });
      }
    }
  }, []);

  return { getComment, setComment };
}

export type KpiCommentsApi = ReturnType<typeof useKpiCellComments>;

// ─────────────────────────────────────────────────────────────────────────────
// Обёртка ячейки: показывает содержимое как есть, добавляет уголок-маркер при
// наличии заметки, tooltip при наведении и мини-редактор по клику.
// ─────────────────────────────────────────────────────────────────────────────

export function CommentableCell({
  commentKey,
  comment,
  onSave,
  children,
  label,
}: {
  commentKey: string;
  comment: string;
  onSave: (key: string, text: string) => void;
  children: ReactNode;
  /** Короткое имя ячейки для заголовка редактора, напр. «План · 1 квартал». */
  label?: string;
}) {
  const hasComment = comment.trim().length > 0;

  const wrapRef = useRef<HTMLSpanElement>(null);
  const [tooltip, setTooltip] = useState<{ left: number; top: number } | null>(null);
  const [editorRect, setEditorRect] = useState<DOMRect | null>(null);
  const [draft, setDraft] = useState(comment);

  const isEditing = editorRect !== null;

  const openEditor = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    setDraft(comment);
    setTooltip(null);
    setEditorRect(el.getBoundingClientRect());
  }, [comment]);

  const closeEditor = useCallback(() => setEditorRect(null), []);

  const commit = useCallback(
    (value: string) => {
      onSave(commentKey, value);
      setEditorRect(null);
    },
    [commentKey, onSave]
  );

  const showTooltip = useCallback(() => {
    if (!hasComment || isEditing) return;
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setTooltip({ left: rect.left + rect.width / 2, top: rect.bottom + 8 });
  }, [hasComment, isEditing]);

  const hideTooltip = useCallback(() => setTooltip(null), []);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      commit(event.currentTarget.value);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeEditor();
    }
  };

  const editorStyle = useMemo<CSSProperties | null>(() => {
    if (!editorRect) return null;
    const width = 232;
    const left = Math.max(
      8,
      Math.min(editorRect.left, window.innerWidth - width - 8)
    );
    const spaceBelow = window.innerHeight - editorRect.bottom;
    const openUp = spaceBelow < 180;
    return {
      position: "fixed",
      left,
      width,
      zIndex: 100210,
      ...(openUp
        ? { bottom: window.innerHeight - editorRect.top + 6 }
        : { top: editorRect.bottom + 6 }),
    };
  }, [editorRect]);

  return (
    <span
      ref={wrapRef}
      // pr-4 резервирует место под иконку справа, чтобы она не наезжала на
      // текст значения (особенно у «плоских» ячеек Плана без своей высоты).
      className="group/cell relative inline-flex items-center justify-center pr-4"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
    >
      {children}

      {/* Наличие заметки помечаем классическим «уголком» в правом-верхнем углу
          ячейки (как в Google Sheets/Excel) — это сразу читается как «здесь есть
          комментарий», в отличие от иконки-плашки. Пустая ячейка показывает
          ненавязчивую иконку добавления при наведении. Клик — открыть редактор. */}
      {hasComment ? (
        <button
          type="button"
          onClick={openEditor}
          aria-label="Изменить комментарий"
          className="group/note absolute right-0 top-0 flex h-3.5 w-3.5 items-start justify-end"
        >
          <svg
            viewBox="0 0 10 10"
            aria-hidden="true"
            className="h-[9px] w-[9px] text-amber-500 transition group-hover/note:text-amber-600"
          >
            <path d="M0 0 H10 V10 Z" fill="currentColor" />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          onClick={openEditor}
          aria-label="Добавить комментарий"
          title="Добавить комментарий"
          className="absolute right-0 top-1/2 inline-flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-[3px] text-slate-300 opacity-0 transition hover:text-slate-500 focus:opacity-100 group-hover/cell:opacity-100"
        >
          <MessageSquarePlus size={12} />
        </button>
      )}

      {tooltip
        ? createPortal(
            <span
              role="tooltip"
              style={{
                position: "fixed",
                left: tooltip.left,
                top: tooltip.top,
                transform: "translateX(-50%)",
                zIndex: 100205,
              }}
              className="pointer-events-none max-w-xs whitespace-pre-wrap break-words rounded-lg bg-slate-800 px-2.5 py-1.5 text-left text-[12px] font-medium leading-snug text-white shadow-lg"
            >
              {comment}
            </span>,
            document.body
          )
        : null}

      {editorStyle
        ? createPortal(
            <>
              {/* Клик по подложке — сохранить (как blur у inline-редактора Факта). */}
              <div
                className="fixed inset-0"
                style={{ zIndex: 100209 }}
                onMouseDown={() => commit(draft)}
              />
              <div
                style={editorStyle}
                className="rounded-xl border border-slate-200 bg-white p-2 shadow-xl"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="flex items-center gap-1.5 px-1 pb-1.5 pt-0.5 text-[11px] font-semibold text-slate-500">
                  <MessageSquare size={12} className="text-amber-500" />
                  {label ? `Комментарий · ${label}` : "Комментарий"}
                </div>
                <textarea
                  autoFocus
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={(event) => {
                    const v = event.currentTarget.value;
                    event.currentTarget.setSelectionRange(v.length, v.length);
                  }}
                  rows={3}
                  placeholder="Напишите заметку к ячейке…"
                  className="w-full resize-none rounded-lg border border-slate-200 px-2.5 py-2 text-[13px] text-slate-800 outline-none transition focus:border-slate-300"
                />
                <div className="flex items-center justify-between gap-2 px-0.5 pt-1.5">
                  <span className="text-[10px] text-slate-400">Enter — сохранить</span>
                  <div className="flex items-center gap-1">
                    {hasComment ? (
                      <button
                        type="button"
                        onClick={() => commit("")}
                        className="rounded-md px-2 py-1 text-[12px] font-medium text-rose-600 transition hover:bg-rose-50"
                      >
                        Удалить
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => commit(draft)}
                      className="rounded-md bg-brand-500 px-2.5 py-1 text-[12px] font-semibold text-white transition hover:bg-brand-600"
                    >
                      Сохранить
                    </button>
                  </div>
                </div>
              </div>
            </>,
            document.body
          )
        : null}
    </span>
  );
}
