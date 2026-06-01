import { ArrowLeftRight, Pencil, Trash2 } from "lucide-react";
import { formatCurrency, type PropertyItem } from "../types";
import StatusBadge from "./StatusBadge";

interface PropertyTableProps {
  items: PropertyItem[];
  onOpenDetail: (item: PropertyItem) => void;
  onEdit: (item: PropertyItem) => void;
  onMovement: (item: PropertyItem) => void;
  onDelete: (item: PropertyItem) => void;
}

const getInitials = (name: string): string =>
  name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

export default function PropertyTable({
  items,
  onOpenDetail,
  onEdit,
  onMovement,
  onDelete,
}: PropertyTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] text-left text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-xs font-medium uppercase tracking-wide text-gray-400">
            <th className="px-5 py-3">Наименование</th>
            <th className="px-5 py-3">Категория</th>
            <th className="px-5 py-3">Серийный номер</th>
            <th className="px-5 py-3">Стоимость</th>
            <th className="px-5 py-3">Назначено</th>
            <th className="px-5 py-3">Статус</th>
            <th className="px-5 py-3 text-right">Действия</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((item) => (
            <tr
              key={item.id}
              className="group cursor-pointer transition hover:bg-gray-50"
              onClick={() => onOpenDetail(item)}
            >
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-3">
                  {item.photo ? (
                    <img
                      src={item.photo}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-lg object-cover"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <div className="font-medium text-gray-800">{item.name}</div>
                    {item.description && (
                      <div className="mt-0.5 max-w-[280px] truncate text-xs text-gray-400">{item.description}</div>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-5 py-3.5">
                <span className="inline-flex rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                  {item.categoryTitle}
                </span>
              </td>
              <td className="px-5 py-3.5">
                <span className="font-mono text-xs text-gray-500">{item.serialNumber || "—"}</span>
              </td>
              <td className="px-5 py-3.5 font-medium text-gray-700">{formatCurrency(item.cost)}</td>
              <td className="px-5 py-3.5">
                {item.assignedToName ? (
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-600">
                      {getInitials(item.assignedToName)}
                    </span>
                    <span className="text-gray-700">{item.assignedToName}</span>
                  </div>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </td>
              <td className="px-5 py-3.5">
                <StatusBadge status={item.status} />
              </td>
              <td className="px-5 py-3.5">
                <div className="flex items-center justify-end gap-1 opacity-0 transition group-hover:opacity-100">
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
