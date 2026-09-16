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
  Wallet,
  MapPin,
  Search,
  Share2,
  Shield,
  SlidersHorizontal,
  UserRoundCheck,
  UserX,
  WalletCards,
} from "lucide-react";
import PageMeta from "../../components/common/PageMeta";

export type SettingsItem = {
  id: string;
  title: string;
  icon: LucideIcon;
  path?: string;
  subtitle?: string;
  keywords?: string[];
};

export type SettingsSection = {
  id: string;
  title: string;
  columns: SettingsItem[][];
};

export const settingsSections: SettingsSection[] = [
  {
    id: "main",
    title: "Основные настройки",
    columns: [
      [
        {
          id: "general-main",
          title: "Обшие",
          icon: SlidersHorizontal,
          path: "/settings/general",
          subtitle: "Базовые параметры",
          keywords: ["общие", "основные", "платформа", "настройки"],
        },
      ],
      [
        {
          id: "notifications",
          title: "Новости",
          icon: Bell,
          path: "/settings/news",
          subtitle: "Лента новостей",
        },
        {
          id: "bot-notifications",
          title: "Уведомления бота",
          icon: BellRing,
          path: "/settings/notifications",
          subtitle: "Что уходит сотруднику и в группу",
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
          title: "Роли и доступы",
          icon: Shield,
          path: "/settings/roles",
          subtitle: "Роли и доступ к модулям",
          keywords: ["роли", "доступ", "права", "модули", "roles", "access"],
        },
        {
          id: "career-site",
          title: "Карьерный сайт",
          icon: Globe,
          path: "/settings/career-site",
          subtitle: "Публичная страница вакансий",
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
          title: "Справочники задач",
          icon: ListChecks,
          path: "/settings/task-directories",
          subtitle: "Статусы, приоритеты, типы и теги",
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
          title: "Динамические поля",
          icon: Braces,
          path: "/settings/custom-fields",
          subtitle: "Свои поля для таблиц и форм",
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
    title: "Организация",
    columns: [
      [
        {
          id: "home",
          title: "Главная",
          icon: Home,
          path: "/settings/home",
          subtitle: "Общие настройки организации",
        },
        {
          id: "locations",
          title: "Локации",
          icon: MapPin,
          path: "/settings/locations",
          subtitle: "Офисы и филиалы",
        },
        {
          id: "departments",
          title: "Департаменты",
          icon: Building2,
          path: "/settings/departments",
          subtitle: "Структура компании",
        },
      ],
      [
        {
          id: "positions",
          title: "Должности",
          icon: BriefcaseBusiness,
          path: "/settings/positions",
          subtitle: "Справочник ролей",
        },
        {
          id: "divisions",
          title: "Подразделение",
          icon: Briefcase,
          path: "/settings/divisions",
          subtitle: "Внутренняя иерархия",
        },
        {
          id: "employment-types",
          title: "Виды занятости",
          icon: Briefcase,
          path: "/settings/employment-types",
          subtitle: "Форматы работы",
        },
      ],
      [
        {
          id: "skills",
          title: "Навыки",
          icon: ClipboardList,
          path: "/settings/skills",
          subtitle: "Матрица компетенций",
        },
        {
          id: "experience-level",
          title: "Уровен опыта",
          icon: ListOrdered,
          path: "/settings/experience-levels",
          subtitle: "Грейды и уровни",
        },
        {
          id: "grade-salaries",
          title: "Зарплаты по грейдам",
          icon: Wallet,
          path: "/settings/grade-salaries",
          subtitle: "Вилки окладов по ступеням",
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
          title: "Категории имушества",
          icon: LaptopMinimal,
          path: "/settings/property-categories",
          subtitle: "Активы и инвентарь",
        },
      ],
    ],
  },
  {
    id: "recruiting",
    title: "Рекрутинг",
    columns: [
      [
        {
          id: "stage-templates",
          title: "Шаблоны этапов",
          icon: ListChecks,
          path: "/settings/stage-templates",
          subtitle: "Этапы найма",
          keywords: ["шаблоны", "этапы", "рекрутинг", "найм"],
        },
      ],
      [
        {
          id: "rejection-reasons",
          title: "Причины отказа",
          icon: UserX,
          path: "/settings/rejection-reasons",
          subtitle: "Причины отказа кандидатам",
          keywords: ["причины", "отказ", "кандидат", "рекрутинг", "воронка"],
        },
      ],
      [
        {
          id: "candidate-sources",
          title: "Источники кандидатов",
          icon: Share2,
          path: "/settings/candidate-sources",
          subtitle: "Каналы привлечения кандидатов",
          keywords: ["источники", "каналы", "кандидат", "рекрутинг", "hh"],
        },
      ],
    ],
  },
  {
    id: "attendance",
    title: "Посешаемость",
    columns: [
      [
        {
          id: "holiday-policies",
          title: "Политика праздников",
          icon: CalendarCheck,
          path: "/settings/holiday-policies",
          subtitle: "Праздничные правила",
        },
      ],
      [
        {
          id: "absence-policies",
          title: "Политики отсутствий",
          icon: CalendarDays,
          path: "/settings/absence-policies",
          subtitle: "Отпуска и больничные",
        },
      ],
      [
        {
          id: "work-schedules",
          title: "График работы",
          icon: ListOrdered,
          path: "/settings/work-schedules",
          subtitle: "Смены и часы",
        },
      ],
    ],
  },
  {
    id: "approvals",
    title: "Одобрения",
    columns: [
      [
        {
          id: "approvals",
          title: "Процессы одобрения",
          icon: CheckCheck,
          path: "/settings/approvals",
          subtitle: "Многоступенчатое одобрение заявок",
          keywords: [
            "одобрение",
            "согласование",
            "approvals",
            "отпуск",
            "посещаемость",
            "этапы",
          ],
        },
      ],
      [],
      [],
    ],
  },
  {
    id: "integrations",
    title: "Интеграции",
    columns: [
      [
        {
          id: "hickvision",
          title: "Hickvision",
          icon: Link2,
          path: "/settings/integrations/hickvision",
          subtitle: "Пользователи и записи",
          keywords: ["hikvision", "hickvision", "integration", "attendance"],
        },
      ],
      [
        {
          id: "timedoctor",
          title: "Time Doctor",
          icon: Link2,
          path: "/settings/integrations/timedoctor",
          subtitle: "Подключение учёта времени",
          keywords: ["time doctor", "timedoctor", "td2", "integration", "productivity", "учет времени"],
        },
      ],
      [],
    ],
  },
  {
    id: "employment-salary",
    title: "Труодустройства и Зарплата",
    columns: [
      [
        {
          id: "probation-policies",
          title: "Политика испитателного срока",
          icon: UserRoundCheck,
          path: "/settings/probation-policies",
          subtitle: "Правила адаптации",
        },
        {
          id: "documents",
          title: "Документы",
          icon: FolderOpen,
          path: "/settings/documents",
          subtitle: "Кадровые документы",
        },
      ],
      [
        {
          id: "salary-types",
          title: "Виды заработной платы",
          icon: WalletCards,
          path: "/settings/compensation",
          subtitle: "Компенсация",
          keywords: ["компенсация", "зарплата"],
        },
        {
          id: "dismissal-types",
          title: "Типы уволнение",
          icon: UserX,
          path: "/settings/dismissal-types",
          subtitle: "Виды завершения работы",
        },
      ],
      [
        {
          id: "dismissal-reasons",
          title: "Причины уволнение",
          icon: UserX,
          path: "/settings/dismissal-reasons",
          subtitle: "Классификатор причин",
        },
        {
          id: "employee-work-change-reasons",
          title: "Причины изменение работы",
          icon: ClipboardList,
          path: "/settings/employee-work-reasons",
          subtitle: "Причины для employee works",
          keywords: ["повышение", "прием на работу", "изменение работы"],
        },
      ],
    ],
  },
];

const SettingsPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const visibleSections = useMemo(() => {
    return settingsSections
      .map((section) => {
        const columns = section.columns
          .map((column) =>
            column.filter((item) => {
              if (!item.path) {
                return false;
              }

              if (!normalizedQuery) {
                return true;
              }

              const fields = [item.title, ...(item.keywords ?? [])];
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
  }, [normalizedQuery]);

  return (
    <>
      <PageMeta title="Настройки | HRMS" description="Список настроек" />

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
              placeholder="Поиск..."
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
                {section.title}
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
                            {item.title}
                          </span>
                          {item.subtitle && (
                            <span className="mt-0.5 block truncate text-xs text-gray-500">
                              {item.subtitle}
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
