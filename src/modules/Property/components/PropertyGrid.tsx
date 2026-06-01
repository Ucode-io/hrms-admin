import { ArrowLeftRight, Hash, Pencil, Trash2, User } from "lucide-react";
import { formatCurrency, type PropertyItem } from "../types";
import StatusBadge from "./StatusBadge";

interface PropertyGridProps {
  items: PropertyItem[];
  onOpenDetail: (item: PropertyItem) => void;
  onEdit: (item: PropertyItem) => void;
  onMovement: (item: PropertyItem) => void;
  onDelete: (item: PropertyItem) => void;
}

export default function PropertyGrid({
  items,
  onOpenDetail,
  onEdit,
  onMovement,
  onDelete,
}: PropertyGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="group flex cursor-pointer flex-col rounded-2xl border border-gray-200 bg-white transition hover:border-brand-200 hover:shadow-sm"
          onClick={() => onOpenDetail(item)}
        >
          {/* Photo / placeholder */}
          <div className="flex h-32 w-full items-center justify-center overflow-hidden rounded-t-2xl bg-gray-50">
            {item.photo ? (
              <img src={item.photo} alt={item.name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-3xl font-semibold text-gray-200">
                {item.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex flex-1 flex-col p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 className="truncate font-semibold text-gray-800">{item.name}</h4>
                <span className="mt-1 inline-flex rounded-lg bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {item.categoryTitle}
                </span>
              </div>
              <StatusBadge status={item.status} />
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-500">
                <Hash size={14} className="shrink-0 text-gray-400" />
                <span className="font-mono text-xs">{item.serialNumber || "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-500">
                <User size={14} className="shrink-0 text-gray-400" />
                <span className={item.assignedToName ? "text-gray-700" : "text-gray-300"}>
                  {item.assignedToName || "Не назначено"}
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
              <span className="text-base font-semibold text-gray-800">
                {formatCurrency(item.cost)}
              </span>
              <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onMovement(item);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-brand-50 hover:text-brand-600"
                  aria-label="Движение"
                  title="Движение (статус, назначение)"
                >
                  <ArrowLeftRight size={15} />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onEdit(item);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Редактировать"
                  title="Редактировать"
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(item);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-rose-50 hover:text-rose-600"
                  aria-label="Удалить"
                  title="Удалить"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
