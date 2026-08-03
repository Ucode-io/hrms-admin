import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import PickerMenu from "./PickerMenu";
import { STICKY_TITLE, TITLE_CELL } from "../constants";
import type { MatrixRef } from "../types";

interface AddRowLineProps {
  label: string;
  /** Что предлагать в списке: свободные отделы или свободные должности. */
  options: MatrixRef[];
  emptyText: string;
  onPick: (id: string) => void;
  /** Строка должности идёт с отступом — она внутри блока отдела. */
  indented?: boolean;
  disabled?: boolean;
}

/**
 * Строка-приглашение «добавить»: должность в конце блока отдела, отдел в конце
 * матрицы.
 *
 * Раньше добавление жило кнопками в панели сверху и плюсом, который появлялся
 * только при наведении на заголовок отдела — то есть в стороне от того места,
 * где строка появится. Здесь действие стоит ровно там, куда добавляется строка.
 */
export default function AddRowLine({
  label,
  options,
  emptyText,
  onPick,
  indented = false,
  disabled = false,
}: AddRowLineProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="flex items-stretch border-t border-gray-100 bg-white">
      <div className={`py-1.5 pl-2 pr-3 ${TITLE_CELL} ${STICKY_TITLE} bg-white`}>
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen((open) => !open)}
          className={`dropdown-toggle flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-gray-400 transition hover:bg-brand-50 hover:text-brand-600 disabled:cursor-not-allowed ${
            indented ? "ml-7" : ""
          }`}
        >
          <Plus size={14} className="shrink-0" />
          {label}
        </button>
      </div>

      <PickerMenu
        isOpen={isOpen}
        anchorEl={triggerRef.current}
        onClose={() => setIsOpen(false)}
        groups={[{ key: "ref", label, items: options.map((item) => ({ id: item.id, title: item.title })) }]}
        emptyText={emptyText}
        onPick={(_group, id) => {
          setIsOpen(false);
          onPick(id);
        }}
      />
    </div>
  );
}
