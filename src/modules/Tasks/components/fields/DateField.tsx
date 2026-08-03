import { useState } from "react";
import DatePicker, { registerLocale } from "react-datepicker";
import { ru } from "date-fns/locale/ru";
import "react-datepicker/dist/react-datepicker.css";
import { CalendarDays } from "lucide-react";
import Popover from "../ui/Popover";
import { ClearButton, ControlButton, FieldSlot, type ControlVariant } from "../ui/controls";

registerLocale("ru", ru);

const toIso = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

const fromIso = (value: string | null): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** "5 авг." for the current year, "5 авг. 2027" otherwise. */
const formatShort = (value: string): string => {
  const date = fromIso(value);
  if (!date) return "—";
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
};

const shiftDays = (days: number): string => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return toIso(date);
};

const PRESETS: { label: string; days: number }[] = [
  { label: "Сегодня", days: 0 },
  { label: "Завтра", days: 1 },
  { label: "Через неделю", days: 7 },
];

interface DateFieldProps {
  value: string | null;
  onChange: (value: string | null) => void;
  variant: ControlVariant;
  placeholder: string;
  /** Paints the value red — used for a passed due date. */
  overdue?: boolean;
}

export default function DateField({
  value,
  onChange,
  variant,
  placeholder,
  overdue,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);

  const set = (next: string | null, close: () => void) => {
    onChange(next);
    close();
  };

  return (
    <FieldSlot>
      <Popover
        open={open}
        onOpenChange={setOpen}
        content={({ close }) => (
          <div className="flex flex-col">
            <div className="flex flex-wrap gap-1 border-b border-gray-100 p-2 dark:border-gray-800">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => set(shiftDays(preset.days), close)}
                  className="rounded-lg px-2.5 py-1.5 text-theme-xs font-medium text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="tasks-calendar p-1">
              <DatePicker
                selected={fromIso(value)}
                onChange={(date: Date | null) => set(date ? toIso(date) : null, close)}
                locale="ru"
                inline
                calendarStartDay={1}
              />
            </div>

            {value && (
              <button
                type="button"
                onClick={() => set(null, close)}
                className="border-t border-gray-100 px-3 py-2.5 text-left text-sm text-gray-500 transition hover:bg-gray-50 hover:text-error-600 dark:border-gray-800 dark:hover:bg-white/5"
              >
                Очистить дату
              </button>
            )}
          </div>
        )}
      >
        {({ ref, props }) => (
          <ControlButton
            ref={ref}
            variant={variant}
            open={open}
            active={Boolean(value)}
            muted={!value}
            hasClear={Boolean(value)}
            {...props}
          >
            <CalendarDays size={15} className="shrink-0 text-gray-400" />
            <span
              className={`min-w-0 flex-1 truncate text-left ${
                value && overdue ? "font-medium text-error-600" : ""
              }`}
            >
              {value ? formatShort(value) : placeholder}
            </span>
          </ControlButton>
        )}
      </Popover>
      {value && <ClearButton onClick={() => onChange(null)} label="Очистить дату" />}
    </FieldSlot>
  );
}
