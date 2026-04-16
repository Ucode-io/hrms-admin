import { type CSSProperties, type ReactNode, useEffect, useState } from "react";
import { useSidebar } from "../../context/SidebarContext";

interface SidebarAwareFixedFooterProps {
  children: ReactNode;
  zIndex?: number;
  contentStyle?: CSSProperties;
}

export default function SidebarAwareFixedFooter({
  children,
  zIndex = 45,
  contentStyle,
}: SidebarAwareFixedFooterProps) {
  const { isExpanded } = useSidebar();
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const handleChange = (event: MediaQueryListEvent) => {
      setIsDesktop(event.matches);
    };

    setIsDesktop(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  const leftOffset = isDesktop ? (isExpanded ? 290 : 90) : 0;

  return (
    <div
      style={{
        position: "fixed",
        left: `${leftOffset}px`,
        right: 0,
        bottom: 0,
        zIndex,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          flexWrap: "wrap",
          width: "100%",
          padding: "10px 16px",
          borderTop: "1px solid #e2e8f0",
          backgroundColor: "rgba(255, 255, 255, 0.98)",
          backdropFilter: "blur(6px)",
          boxShadow: "0 -8px 20px rgba(2, 6, 23, 0.06)",
          ...contentStyle,
        }}
      >
        {children}
      </div>
    </div>
  );
}
