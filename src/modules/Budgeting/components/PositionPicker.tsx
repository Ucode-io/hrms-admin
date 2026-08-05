import { useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Dropdown } from "../../../components/ui/dropdown/Dropdown";
import type { BudgetPosition } from "../types";

interface PositionPickerProps {
  value: string | null;
  positions: BudgetPosition[];
  onChange: (positionId: string | null) => void;
}

/**
 * Должность вакансии — выбор из справочника, а не свободный текст.
 *
 * Свободный текст разъезжается («Frontend», «Фронтенд», «frontend-разработчик»),
 * и по такому бюджету потом не сопоставить план найма с вакансиями рекрутинга.
 */
export default function PositionPicker({ value, positions, onChange }: PositionPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);

  const current = positions.find((position) => position.id === value) ?? null;

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return positions;
    return positions.filter((position) => position.title.toLowerCase().includes(needle));
  }, [positions, search]);

  const close = () => {
    setSearch("");
    setIsOpen(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label="Должность"
        className={`dropdown-toggle w-full truncate rounded-md border border-transparent px-2 py-0.5 text-left text-[11px] transition hover:border-gray-200 hover:bg-white ${
          current ? "text-gray-500" : "text-gray-300"
        }`}
      >
        {current?.title ?? "Выбрать должность"}
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={close}
        usePortal
        anchorEl={triggerRef.current}
        className="w-64 p-1.5"
      >
        <div className="relative mb-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Должность..."
            autoFocus
            className="h-8 w-full rounded-lg border border-gray-200 pl-8 pr-2 text-sm text-gray-800 outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10"
          />
        </div>

        <div className="max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-gray-400">Ничего не нашли</p>
          ) : (
            filtered.map((position) => (
              <button
                key={position.id}
                type="button"
                onClick={() => {
                  close();
                  onChange(position.id);
                }}
                className={`flex w-full items-center rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-brand-50 hover:text-brand-600 ${
                  position.id === value ? "text-brand-600" : "text-gray-700"
                }`}
              >
                <span className="truncate">{position.title}</span>
              </button>
            ))
          )}
        </div>

        {current && (
          <button
            type="button"
            onClick={() => {
              close();
              onChange(null);
            }}
            className="mt-1 w-full rounded-lg border-t border-gray-100 px-2 py-1.5 text-left text-sm text-gray-500 transition hover:bg-gray-50"
          >
            Очистить
          </button>
        )}
      </Dropdown>
    </>
  );
}
