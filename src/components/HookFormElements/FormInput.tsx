import { FC } from "react";
import { Controller, Control, FieldValues, Path } from "react-hook-form";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import { useTranslation } from "../../i18n";

interface FormInputProps<T extends FieldValues> {
  name: Path<T>;
  control: Control<T>;
  label?: string;
  type?: "text" | "number" | "email" | "password" | "date" | "time" | string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  min?: string;
  max?: string;
  step?: number;
}

const FormInput = <T extends FieldValues>({
  name,
  control,
  label,
  type = "text",
  placeholder,
  disabled = false,
  required = false,
  className = "",
  min,
  max,
  step,
}: FormInputProps<T>) => {
  const { t } = useTranslation();
  return (
    <Controller
      name={name}
      control={control}
      rules={{ required: required ? t("common.required_field") : false }}
      render={({ field, fieldState: { error } }) => (
        <div>
          {label && <Label htmlFor={name}>{label}</Label>}
          <Input
            type={type}
            id={name}
            name={name}
            placeholder={placeholder}
            value={field.value || ""}
            onChange={field.onChange}
            onBlur={field.onBlur}
            disabled={disabled}
            error={!!error}
            hint={error?.message}
            className={className}
            min={min}
            max={max}
            step={step}
          />
        </div>
      )}
    />
  );
};

export default FormInput;

