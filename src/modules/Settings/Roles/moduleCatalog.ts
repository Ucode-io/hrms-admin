import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  FileText,
  GraduationCap,
  Home,
  ListTodo,
  Calculator,
  Package,
  Settings as SettingsIcon,
  Target,
  UserRoundCheck,
  UserSearch,
  WalletCards,
} from "lucide-react";
import type { MessageKey } from "../../../i18n/messages";

/**
 * Toggle-able application modules. `key` is the stable machine identifier stored
 * in `hrms_role_modules.module_key` (kept in sync with the backend catalog in
 * udevs-hrms-reports/src/methods/hrms-roles-common.js). `paths` lists the route
 * prefixes a module grants — used by the sidebar/route guard.
 */
export type ModuleKey =
  | "dashboard"
  | "tasks"
  | "budgeting"
  | "kpi"
  | "employees"
  | "recruiting"
  | "time"
  | "documents"
  | "knowledge_base"
  | "property"
  | "surveys"
  | "trainings"
  | "finance"
  | "reports"
  | "settings";

export type ModuleDefinition = {
  key: ModuleKey;
  labelKey: MessageKey;
  descriptionKey: MessageKey;
  icon: LucideIcon;
  paths: string[];
};

export const MODULE_CATALOG: ModuleDefinition[] = [
  {
    key: "dashboard",
    labelKey: "settings_roles.module_dashboard_label",
    descriptionKey: "settings_roles.module_dashboard_desc",
    icon: Home,
    paths: ["/dashboard"],
  },
  {
    key: "tasks",
    labelKey: "settings_roles.module_tasks_label",
    descriptionKey: "settings_roles.module_tasks_desc",
    icon: ListTodo,
    paths: ["/tasks"],
  },
  {
    key: "budgeting",
    labelKey: "settings_roles.module_budgeting_label",
    descriptionKey: "settings_roles.module_budgeting_desc",
    icon: Calculator,
    paths: ["/budgeting"],
  },
  {
    key: "kpi",
    labelKey: "settings_roles.module_kpi_label",
    descriptionKey: "settings_roles.module_kpi_desc",
    icon: Target,
    paths: ["/kpi"],
  },
  {
    key: "employees",
    labelKey: "settings_roles.module_employees_label",
    descriptionKey: "settings_roles.module_employees_desc",
    icon: UserRoundCheck,
    // Оргструктура — тот же модуль «Люди», отдельный корень маршрута.
    // Чаты с AI здесь же: кто видит карточки сотрудников, видит и их
    // переписки. Отдельный ModuleKey потребовал бы правки каталога в
    // udevs-hrms-reports и переназначения всех существующих ролей.
    // Страница стоит в сайдбаре рядом с сотрудниками; `/settings/chats`
    // оставлен в списке ради старых ссылок, которые туда ещё ведут.
    paths: ["/employees", "/organization", "/chats", "/settings/chats"],
  },
  {
    key: "recruiting",
    labelKey: "settings_roles.module_recruiting_label",
    descriptionKey: "settings_roles.module_recruiting_desc",
    icon: UserSearch,
    paths: ["/recruiting"],
  },
  {
    key: "time",
    labelKey: "settings_roles.module_time_label",
    descriptionKey: "settings_roles.module_time_desc",
    icon: CalendarCheck,
    // "/timesheet" и "/shifts" — отдельные пути, а не подпути "/time": проверка
    // доступа сравнивает по сегментам, и под "/time" они не подпадают. Забыть
    // дописать сюда новый путь — значит получить пункт меню, который просто
    // не виден всем, у кого назначена роль, без единой ошибки.
    paths: ["/time", "/timesheet", "/shifts", "/calendar"],
  },
  {
    key: "documents",
    labelKey: "settings_roles.module_documents_label",
    descriptionKey: "settings_roles.module_documents_desc",
    icon: FileText,
    paths: ["/documents"],
  },
  {
    key: "knowledge_base",
    labelKey: "settings_roles.module_knowledge_base_label",
    descriptionKey: "settings_roles.module_knowledge_base_desc",
    icon: BookOpen,
    paths: ["/knowledge-base"],
  },
  {
    key: "property",
    labelKey: "settings_roles.module_property_label",
    descriptionKey: "settings_roles.module_property_desc",
    icon: Package,
    paths: ["/property"],
  },
  {
    key: "surveys",
    labelKey: "settings_roles.module_surveys_label",
    descriptionKey: "settings_roles.module_surveys_desc",
    icon: ClipboardList,
    paths: ["/surveys"],
  },
  {
    key: "trainings",
    labelKey: "settings_roles.module_trainings_label",
    descriptionKey: "settings_roles.module_trainings_desc",
    icon: GraduationCap,
    paths: ["/trainings"],
  },
  {
    key: "finance",
    labelKey: "settings_roles.module_finance_label",
    descriptionKey: "settings_roles.module_finance_desc",
    icon: WalletCards,
    paths: ["/finance"],
  },
  {
    key: "reports",
    labelKey: "settings_roles.module_reports_label",
    descriptionKey: "settings_roles.module_reports_desc",
    icon: BarChart3,
    paths: ["/reports"],
  },
  {
    key: "settings",
    labelKey: "settings_roles.module_settings_label",
    descriptionKey: "settings_roles.module_settings_desc",
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
