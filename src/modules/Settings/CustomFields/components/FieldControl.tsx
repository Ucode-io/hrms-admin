import { useState } from "react";
import { CalendarDays, ChevronDown, CloudUpload, Search } from "lucide-react";

import type { CustomField } from "../types";
import { Toggle, inputClass, textareaClass } from "./Controls";
import { useTranslation } from "../../../../i18n";

function BooleanControl({ defaultChecked }: { defaultChecked: boolean }) {
  const { t } = useTranslation();
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <div className="flex h-11 items-center gap-3">
      <Toggle checked={checked} onChange={setChecked} size="sm" />
      <span className="text-sm text-gray-600">{checked ? t("settings_custom_fields.control.boolean_yes") : t("settings_custom_fields.control.boolean_no")}</span>
    </div>
  );
}

function OptionChips({
  field,
  multiple,
}: {
  field: CustomField;
  multiple: boolean;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string[]>(
    field.defaultValue ? [field.defaultValue] : []
  );

  const toggle = (value: string) => {
    setSelected((prev) => {
      if (multiple) {
        return prev.includes(value)
          ? prev.filter((item) => item !== value)
          : [...prev, value];
      }
      return prev.includes(value) ? [] : [value];
    });
  };

  return (
    <div className="flex flex-wrap gap-2 py-1.5">
      {field.options.map((option) => {
        const isActive = selected.includes(option.value);

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => toggle(option.value)}
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition"
            style={{
              borderColor: isActive ? option.color : "#e5e7eb",
              backgroundColor: isActive ? `${option.color}14` : "#fff",
              color: isActive ? option.color : "#475569",
            }}
          >
            <span
              className={`h-2.5 w-2.5 ${multiple ? "rounded-[4px]" : "rounded-full"}`}
              style={{ backgroundColor: isActive ? option.color : "#cbd5e1" }}
            />
            {option.label}
          </button>
        );
      })}
      {field.options.length === 0 && (
        <span className="text-sm text-gray-400">{t("settings_custom_fields.control.options_not_set")}</span>
      )}
    </div>
  );
}

/** Рендер одного поля «как в форме» — живой предпросмотр внутри редактора поля. */
export function FieldControl({ field }: { field: CustomField }) {
  const { t } = useTranslation();
  const disabled = field.rules.readOnly;
  const placeholder = field.placeholder || t("settings_custom_fields.control.enter_value");

  switch (field.type) {
    case "textarea":
      return (
        <textarea
          className={textareaClass}
          rows={3}
          disabled={disabled}
          defaultValue={field.defaultValue}
          placeholder={placeholder}
        />
      );

    case "boolean":
      return <BooleanControl defaultChecked={field.defaultValue === "true"} />;

    case "radio":
      return <OptionChips field={field} multiple={false} />;

    case "checkbox_group":
    case "multiselect":
      return <OptionChips field={field} multiple />;

    case "select":
      return (
        <div className="relative">
          <select
            className={`${inputClass} appearance-none pr-10`}
            disabled={disabled}
            defaultValue={field.defaultValue}
          >
            <option value="">{field.placeholder || t("settings_custom_fields.control.select_value")}</option>
            {field.options.map((option) => (
              <option key={option.id} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
        </div>
      );

    case "date":
    case "datetime":
      return (
        <div className="relative">
          <input
            type={field.type === "date" ? "date" : "datetime-local"}
            className={`${inputClass} pr-10`}
            disabled={disabled}
            min={field.rules.minDate || undefined}
            max={field.rules.maxDate || undefined}
          />
          <CalendarDays
            size={16}
            className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
        </div>
      );

    case "file":
      return (
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3">
          <CloudUpload size={18} className="text-gray-400" />
          <div className="min-w-0">
            <p className="text-sm text-gray-600">{t("settings_custom_fields.control.file_drop_hint")}</p>
            <p className="text-xs text-gray-400">
              {field.rules.allowedExtensions.length > 0
                ? field.rules.allowedExtensions.join(", ").toUpperCase()
                : t("settings_custom_fields.control.file_any_format")}
              {field.rules.maxFileSizeMb
                ? t("settings_custom_fields.control.file_max_size", { size: field.rules.maxFileSizeMb })
                : ""}
            </p>
          </div>
        </div>
      );

    case "employee":
    case "directory":
      return (
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            className={`${inputClass} pl-10`}
            disabled={disabled}
            placeholder={
              field.placeholder ||
              (field.type === "employee"
                ? t("settings_custom_fields.control.employee_placeholder")
                : t("settings_custom_fields.control.directory_placeholder"))
            }
          />
        </div>
      );

    case "number":
    case "money":
      return (
        <div className="relative">
          <input
            type="number"
            className={`${inputClass} ${field.type === "money" ? "pr-16" : ""}`}
            disabled={disabled}
            defaultValue={field.defaultValue}
            placeholder={field.placeholder || "0"}
          />
          {field.type === "money" && (
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">
              UZS
            </span>
          )}
        </div>
      );

    default:
      return (
        <input
          type={field.type === "email" ? "email" : "text"}
          className={inputClass}
          disabled={disabled}
          defaultValue={field.defaultValue}
          placeholder={placeholder}
        />
      );
  }
}
