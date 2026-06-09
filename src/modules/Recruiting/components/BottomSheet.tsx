import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Leading element before the title (e.g. avatar / icon). */
  leading?: React.ReactNode;
  /** Actions rendered on the right side of the header. */
  headerActions?: React.ReactNode;
  /** Sticky footer content. */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

// A near full-screen sheet that slides up from the bottom — gives much more
// room than a side drawer, matching the reference candidate/vacancy views.
export default function BottomSheet({
  isOpen,
  onClose,
  title,
  subtitle,
  leading,
  headerActions,
  footer,
  children,
}: BottomSheetProps) {
  const [render, setRender] = useState(isOpen);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRender(true);
      const raf = requestAnimationFrame(() => setShow(true));
      return () => cancelAnimationFrame(raf);
    }
    setShow(false);
    const t = setTimeout(() => setRender(false), 260);
    return () => clearTimeout(t);
  }, [isOpen]);

  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (render) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [render]);

  if (!render) return null;

  return (
    <div className="fixed inset-0 z-99999">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-gray-900/40 backdrop-blur-[2px] transition-opacity duration-250 ${
          show ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Sheet */}
      <div
        className={`absolute inset-x-0 bottom-0 flex h-[95vh] flex-col rounded-t-3xl bg-gray-50 shadow-2xl transition-transform duration-300 ease-out ${
          show ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Grab handle */}
        <div className="flex justify-center pt-2.5">
          <span className="h-1.5 w-10 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {leading}
            <div className="min-w-0">
              {title && <div className="truncate text-lg font-semibold text-gray-900">{title}</div>}
              {subtitle && <div className="truncate text-sm text-gray-500">{subtitle}</div>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {headerActions}
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-400 transition hover:bg-gray-50 hover:text-gray-600"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1180px] px-6 py-6">{children}</div>
        </div>

        {/* Footer */}
        {footer && (
          <div className="border-t border-gray-200 bg-white px-6 py-3">
            <div className="mx-auto flex w-full max-w-[1180px] items-center gap-2">{footer}</div>
          </div>
        )}
      </div>
    </div>
  );
}
