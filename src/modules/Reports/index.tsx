import { useMemo, useState } from "react";
import { Link } from "react-router";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Cake,
  CalendarCheck,
  CalendarDays,
  Clock3,
  Dumbbell,
  Filter,
  HandCoins,
  LineChart,
  PieChart,
  Search,
  UserMinus,
  Workflow,
} from "lucide-react";
import PageMeta from "../../components/common/PageMeta";

type ReportItem = {
  id: string;
  title: string;
  icon: LucideIcon;
  path: string;
  subtitle?: string;
  keywords?: string[];
};

type ReportSection = {
  id: string;
  title: string;
  columns: ReportItem[][];
};

const reportSections: ReportSection[] = [
  {
    id: "hr",
    title: "Кадровые отчеты",
    columns: [
      [
        {
          id: "age-distribution",
          title: "Возрастное распределение",
          icon: BarChart3,
          path: "/reports/age-distribution",
          subtitle: "Возрастные группы по отделам",
          keywords: ["возраст", "распределение", "группы"],
        },
        {
          id: "gender-distribution",
          title: "Гендерное распределение",
          icon: PieChart,
          path: "/reports/gender-distribution",
          subtitle: "Соотношение по полу",
          keywords: ["гендер", "пол", "распределение"],
        },
      ],
      [
        {
          id: "staff-count",
          title: "Численность персонала",
          icon: LineChart,
          path: "/reports/staff-count",
          subtitle: "Прирост и текучесть по месяцам",
          keywords: ["численность", "персонал", "штат"],
        },
        {
          id: "staff-turnover",
          title: "Текучесть сотрудников",
          icon: UserMinus,
          path: "/reports/staff-turnover",
          subtitle: "Увольнения по причинам и типам",
          keywords: ["текучесть", "увольнения", "уход"],
        },
      ],
      [
        {
          id: "tenure",
          title: "Стаж",
          icon: Clock3,
          path: "/reports/tenure",
          subtitle: "Средний срок работы и годовщины",
          keywords: ["стаж", "срок", "работа"],
        },
        {
          id: "birthdays",
          title: "Дни рождения",
          icon: Cake,
          path: "/reports/birthdays",
          subtitle: "Дни рождения сотрудников по месяцам",
          keywords: ["день рождения", "дни рождения", "именины", "birthday", "месяц"],
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
          id: "recruiting-funnel",
          title: "Воронка цикла вакансии",
          icon: Filter,
          path: "/reports/recruiting-funnel",
          subtitle: "Воронка кандидатов по этапам",
          keywords: ["воронка", "рекрутинг", "вакансия", "кандидаты", "этапы"],
        },
      ],
      [
        {
          id: "recruiting-sources",
          title: "Кандидаты по источникам",
          icon: Workflow,
          path: "/reports/recruiting-sources",
          subtitle: "Источники кандидатов и динамика",
          keywords: ["источники", "кандидаты", "рекрутинг", "каналы", "hh"],
        },
      ],
      [
        {
          id: "recruiting-closure-times",
          title: "Сроки закрытия вакансий",
          icon: Clock3,
          path: "/reports/recruiting-closure-times",
          subtitle: "Сколько времени требуется до найма",
          keywords: ["сроки", "закрытие", "вакансии", "найм", "рекрутинг"],
        },
      ],
    ],
  },
  {
    id: "attendance",
    title: "Посещаемость",
    columns: [
      [
        {
          id: "absence-balance",
          title: "Баланс отсутствий",
          icon: CalendarDays,
          path: "/reports/absence-balance",
          subtitle: "Лимиты, использование и ожидающие заявки",
          keywords: ["баланс", "выходные", "отсутствие", "отпуск", "ожидает", "лимит"],
        },
      ],
      [
        {
          id: "attendance",
          title: "Посещаемость",
          icon: CalendarCheck,
          path: "/reports/attendance",
          subtitle: "Рабочие дни, отработано и отсутствия",
          keywords: ["посещаемость", "рабочие дни", "отсутствия", "отработано"],
        },
        {
          id: "lateness",
          title: "Опоздания",
          icon: Clock3,
          path: "/reports/lateness",
          subtitle: "Минуты опозданий и количество раз",
          keywords: ["опоздания", "опоздал", "минуты", "поздно"],
        },
      ],
      [
        {
          id: "sport-attendance",
          title: "Посещение спорта",
          icon: Dumbbell,
          path: "/reports/sport-attendance",
          subtitle: "Спортивные посещения по сотрудникам",
          keywords: ["спорт", "посещение", "фитнес"],
        },
      ],
    ],
  },
  {
    id: "finance",
    title: "Финансы",
    columns: [
      [
        {
          id: "bonus-deductions",
          title: "Ведомость бонусов и удержаний",
          icon: HandCoins,
          path: "/reports/bonus-deductions",
          subtitle: "Начисления, удержания, сумма к выплате",
          keywords: ["бонусы", "удержания", "ведомость"],
        },
      ],
      [],
    ],
  },
];

const ReportsHomePage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const visibleSections = useMemo(() => {
    return reportSections
      .map((section) => {
        const columns = section.columns
          .map((column) =>
            column.filter((item) => {
              if (!normalizedQuery) return true;
              const fields = [item.title, ...(item.keywords ?? [])];
              return fields.some((field) =>
                field.toLowerCase().includes(normalizedQuery)
              );
            })
          )
          .filter((column) => column.length > 0);

        return { ...section, columns };
      })
      .filter((section) => section.columns.length > 0);
  }, [normalizedQuery]);

  return (
    <>
      <PageMeta title="Отчеты | HRMS" description="Обзор модулей отчетности" />

      <div className="space-y-4">
        <div className="-mx-4 border-y border-gray-200 bg-white px-4 py-5 md:-mx-6 md:px-6">
          <h1 className="text-2xl font-semibold text-gray-900">Отчеты</h1>
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
              onChange={(e) => setSearchQuery(e.target.value)}
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
                {section.columns.map((column, colIndex) =>
                  column.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={`${section.id}-${colIndex}-${item.id}`}
                        to={item.path}
                        className="group flex items-start gap-2.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-sm"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-brand-100 bg-brand-50 text-brand-500 transition-colors group-hover:bg-brand-100">
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

export default ReportsHomePage;
