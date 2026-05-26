export type AttendanceSourceKind = "absences" | "manual" | "integration" | "unknown";

export const ATTENDANCE_SOURCE_PRIORITY: Record<AttendanceSourceKind, number> = {
  absences: 1,
  manual: 2,
  integration: 3,
  unknown: 4,
};

const normalizeSourceArrayItem = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
};

export const getAttendanceSourceKind = (
  sourceType: unknown
): AttendanceSourceKind => {
  const candidates: string[] = [];

  if (Array.isArray(sourceType)) {
    for (const item of sourceType) {
      const normalized = normalizeSourceArrayItem(item);
      if (normalized) candidates.push(normalized);
    }
  } else if (typeof sourceType === "string") {
    const normalized = normalizeSourceArrayItem(sourceType);
    if (normalized) candidates.push(normalized);
  }

  if (candidates.includes("absences")) return "absences";
  if (candidates.includes("manual")) return "manual";
  if (candidates.includes("integration")) return "integration";
  return "unknown";
};

export const getAttendanceSourcePriority = (sourceType: unknown): number => {
  return ATTENDANCE_SOURCE_PRIORITY[getAttendanceSourceKind(sourceType)];
};

const safeDate = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 10);
};

const safeCreatedAt = (value: unknown): number => {
  if (typeof value !== "string") return 0;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : 0;
};

/**
 * Collapse attendance rows to one per (user_base_id, date), keeping the row
 * with the highest source priority. Ties broken by most recent created_at.
 *
 * Items with unknown user/date are passed through unchanged.
 */
export const dedupeAttendanceByPriority = <
  T extends {
    user_base_id?: unknown;
    date?: unknown;
    source_type?: unknown;
    created_at?: unknown;
  }
>(
  items: readonly T[]
): T[] => {
  const winners = new Map<string, T>();
  const passthrough: T[] = [];

  for (const item of items) {
    const userId = typeof item.user_base_id === "string" ? item.user_base_id : "";
    const date = safeDate(item.date);

    if (!userId || !date) {
      passthrough.push(item);
      continue;
    }

    const key = `${userId}__${date}`;
    const current = winners.get(key);
    if (!current) {
      winners.set(key, item);
      continue;
    }

    const candidatePriority = getAttendanceSourcePriority(item.source_type);
    const currentPriority = getAttendanceSourcePriority(current.source_type);

    if (candidatePriority < currentPriority) {
      winners.set(key, item);
      continue;
    }

    if (candidatePriority === currentPriority) {
      if (safeCreatedAt(item.created_at) > safeCreatedAt(current.created_at)) {
        winners.set(key, item);
      }
    }
  }

  return [...winners.values(), ...passthrough];
};
