import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Calendar } from "lucide-react";

interface FormDatePickerProps {
  /** ISO date string (yyyy-MM-dd) or null. */
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

const toIso = (date: Date | null): string | null => {
  if (!date) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
};

const fromIso = (value: string | null): Date | null => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export default function FormDatePicker({
  value,
  onChange,
  placeholder = "дд.мм.гггг",
  disabled = false,
}: FormDatePickerProps) {
  return (
    <div className="relative">
      <DatePicker
        selected={fromIso(value)}
        onChange={(date) => onChange(toIso(date as Date | null))}
        dateFormat="dd.MM.yyyy"
        placeholderText={placeholder}
        disabled={disabled}
        isClearable={!disabled}
        showPopperArrow={false}
        wrapperClassName="w-full"
        className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 pr-10 text-sm text-gray-800 transition placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
      <Calendar
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
      />
    </div>
  );
}
