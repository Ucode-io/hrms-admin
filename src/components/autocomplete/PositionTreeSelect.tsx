import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  type Position,
  usePositionsQuery,
} from "../../api/services/position.service";

interface PositionTreeSelectProps {
  value: string;
  valueLabel?: string;
  onChange: (id: string, title: string) => void;
  placeholder?: string;
  /** Показывать строку сброса — для необязательных полей. */
  allowClear?: boolean;
  clearLabel?: string;
}

const ROOT_KEY = "__root__";

type TreeRow = {
  position: Position;
  level: number;
  hasChildren: boolean;
};

const parentKeyOf = (position: Position): string => {
  const raw = position.positions_id;
  return typeof raw === "string" && raw ? raw : ROOT_KEY;
};

export default function PositionTreeSelect({
  value,
  valueLabel,
  onChange,
  placeholder = "Выберите должность",
  allowClear = false,
  clearLabel = "— не задана —",
}: PositionTreeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = usePositionsQuery({
    params: { all: true },
    querySettings: { enabled: isOpen },
  });

  const positions = useMemo(
    () => ((data?.response || []) as Position[]),
    [data?.response]
  );

  const childrenByParent = useMemo(() => {
    const map = new Map<string, Position[]>();
    for (const position of positions) {
      const key = parentKeyOf(position);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(position);
    }
    for (const children of map.values()) {
      children.sort((a, b) =>
        String(a.title || "").localeCompare(String(b.title || ""), "ru")
      );
    }
    return map;
  }, [positions]);

  const normalizedSearch = search.trim().toLowerCase();

  // Flat filtered list while searching, ordered tree otherwise.
  const rows = useMemo<TreeRow[]>(() => {
    if (normalizedSearch) {
      return positions
        .filter((p) => String(p.title || "").toLowerCase().includes(normalizedSearch))
        .sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "ru"))
        .map((position) => ({ position, level: 0, hasChildren: false }));
    }

    const result: TreeRow[] = [];
    const walk = (parentKey: string, level: number) => {
      const children = childrenByParent.get(parentKey) || [];
      for (const position of children) {
        const hasChildren = (childrenByParent.get(position.guid)?.length || 0) > 0;
        result.push({ position, level, hasChildren });
        if (hasChildren && expanded.has(position.guid)) {
          walk(position.guid, level + 1);
        }
      }
    };
    walk(ROOT_KEY, 0);
    return result;
  }, [normalizedSearch, positions, childrenByParent, expanded]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedLabel = value
    ? String(positions.find((p) => p.guid === value)?.title || valueLabel || "")
    : "";

  const open = () => {
    if (isOpen) return;
    setIsOpen(true);
    setSearch("");
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const toggleExpand = (guid: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(guid)) next.delete(guid);
      else next.add(guid);
      return next;
    });
  };

  const handleSelect = (position: Position) => {
    onChange(position.guid, String(position.title || ""));
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative" onClick={open}>
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? search : selectedLabel}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={open}
          placeholder={isOpen ? "Поиск должности..." : placeholder}
          readOnly={!isOpen}
          className={`h-11 w-full cursor-pointer rounded-lg border bg-white px-3 pr-10 text-sm shadow-theme-xs transition focus:outline-none focus:ring-3 focus:ring-brand-500/10 ${
            isOpen ? "border-brand-300" : "border-gray-300"
          } ${selectedLabel || isOpen ? "text-gray-800" : "text-gray-400"}`}
        />
        <ChevronDown
          size={16}
          className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="max-h-64 overflow-y-auto py-1">
            {isLoading ? (
              <div className="px-3 py-6 text-center text-sm text-gray-400">Загрузка...</div>
            ) : rows.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-gray-400">Ничего не найдено</div>
            ) : (
              <>
                {/* Сброс — только в дереве: при поиске он был бы лишней строкой
                    среди совпадений. */}
                {allowClear && !normalizedSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange("", "");
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`flex w-full items-center rounded-md px-3 py-1.5 text-left text-sm transition ${
                      value ? "text-gray-500 hover:bg-gray-50" : "bg-brand-50 text-brand-600"
                    }`}
                  >
                    {clearLabel}
                  </button>
                )}
                {rows.map(({ position, level, hasChildren }) => {
                const isSelected = position.guid === value;
                return (
                  <div
                    key={position.guid}
                    className={`flex items-center gap-1 rounded-md px-1.5 py-1.5 text-sm transition ${
                      isSelected ? "bg-brand-50 text-brand-600" : "text-gray-700 hover:bg-gray-50"
                    }`}
                    style={{ paddingLeft: `${8 + level * 18}px` }}
                  >
                    {hasChildren ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(position.guid);
                        }}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                        aria-label={expanded.has(position.guid) ? "Свернуть" : "Развернуть"}
                      >
                        {expanded.has(position.guid) ? (
                          <ChevronDown size={14} />
                        ) : (
                          <ChevronRight size={14} />
                        )}
                      </button>
                    ) : (
                      <span className="h-5 w-5 shrink-0" />
                    )}
                    <button
                      type="button"
                      onClick={() => handleSelect(position)}
                      className="flex-1 truncate text-left"
                    >
                      {String(position.title || "Без названия")}
                    </button>
                  </div>
                );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
