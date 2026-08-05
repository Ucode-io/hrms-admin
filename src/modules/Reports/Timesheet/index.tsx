import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import { Link } from "react-router";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";
import PageMeta from "../../../components/common/PageMeta";
import MonthNavigator from "../../../components/common/MonthNavigator";
import Spinner from "../../../components/ui/Spinner";
import {
  type TimesheetReportDay,
  useTimesheetReportQuery,
  useTimesheetReportTableQuery,
} from "../../../api/services/reports.service";

const PAGE_LIMIT = 25;

type DetailTab = "employees" | "days";

type SortKey = "name" | "worked" | "completion" | "deviation";

/**
 * Подписи источников те же, что в модуле табеля: `hrms_manual` — ручное время
 * HRMS (согласованное), `manual` — правка в самом Time Doctor. Смешивать их
 * нельзя: вопросы к ним разные.
 */
const SOURCE_META: Record<string, { label: string; short: string; color: string }> = {
  tracker: { label: "Трекер", short: "Трекер", color: "#2563eb" },
  manual: { label: "Вручную (Time Doctor)", short: "Вручную (TD)", color: "#9dbcf0" },
  mobile: { label: "Мобильное приложение", short: "Мобильное", color: "#b3a8e8" },
  break: { label: "Перерыв", short: "Перерыв", color: "#cbd5e1" },
  hrms_manual: { label: "Ручное время (HRMS)", short: "Ручное (HRMS)", color: "#0e7490" },
  other: { label: "Другое", short: "Другое", color: "#94a3b8" },
};

const DANGER = "#D92D20";
const SUCCESS = "#039855";

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return "Не удалось загрузить отчет. Попробуйте снова.";
};

/** Секунды → «7ч 30м». Часы с минутами читаются быстрее десятичных. */
const formatDuration = (seconds: number): string => {
  const safe = Math.max(0, Math.round(seconds || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.round((safe % 3600) / 60);
  if (hours === 0) return `${minutes}м`;
  return minutes > 0 ? `${hours}ч ${minutes}м` : `${hours}ч`;
};

/** Отклонение от плана — со знаком: «+2ч 10м» / «−6ч». */
const formatDeviation = (seconds: number): string => {
  const safe = Math.round(seconds || 0);
  if (safe === 0) return "0";
  return `${safe > 0 ? "+" : "−"}${formatDuration(Math.abs(safe))}`;
};

const formatPercent = (value: number | undefined): string =>
  `${String(value ?? 0).replace(".", ",")}%`;

const formatDateRu = (value: string): string => {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}.${month}.${year}` : value;
};

const WEEKDAYS = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

const weekdayOf = (value: string): string => {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "";
  return WEEKDAYS[new Date(year, month - 1, day).getDay()] ?? "";
};

const monthRange = (monthKey: string): { from: string; to: string } => {
  const [year, month] = monthKey.split("-").map(Number);
  const last = new Date(year, month, 0).getDate();
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(last)}`,
  };
};

const currentMonthKey = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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

function TimesheetReportPage() {
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [tab, setTab] = useState<DetailTab>("employees");
  const [sort, setSort] = useState<SortKey>("name");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setOffset(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const range = useMemo(() => monthRange(monthKey), [monthKey]);

  useEffect(() => {
    setOffset(0);
  }, [monthKey, sort]);

  const reportRequest = useMemo(
    () => ({ date_from: range.from, date_to: range.to }),
    [range.from, range.to]
  );

  const { data, isLoading, isFetching, isError, error, refetch } =
    useTimesheetReportQuery(reportRequest);

  const tableRequest = useMemo(
    () => ({
      date_from: range.from,
      date_to: range.to,
      sort,
      ...(search ? { search } : {}),
    }),
    [range.from, range.to, sort, search]
  );

  const {
    data: tableData,
    isLoading: isTableLoading,
    isFetching: isTableFetching,
    isError: isTableError,
    error: tableError,
    refetch: refetchTable,
  } = useTimesheetReportTableQuery({
    requestData: tableRequest,
    limit: PAGE_LIMIT,
    offset,
  });

  const cards = data?.result?.cards ?? {};
  const byDay: TimesheetReportDay[] = data?.result?.charts?.by_day ?? [];
  const bySource = data?.result?.charts?.by_source ?? [];
  const topShortfall = data?.result?.charts?.top_shortfall ?? [];
  const topOvertime = data?.result?.charts?.top_overtime ?? [];

  // Факт столбиками, план линией: так видно и объём, и норму одного дня.
  const daySeries = [
    {
      name: "Отработано",
      type: "column",
      data: byDay.map((item) => Math.round((item.worked_seconds / 3600) * 10) / 10),
    },
    {
      name: "План",
      type: "line",
      data: byDay.map((item) => Math.round((item.plan_seconds / 3600) * 10) / 10),
    },
  ];

  const dayOptions: ApexOptions = {
    chart: { type: "line", fontFamily: "Outfit, sans-serif", toolbar: { show: false } },
    colors: ["#2563eb", "#F79009"],
    stroke: { width: [0, 2.5], curve: "smooth" },
    plotOptions: { bar: { borderRadius: 4, columnWidth: byDay.length <= 10 ? "40px" : "60%" } },
    dataLabels: { enabled: false },
    legend: { position: "top", horizontalAlign: "right", fontSize: "12px" },
    xaxis: {
      categories: byDay.map((item) => item.date.slice(8, 10)),
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { fontSize: "11px", colors: "#64748b" } },
    },
    yaxis: {
      labels: {
        style: { fontSize: "12px", colors: ["#64748b"] },
        formatter: (value: number) => `${Math.round(value)}ч`,
      },
    },
    grid: { borderColor: "#e5e7eb", strokeDashArray: 4 },
    tooltip: {
      theme: "light",
      y: { formatter: (value: number) => `${String(value).replace(".", ",")} ч` },
    },
  };

  const sourceSlices = bySource.map((item) => ({
    ...item,
    meta: SOURCE_META[item.key] ?? SOURCE_META.other,
  }));

  const sourceOptions: ApexOptions = {
    chart: { type: "donut", fontFamily: "Outfit, sans-serif", toolbar: { show: false } },
    labels: sourceSlices.map((item) => item.meta.label),
    colors: sourceSlices.map((item) => item.meta.color),
    legend: { position: "bottom", fontSize: "12px" },
    stroke: { width: 0 },
    dataLabels: {
      enabled: true,
      formatter: (value: number) => `${Math.round(Number(value))}%`,
      style: { fontSize: "12px", fontWeight: 600 },
      dropShadow: { enabled: false },
    },
    plotOptions: {
      pie: {
        donut: {
          size: "62%",
          labels: {
            show: true,
            // При наведении Apex подставляет в центр подпись и «сырое» значение
            // серии — секунды. Показываем часы и короткое имя: полное
            // «Мобильное приложение» в круг не помещалось.
            name: {
              fontSize: "13px",
              color: "#64748b",
              formatter: (value: string) =>
                sourceSlices.find((item) => item.meta.label === value)?.meta.short ?? value,
            },
            value: {
              fontSize: "20px",
              fontWeight: 600,
              color: "#101828",
              formatter: (value: string) => formatDuration(Number(value)),
            },
            total: {
              show: true,
              label: "Всего",
              fontSize: "13px",
              color: "#64748b",
              formatter: () =>
                formatDuration(sourceSlices.reduce((sum, item) => sum + item.seconds, 0)),
            },
          },
        },
      },
    },
    // У donut'а тултип по умолчанию тёмный, а глобальный стиль проекта красит
    // его текст в тёмно-серый — получалось тёмное на тёмном.
    tooltip: {
      theme: "light",
      fillSeriesColor: false,
      y: { formatter: (value: number) => formatDuration(value) },
    },
  };

  const tableResult = tableData?.result;
  const tableItems = tableResult?.items ?? [];
  const pagination = tableResult?.pagination;
  const totalCount = pagination?.total_count ?? 0;

  const employeeColumns = [
    "Сотрудник",
    "Отработано",
    "План",
    "Выполнение",
    "Отклонение",
    "Трекер",
    "Ручное",
    "Перерывы",
    "Дней",
    "Средний день",
  ];

  const dayColumns = [
    "Дата",
    "День",
    "Отработано",
    "План",
    "Выполнение",
    "Сотрудников",
    "Записей",
    "Статус",
  ];

  const detailColumns = tab === "employees" ? employeeColumns : dayColumns;

  if (isLoading) {
    return (
      <>
        <PageMeta title="Табель времени | Отчеты | HRMS" description="Отчет по табелю времени" />
        <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-gray-200 bg-white">
          <Spinner />
        </div>
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageMeta title="Табель времени | Отчеты | HRMS" description="Отчет по табелю времени" />
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
      <PageMeta title="Табель времени | Отчеты | HRMS" description="Отчет по табелю времени" />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <MonthNavigator value={monthKey} onChange={setMonthKey} />
        </div>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Отработано"
            value={formatDuration(cards.worked_seconds ?? 0)}
            hint={`${cards.entry_count ?? 0} записей · в среднем ${formatDuration(
              cards.avg_day_seconds ?? 0
            )}/день`}
          />
          <MetricCard
            title="План"
            value={formatDuration(cards.plan_seconds ?? 0)}
            hint={`${cards.days ?? 0} дней в периоде`}
          />
          <MetricCard
            title="Выполнение плана"
            value={formatPercent(cards.completion_rate)}
            accent={(cards.completion_rate ?? 0) >= 95 ? SUCCESS : undefined}
            hint={`Недоработка ${formatDuration(cards.shortfall_seconds ?? 0)}`}
          />
          <MetricCard
            title="Сотрудники"
            value={String(cards.employees_count ?? 0)}
            hint={`Активных ${cards.active_employees ?? 0} · без записей ${
              cards.idle_employees ?? 0
            }`}
            accent={(cards.idle_employees ?? 0) > 0 ? DANGER : undefined}
          />
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Переработка"
            value={formatDuration(cards.overtime_seconds ?? 0)}
            accent={SUCCESS}
            hint="Сверх плана по сотрудникам"
          />
          <MetricCard
            title="Недоработка"
            value={formatDuration(cards.shortfall_seconds ?? 0)}
            accent={(cards.shortfall_seconds ?? 0) > 0 ? DANGER : undefined}
            hint="Не хватает до плана"
          />
          <MetricCard title="Перерывы" value={formatDuration(cards.break_seconds ?? 0)} />
          <MetricCard
            title="Ручное время"
            value={formatDuration(cards.manual_seconds ?? 0)}
            hint={
              (cards.manual_pending_count ?? 0) > 0
                ? `На согласовании ${formatDuration(cards.manual_pending_seconds ?? 0)} (${
                    cards.manual_pending_count
                  })`
                : "Подтверждённое, входит в факт"
            }
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <article className="rounded-2xl border border-gray-200 bg-white px-4 py-4 xl:col-span-2">
            <h3 className="text-lg font-semibold text-gray-900">Факт против плана по дням</h3>
            <p className="text-sm text-gray-500">Столбцы — отработано, линия — плановые часы</p>
            {byDay.length === 0 ? (
              <div className="mt-2 flex h-[280px] items-center justify-center text-sm text-gray-500">
                Нет данных за период
              </div>
            ) : (
              <div className="mt-2">
                <Chart options={dayOptions} series={daySeries} type="line" height={300} />
              </div>
            )}
          </article>

          <article className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
            <h3 className="text-lg font-semibold text-gray-900">Источники времени</h3>
            <p className="text-sm text-gray-500">Откуда пришли часы</p>
            {sourceSlices.length === 0 ? (
              <div className="mt-2 flex h-[280px] items-center justify-center text-sm text-gray-500">
                Нет данных за период
              </div>
            ) : (
              <div className="mt-2">
                <Chart
                  options={sourceOptions}
                  series={sourceSlices.map((item) => item.seconds)}
                  type="donut"
                  height={300}
                />
              </div>
            )}
          </article>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-4 py-3">
              <h3 className="text-lg font-semibold text-gray-900">Больше всех недоработали</h3>
              <p className="text-sm text-gray-500">Топ-10 по разнице с планом</p>
            </div>
            {topShortfall.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-500">
                Все выполнили план
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {topShortfall.map((item) => (
                  <li key={item.employee_id} className="flex items-center justify-between px-4 py-2.5">
                    <span className="min-w-0">
                      <Link
                        to={`/employees/${item.employee_id}`}
                        className="text-sm font-medium text-gray-800 transition hover:text-brand-500"
                      >
                        {item.name}
                      </Link>
                      {item.department ? (
                        <span className="ml-2 text-xs text-gray-400">{item.department}</span>
                      ) : null}
                    </span>
                    <span className="whitespace-nowrap text-sm font-semibold" style={{ color: DANGER }}>
                      {formatDeviation(item.deviation_seconds)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-4 py-3">
              <h3 className="text-lg font-semibold text-gray-900">Больше всех переработали</h3>
              <p className="text-sm text-gray-500">Топ-10 сверх плана</p>
            </div>
            {topOvertime.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-500">
                Переработок нет
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {topOvertime.map((item) => (
                  <li key={item.employee_id} className="flex items-center justify-between px-4 py-2.5">
                    <span className="min-w-0">
                      <Link
                        to={`/employees/${item.employee_id}`}
                        className="text-sm font-medium text-gray-800 transition hover:text-brand-500"
                      >
                        {item.name}
                      </Link>
                      {item.department ? (
                        <span className="ml-2 text-xs text-gray-400">{item.department}</span>
                      ) : null}
                    </span>
                    <span className="whitespace-nowrap text-sm font-semibold" style={{ color: SUCCESS }}>
                      {formatDeviation(item.deviation_seconds)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="inline-flex rounded-xl border border-gray-200 p-0.5">
              {(
                [
                  { key: "employees", label: "По сотрудникам" },
                  { key: "days", label: "По дням" },
                ] as { key: DetailTab; label: string }[]
              ).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
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

            {tab === "employees" ? (
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
                    placeholder="Сотрудник..."
                    className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-700 outline-none transition focus:border-brand-300"
                  />
                </label>

                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortKey)}
                  className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-brand-300"
                >
                  <option value="name">По алфавиту</option>
                  <option value="deviation">Сначала недоработка</option>
                  <option value="completion">По выполнению плана</option>
                  <option value="worked">По отработанному</option>
                </select>
              </div>
            ) : null}
          </div>

          {tab === "employees" ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
              <p className="text-sm font-medium text-gray-500">
                {totalCount > 0
                  ? `Отображение ${pagination?.from ?? 0} - ${pagination?.to ?? 0} из ${totalCount}`
                  : "Нет данных"}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={offset === 0 || isTableFetching}
                  onClick={() => setOffset(Math.max(0, offset - PAGE_LIMIT))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft size={15} />
                </button>
                <button
                  type="button"
                  disabled={!pagination?.has_next_page || isTableFetching}
                  onClick={() => setOffset(offset + PAGE_LIMIT)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          ) : null}

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
                {tab === "employees" ? (
                  isTableLoading ? (
                    Array.from({ length: 8 }).map((_, rowIndex) => (
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
                  ) : isTableError ? (
                    <tr>
                      <td
                        colSpan={detailColumns.length}
                        className="px-4 py-6 text-center text-sm text-error-600"
                      >
                        {getErrorMessage(tableError)}{" "}
                        <button
                          type="button"
                          onClick={() => {
                            void refetchTable();
                          }}
                          className="ml-2 inline-flex h-8 items-center rounded-lg bg-error-600 px-3 text-xs font-semibold text-white transition hover:bg-error-700"
                        >
                          Повторить
                        </button>
                      </td>
                    </tr>
                  ) : tableItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={detailColumns.length}
                        className="px-4 py-6 text-center text-sm text-gray-500"
                      >
                        Сотрудников по выбранным условиям не найдено
                      </td>
                    </tr>
                  ) : (
                    tableItems.map((item) => (
                      <tr key={item.employee_id} className="hover:bg-gray-50">
                        <td className="border-b border-gray-100 px-4 py-2.5 text-sm">
                          <Link
                            to={`/timesheet?employee=${item.employee_id}`}
                            className="font-semibold text-gray-800 transition hover:text-brand-500"
                          >
                            {item.name}
                          </Link>
                          {item.department || item.position ? (
                            <p className="text-xs text-gray-400">
                              {[item.position, item.department].filter(Boolean).join(" · ")}
                            </p>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap border-b border-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-800">
                          {formatDuration(item.worked_seconds)}
                        </td>
                        <td className="whitespace-nowrap border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                          {formatDuration(item.plan_seconds)}
                        </td>
                        <td className="whitespace-nowrap border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                          {formatPercent(item.completion_rate)}
                        </td>
                        <td className="whitespace-nowrap border-b border-gray-100 px-4 py-2.5 text-sm font-semibold">
                          <span
                            style={{
                              color:
                                item.deviation_seconds < 0
                                  ? DANGER
                                  : item.deviation_seconds > 0
                                    ? SUCCESS
                                    : "#94a3b8",
                            }}
                          >
                            {formatDeviation(item.deviation_seconds)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                          {formatDuration(item.tracker_seconds)}
                        </td>
                        <td className="whitespace-nowrap border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                          {item.manual_seconds > 0 ? formatDuration(item.manual_seconds) : "—"}
                        </td>
                        <td className="whitespace-nowrap border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                          {item.break_seconds > 0 ? formatDuration(item.break_seconds) : "—"}
                        </td>
                        <td className="whitespace-nowrap border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                          {item.active_days} / {item.working_days}
                          {item.missed_days > 0 ? (
                            <span className="ml-1 text-xs" style={{ color: DANGER }}>
                              −{item.missed_days}
                            </span>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                          {item.active_days > 0 ? formatDuration(item.avg_day_seconds) : "—"}
                        </td>
                      </tr>
                    ))
                  )
                ) : byDay.length === 0 ? (
                  <tr>
                    <td
                      colSpan={detailColumns.length}
                      className="px-4 py-6 text-center text-sm text-gray-500"
                    >
                      Нет данных за период
                    </td>
                  </tr>
                ) : (
                  byDay.map((item) => (
                    <tr key={item.date} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap border-b border-gray-100 px-4 py-2.5 text-sm font-medium text-gray-800">
                        {formatDateRu(item.date)}
                      </td>
                      <td className="whitespace-nowrap border-b border-gray-100 px-4 py-2.5 text-sm text-gray-500">
                        {weekdayOf(item.date)}
                      </td>
                      <td className="whitespace-nowrap border-b border-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-800">
                        {formatDuration(item.worked_seconds)}
                      </td>
                      <td className="whitespace-nowrap border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                        {formatDuration(item.plan_seconds)}
                      </td>
                      <td className="whitespace-nowrap border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                        {item.plan_seconds > 0 ? formatPercent(item.completion_rate) : "—"}
                      </td>
                      <td className="whitespace-nowrap border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                        {item.employees_count}
                      </td>
                      <td className="whitespace-nowrap border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                        {item.entry_count}
                      </td>
                      <td className="whitespace-nowrap border-b border-gray-100 px-4 py-2.5 text-xs">
                        {item.holiday ? (
                          <span className="rounded-md bg-violet-100 px-2 py-0.5 font-medium text-violet-700">
                            {item.holiday}
                          </span>
                        ) : item.is_day_off ? (
                          <span className="rounded-md bg-gray-100 px-2 py-0.5 font-medium text-gray-500">
                            Выходной
                          </span>
                        ) : (
                          <span className="text-gray-400">Рабочий</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {isTableFetching && !isTableLoading && tab === "employees" ? (
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

export default observer(TimesheetReportPage);
