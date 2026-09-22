import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "../../i18n";

// Parses a "YYYY-MM" key into a Date at the first day of that month.
// Falls back to the current month for empty/invalid input.
const parseMonthKey = (value: string): Date => {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month >= 1 && month <= 12) {
      return new Date(year, month - 1, 1);
    }
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

const toMonthKey = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const formatMonthLabel = (monthDate: Date, locale: string): string => {
  const formatted = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(monthDate);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

type MonthNavigatorProps = {
  /** Selected month as a "YYYY-MM" key. */
  value: string;
  /** Called with the new "YYYY-MM" key when the user steps months. */
  onChange: (monthKey: string) => void;
  /** Disables both stepper buttons. */
  disabled?: boolean;
  className?: string;
};

// Arrows + month label period picker, matching the /finance/salary control.
export default function MonthNavigator({
  value,
  onChange,
  disabled = false,
  className,
}: MonthNavigatorProps) {
  const { t, locale } = useTranslation();
  const current = parseMonthKey(value);

  const step = (delta: number) => {
    const next = new Date(current.getFullYear(), current.getMonth() + delta, 1);
    onChange(toMonthKey(next));
  };

  return (
    <div
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px",
        borderRadius: "12px",
        border: "1px solid #e2e8f0",
        backgroundColor: "#f8fafc",
        height: "38px",
      }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => step(-1)}
        className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-transparent text-slate-600 transition hover:border-slate-200 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={t("common.prev_month")}
      >
        <ChevronLeft size={16} />
      </button>
      <span className="min-w-[170px] px-3 text-center text-[13px] font-semibold text-slate-700">
        {formatMonthLabel(current, locale)}
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => step(1)}
        className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-transparent text-slate-600 transition hover:border-slate-200 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={t("common.next_month")}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
