import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HexColorPicker } from "react-colorful";

export const DEFAULT_COLOR_SWATCHES = [
  "#EF4444",
  "#F97316",
  "#F59E0B",
  "#EAB308",
  "#84CC16",
  "#22C55E",
  "#10B981",
  "#14B8A6",
  "#06B6D4",
  "#0EA5E9",
  "#3B82F6",
  "#6366F1",
  "#8B5CF6",
  "#A855F7",
  "#D946EF",
  "#EC4899",
  "#F43F5E",
  "#64748B",
];

export const normalizeHexColor = (
  value: string,
  fallback: string = DEFAULT_COLOR_SWATCHES[10]
): string => {
  const prepared = value.trim();
  return /^#[\da-fA-F]{6}$/.test(prepared) ? prepared : fallback;
};

type ColorPickerProps = {
  value: string;
  onChange: (value: string) => void;
  swatches?: string[];
  buttonClassName?: string;
};

export default function ColorPicker({
  value,
  onChange,
  swatches = DEFAULT_COLOR_SWATCHES,
  buttonClassName = "",
}: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const preparedColor = normalizeHexColor(value, swatches[0]);

  useLayoutEffect(() => {
    if (!isOpen || !buttonRef.current) return;

    const updatePosition = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownWidth = 260;
      const viewportWidth = window.innerWidth;
      const left = Math.min(
        Math.max(8, rect.left),
        viewportWidth - dropdownWidth - 8
      );

      setPosition({
        top: rect.bottom + 8,
        left,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedButton = buttonRef.current?.contains(target);
      const clickedDropdown = dropdownRef.current?.contains(target);
      if (!clickedButton && !clickedDropdown) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        ref={buttonRef}
        className={`flex h-10 w-full items-center justify-between rounded-lg border border-gray-300 px-3 text-sm text-gray-800 shadow-theme-xs transition hover:border-gray-400 ${buttonClassName}`}
      >
        <span className="inline-flex items-center gap-2">
          <span
            className="h-5 w-5 rounded-md border border-gray-200"
            style={{ backgroundColor: preparedColor }}
          />
          {preparedColor}
        </span>
        <span className="text-gray-400">▼</span>
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[100120] w-[260px] rounded-xl border border-gray-200 bg-white p-3 shadow-xl"
            style={{ top: position.top, left: position.left }}
          >
            <HexColorPicker
              color={preparedColor}
              onChange={(nextColor) => onChange(normalizeHexColor(nextColor, swatches[0]))}
              style={{ width: "100%", height: 160 }}
            />

            <div className="mt-3 grid grid-cols-6 gap-2">
              {swatches.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  className={`h-7 w-7 rounded-md border transition ${
                    preparedColor.toLowerCase() === swatch.toLowerCase()
                      ? "border-gray-900 ring-2 ring-gray-300"
                      : "border-gray-200 hover:scale-105"
                  }`}
                  style={{ backgroundColor: swatch }}
                  onClick={() => onChange(swatch)}
                  aria-label={`Выбрать цвет ${swatch}`}
                />
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
