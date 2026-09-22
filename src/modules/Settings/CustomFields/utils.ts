import { FIELD_TYPE_MAP, OPTION_COLORS } from "./constants";
import { translate } from "../../../i18n";
import type {
  CustomField,
  FieldOption,
  FieldRules,
  FieldType,
} from "./types";

const TRANSLIT: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "j",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
  "'": "",
  "`": "",
  "ʻ": "",
};

/** «Номер паспорта» -> «nomer_pasporta» */
export const slugifyKey = (value: string): string => {
  const lower = value.toLowerCase().trim();
  let result = "";

  for (const char of lower) {
    if (TRANSLIT[char] !== undefined) {
      result += TRANSLIT[char];
    } else if (/[a-z0-9]/.test(char)) {
      result += char;
    } else {
      result += "_";
    }
  }

  return result.replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 48);
};

export const isValidKey = (key: string): boolean => /^[a-z][a-z0-9_]{1,47}$/.test(key);

export const createId = (prefix: string): string =>
  `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

export const createEmptyRules = (): FieldRules => ({
  required: false,
  unique: false,
  readOnly: false,
  minLength: null,
  maxLength: null,
  min: null,
  max: null,
  pattern: "",
  patternMessage: "",
  minDate: "",
  maxDate: "",
  multiple: false,
  allowedExtensions: [],
  maxFileSizeMb: null,
});

export const createOption = (index = 0): FieldOption => ({
  id: createId("opt"),
  label: "",
  value: "",
  color: OPTION_COLORS[index % OPTION_COLORS.length],
});

export const createEmptyField = (
  entityId: string,
  sortOrder: number
): CustomField => ({
  id: createId("fld"),
  entityId,
  key: "",
  label: "",
  type: "text",
  placeholder: "",
  hint: "",
  defaultValue: "",
  options: [],
  directorySlug: "",
  rules: createEmptyRules(),
  system: false,
  sortOrder,
});

export const typeSupportsOptions = (type: FieldType): boolean =>
  Boolean(FIELD_TYPE_MAP[type]?.hasOptions);

export const describeRules = (field: CustomField): string[] => {
  const parts: string[] = [];

  if (field.rules.required) parts.push(translate("settings_custom_fields.rule_chip.required"));
  if (field.rules.unique) parts.push(translate("settings_custom_fields.rule_chip.unique"));
  if (field.rules.readOnly) parts.push(translate("settings_custom_fields.rule_chip.read_only"));
  const { minLength, maxLength, min, max } = field.rules;

  if (minLength !== null && maxLength !== null) {
    parts.push(translate("settings_custom_fields.rule_chip.length_range", { min: minLength, max: maxLength }));
  } else if (maxLength !== null) {
    parts.push(translate("settings_custom_fields.rule_chip.max_length", { max: maxLength }));
  } else if (minLength !== null) {
    parts.push(translate("settings_custom_fields.rule_chip.min_length", { min: minLength }));
  }

  if (min !== null && max !== null) {
    parts.push(translate("settings_custom_fields.rule_chip.range", { min, max }));
  } else if (max !== null) {
    parts.push(translate("settings_custom_fields.rule_chip.max", { max }));
  } else if (min !== null) {
    parts.push(translate("settings_custom_fields.rule_chip.min", { min }));
  }
  if (field.rules.pattern) parts.push(translate("settings_custom_fields.rule_chip.pattern"));
  if (field.rules.allowedExtensions.length > 0) {
    parts.push(field.rules.allowedExtensions.join(", "));
  }

  return parts;
};

export const sortBySortOrder = <T extends { sortOrder: number }>(items: T[]): T[] =>
  [...items].sort((a, b) => a.sortOrder - b.sortOrder);

export const reindex = <T extends { sortOrder: number }>(items: T[]): T[] =>
  items.map((item, index) => ({ ...item, sortOrder: index }));
