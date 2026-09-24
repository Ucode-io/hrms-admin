import { ArrowLeftRight, Pencil, Trash2 } from "lucide-react";
import { formatCurrency, getInitials, type PropertyItem } from "../types";
import StatusBadge from "./StatusBadge";
import { useTranslation } from "../../../i18n";

interface PropertyTableProps {
  items: PropertyItem[];
  onOpenDetail: (item: PropertyItem) => void;
  onEdit: (item: PropertyItem) => void;
  onMovement: (item: PropertyItem) => void;
  onDelete: (item: PropertyItem) => void;
  onPreviewPhoto: (item: PropertyItem) => void;
}

export default function PropertyTable({ items,
  onOpenDetail,
  onEdit,
  onMovement,
  onDelete,
  onPreviewPhoto,
}: PropertyTableProps) {
  const { t } = useTranslation();
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] text-left text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-xs font-medium uppercase tracking-wide text-gray-400">
            <th className="px-5 py-3">{t("property.table.name")}</th>
            <th className="px-5 py-3">{t("property.table.category")}</th>
            <th className="px-5 py-3">{t("property.table.serial")}</th>
            <th className="px-5 py-3">{t("property.table.cost")}</th>
            <th className="px-5 py-3">{t("property.table.assigned")}</th>
            <th className="px-5 py-3">{t("property.table.status")}</th>
            <th className="px-5 py-3 text-right">{t("property.table.actions")}</th>
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
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onPreviewPhoto(item);
                      }}
                      className="shrink-0 cursor-zoom-in rounded-lg transition hover:opacity-80"
                    >
                      <img src={item.photo} alt={item.name} className="h-9 w-9 rounded-lg bg-gray-50 object-contain" />
                    </button>
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
                    aria-label={t("property.movement.action")}
                    title={t("property.movement.action_title")}
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
                    aria-label={t("common.edit_action")}
                    title={t("common.edit_action")}
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
                    aria-label={t("common.delete")}
                    title={t("common.delete")}
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
