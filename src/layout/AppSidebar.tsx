import { useCallback, useMemo } from "react";
import { Link, useLocation } from "react-router";
import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  CalendarClock,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  GraduationCap,
  Home,
  ListTodo,
  Network,
  Package,
  Settings,
  Target,
  UserRoundCheck,
  UserSearch,
  Users,
  WalletCards,
  Calculator,
} from "lucide-react";
import { useSidebar } from "../context/SidebarContext";
import companyStore from "../store/company.store";
import { observer } from "mobx-react-lite";
import { useCurrentUserAccess } from "../api/services/role.service";
import { isPathAllowed } from "../modules/Settings/Roles/moduleCatalog";

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
  { icon: <Home size={20} />, name: "Дашборд", path: "/dashboard" },
];

const moduleSections: ModuleSection[] = [
  {
    title: "Задачи и KPI",
    items: [
      { name: "Задачи", path: "/tasks", icon: <ListTodo size={18} /> },
      { name: "KPI", path: "/kpi", icon: <Target size={18} /> },
    ],
  },
  {
    title: "Люди",
    items: [
      { name: "Сотрудники", path: "/employees", icon: <UserRoundCheck size={18} /> },
      { name: "Орг структура", path: "/organization/structure", icon: <Network size={18} /> },
    ],
  },
  {
    title: "Рекрутинг",
    items: [
      { name: "Вакансии", path: "/recruiting/vacancies", icon: <UserSearch size={18} /> },
      { name: "Кандидаты", path: "/recruiting/candidates", icon: <Users size={18} /> },
    ],
  },
  {
    title: "Время",
    items: [
      { name: "Посещаемость", path: "/time", icon: <CalendarCheck size={18} /> },
      { name: "Табель времени", path: "/timesheet", icon: <CalendarClock size={18} /> },
      { name: "Смены", path: "/shifts", icon: <CalendarRange size={18} /> },
    ],
  },
  {
    title: "Обучение",
    items: [
      { name: "Тренинги", path: "/trainings", icon: <GraduationCap size={18} /> },
      { name: "База знаний", path: "/knowledge-base", icon: <BookOpen size={18} /> },
      { name: "Опросы", path: "/surveys", icon: <ClipboardList size={18} /> },
    ],
  },
  {
    title: "Финансы",
    items: [
      { name: "Зарплата", path: "/finance/salary", icon: <WalletCards size={18} /> },
      { name: "Бюджет", path: "/budgeting", icon: <Calculator size={18} /> },
    ],
  },
  {
    title: "Система",
    items: [
      { name: "Отчеты", path: "/reports", icon: <BarChart3 size={18} /> },
      { name: "Документы", path: "/documents", icon: <FileText size={18} /> },
      { name: "Имущество", path: "/property", icon: <Package size={18} /> },
      { name: "Настройки", path: "/settings", icon: <Settings size={18} /> },
    ],
  },
];

const ENABLED_PATHS = new Set([
  "/dashboard",
  "/employees",
  "/organization/structure",
  "/recruiting/vacancies",
  "/recruiting/candidates",
  "/documents",
  "/knowledge-base",
  "/property",
  "/reports",
  "/time",
  "/timesheet",
  "/shifts",
  "/time/attendance",
  "/reports/attendance",
  "/reports/absence-balance",
  "/calendar",
  "/finance/salary",
  "/budgeting",
  "/kpi",
  "/tasks",
  "/surveys",
  "/trainings",
  "/settings",
  "/settings/compensation",
  "/settings/news",
]);

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, toggleSidebar } = useSidebar();
  const location = useLocation();

  const sidebarOpen = isExpanded || isMobileOpen;

  // Effective module access for the logged-in user. Non-breaking rollout policy:
  // an employee with NO assigned role (or a global admin) keeps full access;
  // only an explicitly-assigned company role restricts the menu to its modules.
  const { data: access } = useCurrentUserAccess();
  const roleRestricts = Boolean(access?.role) && !access?.role?.isGlobal;
  const allowedModules = useMemo(() => access?.modules ?? [], [access?.modules]);

  const isModuleAllowed = useCallback(
    (path?: string) => {
      if (!path) return false;
      if (!roleRestricts) return true;
      return isPathAllowed(path, allowedModules);
    },
    [roleRestricts, allowedModules]
  );

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

  const isPathEnabled = useCallback(
    (path?: string) => {
      if (!path) return false;
      return ENABLED_PATHS.has(path) && isModuleAllowed(path);
    },
    [isModuleAllowed]
  );

  // Inaccessible items are hidden entirely (not greyed out). We render only
  // enabled paths and drop any section that ends up empty.
  const visibleMainNav = mainNavItems.filter((nav) => isPathEnabled(nav.path));
  const visibleSections = moduleSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => isPathEnabled(item.path)),
    }))
    .filter((section) => section.items.length > 0);

  const renderNavItem = (nav: NavItem) => (
    <li key={nav.path}>
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
    </li>
  );

  const renderSectionItem = (item: { name: string; path: string; icon: React.ReactNode }) => (
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

  const collapsedNavItems: NavItem[] = [
    ...visibleMainNav,
    ...visibleSections.map((section) => ({
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
            {visibleMainNav.length > 0 && (
              <>
                <div>
                  <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Основное</p>
                  <ul className="flex flex-col gap-0.5">
                    {visibleMainNav.map((nav) => renderNavItem(nav))}
                  </ul>
                </div>

                <div className="mx-1 border-t border-gray-100" />
              </>
            )}

            {visibleSections.map((section) => (
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
