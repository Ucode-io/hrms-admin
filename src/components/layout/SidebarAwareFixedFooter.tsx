import { type CSSProperties, type ReactNode, useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { useSidebar } from "../../context/SidebarContext";
import { copilotStore } from "../../features/copilot";

interface SidebarAwareFixedFooterProps {
  children: ReactNode;
  zIndex?: number;
  contentStyle?: CSSProperties;
}

function SidebarAwareFixedFooter({
  children,
  zIndex = 45,
  contentStyle,
}: SidebarAwareFixedFooterProps) {
  const { isExpanded } = useSidebar();
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true
  );
  // The copilot dock only takes space from xl up; below that it is an overlay.
  const [isWide, setIsWide] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 1280 : true
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const wideQuery = window.matchMedia("(min-width: 1280px)");
    const handleChange = (event: MediaQueryListEvent) => {
      setIsDesktop(event.matches);
    };
    const handleWide = (event: MediaQueryListEvent) => {
      setIsWide(event.matches);
    };

    setIsDesktop(mediaQuery.matches);
    setIsWide(wideQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    wideQuery.addEventListener("change", handleWide);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
      wideQuery.removeEventListener("change", handleWide);
    };
  }, []);

  const leftOffset = isDesktop ? (isExpanded ? 290 : 90) : 0;
  // This bar is fixed to the viewport, so it does not know the dock exists and
  // would otherwise run underneath it — burying its own right-aligned controls.
  const rightOffset =
    isWide && copilotStore.isOpen && !copilotStore.isExpanded
      ? copilotStore.width
      : 0;

  return (
    <div
      style={{
        position: "fixed",
        left: `${leftOffset}px`,
        right: `${rightOffset}px`,
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

export default observer(SidebarAwareFixedFooter);
