import type { ReactNode } from "react";

type ToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  /** Подсказка при наведении — что именно включает переключатель. */
  title?: string;
};

export function Toggle({
  checked,
  onChange,
  disabled = false,
  size = "md",
  title,
}: ToggleProps) {
  const track = size === "sm" ? "h-5 w-9" : "h-6 w-11";
  const knob = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const shift = size === "sm" ? "translate-x-4" : "translate-x-5";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      title={title}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative shrink-0 rounded-full transition ${track} ${
        checked ? "bg-brand-500" : "bg-gray-200"
      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    >
      <span
        className={`absolute left-0.5 top-0.5 rounded-full bg-white shadow-theme-xs transition-transform ${knob} ${
          checked ? shift : "translate-x-0"
        }`}
      />
    </button>
  );
}

type ToggleRowProps = {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

export function ToggleRow({
  title,
  description,
  checked,
  onChange,
  disabled,
}: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 px-3.5 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800">{title}</p>
        {description && (
          <p className="mt-0.5 text-xs text-gray-500">{description}</p>
        )}
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} size="sm" />
    </div>
  );
}

type FieldRowProps = {
  label: string;
  hint?: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: ReactNode;
};

export function FormRow({
  label,
  hint,
  required,
  error,
  className = "",
  children,
}: FieldRowProps) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-error-500">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-error-500">{error}</p>
      ) : (
        hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>
      )}
    </div>
  );
}

export const inputClass =
  "h-11 w-full rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400";

/** Компактный инпут для плотных строк (варианты списка) — без w-full/h-11. */
export const compactInputClass =
  "h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10";

export const textareaClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10";

type SegmentedProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: ReactNode }[];
  disabled?: boolean;
};

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  disabled,
}: SegmentedProps<T>) {
  return (
    <div className="inline-flex w-full items-center gap-1 rounded-lg bg-gray-100 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition ${
            value === option.value
              ? "bg-white text-gray-900 shadow-theme-xs"
              : "text-gray-500 hover:text-gray-700"
          } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

type SectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function EditorSection({ title, description, children }: SectionProps) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {description && (
          <p className="mt-0.5 text-xs text-gray-500">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}
