import { FC } from "react";
import { Controller, Control, FieldValues, Path } from "react-hook-form";
import Label from "../form/Label";

interface Option {
  value: string;
  label: string;
}

interface FormSelectProps<T extends FieldValues> {
  name: Path<T>;
  control: Control<T>;
  label?: string;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

const FormSelect = <T extends FieldValues>({
  name,
  control,
  label,
  options,
  placeholder,
  disabled = false,
  required = false,
  className = "",
}: FormSelectProps<T>) => {
  return (
    <Controller
      name={name}
      control={control}
      rules={{ required: required ? "Это поле обязательно" : false }}
      render={({ field, fieldState: { error } }) => (
        <div>
          {label && <Label htmlFor={name}>{label}</Label>}
          <select
            {...field}
            id={name}
            disabled={disabled}
            className={`h-11 w-full appearance-none rounded-lg border px-4 py-2.5 pr-11 text-sm shadow-theme-xs focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90 ${
              error
                ? "border-error-500 focus:border-error-300 focus:ring-error-500/20 dark:text-error-400 dark:border-error-500 dark:focus:border-error-800"
                : "bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white/90 dark:focus:border-brand-800"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {error && (
            <p className="mt-1.5 text-xs text-error-500">{error.message}</p>
          )}
        </div>
      )}
    />
  );
};

export default FormSelect;

