import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X } from "lucide-react";
import EditableValue from "./EditableValue";
import { DATA_CELL, formatMoney, formatTenure, parseNumberInput } from "../constants";
import type { MatrixColumn } from "../types";
import { useTranslation } from "../../../../i18n";

interface ColumnHeadProps {
  column: MatrixColumn;
  /** Порядковый номер ступени — он же ручка перетаскивания. */
  index: number;
  onSave: (minMonths: number | null, maxSalary: number | null) => void;
  onDelete: () => void;
  disabled?: boolean;
}

/**
 * Шапка колонки: номер ступени, стаж и потолок оклада.
 *
 * Сумма стоит в шапке, а не в каждой ячейке, потому что потолок задан по стажу
 * и одинаков для всех отделов — в ячейках это было бы одно и то же число,
 * повторённое десятки раз. Она же здесь самая крупная: по матрице ищут глазами
 * именно деньги.
 */
export default function ColumnHead({
  column,
  index,
  onSave,
  onDelete,
  disabled = false,
}: ColumnHeadProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: column.id, disabled });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group/col relative flex shrink-0 flex-col gap-0.5 border-l border-gray-100 px-2 py-3 ${DATA_CELL} ${
        isDragging ? "z-10 bg-brand-50/70" : ""
      }`}
    >
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          disabled={disabled}
          className="inline-flex h-5 min-w-5 cursor-grab items-center justify-center rounded-md bg-gray-100 px-1.5 text-[11px] font-bold text-gray-500 transition group-hover/col:bg-brand-500 group-hover/col:text-white active:cursor-grabbing"
          aria-label={t("settings_grade_matrix.column_head.move_aria", { index })}
          title={t("settings_grade_matrix.column_head.move_title")}
          {...attributes}
          {...listeners}
        >
          {index}
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          className="inline-flex h-5 w-5 items-center justify-center rounded-md text-gray-300 opacity-0 transition hover:bg-error-50 hover:text-error-500 focus:opacity-100 group-hover/col:opacity-100"
          aria-label={t("settings_grade_matrix.column_head.delete_aria", { index })}
        >
          <X size={13} />
        </button>
      </div>

      <EditableValue
        value={column.minMonths === null ? "" : String(column.minMonths)}
        display={column.minMonths === null ? "" : formatTenure(column.minMonths)}
        placeholder={t("settings_grade_matrix.column_head.tenure_placeholder")}
        ariaLabel={t("settings_grade_matrix.column_head.tenure_aria", { index })}
        className="text-xs text-gray-500"
        onCommit={(raw) => onSave(parseNumberInput(raw), column.maxSalary)}
        disabled={disabled}
      />
      <EditableValue
        value={column.maxSalary === null ? "" : String(column.maxSalary)}
        display={formatMoney(column.maxSalary)}
        placeholder={t("settings_grade_matrix.column_head.salary_placeholder")}
        ariaLabel={t("settings_grade_matrix.column_head.salary_aria", { index })}
        className="text-[15px] font-bold tabular-nums text-gray-900"
        onCommit={(raw) => onSave(column.minMonths, parseNumberInput(raw))}
        disabled={disabled}
      />
    </div>
  );
}
