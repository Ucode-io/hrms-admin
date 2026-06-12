import { useCallback } from "react";
import { Link, useLocation } from "react-router";
import {
  BarChart3,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  FileText,
  Home,
  ListChecks,
  Package,
  Settings,
  Target,
  UserRoundCheck,
  UserSearch,
  Users,
  WalletCards,
} from "lucide-react";
import { useSidebar } from "../context/SidebarContext";
import companyStore from "../store/company.store";
import { observer } from "mobx-react-lite";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path: string;
  badge?: number;
};

type ModuleSection = {
  title: string;
  items: { name: string; path: string; icon: React.ReactNode }[];
};

const mainNavItems: NavItem[] = [
  { icon: <Home size={20} />, name: "Главная страница", path: "/dashboard" },
];

const moduleSections: ModuleSection[] = [
  {
    title: "Задачи и KPI",
    items: [{ name: "KPI", path: "/kpi", icon: <Target size={18} /> }],
  },
  {
    title: "Люди",
    items: [
      { name: "Сотрудники", path: "/employees", icon: <UserRoundCheck size={18} /> },
    ],
  },
  {
    title: "Рекрутинг",
    items: [
      { name: "Вакансии", path: "/recruiting/vacancies", icon: <UserSearch size={18} /> },
      { name: "Кандидаты", path: "/recruiting/candidates", icon: <Users size={18} /> },
      { name: "Шаблоны этапов", path: "/recruiting/settings/stage-templates", icon: <ListChecks size={18} /> },
    ],
  },
  {
    title: "Время",
    items: [{ name: "Посешаемость", path: "/time", icon: <CalendarCheck size={18} /> }],
  },
  {
    title: "Документы",
    items: [
      { name: "Документы", path: "/documents", icon: <FileText size={18} /> },
      { name: "Имущество", path: "/property", icon: <Package size={18} /> },
    ],
  },
  {
    title: "Финансы",
    items: [{ name: "Зарплата", path: "/finance/salary", icon: <WalletCards size={18} /> }],
  },
  {
    title: "Система",
    items: [
      { name: "Отчеты", path: "/reports", icon: <BarChart3 size={18} /> },
      { name: "Настройки", path: "/settings", icon: <Settings size={18} /> },
    ],
  },
];

const ENABLED_PATHS = new Set([
  "/dashboard",
  "/employees",
  "/recruiting/vacancies",
  "/recruiting/candidates",
  "/recruiting/settings/stage-templates",
  "/documents",
  "/property",
  "/reports",
  "/time",
  "/time/attendance",
  "/reports/attendance",
  "/reports/absence-balance",
  "/calendar",
  "/finance/salary",
  "/kpi",
  "/settings",
  "/settings/compensation",
  "/settings/news",
]);

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, toggleSidebar } = useSidebar();
  const location = useLocation();

  const sidebarOpen = isExpanded || isMobileOpen;

  const isActive = useCallback(
    (path: string) => {
      if (path === "/") return location.pathname === "/";
      return (
        location.pathname === path ||
        location.pathname.startsWith(path + "/")
      );
    },
    [location.pathname]
  );

  const isPathEnabled = useCallback((path?: string) => {
    if (!path) return false;
    return ENABLED_PATHS.has(path);
  }, []);

  const renderNavItem = (nav: NavItem) => {
    const isNavEnabled = isPathEnabled(nav.path);
    return (
      <li key={nav.path}>
        {nav.path && isNavEnabled ? (
          <Link
            to={nav.path}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors
              ${
                isActive(nav.path)
                  ? "bg-brand-50 text-brand-500"
                  : "text-gray-700 hover:bg-gray-100"
              }
              ${!sidebarOpen ? "justify-center" : ""}
            `}
          >
            <span
              className={`shrink-0 ${isActive(nav.path) ? "text-brand-500" : "text-gray-500"}`}
            >
              {nav.icon}
            </span>
            {sidebarOpen && <span className="flex-1">{nav.name}</span>}
            {sidebarOpen && nav.badge && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-md bg-error-500 px-1.5 text-xs font-semibold text-white">
                {nav.badge}
              </span>
            )}
          </Link>
        ) : (
          <div
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-400
              ${!sidebarOpen ? "justify-center" : ""}`}
          >
            <span className="shrink-0 text-gray-300">{nav.icon}</span>
            {sidebarOpen && <span className="flex-1">{nav.name}</span>}
            {sidebarOpen && nav.badge && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-md bg-gray-200 px-1.5 text-xs font-semibold text-gray-500">
                {nav.badge}
              </span>
            )}
          </div>
        )}
      </li>
    );
  };

  const renderSectionItem = (item: { name: string; path: string; icon: React.ReactNode }) => {
    const isItemEnabled = isPathEnabled(item.path);
    if (isItemEnabled) {
      return (
        <Link
          to={item.path}
          className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
            isActive(item.path)
              ? "bg-brand-50 font-medium text-brand-500"
              : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
          }`}
        >
          <span className={`shrink-0 ${isActive(item.path) ? "text-brand-500" : "text-gray-400"}`}>{item.icon}</span>
          <span>{item.name}</span>
        </Link>
      );
    }

    return (
      <div className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-gray-400">
        <span className="shrink-0 text-gray-300">{item.icon}</span>
        <span>{item.name}</span>
      </div>
    );
  };

  const collapsedNavItems: NavItem[] = [
    ...mainNavItems,
    ...moduleSections.map((section) => ({
      name: section.title,
      path: section.items[0].path,
      icon: section.items[0].icon,
    })),
  ];

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 left-0 h-screen transition-all duration-300 ease-in-out z-50 bg-white border-r border-gray-200
        ${sidebarOpen ? "w-[290px]" : "w-[90px]"}
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
    >
      {/* Collapse/Expand Toggle */}
      <button
        onClick={toggleSidebar}
        className="absolute top-15 -right-3.5 z-50 flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 transition-colors cursor-pointer shadow-sm"
      >
        {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>

      {/* Logo */}
      <div
        className={`flex items-center px-5 py-5 ${
          !sidebarOpen ? "justify-center" : "justify-start"
        }`}
      >
        <Link to="/">
          {sidebarOpen ? (
            <img
              src={companyStore.logo}
              alt={companyStore.companyName}
              className="h-9 max-w-[160px] object-contain"
            />
          ) : (
            <img
              src={companyStore.logo}
              alt={companyStore.companyName}
              className="h-10 w-10 object-contain"
            />
          )}
        </Link>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 overflow-y-auto px-3 py-1 no-scrollbar">
        {sidebarOpen ? (
          <div className="space-y-3">
            <div>
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Основное</p>
              <ul className="flex flex-col gap-0.5">
                {mainNavItems.map((nav) => renderNavItem(nav))}
              </ul>
            </div>

            <div className="mx-1 border-t border-gray-100" />

            {moduleSections.map((section) => (
              <div key={section.title}>
                <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  {section.title}
                </div>
                <ul className="flex flex-col gap-0.5">
                  {section.items.map((item) => (
                    <li key={item.path}>{renderSectionItem(item)}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {collapsedNavItems.map((nav) => renderNavItem(nav))}
          </ul>
        )}
      </nav>
    </aside>
  );
};

export default observer(AppSidebar);
