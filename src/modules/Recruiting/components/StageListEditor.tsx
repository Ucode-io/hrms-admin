import { useState } from "react";
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from "lucide-react";
import {
  STAGE_COLOR_CONFIG,
  STAGE_COLOR_ORDER,
  newStageId,
  sortStages,
  type StageColor,
  type StageDef,
} from "../types";

interface StageListEditorProps {
  stages: StageDef[];
  onChange: (stages: StageDef[]) => void;
  /** Stage ids that currently hold candidates — deletion is blocked for them. */
  lockedStageIds?: Set<string>;
}

/**
 * Editor for an ordered stage list — shared by the template editor,
 * the vacancy form and the "Изменить этапы" sheet on the vacancy page.
 */
export default function StageListEditor({
  stages,
  onChange,
  lockedStageIds,
}: StageListEditorProps) {
  const [newName, setNewName] = useState("");
  const ordered = sortStages(stages);

  const reindex = (list: StageDef[]) => list.map((s, i) => ({ ...s, order: i }));

  const rename = (id: string, name: string) =>
    onChange(ordered.map((s) => (s.id === id ? { ...s, name } : s)));

  const recolor = (id: string, color: StageColor) =>
    onChange(ordered.map((s) => (s.id === id ? { ...s, color } : s)));

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= ordered.length) return;
    const next = [...ordered];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(reindex(next));
  };

  const remove = (id: string) => onChange(reindex(ordered.filter((s) => s.id !== id)));

  const add = () => {
    const name = newName.trim();
    if (!name) return;
    const color = STAGE_COLOR_ORDER[ordered.length % STAGE_COLOR_ORDER.length];
    onChange(reindex([...ordered, { id: newStageId(), name, color, order: ordered.length }]));
    setNewName("");
  };

  return (
    <div className="space-y-2">
      {ordered.length === 0 && (
        <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-4 text-center text-sm text-gray-400">
          Этапы не заданы — добавьте первый этап
        </p>
      )}

      {ordered.map((stage, index) => {
        const locked = lockedStageIds?.has(stage.id) ?? false;
        return (
          <div
            key={stage.id}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2"
          >
            <GripVertical size={16} className="shrink-0 text-gray-300" />
            <span className="w-5 shrink-0 text-center text-xs font-semibold text-gray-400">
              {index + 1}
            </span>

            <ColorSwatchPicker
              value={stage.color}
              onChange={(color) => recolor(stage.id, color)}
            />

            <input
              value={stage.name}
              onChange={(e) => rename(stage.id, e.target.value)}
              placeholder="Название этапа"
              className="h-9 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 text-sm text-gray-800 transition hover:border-gray-200 focus:border-brand-400 focus:bg-white focus:outline-none"
            />

            {locked && (
              <span className="hidden shrink-0 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-600 sm:inline">
                есть кандидаты
              </span>
            )}

            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
              >
                <ChevronUp size={15} />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === ordered.length - 1}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
              >
                <ChevronDown size={15} />
              </button>
              <button
                type="button"
                onClick={() => remove(stage.id)}
                disabled={locked}
                title={locked ? "На этапе есть кандидаты — сначала переместите их" : "Удалить этап"}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        );
      })}

      <div className="flex items-center gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Новый этап (напр. Финальное интервью)"
          className="h-10 flex-1 rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-800 transition placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
        <button
          type="button"
          onClick={add}
          disabled={!newName.trim()}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-40"
        >
          <Plus size={15} />
          Добавить
        </button>
      </div>
    </div>
  );
}

function ColorSwatchPicker({
  value,
  onChange,
}: {
  value: StageColor;
  onChange: (color: StageColor) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Цвет этапа"
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 transition hover:bg-gray-50"
      >
        <span className={`h-3.5 w-3.5 rounded-full ${STAGE_COLOR_CONFIG[value].dotClassName}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-9 z-20 grid grid-cols-5 gap-1.5 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
            {STAGE_COLOR_ORDER.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => {
                  onChange(color);
                  setOpen(false);
                }}
                className={`flex h-6 w-6 items-center justify-center rounded-md transition hover:bg-gray-100 ${
                  color === value ? "ring-2 ring-brand-300" : ""
                }`}
              >
                <span className={`h-3.5 w-3.5 rounded-full ${STAGE_COLOR_CONFIG[color].dotClassName}`} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
