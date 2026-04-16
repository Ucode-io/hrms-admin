import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";

interface ExpandableSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputId?: string;
  expandedWidth?: number;
  collapsedSize?: number;
  brandColor?: string;
}

export default function ExpandableSearchInput({
  value,
  onChange,
  placeholder = "Поиск",
  inputId,
  expandedWidth = 460,
  collapsedSize = 38,
  brandColor = "#2563eb",
}: ExpandableSearchInputProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const hasValue = useMemo(() => Boolean(value.trim()), [value]);
  const isOpen = isExpanded || hasValue;

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  return (
    <div
      style={{
        position: "relative",
        width: isOpen ? `${expandedWidth}px` : `${collapsedSize}px`,
        maxWidth: isOpen ? `${expandedWidth}px` : `${collapsedSize}px`,
        minWidth: isOpen ? `${expandedWidth}px` : `${collapsedSize}px`,
        transition: "width 0.18s ease, max-width 0.18s ease, min-width 0.18s ease",
      }}
    >
      {isOpen ? (
        <>
          <Search
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "18px",
              height: "18px",
              color: "#94a3b8",
              pointerEvents: "none",
            }}
          />
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            style={{
              width: "100%",
              height: `${collapsedSize}px`,
              paddingLeft: "40px",
              paddingRight: "14px",
              fontSize: "14px",
              border: `1px solid ${isFocused ? brandColor : "#e2e8f0"}`,
              borderRadius: "10px",
              outline: "none",
              color: "#1e293b",
              backgroundColor: "#fff",
              transition: "border-color 0.2s",
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              setIsFocused(false);
              if (!value.trim()) {
                setIsExpanded(false);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape" && !value.trim()) {
                setIsExpanded(false);
              }
            }}
          />
        </>
      ) : (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: `${collapsedSize}px`,
            height: `${collapsedSize}px`,
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            backgroundColor: "#fff",
            color: "#64748b",
            cursor: "pointer",
            transition: "all 0.15s",
          }}
          aria-label="Открыть поиск"
        >
          <Search style={{ width: "18px", height: "18px" }} />
        </button>
      )}
    </div>
  );
}
