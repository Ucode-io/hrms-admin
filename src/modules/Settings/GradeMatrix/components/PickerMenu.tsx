import { useMemo, useState } from "react";
import { Eraser, Search } from "lucide-react";
import { Dropdown } from "../../../../components/ui/dropdown/Dropdown";

export type PickerItem = {
  id: string;
  title: string;
  /** Уже занят другой строкой матрицы — показываем, но выбрать нельзя. */
  disabled?: boolean;
  hint?: string;
};

export type PickerGroup = {
  key: string;
  label: string;
  items: PickerItem[];
  /** Должность в ячейке — это переход на другую роль, и цвет у неё свой. */
  tone?: "brand" | "amber";
};

interface PickerMenuProps {
  isOpen: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  groups: PickerGroup[];
  onPick: (groupKey: string, id: string) => void;
  /** Есть что стирать — показываем «Очистить». */
  onClear?: () => void;
  emptyText?: string;
}

/**
 * Выпадающий список справочника с поиском.
 *
 * Через портал: матрица прокручивается по горизонтали, и список, лежащий
 * внутри прокрутки, обрезался бы её краем.
 */
export default function PickerMenu({
  isOpen,
  anchorEl,
  onClose,
  groups,
  onPick,
  onClear,
  emptyText = "Ничего не найдено",
}: PickerMenuProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return groups
      .map((group) => ({
        ...group,
        items: query
          ? group.items.filter((item) => item.title.toLowerCase().includes(query))
          : group.items,
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, search]);

  if (!isOpen) return null;

  return (
    <Dropdown
      isOpen={isOpen}
      onClose={() => {
        setSearch("");
        onClose();
      }}
      usePortal
      anchorEl={anchorEl}
      className="w-64 p-1.5"
    >
      <div className="relative mb-1">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Поиск..."
          autoFocus
          className="h-8 w-full rounded-lg border border-gray-200 pl-8 pr-2 text-sm text-gray-800 outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10"
        />
      </div>

      <div className="max-h-64 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-gray-400">{emptyText}</p>
        ) : (
          filtered.map((group) => (
            <div key={group.key} className="mb-1 last:mb-0">
              <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                {group.label}
              </p>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={item.disabled}
                  onClick={() => {
                    setSearch("");
                    onPick(group.key, item.id);
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                    item.disabled
                      ? "cursor-not-allowed text-gray-300"
                      : group.tone === "amber"
                        ? "text-amber-700 hover:bg-amber-50"
                        : "text-gray-700 hover:bg-brand-50 hover:text-brand-600"
                  }`}
                >
                  <span className="truncate">{item.title}</span>
                  {item.hint && <span className="shrink-0 text-[11px] text-gray-400">{item.hint}</span>}
                </button>
              ))}
            </div>
          ))
        )}
      </div>

      {onClear && (
        <button
          type="button"
          onClick={() => {
            setSearch("");
            onClear();
          }}
          className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-gray-100 px-2 py-1.5 text-left text-sm text-gray-500 transition hover:bg-gray-50"
        >
          <Eraser size={14} />
          Очистить
        </button>
      )}
    </Dropdown>
  );
}
