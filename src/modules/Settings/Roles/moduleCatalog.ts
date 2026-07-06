import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  FileText,
  Home,
  Package,
  Settings as SettingsIcon,
  Target,
  UserRoundCheck,
  UserSearch,
  WalletCards,
} from "lucide-react";

/**
 * Toggle-able application modules. `key` is the stable machine identifier stored
 * in `hrms_role_modules.module_key` (kept in sync with the backend catalog in
 * udevs-hrms-reports/src/methods/hrms-roles-common.js). `paths` lists the route
 * prefixes a module grants — used by the sidebar/route guard.
 */
export type ModuleKey =
  | "dashboard"
  | "kpi"
  | "employees"
  | "recruiting"
  | "time"
  | "documents"
  | "knowledge_base"
  | "property"
  | "finance"
  | "reports"
  | "settings";

export type ModuleDefinition = {
  key: ModuleKey;
  label: string;
  description: string;
  icon: LucideIcon;
  paths: string[];
};

export const MODULE_CATALOG: ModuleDefinition[] = [
  {
    key: "dashboard",
    label: "Главная страница",
    description: "Дашборд и обзор",
    icon: Home,
    paths: ["/dashboard"],
  },
  {
    key: "kpi",
    label: "Задачи и KPI",
    description: "Цели и показатели",
    icon: Target,
    paths: ["/kpi"],
  },
  {
    key: "employees",
    label: "Сотрудники",
    description: "Люди и профили",
    icon: UserRoundCheck,
    paths: ["/employees"],
  },
  {
    key: "recruiting",
    label: "Рекрутинг",
    description: "Вакансии и кандидаты",
    icon: UserSearch,
    paths: ["/recruiting"],
  },
  {
    key: "time",
    label: "Время",
    description: "Посещаемость и календарь",
    icon: CalendarCheck,
    paths: ["/time", "/calendar"],
  },
  {
    key: "documents",
    label: "Документы",
    description: "Кадровые документы",
    icon: FileText,
    paths: ["/documents"],
  },
  {
    key: "knowledge_base",
    label: "База знаний",
    description: "Статьи и инструкции",
    icon: BookOpen,
    paths: ["/knowledge-base"],
  },
  {
    key: "property",
    label: "Имущество",
    description: "Активы и инвентарь",
    icon: Package,
    paths: ["/property"],
  },
  {
    key: "finance",
    label: "Финансы",
    description: "Зарплата и выплаты",
    icon: WalletCards,
    paths: ["/finance"],
  },
  {
    key: "reports",
    label: "Отчёты",
    description: "Аналитика и отчёты",
    icon: BarChart3,
    paths: ["/reports"],
  },
  {
    key: "settings",
    label: "Настройки",
    description: "Настройки системы",
    icon: SettingsIcon,
    paths: ["/settings"],
  },
];

export const MODULE_KEYS: ModuleKey[] = MODULE_CATALOG.map((m) => m.key);

const MODULE_BY_KEY = new Map(MODULE_CATALOG.map((m) => [m.key, m]));

export const getModuleLabel = (key: string): string =>
  MODULE_BY_KEY.get(key as ModuleKey)?.label ?? key;

/** True if `pathname` falls under any route granted by `moduleKeys`. */
export const isPathAllowed = (
  pathname: string,
  moduleKeys: string[]
): boolean => {
  const allowed = new Set(moduleKeys);
  for (const mod of MODULE_CATALOG) {
    if (!allowed.has(mod.key)) continue;
    if (mod.paths.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
      return true;
    }
  }
  return false;
};

/**
 * The catalog module that owns `pathname`, or null if no module claims it
 * (utility routes like "/", 404, etc. — these are never blocked by the guard).
 */
export const getPathModule = (pathname: string): ModuleKey | null => {
  for (const mod of MODULE_CATALOG) {
    if (mod.paths.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
      return mod.key;
    }
  }
  return null;
};

/** First route the given modules grant — a safe landing target for redirects. */
export const firstAllowedPath = (moduleKeys: string[]): string => {
  const allowed = new Set(moduleKeys);
  const mod = MODULE_CATALOG.find((m) => allowed.has(m.key));
  return mod?.paths[0] ?? "/dashboard";
};
