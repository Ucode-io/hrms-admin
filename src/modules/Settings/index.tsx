import { useMemo, useState } from "react";
import { Link } from "react-router";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BellRing,
  Braces,
  Briefcase,
  BriefcaseBusiness,
  Building2,
  CalendarCheck,
  CalendarDays,
  CheckCheck,
  ClipboardList,
  FolderOpen,
  Globe,
  Home,
  LaptopMinimal,
  Link2,
  ListChecks,
  ListOrdered,
  Receipt,
  Wallet,
  MapPin,
  Search,
  Share2,
  Shield,
  SlidersHorizontal,
  UserRoundCheck,
  UserX,
  WalletCards,
  CircleDollarSign,
} from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import { useTranslation } from "../../i18n";
import type { MessageKey } from "../../i18n/messages";
import { useBillingMenuVisible } from "../../api/services/billing.service";

export type SettingsItem = {
  id: string;
  titleKey: MessageKey;
  icon: LucideIcon;
  path?: string;
  subtitleKey?: MessageKey;
  keywords?: string[];
};

export type SettingsSection = {
  id: string;
  titleKey: MessageKey;
  columns: SettingsItem[][];
};

export const settingsSections: SettingsSection[] = [
  {
    id: "main",
    titleKey: "settings_misc.settings_index.sections.main",
    columns: [
      [
        {
          id: "general-main",

          titleKey: "settings_misc.settings_index.items.general-main.title",
          icon: SlidersHorizontal,
          path: "/settings/general",
          subtitleKey: "settings_misc.settings_index.items.general-main.subtitle",
          keywords: ["общие", "основные", "платформа", "настройки"],
        },
        {
          id: "billing",

          titleKey: "settings_misc.settings_index.items.billing.title",
          icon: Receipt,
          path: "/settings/billing",
          subtitleKey: "settings_misc.settings_index.items.billing.subtitle",
          keywords: ["биллинг", "подписка", "счёт", "счет", "оплата", "тариф", "billing", "invoice"],
        },
      ],
      [
        {
          id: "notifications",

          titleKey: "settings_misc.settings_index.items.notifications.title",
          icon: Bell,
          path: "/settings/news",
          subtitleKey: "settings_misc.settings_index.items.notifications.subtitle",
        },
        {
          id: "bot-notifications",

          titleKey: "settings_misc.settings_index.items.bot-notifications.title",
          icon: BellRing,
          path: "/settings/notifications",
          subtitleKey: "settings_misc.settings_index.items.bot-notifications.subtitle",
          keywords: [
            "уведомления",
            "бот",
            "telegram",
            "группа",
            "опоздания",
            "рассылка",
            "notifications",
          ],
        },
      ],
      [
        {
          id: "roles",

          titleKey: "settings_misc.settings_index.items.roles.title",
          icon: Shield,
          path: "/settings/roles",
          subtitleKey: "settings_misc.settings_index.items.roles.subtitle",
          keywords: ["роли", "доступ", "права", "модули", "roles", "access"],
        },
        {
          id: "career-site",

          titleKey: "settings_misc.settings_index.items.career-site.title",
          icon: Globe,
          path: "/settings/career-site",
          subtitleKey: "settings_misc.settings_index.items.career-site.subtitle",
          keywords: [
            "карьерный",
            "сайт",
            "career",
            "вакансии",
            "поддомен",
            "subdomain",
          ],
        },
        {
          id: "task-directories",

          titleKey: "settings_misc.settings_index.items.task-directories.title",
          icon: ListChecks,
          path: "/settings/task-directories",
          subtitleKey: "settings_misc.settings_index.items.task-directories.subtitle",
          keywords: [
            "задачи",
            "статусы",
            "приоритеты",
            "теги",
            "типы",
            "доска",
            "tasks",
            "status",
            "priority",
            "tag",
          ],
        },
        {
          id: "custom-fields",

          titleKey: "settings_misc.settings_index.items.custom-fields.title",
          icon: Braces,
          path: "/settings/custom-fields",
          subtitleKey: "settings_misc.settings_index.items.custom-fields.subtitle",
          keywords: [
            "динамические",
            "поля",
            "кастомные",
            "custom",
            "fields",
            "конструктор",
            "форма",
            "справочник",
          ],
        },
      ],
    ],
  },
  {
    id: "organization",
    titleKey: "settings_misc.settings_index.sections.organization",
    columns: [
      [
        {
          id: "home",

          titleKey: "settings_misc.settings_index.items.home.title",
          icon: Home,
          path: "/settings/home",
          subtitleKey: "settings_misc.settings_index.items.home.subtitle",
        },
        {
          id: "branches",

          titleKey: "settings_misc.settings_index.items.branches.title",
          icon: MapPin,
          path: "/settings/branches",
          subtitleKey: "settings_misc.settings_index.items.branches.subtitle",
        },
        {
          id: "departments",

          titleKey: "settings_misc.settings_index.items.departments.title",
          icon: Building2,
          path: "/settings/departments",
          subtitleKey: "settings_misc.settings_index.items.departments.subtitle",
        },
      ],
      [
        {
          id: "positions",

          titleKey: "settings_misc.settings_index.items.positions.title",
          icon: BriefcaseBusiness,
          path: "/settings/positions",
          subtitleKey: "settings_misc.settings_index.items.positions.subtitle",
        },
        {
          id: "regions",

          titleKey: "settings_misc.settings_index.items.regions.title",
          icon: Globe,
          path: "/settings/regions",
          subtitleKey: "settings_misc.settings_index.items.regions.subtitle",
        },
        {
          id: "employment-types",

          titleKey: "settings_misc.settings_index.items.employment-types.title",
          icon: Briefcase,
          path: "/settings/employment-types",
          subtitleKey: "settings_misc.settings_index.items.employment-types.subtitle",
        },
      ],
      [
        {
          id: "skills",

          titleKey: "settings_misc.settings_index.items.skills.title",
          icon: ClipboardList,
          path: "/settings/skills",
          subtitleKey: "settings_misc.settings_index.items.skills.subtitle",
        },
        {
          id: "experience-level",

          titleKey: "settings_misc.settings_index.items.experience-level.title",
          icon: ListOrdered,
          path: "/settings/experience-levels",
          subtitleKey: "settings_misc.settings_index.items.experience-level.subtitle",
        },
        {
          id: "grade-salaries",

          titleKey: "settings_misc.settings_index.items.grade-salaries.title",
          icon: Wallet,
          path: "/settings/grade-salaries",
          subtitleKey: "settings_misc.settings_index.items.grade-salaries.subtitle",
          keywords: [
            "зарплата",
            "оклад",
            "вилка",
            "грейд",
            "salary",
            "grade",
            "матрица",
            "стаж",
          ],
        },
        {
          id: "property-categories",

          titleKey: "settings_misc.settings_index.items.property-categories.title",
          icon: LaptopMinimal,
          path: "/settings/property-categories",
          subtitleKey: "settings_misc.settings_index.items.property-categories.subtitle",
        },
      ],
    ],
  },
  {
    id: "recruiting",
    titleKey: "settings_misc.settings_index.sections.recruiting",
    columns: [
      [
        {
          id: "stage-templates",

          titleKey: "settings_misc.settings_index.items.stage-templates.title",
          icon: ListChecks,
          path: "/settings/stage-templates",
          subtitleKey: "settings_misc.settings_index.items.stage-templates.subtitle",
          keywords: ["шаблоны", "этапы", "рекрутинг", "найм"],
        },
      ],
      [
        {
          id: "rejection-reasons",

          titleKey: "settings_misc.settings_index.items.rejection-reasons.title",
          icon: UserX,
          path: "/settings/rejection-reasons",
          subtitleKey: "settings_misc.settings_index.items.rejection-reasons.subtitle",
          keywords: ["причины", "отказ", "кандидат", "рекрутинг", "воронка"],
        },
      ],
      [
        {
          id: "candidate-sources",

          titleKey: "settings_misc.settings_index.items.candidate-sources.title",
          icon: Share2,
          path: "/settings/candidate-sources",
          subtitleKey: "settings_misc.settings_index.items.candidate-sources.subtitle",
          keywords: ["источники", "каналы", "кандидат", "рекрутинг", "hh"],
        },
      ],
    ],
  },
  {
    id: "attendance",
    titleKey: "settings_misc.settings_index.sections.attendance",
    columns: [
      [
        {
          id: "holiday-policies",

          titleKey: "settings_misc.settings_index.items.holiday-policies.title",
          icon: CalendarCheck,
          path: "/settings/holiday-policies",
          subtitleKey: "settings_misc.settings_index.items.holiday-policies.subtitle",
        },
      ],
      [
        {
          id: "absence-policies",

          titleKey: "settings_misc.settings_index.items.absence-policies.title",
          icon: CalendarDays,
          path: "/settings/absence-policies",
          subtitleKey: "settings_misc.settings_index.items.absence-policies.subtitle",
        },
      ],
      [
        {
          id: "work-schedules",

          titleKey: "settings_misc.settings_index.items.work-schedules.title",
          icon: ListOrdered,
          path: "/settings/work-schedules",
          // Не «смены»: здесь недельные шаблоны, а смены на конкретные даты
          // живут на отдельном экране /shifts.
          subtitleKey: "settings_misc.settings_index.items.work-schedules.subtitle",
        },
      ],
    ],
  },
  {
    id: "integrations",
    titleKey: "settings_misc.settings_index.sections.integrations",
    columns: [
      [
        {
          id: "hickvision",

          titleKey: "settings_misc.settings_index.items.hickvision.title",
          icon: Link2,
          path: "/settings/integrations/hickvision",
          subtitleKey: "settings_misc.settings_index.items.hickvision.subtitle",
          keywords: ["hikvision", "hickvision", "integration", "attendance"],
        },
      ],
      [
        {
          id: "timedoctor",

          titleKey: "settings_misc.settings_index.items.timedoctor.title",
          icon: Link2,
          path: "/settings/integrations/timedoctor",
          subtitleKey: "settings_misc.settings_index.items.timedoctor.subtitle",
          keywords: ["time doctor", "timedoctor", "td2", "integration", "productivity", "учет времени"],
        },
      ],
      [],
    ],
  },
  {
    id: "employment-salary",
    titleKey: "settings_misc.settings_index.sections.employment_salary",
    columns: [
      [
        {
          id: "probation-policies",

          titleKey: "settings_misc.settings_index.items.probation-policies.title",
          icon: UserRoundCheck,
          path: "/settings/probation-policies",
          subtitleKey: "settings_misc.settings_index.items.probation-policies.subtitle",
        },
        {
          id: "documents",

          titleKey: "settings_misc.settings_index.items.documents.title",
          icon: FolderOpen,
          path: "/settings/documents",
          subtitleKey: "settings_misc.settings_index.items.documents.subtitle",
        },
      ],
      [
        {
          id: "salary-types",

          titleKey: "settings_misc.settings_index.items.salary-types.title",
          icon: WalletCards,
          path: "/settings/compensation",
          subtitleKey: "settings_misc.settings_index.items.salary-types.subtitle",
          keywords: ["компенсация", "зарплата"],
        },
        {
          id: "attendance-penalties",

          titleKey: "settings_misc.settings_index.items.attendance-penalties.title",
          icon: CircleDollarSign,
          path: "/settings/attendance-penalties",
          subtitleKey: "settings_misc.settings_index.items.attendance-penalties.subtitle",
          keywords: [
            "штраф",
            "опоздание",
            "ранний уход",
            "посещаемость",
            "вычет",
            "зарплата",
            "penalty",
            "attendance",
          ],
        },
        {
          id: "approvals",

          titleKey: "settings_misc.settings_index.items.approvals.title",
          icon: CheckCheck,
          path: "/settings/approvals",
          subtitleKey: "settings_misc.settings_index.items.approvals.subtitle",
          keywords: [
            "одобрение",
            "согласование",
            "approvals",
            "отпуск",
            "посещаемость",
            "этапы",
          ],
        },
        {
          id: "dismissal-types",

          titleKey: "settings_misc.settings_index.items.dismissal-types.title",
          icon: UserX,
          path: "/settings/dismissal-types",
          subtitleKey: "settings_misc.settings_index.items.dismissal-types.subtitle",
        },
      ],
      [
        {
          id: "dismissal-reasons",

          titleKey: "settings_misc.settings_index.items.dismissal-reasons.title",
          icon: UserX,
          path: "/settings/dismissal-reasons",
          subtitleKey: "settings_misc.settings_index.items.dismissal-reasons.subtitle",
        },
        {
          id: "employee-work-change-reasons",

          titleKey: "settings_misc.settings_index.items.employee-work-change-reasons.title",
          icon: ClipboardList,
          path: "/settings/employee-work-reasons",
          subtitleKey: "settings_misc.settings_index.items.employee-work-change-reasons.subtitle",
          keywords: ["повышение", "прием на работу", "изменение работы"],
        },
      ],
    ],
  },
];

const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const showBilling = useBillingMenuVisible();

  const visibleSections = useMemo(() => {
    return settingsSections
      .map((section) => {
        const columns = section.columns
          .map((column) =>
            column.filter((item) => {
              if (!item.path || (item.id === "billing" && !showBilling)) {
                return false;
              }

              if (!normalizedQuery) {
                return true;
              }

              const fields = [t(item.titleKey), ...(item.keywords ?? [])];
              return fields.some((field) =>
                field.toLowerCase().includes(normalizedQuery)
              );
            })
          )
          .filter((column) => column.length > 0);

        return {
          ...section,
          columns,
        };
      })
      .filter((section) => section.columns.length > 0);
  }, [normalizedQuery, showBilling, t]);

  return (
    <>
      <PageMeta title={t("settings_misc.settings_index.page_title")} description={t("settings_misc.settings_index.page_description")} />

      <div className="space-y-4">
        <div className="-mx-4 border-b border-gray-200 px-4 py-4 md:-mx-6 md:px-6">
          <label className="relative block">
            <Search
              size={18}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t("settings_misc.settings_index.search_placeholder")}
              className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-11 pr-4 text-sm text-gray-700 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
            />
          </label>
        </div>

        <div className="space-y-4 pt-1">
          {visibleSections.map((section) => (
            <section
              key={section.id}
              className="rounded-2xl border border-gray-200 bg-white px-4 py-4 md:px-5 md:py-4"
            >
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                {t(section.titleKey)}
              </h2>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {section.columns.map((column, index) =>
                  column.map((item) => {
                    const Icon = item.icon;
                    const content = (
                      <>
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-brand-100 bg-brand-50 text-brand-500 transition-colors group-hover:bg-brand-100"
                        >
                          <Icon size={15} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-gray-900">
                            {t(item.titleKey)}
                          </span>
                          {item.subtitleKey && (
                            <span className="mt-0.5 block truncate text-xs text-gray-500">
                              {t(item.subtitleKey)}
                            </span>
                          )}
                        </span>
                      </>
                    );

                    return (
                      <Link
                        key={`${section.id}-${index}-${item.id}`}
                        to={item.path}
                        className="group flex items-start gap-2.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-sm"
                      >
                        {content}
                      </Link>
                    );
                  })
                )}
              </div>
            </section>
          ))}

          {visibleSections.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
              <p className="text-base font-medium text-gray-800">Ничего не найдено</p>
              <p className="mt-1 text-sm text-gray-500">
                Попробуйте изменить запрос или очистить строку поиска.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SettingsPage;
