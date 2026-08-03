import type { CustomField } from "./types";

/**
 * Значение динамического поля → строка для просмотра (карточка сотрудника,
 * экспорт, мобильная версия). Живёт рядом со справочником, а не в детальной
 * странице: форматирование зависит от типа поля, а тип знает только справочник.
 */

export type DynamicValueView = {
  text: string;
  /** Подсказка для InfoRow: значение нужно отрисовать ссылкой. */
  linkType?: "email" | "phone" | "url";
};

const EMPTY: DynamicValueView = { text: "" };

/** Значение варианта → его человеческое название. */
const optionLabel = (field: CustomField, value: string): string =>
  field.options.find((option) => option.value === value)?.label ?? value;

/** `2026-07-31` → `31.07.2026`; неизвестный формат отдаём как есть. */
const formatDate = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatDateTime = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return `${formatDate(value)} ${parsed.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

export const formatDynamicValue = (
  field: CustomField,
  raw: unknown
): DynamicValueView => {
  if (raw === undefined || raw === null || raw === "") return EMPTY;

  switch (field.type) {
    case "boolean":
      return { text: raw ? "Да" : "Нет" };

    case "select":
    case "radio":
      return { text: optionLabel(field, String(raw)) };

    case "multiselect":
    case "checkbox_group": {
      const values = Array.isArray(raw) ? raw : [raw];
      if (values.length === 0) return EMPTY;
      return { text: values.map((item) => optionLabel(field, String(item))).join(", ") };
    }

    case "date":
      return { text: formatDate(String(raw)) };

    case "datetime":
      return { text: formatDateTime(String(raw)) };

    case "money": {
      const parsed = Number(raw);
      return {
        text: Number.isFinite(parsed) ? parsed.toLocaleString("ru-RU") : String(raw),
      };
    }

    case "email":
      return { text: String(raw), linkType: "email" };

    case "phone":
      return { text: String(raw), linkType: "phone" };

    case "url":
    case "file":
      return { text: String(raw), linkType: "url" };

    default:
      return { text: String(raw) };
  }
};
