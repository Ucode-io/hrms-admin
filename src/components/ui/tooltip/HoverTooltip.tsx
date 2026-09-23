import { useCallback, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Кастомный тултип: показывается сразу при наведении и не обрезается
// контейнером с overflow (рендерится в body через портал).
const HoverTooltip = ({
  text,
  children,
  align = "center",
}: {
  text: string;
  children: ReactNode;
  // "end" — правый край тултипа по правому краю якоря: для якорей у правого края экрана.
  align?: "center" | "end";
}) => {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [coords, setCoords] = useState<{ left?: number; right?: number; top: number } | null>(null);

  const show = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // "end" задаём через right, а не left + translateX(-100%): у fixed-элемента ширина
    // считается от места справа от left, и у правого края экрана текст сжимается в столбик.
    setCoords(align === "end"
      ? { right: window.innerWidth - rect.right, top: rect.bottom + 8 }
      : { left: rect.left + rect.width / 2, top: rect.bottom + 8 });
  }, [align]);

  const hide = useCallback(() => setCoords(null), []);

  return (
    <span
      ref={anchorRef}
      className="inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {coords && text
        ? createPortal(
            <span
              role="tooltip"
              style={{
                position: "fixed",
                left: coords.left,
                right: coords.right,
                top: coords.top,
                transform: align === "end" ? undefined : "translateX(-50%)",
                zIndex: 70,
              }}
              className="pointer-events-none max-w-xs whitespace-normal rounded-lg bg-slate-800 px-2.5 py-1.5 text-[12px] font-medium leading-snug text-white shadow-lg"
            >
              {text}
            </span>,
            document.body
          )
        : null}
    </span>
  );
};

export default HoverTooltip;
