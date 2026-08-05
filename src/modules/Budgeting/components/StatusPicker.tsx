import { useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Dropdown } from "../../../components/ui/dropdown/Dropdown";
import { STATUS_META, STATUS_ORDER } from "../constants";
import type { BudgetRowStatus } from "../types";

interface StatusPickerProps {
  value: BudgetRowStatus;
  onChange: (status: BudgetRowStatus) => void;
}

/**
 * Статус строки.
 *
 * Свой поповер, а не нативный `<select>`: системный список рисуется в стиле ОС
 * и рядом с остальными выпадашками модуля выглядел чужеродным, а длинная
 * подпись («Увольняется») налезала на встроенную стрелку.
 */
export default function StatusPicker({ value, onChange }: StatusPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const current = STATUS_META[value];

  return (
    <div className="relative w-full">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={`Статус: ${current.label}`}
        className={`dropdown-toggle flex w-full items-center justify-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition ${current.className}`}
      >
        <span className="truncate">{current.label}</span>
        <ChevronDown size={12} className="shrink-0 opacity-60" />
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        usePortal
        anchorEl={triggerRef.current}
        className="w-44 p-1.5"
      >
        {STATUS_ORDER.map((key) => {
          const meta = STATUS_META[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setIsOpen(false);
                onChange(key);
              }}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
            >
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.className}`}>
                {meta.label}
              </span>
              {key === value && <Check size={15} className="shrink-0 text-brand-500" />}
            </button>
          );
        })}
      </Dropdown>
    </div>
  );
}
