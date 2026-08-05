import { useState } from "react";
import { formatMoney, parseMoney } from "../constants";

interface MoneyCellProps {
  value: number;
  ariaLabel: string;
  /** Факт выделен цветом: план и факт стоят рядом и иначе сливаются. */
  tone: "plan" | "fact";
  onCommit: (value: number) => void;
}

/**
 * Сумма, которая правится по клику.
 *
 * По умолчанию это текст, а не поле: в таблице полсотни колонок на строку, и
 * сетка из инпутов читалась бы как форма, а не как бюджет. Рамка появляется
 * только там, куда нажали; Enter и потеря фокуса сохраняют, Escape отменяет.
 */
export default function MoneyCell({ value, ariaLabel, tone, onCommit }: MoneyCellProps) {
  const [draft, setDraft] = useState<string | null>(null);

  if (draft !== null) {
    return (
      <input
        value={draft}
        autoFocus
        inputMode="numeric"
        aria-label={ariaLabel}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={(event) => event.currentTarget.select()}
        onBlur={() => {
          const next = parseMoney(draft);
          if (next !== value) onCommit(next);
          setDraft(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") setDraft(null);
        }}
        className="w-full rounded-md border border-brand-300 bg-white px-1.5 py-0.5 text-right text-[12px] tabular-nums outline-none ring-3 ring-brand-500/10"
      />
    );
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={() => setDraft(value ? String(value) : "")}
      className={`w-full truncate rounded-md border border-transparent px-1.5 py-0.5 text-right text-[12px] tabular-nums transition hover:border-gray-200 hover:bg-white ${
        value
          ? tone === "fact"
            ? "font-semibold text-brand-600"
            : "text-gray-700"
          : "text-gray-300"
      }`}
    >
      {formatMoney(value)}
    </button>
  );
}
