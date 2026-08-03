import {
  Controller,
  type Control,
  type FieldPath,
  type RegisterOptions,
} from "react-hook-form";

import type { CustomField } from "../../../Settings/CustomFields/types";
import type { EmployeeFormValues } from "../types";

/**
 * Рендер динамического поля в стиле формы сотрудника.
 *
 * Поле привязано к react-hook-form под именем `custom_data.<ключ>`, поэтому
 * правила из справочника (обязательность, длина, диапазон, регулярное выражение)
 * реально блокируют сохранение, а не только показываются чипами в настройках.
 *
 * Значения уходят в payload только если в u-code у `user_base` заведено
 * поле-контейнер `custom_data` — это сообщает сервер (`entity.values_field`).
 */
type DynamicFieldControlProps = {
  field: CustomField;
  control: Control<EmployeeFormValues>;
  inputStyle: React.CSSProperties;
  brandColor: string;
  invalid: boolean;
};

/** Типы, у которых значение — массив выбранных вариантов. */
const MULTI_TYPES = new Set(["multiselect", "checkbox_group"]);

/**
 * Типы без пригодного контрола: файл ещё заглушка, значение ввести физически
 * нечем. Обязательность на них не вешаем — иначе форму нельзя было бы отправить.
 */
const UNSUPPORTED_TYPES = new Set(["file"]);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_PATTERN = /^https?:\/\/\S+$/i;

const isEmptyValue = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  value === "" ||
  (Array.isArray(value) && value.length === 0);

/**
 * Все проверки одного поля. Отдельной функцией, потому что формы на голом
 * `useState` (модалка «Добавить должность») не умеют правила react-hook-form.
 */
export const dynamicFieldValidators = (
  field: CustomField
): Record<string, (value: unknown) => true | string> => {
  const validate: Record<string, (value: unknown) => true | string> = {};

  // Переключатель «да/нет» всегда имеет значение — обязательность бессмысленна.
  if (field.rules.required && field.type !== "boolean") {
    validate.required = (value) =>
      isEmptyValue(value) ? "Заполните поле" : true;
  }

  const { minLength, maxLength, min, max, minDate, maxDate, pattern } = field.rules;

  if (minLength !== null || maxLength !== null) {
    validate.length = (value) => {
      if (typeof value !== "string" || value === "") return true;
      if (minLength !== null && value.length < minLength) {
        return `Минимум ${minLength} символов`;
      }
      if (maxLength !== null && value.length > maxLength) {
        return `Максимум ${maxLength} символов`;
      }
      return true;
    };
  }

  if (min !== null || max !== null) {
    validate.range = (value) => {
      if (isEmptyValue(value)) return true;
      const parsed = Number(value);
      if (Number.isNaN(parsed)) return "Введите число";
      if (min !== null && parsed < min) return `Не меньше ${min}`;
      if (max !== null && parsed > max) return `Не больше ${max}`;
      return true;
    };
  }

  if (minDate || maxDate) {
    validate.dateRange = (value) => {
      if (typeof value !== "string" || !value) return true;
      if (minDate && value < minDate) return `Не раньше ${minDate}`;
      if (maxDate && value > maxDate) return `Не позже ${maxDate}`;
      return true;
    };
  }

  if (pattern) {
    validate.pattern = (value) => {
      if (typeof value !== "string" || !value) return true;
      try {
        return new RegExp(pattern).test(value)
          ? true
          : field.rules.patternMessage || "Значение не соответствует формату";
      } catch {
        // Некорректное регулярное выражение в справочнике не должно ломать форму.
        return true;
      }
    };
  }

  if (field.type === "email") {
    validate.email = (value) =>
      typeof value === "string" && value && !EMAIL_PATTERN.test(value)
        ? "Некорректный адрес"
        : true;
  }

  if (field.type === "url") {
    validate.url = (value) =>
      typeof value === "string" && value && !URL_PATTERN.test(value)
        ? "Ссылка должна начинаться с http:// или https://"
        : true;
  }

  return validate;
};

/** Первое нарушенное правило поля или `null`, если значение допустимо. */
export const validateDynamicValue = (
  field: CustomField,
  value: unknown
): string | null => {
  for (const check of Object.values(dynamicFieldValidators(field))) {
    const result = check(value);
    if (result !== true) return result;
  }
  return null;
};

/** Те же правила, но в формате react-hook-form. */
type ControllerRules = Omit<
  RegisterOptions<EmployeeFormValues>,
  "disabled" | "valueAsNumber" | "valueAsDate" | "setValueAs"
>;

export const dynamicFieldRules = (field: CustomField): ControllerRules => {
  const validate = dynamicFieldValidators(field);
  return Object.keys(validate).length > 0 ? { validate } : {};
};

/** Значение поля по умолчанию — с оглядкой на тип. */
export const dynamicFieldDefault = (field: CustomField): unknown => {
  if (field.type === "boolean") return false;
  if (MULTI_TYPES.has(field.type)) {
    return field.defaultValue ? [field.defaultValue] : [];
  }
  return field.defaultValue ?? "";
};

const chipStyle = (active: boolean, color: string): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "8px 14px",
  fontSize: "14px",
  borderRadius: "10px",
  border: `1px solid ${active ? color || "#465FFF" : "#e2e8f0"}`,
  backgroundColor: active ? `${color || "#465FFF"}14` : "#fff",
  color: active ? color || "#465FFF" : "#475569",
  cursor: "pointer",
});

function OptionChips({
  field,
  multiple,
  value,
  onChange,
}: {
  field: CustomField;
  multiple: boolean;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const selected = Array.isArray(value)
    ? value.map(String)
    : typeof value === "string" && value
      ? [value]
      : [];

  const toggle = (optionValue: string) => {
    if (multiple) {
      onChange(
        selected.includes(optionValue)
          ? selected.filter((item) => item !== optionValue)
          : [...selected, optionValue]
      );
      return;
    }
    onChange(selected.includes(optionValue) ? "" : optionValue);
  };

  if (field.options.length === 0) {
    return <p style={{ fontSize: "13px", color: "#94a3b8" }}>Варианты не заданы</p>;
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
      {field.options.map((option) => (
        <button
          key={option.id}
          type="button"
          disabled={field.rules.readOnly}
          onClick={() => toggle(option.value)}
          style={chipStyle(selected.includes(option.value), option.color)}
        >
          <span
            style={{
              width: "10px",
              height: "10px",
              borderRadius: multiple ? "3px" : "50%",
              backgroundColor: selected.includes(option.value)
                ? option.color || "#465FFF"
                : "#cbd5e1",
            }}
          />
          {option.label}
        </button>
      ))}
    </div>
  );
}

function BooleanControl({
  brandColor,
  checked,
  onChange,
  disabled,
}: {
  brandColor: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        border: "none",
        background: "none",
        padding: 0,
        cursor: disabled ? "default" : "pointer",
      }}
    >
      <span
        style={{
          position: "relative",
          width: "40px",
          height: "22px",
          borderRadius: "999px",
          backgroundColor: checked ? brandColor : "#e2e8f0",
          transition: "background-color 0.15s",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: "3px",
            left: checked ? "21px" : "3px",
            width: "16px",
            height: "16px",
            borderRadius: "50%",
            backgroundColor: "#fff",
            transition: "left 0.15s",
          }}
        />
      </span>
      <span style={{ fontSize: "14px", color: "#475569" }}>{checked ? "Да" : "Нет"}</span>
    </button>
  );
}

/**
 * Контрол динамического поля как управляемый компонент — без привязки к
 * какой-либо форме. Так его переиспользуют и форма сотрудника (через
 * react-hook-form ниже), и модалка «Добавить должность» на обычном useState.
 */
export function DynamicFieldInput({
  field,
  value,
  onChange,
  onBlur,
  inputStyle,
  brandColor,
  invalid = false,
}: {
  field: CustomField;
  value: unknown;
  onChange: (next: unknown) => void;
  onBlur?: () => void;
  inputStyle: React.CSSProperties;
  brandColor: string;
  invalid?: boolean;
}) {
  const placeholder = field.placeholder || "Введите значение";
  const disabled = field.rules.readOnly;
  const style: React.CSSProperties = invalid
    ? { ...inputStyle, borderColor: "#f04438" }
    : inputStyle;
  const text = typeof value === "string" ? value : value == null ? "" : String(value);

  switch (field.type) {
    case "file":
      // Загрузки ещё нет — показываем заглушку, значение вводить нечем.
      return (
        <div
          style={{
            ...inputStyle,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            borderStyle: "dashed",
            backgroundColor: "#f8fafc",
            color: "#94a3b8",
          }}
        >
          <span>Загрузка файла</span>
          <span style={{ fontSize: "12px" }}>
            {field.rules.allowedExtensions.length > 0
              ? field.rules.allowedExtensions.join(", ").toUpperCase()
              : "Любой формат"}
            {field.rules.maxFileSizeMb ? ` · до ${field.rules.maxFileSizeMb} МБ` : ""}
          </span>
        </div>
      );

    case "textarea":
      return (
        <textarea
          rows={3}
          disabled={disabled}
          value={text}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          style={{ ...style, resize: "vertical", fontFamily: "inherit" }}
        />
      );

    case "boolean":
      return (
        <BooleanControl
          brandColor={brandColor}
          checked={Boolean(value)}
          disabled={disabled}
          onChange={onChange}
        />
      );

    case "radio":
      return <OptionChips field={field} multiple={false} value={value} onChange={onChange} />;

    case "multiselect":
    case "checkbox_group":
      return <OptionChips field={field} multiple value={value} onChange={onChange} />;

    case "select":
      return (
        <select
          disabled={disabled}
          value={text}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          style={{ ...style, appearance: "none", cursor: "pointer" }}
        >
          <option value="">{field.placeholder || "Выберите значение"}</option>
          {field.options.map((option) => (
            <option key={option.id} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );

    case "date":
    case "datetime":
      return (
        <input
          type={field.type === "date" ? "date" : "datetime-local"}
          disabled={disabled}
          value={text}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          min={field.rules.minDate || undefined}
          max={field.rules.maxDate || undefined}
          style={style}
        />
      );

    case "number":
    case "money":
      return (
        <input
          type="number"
          disabled={disabled}
          value={text}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          placeholder={field.placeholder || "0"}
          min={field.rules.min ?? undefined}
          max={field.rules.max ?? undefined}
          style={style}
        />
      );

    case "employee":
    case "directory":
      return (
        <input
          disabled={disabled}
          value={text}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          placeholder={
            field.placeholder ||
            (field.type === "employee" ? "Найдите сотрудника" : "Выберите из справочника")
          }
          style={style}
        />
      );

    default:
      return (
        <input
          type={field.type === "email" ? "email" : "text"}
          disabled={disabled}
          value={text}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          maxLength={field.rules.maxLength ?? undefined}
          style={style}
        />
      );
  }
}

/** Тот же контрол, но привязанный к react-hook-form формы сотрудника. */
export default function DynamicFieldControl({
  field,
  control,
  inputStyle,
  brandColor,
  invalid,
}: DynamicFieldControlProps) {
  // Заглушку к форме не привязываем: иначе required сделал бы форму
  // неотправляемой — заполнить поле нечем.
  if (UNSUPPORTED_TYPES.has(field.type)) {
    return (
      <DynamicFieldInput
        field={field}
        value=""
        onChange={() => {}}
        inputStyle={inputStyle}
        brandColor={brandColor}
      />
    );
  }

  return (
    <Controller
      control={control}
      name={`custom_data.${field.key}` as FieldPath<EmployeeFormValues>}
      rules={dynamicFieldRules(field)}
      render={({ field: controlled }) => (
        <DynamicFieldInput
          field={field}
          value={controlled.value}
          onChange={controlled.onChange}
          onBlur={controlled.onBlur}
          inputStyle={inputStyle}
          brandColor={brandColor}
          invalid={invalid}
        />
      )}
    />
  );
}
