import { useMemo, useState } from "react";
import { Link } from "react-router";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Brain,
  Briefcase,
  BriefcaseBusiness,
  Building2,
  CalendarCheck,
  CalendarDays,
  CircleUserRound,
  ClipboardList,
  Columns2,
  CreditCard,
  FileCheck,
  FileOutput,
  FolderOpen,
  Funnel,
  Globe,
  Handshake,
  Home,
  IdCard,
  Import,
  LaptopMinimal,
  Link2,
  ListOrdered,
  Mail,
  MapPin,
  Monitor,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  UserRoundCheck,
  UserX,
  WalletCards,
  Webhook,
} from "lucide-react";
import PageMeta from "../../components/common/PageMeta";

type SettingsItem = {
  id: string;
  title: string;
  icon: LucideIcon;
  path?: string;
  subtitle?: string;
  keywords?: string[];
};

type SettingsSection = {
  id: string;
  title: string;
  columns: SettingsItem[][];
};

const settingsSections: SettingsSection[] = [
  {
    id: "general",
    title: "Общие",
    columns: [
      [
        {
          id: "general-main",
          title: "Общие",
          icon: SlidersHorizontal,
          path: "/settings/general",
          subtitle: "Базовые параметры",
          keywords: ["платформа", "настройки"],
        },
        { id: "webhooks", title: "Вебхуки", icon: Webhook, subtitle: "События и триггеры", keywords: ["hooks"] },
        { id: "accounts", title: "Счета", icon: CreditCard, subtitle: "Оплаты и реквизиты", keywords: ["биллинг"] },
      ],
      [
        { id: "alerts", title: "Оповещения", icon: Bell, subtitle: "Уведомления и каналы", keywords: ["уведомления"] },
        { id: "import", title: "Импорт", icon: Import, subtitle: "Загрузка данных", keywords: ["загрузка"] },
      ],
      [
        { id: "integrations", title: "Интеграции", icon: Link2, subtitle: "Внешние сервисы", keywords: ["api"] },
        { id: "export", title: "Экспорт", icon: FileOutput, subtitle: "Выгрузка отчетов", keywords: ["выгрузка"] },
      ],
    ],
  },
  {
    id: "core",
    title: "Основные",
    columns: [
      [
        { id: "home", title: "Главная", icon: Home, subtitle: "Общие настройки", path: "/settings/home", },
        {
          id: "experience-level",
          title: "Уровень опыта",
          icon: ListOrdered,
          path: "/settings/experience-levels",
          subtitle: "Грейды и уровни",
          keywords: ["грейды", "уровни"],
        },
        {
          id: "locations",
          title: "Локации",
          icon: MapPin,
          path: "/settings/locations",
          subtitle: "Офисы и филиалы",
          keywords: ["адрес", "офисы", "страны"],
        },
        // { id: "gender", title: "Пол", icon: VenusAndMars, subtitle: "Справочник значений" },
        // { id: "forms", title: "Формы", icon: FileText, subtitle: "Поля и шаблоны" },
      ],
      [
        // { id: "calendars", title: "Календари", icon: CalendarDays, subtitle: "Рабочие графики" },
        {
          id: "departments",
          title: "Департаменты",
          icon: Building2,
          path: "/settings/departments",
          subtitle: "Структура компании",
          keywords: ["иерархия", "департаменты"],
        },
        {
          id: "holiday-policies",
          title: "Политики праздников",
          icon: CalendarCheck,
          subtitle: "Праздничные правила",
          path: "/settings/holiday-policies",
          keywords: ["праздники", "календарь"],
        },
        // { id: "job-catalog", title: "Каталог должностей", icon: ListOrdered, subtitle: "Позиции и роли" },
      ],
      [
        {
          id: "job-titles",
          title: "Должности",
          icon: BriefcaseBusiness,
          path: "/settings/positions",
          subtitle: "Справочник ролей",
          keywords: ["позиции", "роли"],
        },
        {
          id: "subdivisions",
          title: "Подразделения",
          icon: Columns2,
          path: "/settings/divisions",
          subtitle: "Внутренняя иерархия",
          keywords: ["структура", "отделы"],
        },
        {
          id: "employment-types",
          title: "Виды занятости",
          icon: Briefcase,
          path: "/settings/employment-types",
          subtitle: "Форматы работы",
          keywords: ["контракт", "тип занятости"],
        },
        {
          id: "skills",
          title: "Навыки",
          icon: Brain,
          path: "/settings/skills",
          subtitle: "Матрица компетенций",
          keywords: ["компетенции", "умения"],
        },
      ],
    ],
  },
  {
    id: "hr",
    title: "HR",
    columns: [
      [
        {
          id: "absence-policies",
          title: "Политики отсутствий",
          icon: CalendarDays,
          path: "/settings/absence-policies",
          subtitle: "Отпуска и больничные",
        },
        {
          id: "probation-policies",
          title: "Политики испытательного срока",
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
        {
          id: "property-categories",
          title: "Категории имущества",
          icon: LaptopMinimal,
          path: "/settings/property-categories",
          subtitle: "Активы и инвентарь",
        },
      ],
      [
        {
          id: "work-schedules",
          title: "Графики работы",
          icon: ListOrdered,
          subtitle: "Смены и часы",
          path: "/settings/work-schedules",
        },
        {
          id: "dismissal-reasons",
          title: "Причины увольнения",
          icon: UserX,
          path: "/settings/dismissal-reasons",
          subtitle: "Классификатор причин",
        },
        // { id: "people-data", title: "Данные о людях", icon: IdCard, subtitle: "Личные данные" },
      ],
      [
        {
          id: "compensation",
          title: "Компенсация",
          icon: WalletCards,
          path: "/settings/compensation",
          subtitle: "Выплаты и бонусы",
        },
        {
          id: "dismissal-types",
          title: "Типы увольнения",
          icon: UserX,
          path: "/settings/dismissal-types",
          subtitle: "Виды завершения работы",
        },
        {
          id: "employee-work-change-reasons",
          title: "Причины изменения работы",
          icon: ClipboardList,
          path: "/settings/employee-work-reasons",
          subtitle: "Причины для employee works",
          keywords: ["повышение", "прием на работу", "изменение работы"],
        },
        { id: "asset-fields", title: "Поля активов", icon: Monitor, subtitle: "Параметры имущества" },
      ],
    ],
  },
  {
    id: "recruit",
    title: "Recruit",
    columns: [
      [
        { id: "career-site", title: "Карьерный сайт", icon: Globe, subtitle: "Публичная страница" },
        { id: "candidate-fields", title: "Поля кандидата", icon: IdCard, subtitle: "Анкеты и атрибуты" },
        { id: "sources", title: "Источники", icon: Funnel, subtitle: "Каналы привлечения" },
        { id: "interview-templates", title: "Шаблоны интервью", icon: Mail, subtitle: "Сценарии интервью" },
        { id: "tags", title: "Теги", icon: Tags, subtitle: "Метки и фильтрация" },
      ],
      [
        { id: "gdpr", title: "GDPR", icon: ShieldCheck, subtitle: "Персональные данные" },
        { id: "vacancy-stages", title: "Этапы вакансии", icon: Columns2, subtitle: "Воронка подбора" },
        { id: "score-sheet", title: "Оценочный лист", icon: ClipboardList, subtitle: "Формы оценки" },
        { id: "offer-templates", title: "Шаблоны предложений", icon: Handshake, subtitle: "Офферы и согласования" },
        { id: "contracts", title: "Контракты", icon: FileCheck, subtitle: "Трудовые офферы" },
      ],
      [
        { id: "vacancy-fields", title: "Поля вакансии", icon: Monitor, subtitle: "Параметры вакансий" },
        { id: "decline-reasons", title: "Причины отказа", icon: UserX, subtitle: "Справочник отказов" },
        { id: "email-templates", title: "Шаблоны эл. писем", icon: Mail, subtitle: "Письма кандидатам" },
        { id: "resume-templates", title: "Шаблоны резюме", icon: CircleUserRound, subtitle: "Карточки резюме" },
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
        <div className="-mx-4 border-y border-gray-200 bg-white px-4 py-5 md:-mx-6 md:px-6">
          <h1 className="text-2xl font-semibold text-gray-900">Настройки</h1>
        </div>

        <div className="-mx-4 border-b border-gray-200 px-4 pb-4 md:-mx-6 md:px-6">
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
                    const isClickable = Boolean(item.path);
                    const content = (
                      <>
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors ${isClickable
                            ? "border-brand-100 bg-brand-50 text-brand-500 group-hover:bg-brand-100"
                            : "border-gray-200 bg-gray-100 text-gray-400"
                            }`}
                        >
                          <Icon size={15} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block truncate text-sm font-semibold ${isClickable ? "text-gray-900" : "text-gray-500"
                              }`}
                          >
                            {item.title}
                          </span>
                          {item.subtitle && (
                            <span
                              className={`mt-0.5 block truncate text-xs ${isClickable ? "text-gray-500" : "text-gray-400"
                                }`}
                            >
                              {item.subtitle}
                            </span>
                          )}
                        </span>
                        {!isClickable && (
                          <span className="shrink-0 rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                            Скоро
                          </span>
                        )}
                      </>
                    );

                    if (isClickable && item.path) {
                      return (
                        <Link
                          key={`${section.id}-${index}-${item.id}`}
                          to={item.path}
                          className="group flex items-start gap-2.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-sm"
                        >
                          {content}
                        </Link>
                      );
                    }

                    return (
                      <div
                        key={`${section.id}-${index}-${item.id}`}
                        className="flex cursor-not-allowed items-start gap-2.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5"
                      >
                        {content}
                      </div>
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
