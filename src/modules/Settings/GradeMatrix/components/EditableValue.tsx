import { useState } from "react";

interface EditableValueProps {
  /** Сырое значение для правки (цифры без разрядов, текст как есть). */
  value: string;
  /** Как значение выглядит, пока его не правят. */
  display: string;
  placeholder: string;
  ariaLabel: string;
  onCommit: (raw: string) => void;
  className?: string;
  /** Как выглядит подсказка в пустом значении — её можно и прятать до наведения. */
  emptyClassName?: string;
  align?: "left" | "center";
  disabled?: boolean;
}

/**
 * Значение, которое правится по клику.
 *
 * Раньше здесь всегда стоял input, и матрица выглядела как форма из полусотни
 * пустых полей. Читают её несравнимо чаще, чем правят, поэтому по умолчанию
 * это текст, а рамка и курсор появляются только там, куда человек нажал.
 *
 * Правка уходит на сервер по Enter или потере фокуса, Escape возвращает
 * прежнее значение.
 */
export default function EditableValue({
  value,
  display,
  placeholder,
  ariaLabel,
  onCommit,
  className = "",
  emptyClassName = "text-gray-300",
  align = "left",
  disabled = false,
}: EditableValueProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const alignment = align === "center" ? "text-center" : "text-left";

  if (draft !== null && !disabled) {
    return (
      <input
        value={draft}
        autoFocus
        onChange={(event) => setDraft(event.target.value)}
        onFocus={(event) => event.currentTarget.select()}
        onBlur={() => {
          if (draft !== value) onCommit(draft);
          setDraft(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setDraft(null);
          }
        }}
        aria-label={ariaLabel}
        className={`w-full rounded-md border border-brand-300 bg-white px-2 py-0.5 outline-none ring-3 ring-brand-500/10 ${alignment} ${className}`}
      />
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setDraft(value)}
      aria-label={ariaLabel}
      className={`w-full truncate rounded-md border border-transparent px-2 py-0.5 transition hover:border-gray-200 hover:bg-white disabled:cursor-not-allowed ${alignment} ${
        display ? className : emptyClassName
      }`}
    >
      {display || placeholder}
    </button>
  );
}
