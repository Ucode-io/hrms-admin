import { useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "../../../i18n";

export interface SelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  brandColor: string;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  brandColor,
}: SearchableSelectProps) {
  const { t } = useTranslation();
  placeholder ??= t("common.select_placeholder");
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedLabel = options.find((o) => o.value === value)?.label || "";

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = () => {
    setIsOpen(true);
    setSearch("");
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div
        style={{ position: "relative", cursor: "pointer" }}
        onClick={() => !isOpen && handleOpen()}
      >
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? search : selectedLabel}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={handleOpen}
          placeholder={isOpen ? t("common.search_placeholder") : placeholder}
          readOnly={!isOpen}
          style={{
            width: "100%",
            padding: "10px 36px 10px 14px",
            fontSize: "14px",
            border: `1px solid ${isOpen ? brandColor : "#e2e8f0"}`,
            borderRadius: "10px",
            outline: "none",
            color: isOpen ? "#1e293b" : value ? "#1e293b" : "#94a3b8",
            backgroundColor: "#fff",
            cursor: isOpen ? "text" : "pointer",
            transition: "border-color 0.2s",
            boxSizing: "border-box",
          }}
        />
        <ChevronDown
          style={{
            position: "absolute",
            right: "12px",
            top: "50%",
            transform: `translateY(-50%) rotate(${isOpen ? 180 : 0}deg)`,
            width: "16px",
            height: "16px",
            color: "#94a3b8",
            pointerEvents: "none",
            transition: "transform 0.2s",
          }}
        />
      </div>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            backgroundColor: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
            zIndex: 50,
            maxHeight: "220px",
            overflowY: "auto",
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: "16px", textAlign: "center", fontSize: "13px", color: "#94a3b8" }}>
              {t("common.no_options_found")}
            </div>
          ) : (
            filtered.map((opt) => (
              <div
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                style={{
                  padding: "9px 14px",
                  fontSize: "14px",
                  color: opt.value === value ? brandColor : "#1e293b",
                  backgroundColor: opt.value === value ? `${brandColor}08` : "transparent",
                  cursor: "pointer",
                  transition: "background-color 0.1s",
                  fontWeight: opt.value === value ? 500 : 400,
                }}
                onMouseEnter={(e) => {
                  if (opt.value !== value) e.currentTarget.style.backgroundColor = "#f8fafc";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = opt.value === value ? `${brandColor}08` : "transparent";
                }}
              >
                {opt.label}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
