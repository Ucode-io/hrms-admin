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
  ListTodo,
  PieChart,
  Search,
  UserMinus,
  Workflow,
} from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import { useTranslation } from "../../i18n";
import type { MessageKey } from "../../i18n/messages";

type ReportItem = {
  id: string;
  titleKey: MessageKey;
  icon: LucideIcon;
  path: string;
  subtitleKey?: MessageKey;
  // ponytail: search aliases stay literal — they are extra match terms, not shown anywhere.
  keywords?: string[];
};

type ReportSection = {
  id: string;
  titleKey: MessageKey;
  columns: ReportItem[][];
};

const reportSections: ReportSection[] = [
  {
    id: "hr",
    titleKey: "reports.index.section_hr",
    columns: [
      [
        {
          id: "age-distribution",
          titleKey: "reports.index.age_distribution_title",
          icon: BarChart3,
          path: "/reports/age-distribution",
          subtitleKey: "reports.index.age_distribution_subtitle",
          keywords: ["возраст", "распределение", "группы"],
        },
        {
          id: "gender-distribution",
          titleKey: "reports.index.gender_distribution_title",
          icon: PieChart,
          path: "/reports/gender-distribution",
          subtitleKey: "reports.index.gender_distribution_subtitle",
          keywords: ["гендер", "пол", "распределение"],
        },
      ],
      [
        {
          id: "staff-count",
          titleKey: "reports.index.staff_count_title",
          icon: LineChart,
          path: "/reports/staff-count",
          subtitleKey: "reports.index.staff_count_subtitle",
          keywords: ["численность", "персонал", "штат"],
        },
        {
          id: "staff-turnover",
          titleKey: "reports.index.staff_turnover_title",
          icon: UserMinus,
          path: "/reports/staff-turnover",
          subtitleKey: "reports.index.staff_turnover_subtitle",
          keywords: ["текучесть", "увольнения", "уход"],
        },
      ],
      [
        {
          id: "tenure",
          titleKey: "reports.index.tenure_title",
          icon: Clock3,
          path: "/reports/tenure",
          subtitleKey: "reports.index.tenure_subtitle",
          keywords: ["стаж", "срок", "работа"],
        },
        {
          id: "birthdays",
          titleKey: "reports.index.birthdays_title",
          icon: Cake,
          path: "/reports/birthdays",
          subtitleKey: "reports.index.birthdays_subtitle",
          keywords: ["день рождения", "дни рождения", "именины", "birthday", "месяц"],
        },
      ],
    ],
  },
  {
    id: "recruiting",
    titleKey: "reports.index.section_recruiting",
    columns: [
      [
        {
          id: "recruiting-funnel",
          titleKey: "reports.index.recruiting_funnel_title",
          icon: Filter,
          path: "/reports/recruiting-funnel",
          subtitleKey: "reports.index.recruiting_funnel_subtitle",
          keywords: ["воронка", "рекрутинг", "вакансия", "кандидаты", "этапы"],
        },
      ],
      [
        {
          id: "recruiting-sources",
          titleKey: "reports.index.recruiting_sources_title",
          icon: Workflow,
          path: "/reports/recruiting-sources",
          subtitleKey: "reports.index.recruiting_sources_subtitle",
          keywords: ["источники", "кандидаты", "рекрутинг", "каналы", "hh"],
        },
      ],
      [
        {
          id: "recruiting-closure-times",
          titleKey: "reports.index.recruiting_closure_times_title",
          icon: Clock3,
          path: "/reports/recruiting-closure-times",
          subtitleKey: "reports.index.recruiting_closure_times_subtitle",
          keywords: ["сроки", "закрытие", "вакансии", "найм", "рекрутинг"],
        },
      ],
    ],
  },
  {
    id: "attendance",
    titleKey: "reports.index.section_attendance",
    columns: [
      [
        {
          id: "absence-balance",
          titleKey: "reports.index.absence_balance_title",
          icon: CalendarDays,
          path: "/reports/absence-balance",
          subtitleKey: "reports.index.absence_balance_subtitle",
          keywords: ["баланс", "выходные", "отсутствие", "отпуск", "ожидает", "лимит"],
        },
      ],
      [
        {
          id: "attendance",
          titleKey: "reports.index.attendance_title",
          icon: CalendarCheck,
          path: "/reports/attendance",
          subtitleKey: "reports.index.attendance_subtitle",
          keywords: ["посещаемость", "рабочие дни", "отсутствия", "отработано"],
        },
        {
          id: "lateness",
          titleKey: "reports.index.lateness_title",
          icon: Clock3,
          path: "/reports/lateness",
          subtitleKey: "reports.index.lateness_subtitle",
          keywords: ["опоздания", "опоздал", "минуты", "поздно"],
        },
      ],
      [
        {
          id: "timesheet",
          titleKey: "reports.index.timesheet_title",
          icon: Clock3,
          path: "/reports/timesheet",
          subtitleKey: "reports.index.timesheet_subtitle",
          keywords: ["табель", "время", "план", "факт", "переработка", "недоработка", "time doctor"],
        },
        {
          id: "sport-attendance",
          titleKey: "reports.index.sport_attendance_title",
          icon: Dumbbell,
          path: "/reports/sport-attendance",
          subtitleKey: "reports.index.sport_attendance_subtitle",
          keywords: ["спорт", "посещение", "фитнес"],
        },
      ],
    ],
  },
  {
    id: "tasks",
    titleKey: "reports.index.section_tasks",
    columns: [
      [
        {
          id: "tasks",
          titleKey: "reports.index.tasks_title",
          icon: ListTodo,
          path: "/reports/tasks",
          subtitleKey: "reports.index.tasks_subtitle",
          keywords: ["задачи", "статусы", "дедлайн", "срок", "просрочено", "tasks"],
        },
      ],
      [],
    ],
  },
  {
    id: "finance",
    titleKey: "reports.index.section_finance",
    columns: [
      [
        {
          id: "bonus-deductions",
          titleKey: "reports.index.bonus_deductions_title",
          icon: HandCoins,
          path: "/reports/bonus-deductions",
          subtitleKey: "reports.index.bonus_deductions_subtitle",
          keywords: ["бонусы", "удержания", "ведомость"],
        },
      ],
      [],
    ],
  },
];

const ReportsHomePage: React.FC = () => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const visibleSections = useMemo(() => {
    return reportSections
      .map((section) => {
        const columns = section.columns
          .map((column) =>
            column.filter((item) => {
              if (!normalizedQuery) return true;
              const fields = [t(item.titleKey), ...(item.keywords ?? [])];
              return fields.some((field) =>
                field.toLowerCase().includes(normalizedQuery)
              );
            })
          )
          .filter((column) => column.length > 0);

        return { ...section, columns };
      })
      .filter((section) => section.columns.length > 0);
  }, [normalizedQuery, t]);

  return (
    <>
      <PageMeta
        title={t("reports.index.page_title")}
        description={t("reports.index.page_description")}
      />

      <div className="space-y-4">
        <div className="-mx-4 border-y border-gray-200 bg-white px-4 py-5 md:-mx-6 md:px-6">
          <h1 className="text-2xl font-semibold text-gray-900">{t("reports.index.page_heading")}</h1>
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
              placeholder={t("reports.index.search_placeholder")}
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
                            {t(item.titleKey)}
                          </span>
                          {item.subtitleKey && (
                            <span className="mt-0.5 block truncate text-xs text-gray-500">
                              {t(item.subtitleKey)}
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
              <p className="text-base font-medium text-gray-800">{t("reports.index.no_results")}</p>
              <p className="mt-1 text-sm text-gray-500">
                {t("reports.index.try_changing_query")}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ReportsHomePage;
