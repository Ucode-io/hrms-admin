import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import GradeCell from "./GradeCell";
import EditableValue from "./EditableValue";
import { DATA_CELL, STICKY_TITLE, TITLE_CELL, cellAt } from "../constants";
import type { CellDraft, MatrixColumn, MatrixLevel, MatrixRef, MatrixRow } from "../types";

interface MatrixRowLineProps {
  row: MatrixRow;
  columns: MatrixColumn[];
  levels: MatrixLevel[];
  positions: MatrixRef[];
  onCellSave: (value: Omit<CellDraft, "rowId">) => void;
  onDelete: () => void;
  disabled?: boolean;
}

/**
 * Строка матрицы: заголовок отдела или должность внутри него.
 *
 * Разница не только в оформлении: в ячейках отдела — свободный текст требования
 * («0 project», «10 employee»), единица у каждого отдела своя. В ячейках
 * должности — грейд из справочников.
 */
export default function MatrixRowLine({
  row,
  columns,
  levels,
  positions,
  onCellSave,
  onDelete,
  disabled = false,
}: MatrixRowLineProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: row.id, disabled });

  const isDepartment = row.type === "department";
  const rowBg = isDepartment ? "bg-gray-50" : "bg-white";

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group/row flex items-stretch border-t border-gray-100 ${rowBg} ${
        isDragging ? "relative z-10 shadow-lg" : isDepartment ? "" : "hover:bg-gray-50/60"
      }`}
    >
      {/* Название строки прилипает к левому краю: без него ячейки справа
          читать невозможно. */}
      <div
        className={`flex items-center gap-1.5 py-2 pl-2 pr-3 ${TITLE_CELL} ${STICKY_TITLE} ${rowBg} ${
          isDepartment ? "" : "group-hover/row:bg-gray-50/60"
        }`}
      >
        <button
          type="button"
          disabled={disabled}
          className="inline-flex h-6 w-4 shrink-0 cursor-grab items-center justify-center text-gray-300 opacity-0 transition group-hover/row:opacity-100 active:cursor-grabbing"
          aria-label={`Переместить ${row.title}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} />
        </button>

        <span
          className={`min-w-0 flex-1 truncate ${
            isDepartment
              ? "text-[13px] font-bold uppercase tracking-wide text-brand-600"
              : "pl-3 text-sm text-gray-700"
          }`}
          title={row.title}
        >
          {row.title}
        </span>

        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-300 opacity-0 transition hover:bg-error-50 hover:text-error-500 focus:opacity-100 group-hover/row:opacity-100"
          aria-label={`Убрать ${row.title} из матрицы`}
        >
          <Trash2 size={13} />
        </button>
      </div>

      {columns.map((column) => {
        const cell = cellAt(row, column.id);

        if (isDepartment) {
          return (
            <div
              key={column.id}
              className={`flex shrink-0 items-center border-l border-gray-100 px-2 py-1.5 ${DATA_CELL}`}
            >
              <EditableValue
                value={cell?.text ?? ""}
                display={cell?.text ?? ""}
                placeholder="требование"
                ariaLabel={`Требование отдела ${row.title}`}
                align="center"
                className="text-[13px] text-gray-600"
                // Подсказка проступает только при наведении: полтора десятка
                // слов «требование» в пустых ячейках забивают собой матрицу.
                emptyClassName="text-[13px] text-transparent group-hover/row:text-gray-300"
                disabled={disabled}
                onCommit={(text) => onCellSave({ columnId: column.id, text })}
              />
            </div>
          );
        }

        return (
          <GradeCell
            key={column.id}
            cell={cell}
            levels={levels}
            positions={positions}
            disabled={disabled}
            onSelect={(value) => onCellSave({ columnId: column.id, ...value })}
          />
        );
      })}
    </div>
  );
}
