import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import AutoTextarea from "./AutoTextarea";

interface AutoSaveTextProps {
  value: string;
  onSave: (value: string) => void;
  placeholder: string;
  /** Enter inserts a newline instead of committing. */
  multiline?: boolean;
  /** Empty input reverts to the previous value instead of saving. */
  required?: boolean;
  className?: string;
  minHeight?: number;
}

/**
 * Always-editable text that commits on blur — no edit mode, no Save button.
 * Escape reverts, Enter commits a single-line field, ⌘/Ctrl+Enter commits a
 * multiline one. A brief "Сохранено" tick confirms the write, since an
 * autosaving field otherwise gives no feedback at all.
 */
export default function AutoSaveText({
  value,
  onSave,
  placeholder,
  multiline = false,
  required = false,
  className = "",
  minHeight,
}: AutoSaveTextProps) {
  const [draft, setDraft] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const savedTimer = useRef<number>(0);

  // Adopt external updates (another field's mutation refetches the task).
  useEffect(() => {
    if (!isFocused) setDraft(value);
  }, [value, isFocused]);

  useEffect(() => () => window.clearTimeout(savedTimer.current), []);

  // Reads from the DOM node rather than `draft` — the blur can land in the same
  // React batch as the last keystroke, where the state is still one edit behind.
  const commit = () => {
    const next = (ref.current?.value ?? draft).trim();
    if (required && !next) {
      setDraft(value);
      return;
    }
    if (next === value.trim()) return;
    onSave(next);
    setJustSaved(true);
    window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setJustSaved(false), 1600);
  };

  return (
    <div className="relative">
      <AutoTextarea
        ref={ref}
        value={draft}
        minHeight={minHeight}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setIsFocused(false);
          commit();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setDraft(value);
            // Blur without committing — the reverted draft is already correct.
            requestAnimationFrame(() => ref.current?.blur());
          }
          if (event.key === "Enter" && (!multiline || event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            ref.current?.blur();
          }
        }}
        className={`-mx-2 rounded-lg border border-transparent bg-transparent px-2 py-1 transition placeholder:text-gray-400 hover:border-gray-200 focus:border-brand-300 focus:bg-white focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:hover:border-gray-700 dark:focus:bg-gray-900 ${className}`}
      />
      {justSaved && (
        <span className="pointer-events-none absolute -top-5 right-0 inline-flex items-center gap-1 text-theme-xs text-success-600">
          <Check size={12} />
          Сохранено
        </span>
      )}
    </div>
  );
}
