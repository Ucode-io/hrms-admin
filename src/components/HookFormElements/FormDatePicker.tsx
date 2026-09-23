import { useEffect, useRef } from "react";
import { Controller } from "react-hook-form";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.min.css";
import { useTranslation, monthNames, weekdayNames } from "../../i18n";

interface FormDatePickerProps {
  name: string;
  control: any;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
}

export default function FormDatePicker({
  name,
  control,
  label,
  placeholder,
  required = false,
  disabled = false,
  minDate,
  maxDate,
}: FormDatePickerProps) {
  const { t, locale } = useTranslation();
  placeholder ??= t("common.select_date");
  const weekdaysLong = weekdayNames(locale, "long");
  const weekdaysShort = weekdayNames(locale, "short");
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Controller
      name={name}
      control={control}
      rules={{ required: required ? t("common.required_field") : undefined }}
      render={({ field, fieldState: { error } }) => {
        useEffect(() => {
          if (!inputRef.current) return;

          const fp = flatpickr(inputRef.current, {
            dateFormat: "Y-m-d",
            locale: {
              firstDayOfWeek: 1,
              weekdays: {
                // flatpickr ждёт неделю с воскресенья, а weekdayNames — с понедельника.
                shorthand: [weekdaysShort[6], ...weekdaysShort.slice(0, 6)] as never,
                longhand: [weekdaysLong[6], ...weekdaysLong.slice(0, 6)] as never,
              },
              months: {
                shorthand: monthNames(locale, "short") as never,
                longhand: monthNames(locale, "long") as never,
              },
            },
            minDate: minDate,
            maxDate: maxDate,
            onChange: (selectedDates) => {
              if (selectedDates && selectedDates[0]) {
                const date = selectedDates[0];
                const formattedDate = date.toISOString().split("T")[0];
                field.onChange(formattedDate);
              }
            },
          });

          if (field.value) {
            fp.setDate(field.value, false);
          }

          return () => {
            fp.destroy();
          };
        }, [field.value, minDate, maxDate, locale]);

        return (
          <div className="w-full">
            {label && (
              <label
                htmlFor={name}
                className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {label}
              </label>
            )}
            <input
              ref={inputRef}
              type="text"
              id={name}
              placeholder={placeholder}
              disabled={disabled}
              className={`w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition-all ${error
                  ? "border-error-500 focus:border-error-500 focus:ring-2 focus:ring-error-100 dark:focus:ring-error-500/20"
                  : "border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-gray-700 dark:focus:border-brand-500 dark:focus:ring-brand-500/20"
                } bg-white dark:bg-gray-800 text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 disabled:cursor-not-allowed disabled:opacity-50`}
            />
            {error && (
              <p className="mt-1 text-xs text-error-500">{error.message}</p>
            )}
          </div>
        );
      }}
    />
  );
}
