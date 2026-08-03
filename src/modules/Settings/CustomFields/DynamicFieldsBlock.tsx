import { DynamicFieldInput } from "../../Employees/Form/layout/DynamicFieldControl";
import type { CustomField } from "./types";

/**
 * Блок динамических полей для форм на обычном `useState`. Ставится в конец
 * формы: раскладки для этих экранов нет, порядок — как в справочнике.
 *
 * Форма сотрудника и модалка должности этот блок не используют — там поля
 * расставляет конструктор раскладки.
 */

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  borderRadius: "8px",
  border: "1px solid #e2e8f0",
  backgroundColor: "#fff",
  padding: "9px 12px",
  fontSize: "13px",
  color: "#1e293b",
  outline: "none",
};

type DynamicFieldsBlockProps = {
  fields: CustomField[];
  values: Record<string, unknown>;
  errors: Record<string, string>;
  onChange: (key: string, value: unknown) => void;
  brandColor: string;
  /** Одна колонка — для узких модалок. */
  columns?: 1 | 2;
  inputStyle?: React.CSSProperties;
};

export default function DynamicFieldsBlock({
  fields,
  values,
  errors,
  onChange,
  brandColor,
  columns = 2,
  inputStyle = INPUT_STYLE,
}: DynamicFieldsBlockProps) {
  if (fields.length === 0) return null;

  return (
    <div
      className={`grid grid-cols-1 gap-4 ${columns === 2 ? "sm:grid-cols-2" : ""}`}
    >
      {fields.map((field) => {
        const error = errors[field.key];

        return (
          <div key={field.id}>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
              {field.label}
              {field.rules.required ? " *" : ""}
            </label>
            <DynamicFieldInput
              field={field}
              value={values[field.key]}
              onChange={(next) => onChange(field.key, next)}
              inputStyle={inputStyle}
              brandColor={brandColor}
              invalid={Boolean(error)}
            />
            {(error || field.hint) && (
              <p
                className="mt-1.5 text-[12px]"
                style={{ color: error ? "#f04438" : "#94a3b8" }}
              >
                {error || field.hint}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
