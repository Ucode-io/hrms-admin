import { useState } from "react";

interface EditableTextProps {
  value: string;
  placeholder: string;
  ariaLabel: string;
  onCommit: (value: string) => void;
  className?: string;
  align?: "left" | "center";
}

/**
 * Текст, который правится по клику: название отдела, вакансии, должность,
 * проценты.
 *
 * Тот же приём, что в матрице грейдов: читают таблицу несравнимо чаще, чем
 * правят, поэтому поле появляется только там, куда нажали. Enter и потеря
 * фокуса сохраняют, Escape возвращает прежнее значение.
 */
export default function EditableText({
  value,
  placeholder,
  ariaLabel,
  onCommit,
  className = "",
  align = "left",
}: EditableTextProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const alignment = align === "center" ? "text-center" : "text-left";

  if (draft !== null) {
    return (
      <input
        value={draft}
        autoFocus
        aria-label={ariaLabel}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={(event) => event.currentTarget.select()}
        onBlur={() => {
          const next = draft.trim();
          if (next !== value) onCommit(next);
          setDraft(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") setDraft(null);
        }}
        className={`w-full rounded-md border border-brand-300 bg-white px-2 py-0.5 outline-none ring-3 ring-brand-500/10 ${alignment} ${className}`}
      />
    );
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={() => setDraft(value)}
      className={`w-full truncate rounded-md border border-transparent px-2 py-0.5 transition hover:border-gray-200 hover:bg-white ${alignment} ${
        value ? className : "text-gray-300"
      }`}
    >
      {value || placeholder}
    </button>
  );
}
