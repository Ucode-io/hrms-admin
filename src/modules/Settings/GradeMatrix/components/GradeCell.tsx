import { useRef, useState } from "react";
import { ArrowUpRight, Plus } from "lucide-react";
import PickerMenu from "./PickerMenu";
import { DATA_CELL } from "../constants";
import type { MatrixCell, MatrixLevel, MatrixRef } from "../types";

interface GradeCellProps {
  cell: MatrixCell | null;
  levels: MatrixLevel[];
  positions: MatrixRef[];
  onSelect: (value: { experienceLevelId?: string | null; positionId?: string | null }) => void;
  disabled?: boolean;
}

/**
 * Ячейка должности: грейд на пересечении «должность × ступень».
 *
 * В ней либо уровень опыта (обычная ступень роста), либо должность — переход на
 * следующую роль, которым лестница заканчивается (CTO после D6). Второе видно
 * по цвету: это не очередной грейд, а выход из лестницы.
 *
 * Пустая ячейка ничего не рисует до наведения: пунктирные заглушки во всех
 * пустых пересечениях заполняли таблицу шумом, за которым не видно грейдов.
 */
export default function GradeCell({
  cell,
  levels,
  positions,
  onSelect,
  disabled = false,
}: GradeCellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const level = cell?.experienceLevelId
    ? levels.find((item) => item.id === cell.experienceLevelId)
    : null;
  const position = cell?.positionId
    ? positions.find((item) => item.id === cell.positionId)
    : null;
  const isOrphan = Boolean(cell && !level && !position);

  return (
    <div className={`flex shrink-0 items-center justify-center border-l border-gray-100 px-2 ${DATA_CELL}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
        className={`dropdown-toggle flex h-8 w-full items-center justify-center rounded-lg text-sm font-semibold transition hover:bg-gray-50 disabled:cursor-not-allowed ${
          isOpen ? "ring-2 ring-brand-300" : ""
        } ${cell ? "" : "text-transparent hover:text-gray-300"}`}
        aria-label="Выбрать грейд"
      >
        {/* Бейдж по размеру содержимого, а не во всю ячейку: полоса-подложка на
            каждом пересечении превращает таблицу в сплошную заливку. */}
        {level ? (
          <span className="max-w-full truncate rounded-md bg-brand-50 px-2.5 py-1 text-brand-600">
            {level.title}
          </span>
        ) : position ? (
          <span className="inline-flex max-w-full items-center gap-1 truncate rounded-md bg-amber-50 px-2.5 py-1 text-amber-700">
            <ArrowUpRight size={13} className="shrink-0" />
            {position.title}
          </span>
        ) : isOrphan ? (
          // Справочник почистили, а ячейка осталась — молча показать «пусто»
          // значило бы спрятать заполненный грейд.
          <span className="rounded-md border border-dashed border-amber-300 px-2 py-0.5 text-xs text-amber-600">
            удалён
          </span>
        ) : (
          <Plus size={14} />
        )}
      </button>

      <PickerMenu
        isOpen={isOpen}
        anchorEl={triggerRef.current}
        onClose={() => setIsOpen(false)}
        groups={[
          {
            key: "level",
            label: "Уровни опыта",
            items: levels.map((item) => ({ id: item.id, title: item.title })),
          },
          {
            key: "position",
            label: "Переход на должность",
            tone: "amber",
            items: positions.map((item) => ({ id: item.id, title: item.title })),
          },
        ]}
        onPick={(groupKey, id) => {
          setIsOpen(false);
          onSelect(
            groupKey === "level"
              ? { experienceLevelId: id, positionId: null }
              : { experienceLevelId: null, positionId: id }
          );
        }}
        onClear={
          cell
            ? () => {
                setIsOpen(false);
                onSelect({ experienceLevelId: null, positionId: null });
              }
            : undefined
        }
      />
    </div>
  );
}
