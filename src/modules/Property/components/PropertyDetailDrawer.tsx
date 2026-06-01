import { useEffect } from "react";
import { ArrowLeftRight, ImageOff, Loader2, Pencil, Trash2, X } from "lucide-react";
import StatusBadge from "./StatusBadge";
import { usePropertyHistoryQuery, mapPropertyHistoryRow } from "../../../api/services/property.service";
import {
  PROPERTY_STATUS_CONFIG,
  formatCurrency,
  formatDate,
  formatDateTime,
  type PropertyHistoryEntry,
  type PropertyItem,
} from "../types";

interface PropertyDetailDrawerProps {
  isOpen: boolean;
  item: PropertyItem | null;
  onClose: () => void;
  onEdit: (item: PropertyItem) => void;
  onMovement: (item: PropertyItem) => void;
  onDelete: (item: PropertyItem) => void;
}

const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-3 py-2">
    <span className="shrink-0 text-sm text-gray-500">{label}</span>
    <span className="text-right text-sm font-medium text-gray-800">{value || "—"}</span>
  </div>
);

const HistoryItem = ({ entry, isLast }: { entry: PropertyHistoryEntry; isLast: boolean }) => {
  const toConfig = PROPERTY_STATUS_CONFIG[entry.toStatus];
  const fromConfig = entry.fromStatus ? PROPERTY_STATUS_CONFIG[entry.fromStatus] : null;
  return (
    <li className="relative flex gap-3 pb-5">
      {!isLast && <span className="absolute left-[7px] top-4 h-full w-px bg-gray-200" />}
      <span className={`mt-1 h-3.5 w-3.5 shrink-0 rounded-full ring-4 ring-white ${toConfig.dotClassName}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-700">
          {fromConfig ? (
            <>
              <span className="text-gray-400">{fromConfig.label}</span>
              <span className="text-gray-300">→</span>
              <span className="font-medium">{toConfig.label}</span>
            </>
          ) : (
            <span className="font-medium">{toConfig.label}</span>
          )}
        </div>
        {entry.assigneeName && (
          <div className="mt-0.5 text-sm text-gray-600">
            Назначено: <span className="font-medium">{entry.assigneeName}</span>
            {entry.date ? ` · ${formatDate(entry.date)}` : ""}
          </div>
        )}
        {entry.comment && (
          <p className="mt-1 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">{entry.comment}</p>
        )}
        <div className="mt-1 text-xs text-gray-400">
          {formatDateTime(entry.at)} · {entry.author}
        </div>
      </div>
    </li>
  );
};

export default function PropertyDetailDrawer({
  isOpen,
  item,
  onClose,
  onEdit,
  onMovement,
  onDelete,
}: PropertyDetailDrawerProps) {
  const { data: historyData, isLoading: isHistoryLoading } = usePropertyHistoryQuery(
    item?.id ?? null,
    isOpen
  );

  const historyEntries = (historyData?.response ?? []).map(mapPropertyHistoryRow)
    .sort((a, b) => b.at.localeCompare(a.at));

  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (isOpen) document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [isOpen, onClose]);

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-99999">
      <div className="absolute inset-0 bg-gray-900/30 backdrop-blur-[2px]" onClick={onClose} />

      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[480px] flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-lg font-semibold text-gray-900">{item.name}</h3>
              <StatusBadge status={item.status} />
            </div>
            <p className="mt-0.5 text-sm text-gray-500">{item.categoryTitle || "Без категории"}</p>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-400 transition hover:bg-gray-50 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Photo */}
          <div className="mb-5 flex h-44 w-full items-center justify-center overflow-hidden rounded-2xl border border-gray-100 bg-gray-50">
            {item.photo
              ? <img src={item.photo} alt={item.name} className="h-full w-full object-cover" />
              : <div className="flex flex-col items-center gap-1 text-gray-300"><ImageOff size={28} /><span className="text-xs">Нет фото</span></div>
            }
          </div>

          {/* Info */}
          <div className="divide-y divide-gray-100 rounded-2xl border border-gray-100 px-4">
            <InfoRow label="Серийный номер" value={<span className="font-mono text-xs">{item.serialNumber}</span>} />
            <InfoRow label="Стоимость" value={formatCurrency(item.cost)} />
            <InfoRow label="Дата покупки" value={formatDate(item.purchaseDate)} />
            <InfoRow label="Гарантия до" value={formatDate(item.warrantyUntil)} />
            <InfoRow label="Назначено" value={item.assignedToName} />
            <InfoRow label="Дата выдачи" value={formatDate(item.assignedDate)} />
          </div>

          {item.description && (
            <div className="mt-4">
              <p className="mb-1.5 text-sm font-medium text-gray-700">Описание</p>
              <p className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600">{item.description}</p>
            </div>
          )}

          {/* Actions */}
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={() => onMovement(item)}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-medium text-white transition hover:bg-brand-600">
              <ArrowLeftRight size={16} />
              Движение
            </button>
            <button type="button" onClick={() => onEdit(item)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-medium text-gray-600 transition hover:bg-gray-50">
              <Pencil size={16} />
              Изменить
            </button>
            <button type="button" onClick={() => onDelete(item)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose-100 text-rose-600 transition hover:bg-rose-50">
              <Trash2 size={16} />
            </button>
          </div>

          {/* History */}
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-900">История изменений</h4>
              <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                {isHistoryLoading ? "…" : historyEntries.length}
              </span>
            </div>
            {isHistoryLoading ? (
              <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-gray-400" /></div>
            ) : historyEntries.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                История пуста. Используйте действие «Движение», чтобы зафиксировать изменения.
              </p>
            ) : (
              <ul className="pl-1">
                {historyEntries.map((entry, index) => (
                  <HistoryItem key={entry.id} entry={entry} isLast={index === historyEntries.length - 1} />
                ))}
              </ul>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
