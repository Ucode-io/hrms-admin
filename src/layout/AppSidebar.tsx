import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Home,
  User,
  Users,
  Calendar,
  Search as SearchIcon,
  Send,
  CheckSquare,
  FileText,
  Monitor,
  BookOpen,
  Zap,
  Phone,
  Settings,
} from "lucide-react";
import { useSidebar } from "../context/SidebarContext";
import companyStore from "../store/company.store";
import { observer } from "mobx-react-lite";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  badge?: number;
  subItems?: { name: string; path: string }[];
};

// Group 1: Main navigation
const mainNavItems: NavItem[] = [
  {
    icon: <Home size={20} />,
    name: "Главная страница",
    path: "/dashboard",
  },
  {
    icon: <User size={20} />,
    name: "Мои активности",
    path: "/my-activities",
  },
  {
    icon: <CheckSquare size={20} />,
    name: "Уведомления",
    path: "/notifications",
    badge: 39,
  },
];

// Group 2: Modules
const moduleNavItems: NavItem[] = [
  {
    icon: <Users size={20} />,
    name: "Сотрудники",
    path: "/employees",
  },
  {
    icon: <Calendar size={20} />,
    name: "Календарь",
    path: "/calendar",
  },
  {
    icon: <SearchIcon size={20} />,
    name: "Рекрутинг",
    subItems: [
      { name: "Вакансии", path: "/recruiting/vacancies" },
      { name: "Кандидаты", path: "/recruiting/candidates" },
    ],
  },
  {
    icon: <Send size={20} />,
    name: "Запросы",
    path: "/requests",
  },
  {
    icon: <CheckSquare size={20} />,
    name: "Задачи",
    path: "/tasks",
  },
  {
    icon: <FileText size={20} />,
    name: "Документы",
    path: "/documents",
  },
  {
    icon: <Monitor size={20} />,
    name: "Имущество",
    path: "/assets",
  },
  {
    icon: <BookOpen size={20} />,
    name: "База знаний",
    path: "/knowledge-base",
  },
  {
    icon: <Zap size={20} />,
    name: "Воркфлоу",
    path: "/workflow",
  },
  {
    icon: <Phone size={20} />,
    name: "Отчеты",
    path: "/reports",
  },
];

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, toggleSidebar } = useSidebar();
  const location = useLocation();

  const [openSubmenu, setOpenSubmenu] = useState<number | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>(
    {}
  );
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

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

  // Auto-open active submenu
  useEffect(() => {
    moduleNavItems.forEach((nav, index) => {
      if (nav.subItems?.some((sub) => isActive(sub.path))) {
        setOpenSubmenu(index);
      }
    });
  }, [location, isActive]);

  // Measure submenu heights
  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `${openSubmenu}`;
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prev) => ({
          ...prev,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (index: number) => {
    setOpenSubmenu((prev) => (prev === index ? null : index));
  };

  const renderNavItem = (nav: NavItem, index: number, _groupKey: string) => {
    const isNavEnabled = nav.name === "Главная страница" || nav.name === "Сотрудники";

    if (nav.subItems) {
      if (!isNavEnabled) {
        return (
          <li key={nav.name}>
            <div
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-400
                ${!sidebarOpen ? "justify-center" : ""}`}
            >
              <span className="shrink-0 text-gray-300">{nav.icon}</span>
              {sidebarOpen && (
                <>
                  <span className="flex-1 text-left">{nav.name}</span>
                  <ChevronDown size={16} className="text-gray-300" />
                </>
              )}
            </div>
          </li>
        );
      }

      const hasActiveSub = nav.subItems.some((sub) => isActive(sub.path));
      return (
        <li key={nav.name}>
          <button
            onClick={() => handleSubmenuToggle(index)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer
              ${hasActiveSub
                ? "bg-brand-50 text-brand-500"
                : "text-gray-700 hover:bg-gray-100"
              }
              ${!sidebarOpen ? "justify-center" : ""}
            `}
          >
            <span className={`shrink-0 ${hasActiveSub ? "text-brand-500" : "text-gray-500"}`}>
              {nav.icon}
            </span>
            {sidebarOpen && (
              <>
                <span className="flex-1 text-left">{nav.name}</span>
                <ChevronDown
                  size={16}
                  className={`text-gray-400 transition-transform duration-200 ${openSubmenu === index ? "rotate-180" : ""
                    }`}
                />
              </>
            )}
          </button>

          {/* Submenu */}
          {nav.subItems && sidebarOpen && (
            <div
              ref={(el) => {
                subMenuRefs.current[`${index}`] = el;
              }}
              className="overflow-hidden transition-all duration-300"
              style={{
                height:
                  openSubmenu === index
                    ? `${subMenuHeight[`${index}`]}px`
                    : "0px",
              }}
            >
              <ul className="mt-1 ml-9 space-y-0.5">
                {nav.subItems.map((sub) => (
                  <li key={sub.name}>
                    <Link
                      to={sub.path}
                      className={`block rounded-xl px-3 py-2 text-sm transition-colors ${isActive(sub.path)
                        ? "text-brand-500 font-medium bg-brand-50"
                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                        }`}
                    >
                      {sub.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
      );
    }

    // Direct link item
    return (
      <li key={nav.name}>
        {nav.path && isNavEnabled ? (
          <Link
            to={nav.path}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors
              ${isActive(nav.path)
                ? "bg-brand-50 text-brand-500"
                : "text-gray-700 hover:bg-gray-100"
              }
              ${!sidebarOpen ? "justify-center" : ""}
            `}
          >
            <span className={`shrink-0 ${isActive(nav.path) ? "text-brand-500" : "text-gray-500"}`}>
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
        className={`flex items-center px-5 py-5 ${!sidebarOpen ? "justify-center" : "justify-start"
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

      {/* Search Bar */}
      {sidebarOpen && (
        <div className="px-4 pb-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              <SearchIcon size={18} />
            </span>
            <input
              type="text"
              placeholder="Поиск..."
              className="w-full h-10 rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-16 text-sm text-gray-700 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/10 transition-colors"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-xs text-gray-400">
              ⌘ + K
            </span>
          </div>
        </div>
      )}

      {/* Nav Items */}
      <nav className="flex-1 overflow-y-auto px-3 py-1 no-scrollbar">
        {/* Group 1: Main */}
        <ul className="flex flex-col gap-0.5">
          {mainNavItems.map((nav, index) => renderNavItem(nav, index, "main"))}
        </ul>

        {/* Separator */}
        <div className="mx-1 my-3 border-t border-gray-100" />

        {/* Group 2: Modules */}
        <ul className="flex flex-col gap-0.5">
          {moduleNavItems.map((nav, index) => renderNavItem(nav, index, "modules"))}
        </ul>
      </nav>

      {/* Bottom Section */}
      <div className="mt-auto border-t border-gray-100 px-3 py-3">
        {/* Settings */}
        <Link
          to="/settings"
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors
            ${isActive("/settings")
              ? "bg-brand-50 text-brand-500"
              : "text-gray-700 hover:bg-gray-100"
            }
            ${!sidebarOpen ? "justify-center" : ""}
          `}
        >
          <span className={`shrink-0 ${isActive("/settings") ? "text-brand-500" : "text-gray-500"}`}>
            <Settings size={20} />
          </span>
          {sidebarOpen && <span>Настройки</span>}
        </Link>
      </div>
    </aside>
  );
};

export default observer(AppSidebar);
