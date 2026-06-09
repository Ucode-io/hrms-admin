import { useState } from "react";
import { X } from "lucide-react";

interface TagsInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  /** Force chips to uppercase (e.g. tech tags). */
  uppercase?: boolean;
}

export default function TagsInput({ value, onChange, placeholder, uppercase }: TagsInputProps) {
  const [input, setInput] = useState("");

  const add = (raw: string) => {
    const v = uppercase ? raw.trim().toUpperCase() : raw.trim();
    if (!v || value.includes(v)) return;
    onChange([...value, v]);
    setInput("");
  };

  const remove = (tag: string) => onChange(value.filter((t) => t !== tag));

  return (
    <div className="flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-2 py-1.5 transition focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100">
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-600"
        >
          {tag}
          <button type="button" onClick={() => remove(tag)} className="text-brand-400 hover:text-brand-600">
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(input);
          } else if (e.key === "Backspace" && !input && value.length) {
            remove(value[value.length - 1]);
          }
        }}
        onBlur={() => add(input)}
        placeholder={value.length === 0 ? placeholder : ""}
        className="h-7 min-w-[120px] flex-1 bg-transparent px-1 text-sm text-gray-800 outline-none placeholder:text-gray-400"
      />
    </div>
  );
}
