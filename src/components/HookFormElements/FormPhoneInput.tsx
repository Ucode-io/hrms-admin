import { FC } from "react";
import { Controller, Control, FieldValues, Path } from "react-hook-form";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import Label from "../form/Label";
import { useTranslation } from "../../i18n";

interface FormPhoneInputProps<T extends FieldValues> {
  name: Path<T>;
  control: Control<T>;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  defaultCountry?: string;
}

const FormPhoneInput = <T extends FieldValues>({
  name,
  control,
  label,
  placeholder,
  disabled = false,
  required = false,
  className = "",
  defaultCountry = "UZ",
}: FormPhoneInputProps<T>) => {
  const { t } = useTranslation();
  return (
    <Controller
      name={name}
      control={control}
      rules={{ required: required ? t("common.required_field") : false }}
      render={({ field, fieldState: { error } }) => (
        <div>
          {label && <Label htmlFor={name}>{label}</Label>}
          <div className="relative">
            <PhoneInput
              international
              defaultCountry={defaultCountry as any}
              placeholder={placeholder}
              disabled={disabled}
              value={field.value || ""}
              onChange={(value) => field.onChange(value || "")}
              onBlur={field.onBlur}
              className={`
                PhoneInput
                h-11 w-full rounded-lg border appearance-none px-4 py-2.5 text-sm shadow-theme-xs 
                placeholder:text-gray-400 focus:outline-hidden focus:ring-3 
                dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30
                ${
                  error
                    ? "border-error-500 focus:border-error-300 focus:ring-error-500/20 dark:text-error-400 dark:border-error-500 dark:focus:border-error-800"
                    : "bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white/90 dark:focus:border-brand-800"
                }
                ${disabled ? "opacity-50 cursor-not-allowed" : ""}
                ${className}
              `}
              numberInputProps={{
                className: `
                  PhoneInputInput
                  bg-transparent border-0 outline-none w-full text-sm
                  text-gray-800 dark:text-white/90
                  placeholder:text-gray-400 dark:placeholder:text-white/30
                `,
                onBlur: field.onBlur,
              }}
            />
          </div>
          {error && (
            <p className="mt-1.5 text-xs text-error-500">{error.message}</p>
          )}
        </div>
      )}
    />
  );
};

export default FormPhoneInput;

