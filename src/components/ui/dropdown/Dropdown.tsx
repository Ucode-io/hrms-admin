import type React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface DropdownProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  usePortal?: boolean;
  anchorEl?: HTMLElement | null;
  portalOffset?: number;
}

export const Dropdown: React.FC<DropdownProps> = ({
  isOpen,
  onClose,
  children,
  className = "",
  usePortal = false,
  anchorEl = null,
  portalOffset = 8,
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [portalStyle, setPortalStyle] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest(".dropdown-toggle")
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  useLayoutEffect(() => {
    if (!isOpen || !usePortal || !anchorEl || !dropdownRef.current) {
      return;
    }

    const updatePosition = () => {
      if (!anchorEl || !dropdownRef.current) return;

      const anchorRect = anchorEl.getBoundingClientRect();
      const dropdownRect = dropdownRef.current.getBoundingClientRect();

      setPortalStyle({
        top: anchorRect.bottom + portalOffset,
        left: Math.max(8, anchorRect.right - dropdownRect.width),
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, usePortal, anchorEl, portalOffset]);

  if (!isOpen) return null;

  const content = (
    <div
      ref={dropdownRef}
      className={`${
        usePortal ? "fixed" : "absolute mt-2"
      } right-0 z-[9999] rounded-xl border border-gray-200 bg-white shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark ${className}`}
      style={
        usePortal
          ? {
              top: `${portalStyle.top}px`,
              left: `${portalStyle.left}px`,
            }
          : undefined
      }
    >
      {children}
    </div>
  );

  if (usePortal) {
    return createPortal(content, document.body);
  }

  return content;
};
