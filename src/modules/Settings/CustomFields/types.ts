export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "money"
  | "date"
  | "datetime"
  | "boolean"
  | "select"
  | "multiselect"
  | "radio"
  | "checkbox_group"
  | "email"
  | "phone"
  | "url"
  | "file"
  | "employee"
  | "directory";

export type FieldOption = {
  id: string;
  label: string;
  value: string;
  color: string;
};

export type FieldRules = {
  required: boolean;
  unique: boolean;
  readOnly: boolean;
  minLength: number | null;
  maxLength: number | null;
  min: number | null;
  max: number | null;
  pattern: string;
  patternMessage: string;
  minDate: string;
  maxDate: string;
  multiple: boolean;
  allowedExtensions: string[];
  maxFileSizeMb: number | null;
};

export type CustomField = {
  id: string;
  entityId: string;
  /** Системный ключ — имя колонки в таблице. */
  key: string;
  label: string;
  type: FieldType;
  placeholder: string;
  hint: string;
  defaultValue: string;
  options: FieldOption[];
  /** Слаг справочника для типа `directory`. */
  directorySlug: string;
  rules: FieldRules;
  /** Статичное поле таблицы: ключ и тип менять нельзя, удалить нельзя. */
  system: boolean;
  sortOrder: number;
};

export type CustomFieldEntity = {
  id: string;
  /** Слаг таблицы в u-code (user_base, candidates, ...). */
  slug: string;
  title: string;
  description: string;
  icon: string;
  /** Таблица подключена к API. Пока включена только `user_base`. */
  enabled: boolean;
  /**
   * Ключ поля-контейнера под значения динамических полей (`custom_data`), если
   * оно заведено в u-code. `null` — значения сохранять пока некуда.
   */
  valuesField: string | null;
};

export type CustomFieldsSchema = {
  entities: CustomFieldEntity[];
  fields: CustomField[];
};
