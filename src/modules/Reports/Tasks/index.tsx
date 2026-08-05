import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import { Link } from "react-router";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";
import PageMeta from "../../../components/common/PageMeta";
import Spinner from "../../../components/ui/Spinner";
import {
  type TaskDeadlineBucketKey,
  type TasksByStatusItem,
  useTasksByEmployeeQuery,
  useTasksByStatusReportQuery,
  useTasksByStatusTableQuery,
} from "../../../api/services/reports.service";

const TABLE_PAGE_LIMIT = 20;

type DetailTab = "tasks" | "employees";

/**
 * Порядок и цвета бакетов срока — общие для диаграммы, фильтра и таблицы,
 * чтобы «Просрочено» везде было одним и тем же красным.
 */
const DEADLINE_BUCKETS: {
  key: TaskDeadlineBucketKey;
  label: string;
  /** Короткая подпись — для центра кольца, куда полная не помещается. */
  short: string;
  color: string;
}[] = [
  { key: "overdue", label: "Просрочено", short: "Просрочено", color: "#F04438" },
  { key: "today", label: "Сегодня", short: "Сегодня", color: "#F79009" },
  { key: "week", label: "В течение недели", short: "На неделе", color: "#0BA5EC" },
  { key: "later", label: "Позже", short: "Позже", color: "#7A5AF8" },
  { key: "no_deadline", label: "Без срока", short: "Без срока", color: "#94A3B8" },
  { key: "completed", label: "Завершено", short: "Завершено", color: "#12B76A" },
];

const BUCKET_BY_KEY = new Map(DEADLINE_BUCKETS.map((bucket) => [bucket.key, bucket]));

const FALLBACK_STATUS_COLORS = [
  "#6B8FE3",
  "#12B76A",
  "#F79009",
  "#F04438",
  "#7A5AF8",
  "#06B6D4",
  "#EC4899",
  "#84CC16",
];

const DANGER = "#D92D20";
const SUCCESS = "#039855";

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return "Не удалось загрузить отчет. Попробуйте снова.";
};

const isHexColor = (value: string): boolean => /^#[0-9a-f]{3,8}$/i.test(value);

const statusColor = (status: { color: string }, index: number): string =>
  isHexColor(status.color)
    ? status.color
    : FALLBACK_STATUS_COLORS[index % FALLBACK_STATUS_COLORS.length];

const formatDate = (value: string | null): string => {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}.${month}.${year}`;
};

// Дни: падеж считаем по последним цифрам — «1 день», «3 дня», «11 дней».
const pluralizeDays = (count: number): string => {
  const abs = Math.abs(count);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "дня";
  return "дней";
};

const formatDays = (count: number): string => `${count} ${pluralizeDays(count)}`;

const formatPercent = (value: number): string => `${String(value).replace(".", ",")}%`;

const getVisiblePages = (currentPage: number, totalPages: number, maxButtons = 7): number[] => {
  if (totalPages <= maxButtons) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const half = Math.floor(maxButtons / 2);
  let start = currentPage - half;
  let end = currentPage + half;

  if (start < 1) {
    start = 1;
    end = maxButtons;
  }

  if (end > totalPages) {
    end = totalPages;
    start = totalPages - maxButtons + 1;
  }

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
};

function MetricCard({
  title,
  value,
  hint,
  accent,
}: {
  title: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold" style={{ color: accent || "#101828" }}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-gray-400">{hint}</p> : null}
    </article>
  );
}

function StatusBadge({ title, color }: { title: string; color: string }) {
  const safe = isHexColor(color) ? color : "#94A3B8";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${safe}1a`, color: isHexColor(color) ? color : "#475569" }}
    >
      {title}
    </span>
  );
}

function Pagination({
  page,
  totalPages,
  disabled,
  onChange,
}: {
  page: number;
  totalPages: number;
  disabled: boolean;
  onChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={page <= 1 || disabled}
        onClick={() => onChange(Math.max(1, page - 1))}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ChevronLeft size={15} />
      </button>

      {getVisiblePages(page, totalPages).map((item) => {
        const isActive = item === page;
        return (
          <button
            key={item}
            type="button"
            disabled={disabled}
            onClick={() => onChange(item)}
            className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-70"
            style={{
              borderColor: isActive ? "var(--company-color)" : "#e5e7eb",
              backgroundColor: isActive ? "var(--company-color)" : "#ffffff",
              color: isActive ? "#ffffff" : "#334155",
            }}
          >
            {item}
          </button>
        );
      })}

      <button
        type="button"
        disabled={page >= totalPages || disabled}
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  );
}

function TasksReportPage() {
  const [tab, setTab] = useState<DetailTab>("tasks");
  const [tablePage, setTablePage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [bucket, setBucket] = useState<TaskDeadlineBucketKey | "">("");
  const [statusId, setStatusId] = useState("");
  const [onlyDelayed, setOnlyDelayed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setTablePage(1);
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, isFetching, isError, error, refetch } = useTasksByStatusReportQuery();

  const tasksRequestData = useMemo(
    () => ({
      ...(search ? { search } : {}),
      ...(bucket ? { deadline_bucket: bucket } : {}),
      ...(statusId ? { status_ids: [statusId] } : {}),
      // В срезе опозданий сортируем по размеру просрочки: там важно «на сколько»,
      // а не «когда дедлайн».
      ...(onlyDelayed ? { only_delayed: true, sort: "overdue" } : {}),
    }),
    [search, bucket, statusId, onlyDelayed]
  );

  const employeesRequestData = useMemo(
    () => ({
      ...(search ? { search } : {}),
      ...(onlyDelayed ? { only_delayed: true } : {}),
    }),
    [search, onlyDelayed]
  );

  const {
    data: tableData,
    isLoading: isTableLoading,
    isFetching: isTableFetching,
    isError: isTableError,
    error: tableError,
    refetch: refetchTable,
  } = useTasksByStatusTableQuery({
    requestData: tasksRequestData,
    page: tab === "tasks" ? tablePage : 1,
    limit: TABLE_PAGE_LIMIT,
  });

  const {
    data: employeeData,
    isLoading: isEmployeeLoading,
    isFetching: isEmployeeFetching,
    isError: isEmployeeError,
    error: employeeError,
    refetch: refetchEmployees,
  } = useTasksByEmployeeQuery({
    requestData: employeesRequestData,
    page: tab === "employees" ? tablePage : 1,
    limit: TABLE_PAGE_LIMIT,
    enabled: tab === "employees",
  });

  const cards = data?.result?.cards ?? {};
  const byStatus: TasksByStatusItem[] = data?.result?.charts?.by_status ?? [];
  const byDeadline = data?.result?.charts?.by_deadline ?? [];
  const topOverdue = data?.result?.charts?.top_overdue ?? [];

  const countSeries = [{ name: "Задач", data: byStatus.map((item) => item.count) }];

  // Apex тянет столбец на всю ширину категории, поэтому при одном-двух
  // статусах «45%» превращались в сплошную плашку вместо графика.
  const columnWidth = byStatus.length <= 3 ? "56px" : "45%";

  const countOptions: ApexOptions = {
    chart: { type: "bar", fontFamily: "Outfit, sans-serif", toolbar: { show: false } },
    colors: byStatus.map((item, index) => statusColor(item, index)),
    plotOptions: { bar: { borderRadius: 6, columnWidth, distributed: true } },
    legend: { show: false },
    dataLabels: { enabled: true },
    xaxis: {
      categories: byStatus.map((item) => item.title),
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { fontSize: "11px", colors: "#64748b" } },
    },
    yaxis: { labels: { style: { fontSize: "12px", colors: ["#64748b"] } } },
    grid: { borderColor: "#e5e7eb", strokeDashArray: 4 },
    tooltip: { y: { formatter: (value: number) => `${value} задач` } },
  };

  /**
   * Сроки — кольцевая диаграмма по бакетам, а не стек по статусам: статусов в
   * работе бывает один-два, и стек вырождался в сплошной прямоугольник. Разрез
   * «срок внутри статуса» остаётся доступен фильтрами таблицы.
   */
  const deadlineSlices = DEADLINE_BUCKETS.map((item) => ({
    ...item,
    count: byDeadline.find((entry) => entry.key === item.key)?.count ?? 0,
  })).filter((item) => item.count > 0);

  const deadlineSeries = deadlineSlices.map((item) => item.count);

  const deadlineOptions: ApexOptions = {
    chart: { type: "donut", fontFamily: "Outfit, sans-serif", toolbar: { show: false } },
    labels: deadlineSlices.map((item) => item.label),
    colors: deadlineSlices.map((item) => item.color),
    legend: { position: "bottom", fontSize: "12px" },
    stroke: { width: 0 },
    dataLabels: {
      enabled: true,
      formatter: (_value: number, opts) =>
        String(deadlineSlices[opts.seriesIndex]?.count ?? ""),
      style: { fontSize: "12px", fontWeight: 600 },
      dropShadow: { enabled: false },
    },
    plotOptions: {
      pie: {
        donut: {
          size: "62%",
          labels: {
            show: true,
            // При наведении Apex подставляет в центр подпись сегмента: полная
            // «В течение недели» в круг не помещается.
            name: {
              fontSize: "13px",
              color: "#64748b",
              formatter: (value: string) =>
                deadlineSlices.find((item) => item.label === value)?.short ?? value,
            },
            value: {
              fontSize: "20px",
              fontWeight: 600,
              color: "#101828",
              formatter: (value: string) => `${Number(value)} задач`,
            },
            total: {
              show: true,
              label: "Всего задач",
              fontSize: "13px",
              color: "#64748b",
              formatter: () => String(deadlineSlices.reduce((sum, item) => sum + item.count, 0)),
            },
          },
        },
      },
    },
    // У donut'а тултип по умолчанию тёмный, а глобальный стиль проекта красит
    // его текст в тёмно-серый (index.css оформляет только `theme-light`) —
    // получалось тёмное на тёмном. Заодно снимаем заливку цветом сегмента.
    tooltip: {
      theme: "light",
      fillSeriesColor: false,
      y: { formatter: (value: number) => `${value} задач` },
    },
  };

  const tasksResult = tableData?.result;
  const taskItems = tasksResult?.items ?? [];
  const employeesResult = employeeData?.result;
  const employeeItems = employeesResult?.items ?? [];

  const activePagination =
    tab === "tasks" ? tasksResult?.pagination : employeesResult?.pagination;
  const totalCount = activePagination?.total_count ?? 0;
  const totalPages = Math.max(1, activePagination?.total_pages ?? 1);
  const from = activePagination?.from ?? 0;
  const to = activePagination?.to ?? 0;

  const isDetailLoading = tab === "tasks" ? isTableLoading : isEmployeeLoading;
  const isDetailFetching = tab === "tasks" ? isTableFetching : isEmployeeFetching;
  const isDetailError = tab === "tasks" ? isTableError : isEmployeeError;
  const detailError = tab === "tasks" ? tableError : employeeError;
  const refetchDetail = tab === "tasks" ? refetchTable : refetchEmployees;

  const taskColumns = [
    "Код",
    "Задача",
    "Статус",
    "Исполнители",
    "Дедлайн",
    "Закрыто",
    "Просрочка",
    "Срок",
  ];

  const employeeColumns = [
    "Сотрудник",
    "Всего",
    "Открытых",
    "Просрочено",
    "Завершено",
    "В срок",
    "С опозданием",
    "% в срок",
    "Просрочка, всего",
    "Средняя",
    "Максимум",
  ];

  const detailColumns = tab === "tasks" ? taskColumns : employeeColumns;

  if (isLoading) {
    return (
      <>
        <PageMeta title="Задачи | Отчеты | HRMS" description="Отчет по задачам" />
        <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-gray-200 bg-white">
          <Spinner />
        </div>
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageMeta title="Задачи | Отчеты | HRMS" description="Отчет по задачам" />
        <div className="rounded-2xl border border-error-200 bg-error-50 p-6">
          <p className="text-sm font-medium text-error-700">{getErrorMessage(error)}</p>
          <button
            type="button"
            onClick={() => {
              void refetch();
            }}
            className="mt-3 inline-flex h-10 items-center justify-center rounded-xl bg-error-600 px-4 text-sm font-semibold text-white transition hover:bg-error-700"
          >
            Повторить
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageMeta title="Задачи | Отчеты | HRMS" description="Отчет по задачам" />

      <div className="space-y-4">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Всего задач" value={String(cards.total ?? 0)} />
          <MetricCard
            title="Открытые"
            value={String(cards.open ?? 0)}
            hint={`К выполнению ${cards.todo ?? 0} · В работе ${cards.in_progress ?? 0}`}
          />
          <MetricCard
            title="Просрочено сейчас"
            value={String(cards.overdue ?? 0)}
            accent={(cards.overdue ?? 0) > 0 ? DANGER : undefined}
            hint={`Сегодня ${cards.due_today ?? 0} · На неделе ${cards.due_week ?? 0}`}
          />
          <MetricCard
            title="Завершено"
            value={`${cards.completed ?? 0} (${formatPercent(cards.completion_rate ?? 0)})`}
            hint={`Без дедлайна ${cards.completed_without_deadline ?? 0}`}
          />
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Закрыто вовремя"
            value={String(cards.completed_on_time ?? 0)}
            accent={SUCCESS}
            hint={`${formatPercent(cards.on_time_rate ?? 0)} от завершённых с дедлайном`}
          />
          <MetricCard
            title="Закрыто с опозданием"
            value={String(cards.completed_late ?? 0)}
            accent={(cards.completed_late ?? 0) > 0 ? DANGER : undefined}
            hint={`Суммарно ${formatDays(cards.late_days_completed ?? 0)} сверх срока`}
          />
          <MetricCard
            title="Общая просрочка"
            value={formatDays(cards.late_days_total ?? 0)}
            accent={(cards.late_days_total ?? 0) > 0 ? DANGER : undefined}
            hint={`Закрытые ${cards.late_days_completed ?? 0} · Открытые ${cards.late_days_open ?? 0}`}
          />
          <MetricCard
            title="Просрочка на задачу"
            value={formatDays(cards.avg_overdue_days ?? 0)}
            hint={`Задач с просрочкой ${cards.tasks_with_delay ?? 0} · Максимум ${formatDays(
              cards.max_overdue_days ?? 0
            )}`}
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <article className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
            <h3 className="text-lg font-semibold text-gray-900">Задачи по статусам</h3>
            <p className="text-sm text-gray-500">Количество задач в каждом статусе</p>
            {byStatus.length === 0 ? (
              <div className="mt-2 flex h-[280px] items-center justify-center text-sm text-gray-500">
                Нет данных для графика
              </div>
            ) : (
              <div className="mt-2">
                <Chart options={countOptions} series={countSeries} type="bar" height={300} />
              </div>
            )}
          </article>

          <article className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
            <h3 className="text-lg font-semibold text-gray-900">Задачи по срокам</h3>
            <p className="text-sm text-gray-500">
              Просрочено, горит сегодня, в течение недели, позже и без срока
            </p>
            {deadlineSeries.length === 0 ? (
              <div className="mt-2 flex h-[280px] items-center justify-center text-sm text-gray-500">
                Нет данных для графика
              </div>
            ) : (
              <div className="mt-2">
                <Chart
                  options={deadlineOptions}
                  series={deadlineSeries}
                  type="donut"
                  height={300}
                />
              </div>
            )}
          </article>
        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3">
            <h3 className="text-lg font-semibold text-gray-900">Самые просроченные задачи</h3>
            <p className="text-sm text-gray-500">
              Топ-10 по числу дней сверх дедлайна: и закрытые с опозданием, и висящие открытыми
            </p>
          </div>

          {topOverdue.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">
              Задач с просрочкой нет
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-gray-50">
                    {["Код", "Задача", "Статус", "Исполнители", "Дедлайн", "Закрыто", "Просрочка"].map(
                      (column) => (
                        <th
                          key={column}
                          className="whitespace-nowrap border-b border-gray-200 px-4 py-2.5 text-left text-sm font-semibold text-gray-700"
                        >
                          {column}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {topOverdue.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap border-b border-gray-100 px-4 py-2.5 text-sm font-medium text-gray-500">
                        {item.code || "—"}
                      </td>
                      <td className="border-b border-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-800">
                        <Link to="/tasks" className="transition hover:text-brand-500">
                          {item.title || "Без названия"}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap border-b border-gray-100 px-4 py-2.5">
                        <StatusBadge title={item.status_title} color={item.status_color} />
                      </td>
                      <td className="border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                        {item.assignees || "—"}
                      </td>
                      <td className="whitespace-nowrap border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                        {formatDate(item.deadline)}
                      </td>
                      <td className="whitespace-nowrap border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                        {item.is_completed ? formatDate(item.completion_date) : "—"}
                      </td>
                      <td
                        className="whitespace-nowrap border-b border-gray-100 px-4 py-2.5 text-sm font-semibold"
                        style={{ color: DANGER }}
                      >
                        +{formatDays(item.overdue_days)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="inline-flex rounded-xl border border-gray-200 p-0.5">
              {(
                [
                  { key: "tasks", label: "Задачи" },
                  { key: "employees", label: "По исполнителям" },
                ] as { key: DetailTab; label: string }[]
              ).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setTab(item.key);
                    setTablePage(1);
                  }}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium transition"
                  style={{
                    backgroundColor: tab === item.key ? "var(--company-color)" : "transparent",
                    color: tab === item.key ? "#ffffff" : "#475569",
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="relative w-full sm:w-64">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder={tab === "tasks" ? "Название или код..." : "Сотрудник..."}
                  className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-700 outline-none transition focus:border-brand-300"
                />
              </label>

              {tab === "tasks" ? (
                <>
                  <select
                    value={statusId}
                    onChange={(event) => {
                      setStatusId(event.target.value);
                      setTablePage(1);
                    }}
                    className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-brand-300"
                  >
                    <option value="">Все статусы</option>
                    {byStatus.map((status) => (
                      <option key={status.status_id ?? status.title} value={status.status_id ?? ""}>
                        {status.title} ({status.count})
                      </option>
                    ))}
                  </select>

                  <select
                    value={bucket}
                    onChange={(event) => {
                      setBucket(event.target.value as TaskDeadlineBucketKey | "");
                      setTablePage(1);
                    }}
                    className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-brand-300"
                  >
                    <option value="">Все сроки</option>
                    {DEADLINE_BUCKETS.map((item) => {
                      const count = byDeadline.find((entry) => entry.key === item.key)?.count ?? 0;
                      return (
                        <option key={item.key} value={item.key}>
                          {item.label} ({count})
                        </option>
                      );
                    })}
                  </select>
                </>
              ) : null}

              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-gray-200 px-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={onlyDelayed}
                  onChange={(event) => {
                    setOnlyDelayed(event.target.checked);
                    setTablePage(1);
                  }}
                  className="h-4 w-4 accent-error-500"
                />
                Только с просрочкой
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-medium text-gray-500">
              {totalCount > 0 ? `Отображение ${from} - ${to} из ${totalCount}` : "Нет данных"}
              {tab === "employees" && (employeesResult?.unassigned ?? 0) > 0
                ? ` · Без исполнителя: ${employeesResult?.unassigned}`
                : ""}
            </p>

            <Pagination
              page={tablePage}
              totalPages={totalPages}
              disabled={isDetailFetching}
              onChange={setTablePage}
            />
          </div>

          <div className="relative overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-gray-50">
                  {detailColumns.map((column) => (
                    <th
                      key={column}
                      className="whitespace-nowrap border-b border-gray-200 px-4 py-2.5 text-left text-sm font-semibold text-gray-700"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isDetailLoading ? (
                  Array.from({ length: 10 }).map((_, rowIndex) => (
                    <tr key={`skeleton-${rowIndex}`} className="animate-pulse">
                      {detailColumns.map((__, cellIndex) => (
                        <td
                          key={`skeleton-cell-${rowIndex}-${cellIndex}`}
                          className="border-b border-gray-100 px-4 py-3"
                        >
                          <div className="h-4 w-full rounded bg-gray-200" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : isDetailError ? (
                  <tr>
                    <td
                      colSpan={detailColumns.length}
                      className="px-4 py-6 text-center text-sm text-error-600"
                    >
                      {getErrorMessage(detailError)}{" "}
                      <button
                        type="button"
                        onClick={() => {
                          void refetchDetail();
                        }}
                        className="ml-2 inline-flex h-8 items-center rounded-lg bg-error-600 px-3 text-xs font-semibold text-white transition hover:bg-error-700"
                      >
                        Повторить
                      </button>
                    </td>
                  </tr>
                ) : tab === "tasks" ? (
                  taskItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={detailColumns.length}
                        className="px-4 py-6 text-center text-sm text-gray-500"
                      >
                        Задач по выбранным условиям не найдено
                      </td>
                    </tr>
                  ) : (
                    taskItems.map((item) => {
                      const bucketMeta = BUCKET_BY_KEY.get(item.deadline_bucket);
                      const daysLeft = item.days_left;

                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="whitespace-nowrap border-b border-gray-100 px-4 py-2.5 text-sm font-medium text-gray-500">
                            {item.code || "—"}
                          </td>
                          <td className="border-b border-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-800">
                            <Link to="/tasks" className="transition hover:text-brand-500">
                              {item.title || "Без названия"}
                            </Link>
                            {item.priority ? (
                              <span
                                className="ml-2 text-xs font-medium"
                                style={{
                                  color: isHexColor(item.priority.color)
                                    ? item.priority.color
                                    : "#475569",
                                }}
                              >
                                {item.priority.title}
                              </span>
                            ) : null}
                          </td>
                          <td className="whitespace-nowrap border-b border-gray-100 px-4 py-2.5">
                            <StatusBadge title={item.status.title} color={item.status.color} />
                          </td>
                          <td className="border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                            {item.assignees.length === 0
                              ? "—"
                              : item.assignees.map((assignee) => assignee.name).join(", ")}
                          </td>
                          <td className="whitespace-nowrap border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                            {formatDate(item.deadline)}
                          </td>
                          <td className="whitespace-nowrap border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                            {item.status.group === "completed"
                              ? formatDate(item.completion_date)
                              : "—"}
                          </td>
                          <td className="whitespace-nowrap border-b border-gray-100 px-4 py-2.5 text-sm font-semibold">
                            {item.overdue_days > 0 ? (
                              <span style={{ color: DANGER }}>+{formatDays(item.overdue_days)}</span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap border-b border-gray-100 px-4 py-2.5 text-sm">
                            {item.status.group === "completed" ? (
                              <span
                                className="text-xs font-medium"
                                style={{
                                  color:
                                    item.completed_on_time === false
                                      ? DANGER
                                      : item.completed_on_time === true
                                        ? SUCCESS
                                        : "#94A3B8",
                                }}
                              >
                                {item.completed_on_time === false
                                  ? "С опозданием"
                                  : item.completed_on_time === true
                                    ? "В срок"
                                    : "Без дедлайна"}
                              </span>
                            ) : daysLeft == null ? (
                              <span className="text-xs text-gray-400">Без срока</span>
                            ) : (
                              <span
                                className="text-xs font-medium"
                                style={{ color: bucketMeta?.color || "#475569" }}
                              >
                                {daysLeft < 0
                                  ? `Просрочено на ${formatDays(Math.abs(daysLeft))}`
                                  : daysLeft === 0
                                    ? "Сегодня"
                                    : `Осталось ${formatDays(daysLeft)}`}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )
                ) : employeeItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={detailColumns.length}
                      className="px-4 py-6 text-center text-sm text-gray-500"
                    >
                      Исполнителей по выбранным условиям не найдено
                    </td>
                  </tr>
                ) : (
                  employeeItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="border-b border-gray-100 px-4 py-2.5 text-sm">
                        <Link
                          to={`/employees/${item.id}`}
                          className="font-semibold text-gray-800 transition hover:text-brand-500"
                        >
                          {item.employee}
                        </Link>
                        {item.department || item.position ? (
                          <p className="text-xs text-gray-400">
                            {[item.position, item.department].filter(Boolean).join(" · ")}
                          </p>
                        ) : null}
                      </td>
                      <td className="border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                        {item.total}
                      </td>
                      <td className="border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                        {item.open}
                      </td>
                      <td className="border-b border-gray-100 px-4 py-2.5 text-sm font-semibold">
                        {item.overdue_open > 0 ? (
                          <span style={{ color: DANGER }}>{item.overdue_open}</span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                      <td className="border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                        {item.completed}
                      </td>
                      <td
                        className="border-b border-gray-100 px-4 py-2.5 text-sm font-semibold"
                        style={{ color: SUCCESS }}
                      >
                        {item.completed_on_time}
                      </td>
                      <td className="border-b border-gray-100 px-4 py-2.5 text-sm font-semibold">
                        {item.completed_late > 0 ? (
                          <span style={{ color: DANGER }}>{item.completed_late}</span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                      <td className="border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                        {formatPercent(item.on_time_rate)}
                      </td>
                      <td className="whitespace-nowrap border-b border-gray-100 px-4 py-2.5 text-sm font-semibold">
                        {item.late_days_total > 0 ? (
                          <span style={{ color: DANGER }}>{formatDays(item.late_days_total)}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                        {item.avg_overdue_days > 0 ? formatDays(item.avg_overdue_days) : "—"}
                      </td>
                      <td className="whitespace-nowrap border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                        {item.max_overdue_days > 0 ? formatDays(item.max_overdue_days) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {isDetailFetching && !isDetailLoading ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
                <div className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
                  <Spinner size="sm" className="h-5 w-5" />
                  <span className="text-sm font-medium text-gray-600">Загрузка...</span>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {isFetching ? <p className="text-right text-xs text-gray-400">Обновление данных...</p> : null}
      </div>
    </>
  );
}

export default observer(TasksReportPage);
