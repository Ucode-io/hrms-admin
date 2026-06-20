// Minimal emoji picker — a button showing the current emoji that opens a small
// preset grid. Enough for a Notion-like page icon without extra dependencies.

import { useEffect, useRef, useState } from "react";

const PRESET_EMOJIS = [
  // Документы и файлы
  "📄", "📃", "📑", "📊", "📈", "📉", "🗂️", "📂", "📁", "🗃️",
  "🗄️", "📋", "📝", "✏️", "🖊️", "🖋️", "✒️", "📌", "📍", "🔖",
  "🏷️", "📎", "🖇️", "📒", "📓", "📔", "📕", "📗", "📘", "📙",
  "📚", "📖", "📰", "🗞️", "📜", "🧾", "📅", "📆", "🗓️", "📇",
  "🗒️",
  // Идеи, цели, работа
  "💡", "🎯", "🚀", "⭐", "🌟", "✨", "🔥", "⚡", "💥", "🎉",
  "🎊", "🏆", "🏅", "🥇", "🎖️", "🏁", "🚩", "🧭", "🗺️", "⚙️",
  "🛠️", "🔧", "🔨", "🧰", "⚖️", "🔗", "🧩", "🧱", "📦", "🎁",
  // Люди и роли
  "🧑‍💼", "👩‍💼", "👨‍💼", "🧑‍💻", "👩‍💻", "👨‍💻", "🧑‍🏫", "👥", "🤝", "👋",
  "🙌", "👏", "🫱", "🧑‍🔧", "🧑‍🍳", "🧑‍⚕️", "🦸", "🧙",
  // Безопасность и связь
  "🔐", "🔒", "🔓", "🔑", "🗝️", "🛡️", "🚨", "⚠️", "📢", "📣",
  "🔔", "📞", "📱", "💬", "📧", "✉️", "📨", "📤", "📥", "🔍",
  "🔎",
  // Устройства и интерфейс
  "💻", "🖥️", "⌨️", "🖱️", "🖨️", "💾", "💿", "🗜️", "🔌", "🔋",
  "🌐", "🛰️", "📡", "🧮", "🕹️",
  // Статусы и символы
  "✅", "☑️", "✔️", "❌", "⛔", "🚫", "❓", "❗", "➕", "➖",
  "♻️", "🔄", "🔁", "🆕", "🆗", "🆙", "🔝", "💯", "❤️", "💙",
  "💚", "💛", "🧡", "💜", "🖤", "🤍",
  // Природа и прочее
  "🌍", "🌎", "🌏", "☀️", "⛅", "🌈", "🏖️", "🌱", "🌳", "🍀",
  "☕", "🍕", "🎨", "🎵", "🧠", "👀", "🦷", "🩺",
];

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

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
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
        <div className="absolute left-0 top-full z-50 mt-1 grid max-h-64 w-64 grid-cols-8 gap-1 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
          {PRESET_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onChange(emoji);
                setOpen(false);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md text-lg hover:bg-gray-100"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
