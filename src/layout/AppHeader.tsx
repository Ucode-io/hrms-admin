import { useMemo } from "react";
import { useLocation } from "react-router";
import { useSidebar } from "../context/SidebarContext";
import UserDropdown from "../components/header/UserDropdown";
import companyStore from "../store/company.store";
import { observer } from "mobx-react-lite";
import { Bell, Menu, X } from "lucide-react";

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Главная страница",
  employees: "Сотрудники",
  organization: "Организация",
  reports: "Отчеты",
  settings: "Настройки",
  finance: "Финансы",
  time: "Время",
  calendar: "Календарь",
  clients: "Клиенты",
  contracts: "Договоры",
  products: "Продукты",
  merchants: "Партнеры",
  notifications: "Уведомления",
  news: "Новости",
};

const formatSegment = (segment: string) =>
  segment
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const normalizeSegmentLabel = (segment: string) => {
  if (segment === "new") return "Создание";
  if (segment === "edit") return "Редактирование";
  if (/^[0-9a-f-]{6,}$/i.test(segment)) return "Детали";
  return SEGMENT_LABELS[segment] || formatSegment(segment);
};

const buildHeaderBreadcrumbs = (pathname: string) => {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return ["Главная страница"];

  if (segments[0] === "employees") {
    const tail = segments.slice(1).map(normalizeSegmentLabel);
    return ["Люди", "Сотрудники", ...tail];
  }

  return segments.map(normalizeSegmentLabel);
};

const AppHeader: React.FC = () => {
  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const location = useLocation();

  const handleToggle = () => {
    if (window.innerWidth >= 1024) {
      toggleSidebar();
    } else {
      toggleMobileSidebar();
    }
  };

  const breadcrumbs = useMemo(() => {
    return buildHeaderBreadcrumbs(location.pathname);
  }, [location.pathname]);

  return (
    <header className="sticky top-0 flex items-center justify-between w-full h-16 bg-white border-b border-gray-200 px-4 lg:px-6 z-40">
      <div className="flex items-center gap-3 min-w-0">
        <button
          className="flex items-center justify-center w-10 h-10 text-gray-500 rounded-lg hover:bg-gray-100 lg:hidden transition-colors"
          onClick={handleToggle}
          aria-label="Toggle Sidebar"
        >
          {isMobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        <a href="/dashboard" className="lg:hidden">
          <img
            src={companyStore.logo}
            alt={companyStore.companyName}
            className="h-8 w-8 object-contain"
          />
        </a>

        <div className="hidden lg:flex min-w-0 items-center">
          <div className="inline-flex min-w-0 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm">
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <div key={`${crumb}-${index}`} className="inline-flex min-w-0 items-center gap-2">
                  <span
                    className={`truncate ${isLast ? "font-semibold text-gray-800" : "font-medium text-gray-500"}`}
                  >
                    {crumb}
                  </span>
                  {!isLast ? <span className="text-gray-400">›</span> : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 shadow-sm"
          aria-label="Уведомления"
        >
          <Bell size={18} />
        </button>

        <UserDropdown />
      </div>
    </header>
  );
};

export default observer(AppHeader);
