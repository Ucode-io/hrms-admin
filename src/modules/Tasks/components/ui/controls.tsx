import { forwardRef, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * `row`  — sidebar property control: invisible until hovered (Jira detail view).
 * `chip` — bordered pill used as a compact form control (Linear quick-create).
 */
export type ControlVariant = "row" | "chip";

interface ControlButtonProps {
  variant: ControlVariant;
  open?: boolean;
  /** Renders the label muted, like a placeholder. */
  muted?: boolean;
  /** Reserves room for the adjacent clear button. */
  hasClear?: boolean;
  active?: boolean;
  children: ReactNode;
  className?: string;
}

export const ControlButton = forwardRef<HTMLButtonElement, ControlButtonProps>(
  function ControlButton(
    { variant, open, muted, hasClear, active, children, className = "", ...rest },
    ref
  ) {
    const base =
      "inline-flex items-center gap-2 text-sm transition focus:outline-hidden disabled:opacity-50";

    const variantClass =
      variant === "row"
        ? `w-full min-h-9 rounded-lg px-2 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-white/10 ${
            open ? "bg-gray-100 ring-1 ring-brand-400 dark:bg-white/10" : ""
          }`
        : `h-9 rounded-lg border px-3 ${
            open
              ? "border-brand-400 bg-white ring-3 ring-brand-500/10 dark:bg-gray-900"
              : active
                ? "border-gray-300 bg-gray-50 hover:bg-gray-100 dark:border-gray-600 dark:bg-white/5 dark:hover:bg-white/10"
                : "border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-white/5"
          }`;

    return (
      <button
        ref={ref}
        type="button"
        {...rest}
        className={`${base} ${variantClass} ${hasClear ? "pr-7" : ""} ${
          muted ? "text-gray-400" : "text-gray-700 dark:text-gray-200"
        } ${className}`}
      >
        {children}
      </button>
    );
  }
);

export function ClearButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="absolute right-1.5 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 opacity-0 transition hover:bg-gray-200 hover:text-gray-600 focus:opacity-100 group-hover/field:opacity-100 dark:hover:bg-white/10"
    >
      <X size={13} />
    </button>
  );
}

/** Wraps a control so its clear button can sit on top of it. */
export function FieldSlot({ children }: { children: ReactNode }) {
  return <div className="group/field relative flex min-w-0 items-center">{children}</div>;
}

/** Label + control row in the detail sidebar. */
export function SidebarField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-9 items-center gap-2 py-0.5">
      <span className="w-[84px] shrink-0 text-theme-xs font-medium text-gray-400">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
