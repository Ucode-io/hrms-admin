import { useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useSidebar } from "../context/SidebarContext";
import { type HeaderBreadcrumbItem, useHeaderBreadcrumb } from "../context/HeaderBreadcrumbContext";
import UserDropdown from "../components/header/UserDropdown";
import companyStore from "../store/company.store";
import { observer } from "mobx-react-lite";
import { ArrowLeft, Bell, Menu, X } from "lucide-react";
import { CopilotToggle } from "../features/copilot";

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Главная страница",
  documents: "Документы",
  "knowledge-base": "База знаний",
  articles: "Статья",
  employees: "Сотрудники",
  organization: "Организация",
  reports: "Отчеты",
  kpi: "KPI",
  tasks: "Задачи",
  budgeting: "Бюджетирование",
  "age-distribution": "Возрастное распределение",
  "gender-distribution": "Гендерное распределение",
  "staff-count": "Численность сотрудников",
  "staff-turnover": "Текучесть кадров",
  tenure: "Стаж",
  "absence-balance": "Баланс отсутствий",
  attendance: "Посещаемость",
  "sport-attendance": "Посещение спорта",
  payroll: "ФОТ",
  "bonus-deductions": "Бонусы и удержания",
  settings: "Настройки",
  "attendance-penalties": "Штрафы",
  "grade-salaries": "Зарплаты по грейдам",
  "experience-levels": "Уровни опыта",
  positions: "Должности",
  integrations: "Интеграции",
  hickvision: "Hickvision",
  timedoctor: "Time Doctor",
  finance: "Финансы",
  salary: "Зарплата",
  time: "Время",
  timesheet: "Табель времени",
  shifts: "График работы",
  "time-tracking": "Учёт времени работы",
  surveys: "Опросники",
  trainings: "Тренинги",
  calendar: "Календарь",
  clients: "Клиенты",
  contracts: "Договоры",
  products: "Продукты",
  merchants: "Партнеры",
  notifications: "Уведомления",
  news: "Новости",
  generate: "Генерация",
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

const buildHeaderBreadcrumbs = (
  pathname: string,
  getOverrideLabel: (path: string) => string | undefined,
  getOverrideItems: (path: string) => HeaderBreadcrumbItem[] | undefined
): HeaderBreadcrumbItem[] => {
  const overrideItems = getOverrideItems(pathname);
  if (overrideItems && overrideItems.length > 0) {
    return overrideItems;
  }

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return [{ label: "Главная страница", to: "/dashboard" }];
  }

  if (segments[0] === "employees") {
    const tail = segments.slice(1).map((segment, index) => {
      const to = `/${["employees", ...segments.slice(1, index + 2)].join("/")}`;
      return {
        label: getOverrideLabel(to) || normalizeSegmentLabel(segment),
        to,
      };
    });

    return [
      { label: "Люди", to: "/employees" },
      { label: "Сотрудники", to: "/employees" },
      ...tail,
    ];
  }

  return segments.map((segment, index) => {
    const to = `/${segments.slice(0, index + 1).join("/")}`;
    return {
      label: getOverrideLabel(to) || normalizeSegmentLabel(segment),
      to,
    };
  });
};

const AppHeader: React.FC = () => {
  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { getBreadcrumbLabel, getBreadcrumbItems } = useHeaderBreadcrumb();

  const handleToggle = () => {
    if (window.innerWidth >= 1024) {
      toggleSidebar();
    } else {
      toggleMobileSidebar();
    }
  };

  const breadcrumbs = useMemo(() => {
    return buildHeaderBreadcrumbs(location.pathname, getBreadcrumbLabel, getBreadcrumbItems);
  }, [getBreadcrumbItems, getBreadcrumbLabel, location.pathname]);
  const isDocumentsFolderView =
    location.pathname === "/documents" && new URLSearchParams(location.search).has("folder");
  // Detail and form (create/edit) pages: back button lives here in the header.
  const BACK_BUTTON_PAGES: Array<{ pattern: RegExp; listPath: string }> = [
    { pattern: /^\/employees\/.+/, listPath: "/employees" },
    { pattern: /^\/recruiting\/vacancies\/.+/, listPath: "/recruiting/vacancies" },
    { pattern: /^\/recruiting\/candidates\/.+/, listPath: "/recruiting/candidates" },
    { pattern: /^\/property\/.+/, listPath: "/property" },
    { pattern: /^\/reports\/.+/, listPath: "/reports" },
    { pattern: /^\/surveys\/.+/, listPath: "/surveys" },
    { pattern: /^\/trainings\/.+/, listPath: "/trainings" },
    { pattern: /^\/settings\/.+/, listPath: "/settings" },
    { pattern: /^\/timesheet\/.+/, listPath: "/timesheet" },
  ];
  const backButtonPage = BACK_BUTTON_PAGES.find((page) => page.pattern.test(location.pathname));
  const showBackButton = Boolean(backButtonPage) || isDocumentsFolderView;

  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
      return;
    }

    navigate(isDocumentsFolderView ? "/documents" : backButtonPage?.listPath ?? "/employees");
  };

  return (
    <header className="flex items-center justify-between w-full h-16 bg-white border-b border-gray-200 px-4 lg:px-6 z-40">
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
            {showBackButton ? (
              <>
                <button
                  type="button"
                  onClick={handleBack}
                  className="-ml-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-white hover:text-gray-800"
                  aria-label="Назад"
                  title="Назад"
                >
                  <ArrowLeft size={16} />
                </button>
                <span className="text-gray-300">|</span>
              </>
            ) : null}
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <div key={`${crumb.to}-${index}`} className="inline-flex min-w-0 items-center gap-2">
                  <Link
                    to={crumb.to}
                    className={`truncate ${isLast ? "font-semibold text-gray-800" : "font-medium text-gray-500"}`}
                    aria-current={isLast ? "page" : undefined}
                  >
                    {crumb.label}
                  </Link>
                  {!isLast ? <span className="text-gray-400">›</span> : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <CopilotToggle />

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
