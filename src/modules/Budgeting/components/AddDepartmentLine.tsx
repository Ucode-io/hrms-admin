import { useMemo, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Dropdown } from "../../../components/ui/dropdown/Dropdown";
import { STICKY_TITLE_CLASS, TITLE_CELL } from "../constants";

interface AddDepartmentLineProps {
  /** Отделы компании, которых в бюджете ещё нет. */
  departments: { id: string; title: string }[];
  onPick: (departmentId: string) => void;
}

/**
 * Приглашение добавить отдел в конце таблицы.
 *
 * Отдел выбирается из справочника компании, а не заводится здесь: своего списка
 * отделов у бюджета нет — иначе в системе появились бы два набора названий,
 * которые разъедутся, и отчёт «бюджет против факта по отделам» пришлось бы
 * сшивать руками.
 */
export default function AddDepartmentLine({ departments, onPick }: AddDepartmentLineProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return departments;
    return departments.filter((department) => department.title.toLowerCase().includes(needle));
  }, [departments, search]);

  const close = () => {
    setSearch("");
    setIsOpen(false);
  };

  return (
    <div className="flex items-stretch border-t border-slate-100 bg-white">
      <div className={`py-1.5 pl-2 pr-3 ${TITLE_CELL} ${STICKY_TITLE_CLASS} bg-white`}>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          className="dropdown-toggle flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-slate-400 transition hover:bg-brand-50 hover:text-brand-600"
        >
          <Plus size={14} className="shrink-0" />
          Отдел
        </button>

        <Dropdown
          isOpen={isOpen}
          onClose={close}
          usePortal
          anchorEl={triggerRef.current}
          className="w-64 p-1.5"
        >
          <div className="relative mb-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Отдел..."
              autoFocus
              className="h-8 w-full rounded-lg border border-slate-200 pl-8 pr-2 text-sm text-slate-800 outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10"
            />
          </div>

          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-slate-400">
                {departments.length === 0
                  ? "Все отделы уже в бюджете"
                  : "Ничего не нашли"}
              </p>
            ) : (
              filtered.map((department) => (
                <button
                  key={department.id}
                  type="button"
                  onClick={() => {
                    close();
                    onPick(department.id);
                  }}
                  className="flex w-full items-center rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 transition hover:bg-brand-50 hover:text-brand-600"
                >
                  <span className="truncate">{department.title}</span>
                </button>
              ))
            )}
          </div>
        </Dropdown>
      </div>
    </div>
  );
}
