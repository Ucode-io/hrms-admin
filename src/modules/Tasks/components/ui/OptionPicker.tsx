import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, Plus, Search } from "lucide-react";

export interface PickerOption {
  value: string;
  label: string;
  /** Secondary text on the right of a row (position, count, …). */
  hint?: string;
  icon?: ReactNode;
  /**
   * Optional section the row belongs to. A header is drawn whenever `key`
   * changes, so options must arrive already sorted by section — the picker
   * does not regroup them.
   */
  group?: { key: string; label: string };
}

interface OptionPickerProps {
  options: PickerOption[];
  /** Selected value(s); an array turns the picker into a multi-select. */
  selected: string | string[] | null;
  onSelect: (value: string) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Shows a "create «query»" row when the query matches no option. */
  onCreate?: (label: string) => void;
  createLabel?: (query: string) => string;
  /** Extra row pinned under the list, e.g. "Очистить". */
  footer?: (args: { close: () => void }) => ReactNode;
  close: () => void;
  /** Multi-select keeps the panel open after a pick. */
  closeOnSelect?: boolean;
}

/**
 * The one list UI behind every Tasks picker: type to filter, ↑/↓ to move,
 * Enter to pick. Keeping them identical is what makes the fields feel like a
 * single system instead of five different dropdowns.
 */
export default function OptionPicker({
  options,
  selected,
  onSelect,
  searchable = false,
  searchPlaceholder = "Поиск...",
  emptyText = "Ничего не найдено",
  onCreate,
  createLabel = (query) => `Создать «${query}»`,
  footer,
  close,
  closeOnSelect = true,
}: OptionPickerProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedValues = useMemo(
    () => (Array.isArray(selected) ? selected : selected ? [selected] : []),
    [selected]
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(needle) ||
        option.hint?.toLowerCase().includes(needle)
    );
  }, [options, query]);

  const trimmedQuery = query.trim();
  const canCreate =
    Boolean(onCreate) &&
    trimmedQuery.length > 0 &&
    !options.some((option) => option.label.toLowerCase() === trimmedQuery.toLowerCase());

  const rowCount = filtered.length + (canCreate ? 1 : 0);

  useEffect(() => {
    if (searchable) searchRef.current?.focus();
  }, [searchable]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const pick = (value: string) => {
    onSelect(value);
    if (closeOnSelect) close();
    else setQuery("");
  };

  const activate = (index: number) => {
    if (index === filtered.length && canCreate) {
      onCreate?.(trimmedQuery);
      if (closeOnSelect) close();
      else setQuery("");
      return;
    }
    const option = filtered[index];
    if (option) pick(option.value);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (rowCount ? (index + 1) % rowCount : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (rowCount ? (index - 1 + rowCount) % rowCount : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      activate(activeIndex);
    }
  };

  return (
    <div onKeyDown={handleKeyDown} className="flex min-h-0 flex-col">
      {searchable && (
        <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 px-3 dark:border-gray-800">
          <Search size={14} className="shrink-0 text-gray-400" />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-10 w-full bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-hidden dark:text-white/90"
          />
        </div>
      )}

      <div ref={listRef} className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-1.5">
        {filtered.map((option, index) => {
          const isSelected = selectedValues.includes(option.value);
          // Headers sit between rows and are not selectable, so they stay out
          // of the index space that ↑/↓ walks.
          const groupHeader =
            option.group && option.group.key !== filtered[index - 1]?.group?.key ? (
              <p
                key={`group-${option.group.key}`}
                className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 first:pt-1"
              >
                {option.group.label}
              </p>
            ) : null;

          return (
            <Fragment key={option.value}>
              {groupHeader}
            <button
              type="button"
              data-index={index}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => pick(option.value)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                index === activeIndex
                  ? "bg-gray-100 dark:bg-white/10"
                  : "hover:bg-gray-50 dark:hover:bg-white/5"
              }`}
            >
              {option.icon && <span className="flex shrink-0 items-center">{option.icon}</span>}
              <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-200">
                {option.label}
              </span>
              {option.hint && (
                <span className="shrink-0 truncate text-theme-xs text-gray-400">{option.hint}</span>
              )}
              {isSelected && <Check size={15} className="shrink-0 text-brand-500" />}
            </button>
            </Fragment>
          );
        })}

        {canCreate && (
          <button
            type="button"
            data-index={filtered.length}
            onMouseEnter={() => setActiveIndex(filtered.length)}
            onClick={() => activate(filtered.length)}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-brand-600 transition dark:text-brand-400 ${
              activeIndex === filtered.length
                ? "bg-brand-50 dark:bg-brand-500/10"
                : "hover:bg-brand-50 dark:hover:bg-brand-500/10"
            }`}
          >
            <Plus size={15} className="shrink-0" />
            <span className="truncate">{createLabel(trimmedQuery)}</span>
          </button>
        )}

        {rowCount === 0 && (
          <p className="px-2.5 py-6 text-center text-sm text-gray-400">{emptyText}</p>
        )}
      </div>

      {footer && (
        <div className="shrink-0 border-t border-gray-100 p-1.5 dark:border-gray-800">
          {footer({ close })}
        </div>
      )}
    </div>
  );
}
