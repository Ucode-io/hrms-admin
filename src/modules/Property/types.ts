// Domain types, constants and formatters for the Property (Имущество) module.

export type PropertyStatus = "in_stock" | "assigned" | "repair" | "written_off";

// A single entry in an item's change history (produced by the movement action).
export interface PropertyHistoryEntry {
  id: string;
  at: string; // ISO datetime
  fromStatus: PropertyStatus | null;
  toStatus: PropertyStatus;
  assigneeName: string | null;
  date: string | null;
  comment: string;
  author: string;
}

export interface PropertyItem {
  id: string;
  // General attributes (edited via the regular form).
  name: string;
  categoryId: string | null;
  categoryTitle: string;
  serialNumber: string;
  cost: number;
  photo: string | null;
  purchaseDate: string | null;
  warrantyUntil: string | null;
  description: string;
  // Movement state (changed via the movement action, tracked in history).
  status: PropertyStatus;
  assignedToGuid: string | null;
  assignedToName: string | null;
  assignedDate: string | null;
}

// Editable general attributes (regular edit / create form).
export interface PropertyGeneralDraft {
  name: string;
  categoryId: string | null;
  serialNumber: string;
  cost: number;
  photo: string | null;
  purchaseDate: string | null;
  warrantyUntil: string | null;
  description: string;
}

// Input of the movement action.
export interface PropertyMovementInput {
  status: PropertyStatus;
  assignedToGuid: string | null;
  assignedToName: string | null;
  date: string | null;
  comment: string;
}

export const PROPERTY_STATUS_ORDER: PropertyStatus[] = [
  "in_stock",
  "assigned",
  "repair",
  "written_off",
];

export const PROPERTY_STATUS_CONFIG: Record<
  PropertyStatus,
  { label: string; badgeClassName: string; dotClassName: string }
> = {
  in_stock: {
    label: "На складе",
    badgeClassName: "bg-slate-100 text-slate-600",
    dotClassName: "bg-slate-400",
  },
  assigned: {
    label: "Выдано",
    badgeClassName: "bg-emerald-100 text-emerald-700",
    dotClassName: "bg-emerald-500",
  },
  repair: {
    label: "На ремонте",
    badgeClassName: "bg-amber-100 text-amber-700",
    dotClassName: "bg-amber-500",
  },
  written_off: {
    label: "Списано",
    badgeClassName: "bg-rose-100 text-rose-700",
    dotClassName: "bg-rose-500",
  },
};

export const formatCurrency = (value: number): string => {
  if (!Number.isFinite(value)) return "—";
  return `$${value.toLocaleString("ru-RU")}`;
};

export const formatDate = (iso: string | null): string => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()}`;
};

export const formatDateTime = (iso: string | null): string => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()} ${hours}:${minutes}`;
};

export const createEmptyGeneralDraft = (): PropertyGeneralDraft => ({
  name: "",
  categoryId: null,
  serialNumber: "",
  cost: 0,
  photo: null,
  purchaseDate: null,
  warrantyUntil: null,
  description: "",
});

export const generalDraftFromItem = (item: PropertyItem): PropertyGeneralDraft => ({
  name: item.name,
  categoryId: item.categoryId,
  serialNumber: item.serialNumber,
  cost: item.cost,
  photo: item.photo,
  purchaseDate: item.purchaseDate,
  warrantyUntil: item.warrantyUntil,
  description: item.description,
});

export const createMovementInput = (item: PropertyItem): PropertyMovementInput => ({
  status: item.status,
  assignedToGuid: item.assignedToGuid,
  assignedToName: item.assignedToName,
  date: item.assignedDate,
  comment: "",
});
