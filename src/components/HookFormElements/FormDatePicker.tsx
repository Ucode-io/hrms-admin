import { useEffect, useRef } from "react";
import { Controller } from "react-hook-form";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.min.css";

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
  placeholder = "Выберите дату",
  required = false,
  disabled = false,
  minDate,
  maxDate,
}: FormDatePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Controller
      name={name}
      control={control}
      rules={{ required: required ? "Это поле обязательно" : undefined }}
      render={({ field, fieldState: { error } }) => {
        useEffect(() => {
          if (!inputRef.current) return;

          const fp = flatpickr(inputRef.current, {
            dateFormat: "Y-m-d",
            locale: {
              firstDayOfWeek: 1,
              weekdays: {
                shorthand: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"],
                longhand: [
                  "Воскресенье",
                  "Понедельник",
                  "Вторник",
                  "Среда",
                  "Четверг",
                  "Пятница",
                  "Суббота",
                ],
              },
              months: {
                shorthand: [
                  "Янв",
                  "Фев",
                  "Мар",
                  "Апр",
                  "Май",
                  "Июн",
                  "Июл",
                  "Авг",
                  "Сен",
                  "Окт",
                  "Ноя",
                  "Дек",
                ],
                longhand: [
                  "Январь",
                  "Февраль",
                  "Март",
                  "Апрель",
                  "Май",
                  "Июнь",
                  "Июль",
                  "Август",
                  "Сентябрь",
                  "Октябрь",
                  "Ноябрь",
                  "Декабрь",
                ],
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
        }, [field.value, minDate, maxDate]);

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
