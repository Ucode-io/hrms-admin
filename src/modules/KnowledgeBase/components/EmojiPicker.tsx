// Emoji picker — a button showing the current emoji that opens the full
// Unicode set (with search) via the emoji-picker-element web component.

import { useEffect, useRef, useState } from "react";
import "emoji-picker-element";

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
  /** Tailwind text-size class for the trigger, e.g. "text-5xl". */
  size?: string;
  disabled?: boolean;
}

export default function EmojiPicker({
  value,
  onChange,
  size = "text-2xl",
  disabled = false,
}: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  // Callers pass an inline arrow; keep it out of the mount effect's deps so
  // the picker isn't rebuilt (losing the search input) on every parent render.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // The web component lives outside React's tree, so mount it by hand and
  // listen for its custom `emoji-click` event.
  useEffect(() => {
    const host = pickerRef.current;
    if (!open || !host) return;
    const picker = document.createElement("emoji-picker");
    // The element follows prefers-color-scheme by default; the admin panel is
    // light-only, so pin it instead of going dark on dark-mode systems.
    picker.classList.add("light");
    picker.style.setProperty("--num-columns", "8");
    picker.style.height = "22rem";
    const onPick = (e: Event) => {
      onChangeRef.current((e as CustomEvent).detail.unicode);
      setOpen(false);
    };
    picker.addEventListener("emoji-click", onPick);
    host.appendChild(picker);
    return () => {
      picker.removeEventListener("emoji-click", onPick);
      picker.remove();
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center justify-center rounded-lg leading-none transition-colors hover:bg-gray-100 ${size} ${
          disabled ? "cursor-default" : "cursor-pointer"
        }`}
        style={{ width: "1.4em", height: "1.4em" }}
      >
        {value || "📄"}
      </button>
      {open && (
        <div
          ref={pickerRef}
          className="absolute left-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-gray-200 shadow-lg"
        />
      )}
    </div>
  );
}
