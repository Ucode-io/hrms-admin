import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useEffect } from "react";
import { useLocation } from "react-router";

type BreadcrumbLabelsMap = Record<string, string>;
type BreadcrumbItemsMap = Record<string, HeaderBreadcrumbItem[]>;

export type HeaderBreadcrumbItem = {
  label: string;
  to: string;
};

type HeaderBreadcrumbContextType = {
  getBreadcrumbLabel: (path: string) => string | undefined;
  setBreadcrumbLabel: (path: string, label: string) => void;
  clearBreadcrumbLabel: (path: string) => void;
  getBreadcrumbItems: (path: string) => HeaderBreadcrumbItem[] | undefined;
  setBreadcrumbItems: (path: string, items: HeaderBreadcrumbItem[]) => void;
  clearBreadcrumbItems: (path: string) => void;
};

const HeaderBreadcrumbContext = createContext<HeaderBreadcrumbContextType | undefined>(undefined);

export const HeaderBreadcrumbProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [labelsByPath, setLabelsByPath] = useState<BreadcrumbLabelsMap>({});
  const [itemsByPath, setItemsByPath] = useState<BreadcrumbItemsMap>({});

  const getBreadcrumbLabel = useCallback(
    (path: string) => labelsByPath[path],
    [labelsByPath]
  );

  const setBreadcrumbLabel = useCallback((path: string, label: string) => {
    if (!path || !label) return;
    setLabelsByPath((prev) => {
      if (prev[path] === label) return prev;
      return { ...prev, [path]: label };
    });
  }, []);

  const clearBreadcrumbLabel = useCallback((path: string) => {
    if (!path) return;
    setLabelsByPath((prev) => {
      if (!(path in prev)) return prev;
      const next = { ...prev };
      delete next[path];
      return next;
    });
  }, []);

  const getBreadcrumbItems = useCallback(
    (path: string) => itemsByPath[path],
    [itemsByPath]
  );

  const setBreadcrumbItems = useCallback((path: string, items: HeaderBreadcrumbItem[]) => {
    if (!path || items.length === 0) return;
    setItemsByPath((prev) => {
      const prevItems = prev[path];
      const same =
        Array.isArray(prevItems) &&
        prevItems.length === items.length &&
        prevItems.every((item, index) => item.label === items[index].label && item.to === items[index].to);
      if (same) return prev;
      return { ...prev, [path]: items };
    });
  }, []);

  const clearBreadcrumbItems = useCallback((path: string) => {
    if (!path) return;
    setItemsByPath((prev) => {
      if (!(path in prev)) return prev;
      const next = { ...prev };
      delete next[path];
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      getBreadcrumbLabel,
      setBreadcrumbLabel,
      clearBreadcrumbLabel,
      getBreadcrumbItems,
      setBreadcrumbItems,
      clearBreadcrumbItems,
    }),
    [
      clearBreadcrumbItems,
      clearBreadcrumbLabel,
      getBreadcrumbItems,
      getBreadcrumbLabel,
      setBreadcrumbItems,
      setBreadcrumbLabel,
    ]
  );

  return <HeaderBreadcrumbContext.Provider value={value}>{children}</HeaderBreadcrumbContext.Provider>;
};

export const useHeaderBreadcrumb = () => {
  const context = useContext(HeaderBreadcrumbContext);
  if (!context) {
    throw new Error("useHeaderBreadcrumb must be used within a HeaderBreadcrumbProvider");
  }
  return context;
};

export const useHeaderBreadcrumbLabel = (label: string | null | undefined, targetPath?: string) => {
  const location = useLocation();
  const { setBreadcrumbLabel, clearBreadcrumbLabel } = useHeaderBreadcrumb();
  const path = targetPath || location.pathname;
  const normalizedLabel = (label || "").trim();

  useEffect(() => {
    if (!normalizedLabel) {
      clearBreadcrumbLabel(path);
      return;
    }

    setBreadcrumbLabel(path, normalizedLabel);
    return () => {
      clearBreadcrumbLabel(path);
    };
  }, [clearBreadcrumbLabel, normalizedLabel, path, setBreadcrumbLabel]);
};

export const useHeaderBreadcrumbItems = (items: HeaderBreadcrumbItem[], targetPath?: string) => {
  const location = useLocation();
  const { setBreadcrumbItems, clearBreadcrumbItems } = useHeaderBreadcrumb();
  const path = targetPath || location.pathname;

  useEffect(() => {
    if (!Array.isArray(items) || items.length === 0) {
      clearBreadcrumbItems(path);
      return;
    }

    setBreadcrumbItems(path, items);
    return () => {
      clearBreadcrumbItems(path);
    };
  }, [clearBreadcrumbItems, items, path, setBreadcrumbItems]);
};
