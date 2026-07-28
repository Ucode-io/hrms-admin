import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import { Link } from "react-router";
import { Icon } from "@iconify/react";
import {
  AlertTriangle,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock,
  Search,
  Users,
} from "lucide-react";
import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";
import PageMeta from "../../../components/common/PageMeta";
import Spinner from "../../../components/ui/Spinner";
import {
  type AbsenceBalanceByDepartmentItem,
  type AbsenceBalanceByPolicyItem,
  type AbsenceBalancePolicyFilterItem,
  type AbsenceBalanceTableItem,
  useAbsenceBalanceReportQuery,
  useAbsenceBalanceTableQuery,
} from "../../../api/services/reports.service";

const TABLE_PAGE_LIMIT = 50;
const DEFAULT_POLICY_ICON = "mdi:airplane";

const MONTHS_RU = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

const formatIsoDateRu = (iso: string | null | undefined): string => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return "—";
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}.${month}.${year}`;
};

// The balance window differs per policy: yearly policies use the calendar year,
// monthly policies the current month, weekly the current week. Render it plainly
// so it's obvious what "used / available" covers for each row.
const formatCyclePeriod = (item: AbsenceBalanceTableItem): string => {
  const from = item.cycle_from;
  if (!from || !/^\d{4}-\d{2}-\d{2}/.test(from)) return item.period_label;
  const [year, month] = from.slice(0, 10).split("-");

  if (item.period === "month") {
    return `${MONTHS_RU[Number(month) - 1] ?? ""} ${year}`.trim();
  }
  if (item.period === "week") {
    return `${formatIsoDateRu(item.cycle_from)} – ${formatIsoDateRu(item.cycle_to)}`;
  }
  return `${year} год`;
};

type RowFilter = "" | "pending" | "exhausted";

const ROW_FILTER_OPTIONS: { value: RowFilter; label: string }[] = [
  { value: "", label: "Все строки" },
  { value: "pending", label: "С ожидающими заявками" },
  { value: "exhausted", label: "Лимит исчерпан" },
];

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return "Не удалось загрузить отчет. Попробуйте снова.";
};

const formatMetric = (value: number | null | undefined): string => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0,0";
  }
  return value.toFixed(1).replace(".", ",");
};

const resolveHexColor = (value: unknown, fallback: string): string => {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) return normalized;
  return fallback;
};

const utilizationColor = (percent: number): string => {
  if (percent >= 100) return "#ef4444";
  if (percent >= 70) return "#f59e0b";
  return "#10b981";
};

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

function SummaryCard({
  icon,
  title,
  value,
  hint,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  hint?: string;
  accent: string;
}) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2.5">
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${accent}1a`, color: accent }}
        >
          {icon}
        </span>
        <p className="text-sm text-gray-500">{title}</p>
      </div>
      <p className="mt-3 text-2xl font-semibold text-gray-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-gray-400">{hint}</p> : null}
    </article>
  );
}

function PolicyCard({ policy }: { policy: AbsenceBalanceByPolicyItem }) {
  const color = resolveHexColor(policy.color, "#3b82f6");
  const icon = policy.icon || DEFAULT_POLICY_ICON;
  const utilization = Math.min(100, Math.max(0, policy.utilization_percent));

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${color}1a` }}
          >
            <Icon icon={icon} width={18} height={18} color={color} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-gray-900">{policy.label}</p>
            <p className="text-[11px] text-gray-400">{policy.period_label}</p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
            policy.policy_type === "unpaid"
              ? "bg-rose-50 text-rose-600"
              : "bg-emerald-50 text-emerald-600"
          }`}
        >
          {policy.policy_type_label}
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div>
          <p className="text-[11px] text-gray-400">Использовано за цикл</p>
          <p className="mt-0.5 text-lg font-semibold text-gray-900">
            {formatMetric(policy.used_days)}
            <span className="text-xs font-medium text-gray-400">
              {" "}
              / {formatMetric(policy.total_limit)} д.
            </span>
          </p>
        </div>
        <p className="text-sm font-bold" style={{ color: utilizationColor(policy.utilization_percent) }}>
          {policy.utilization_percent}%
        </p>
      </div>

      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${utilization}%`,
            backgroundColor: utilizationColor(policy.utilization_percent),
          }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px]">
        <span className="text-gray-500">
          {policy.employees_count} сотр. · доступно {formatMetric(policy.available_days)} д.
        </span>
        <span className="flex items-center gap-2">
          {policy.pending_requests > 0 ? (
            <span className="font-semibold text-amber-600">
              {policy.pending_requests} ожид.
            </span>
          ) : null}
          {policy.exhausted_count > 0 ? (
            <span className="font-semibold text-rose-600">
              {policy.exhausted_count} исчерп.
            </span>
          ) : null}
        </span>
      </div>
    </article>
  );
}

function AbsenceBalancePage() {
  const [tablePage, setTablePage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  const [rowFilter, setRowFilter] = useState<RowFilter>("");

  // Reference month for the whole report. Month-cycle policies (e.g. Дей Офф)
  // show this month; year-cycle policies show the corresponding year. Lets HR
  // look back at previous periods, not just the current one.
  const now = new Date();
  const [periodYear, setPeriodYear] = useState(now.getFullYear());
  const [periodMonth, setPeriodMonth] = useState(now.getMonth());

  const asOfDate = useMemo(
    () => `${periodYear}-${String(periodMonth + 1).padStart(2, "0")}-15`,
    [periodYear, periodMonth]
  );
  const periodLabel = `${MONTHS_RU[periodMonth]} ${periodYear}`;
  const isCurrentMonth =
    periodYear === now.getFullYear() && periodMonth === now.getMonth();

  const shiftMonth = (delta: number) => {
    const shifted = new Date(periodYear, periodMonth + delta, 1);
    setPeriodYear(shifted.getFullYear());
    setPeriodMonth(shifted.getMonth());
    setTablePage(1);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setTablePage(1);
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // The overview (cards, policy usage, department chart) always reflects the
  // whole company. Search / policy / row filters apply to the table only.
  const summaryRequestData = useMemo(
    () => ({ as_of_date: asOfDate }),
    [asOfDate]
  );

  const tableRequestData = useMemo(
    () => ({
      as_of_date: asOfDate,
      ...(search ? { search } : {}),
      ...(selectedPolicyId ? { absence_policies_ids: [selectedPolicyId] } : {}),
      ...(rowFilter ? { row_filter: rowFilter } : {}),
    }),
    [asOfDate, search, selectedPolicyId, rowFilter]
  );

  const { data, isLoading, isFetching, isError, error, refetch } =
    useAbsenceBalanceReportQuery(summaryRequestData);

  const {
    data: tableData,
    isLoading: isTableLoading,
    isFetching: isTableFetching,
    isError: isTableError,
    error: tableError,
    refetch: refetchTable,
  } = useAbsenceBalanceTableQuery({
    requestData: tableRequestData,
    page: tablePage,
    limit: TABLE_PAGE_LIMIT,
  });

  const cards = data?.result?.cards ?? {};
  const byPolicy: AbsenceBalanceByPolicyItem[] = data?.result?.charts?.by_policy ?? [];
  const byDepartment: AbsenceBalanceByDepartmentItem[] = useMemo(
    () => data?.result?.charts?.by_department ?? [],
    [data?.result?.charts?.by_department]
  );
  const policyFilters: AbsenceBalancePolicyFilterItem[] =
    data?.result?.filters?.absence_policies ?? [];

  const reportYear = String(periodYear);

  const tableResult = tableData?.result;
  const tableItems = tableResult?.items ?? [];
  const tablePagination = tableResult?.pagination;
  const tableTotalCount = tablePagination?.total_count ?? 0;
  const tableTotalPages = Math.max(1, tablePagination?.total_pages ?? 1);
  const tableCurrentPage = tablePage;
  const tableFrom = tablePagination?.from ?? 0;
  const tableTo = tablePagination?.to ?? 0;
  const visiblePages = getVisiblePages(tableCurrentPage, tableTotalPages);

  const departmentChartSeries = useMemo(
    () => [
      { name: "Использовано", data: byDepartment.map((item) => item.used_days) },
      { name: "Ожидает", data: byDepartment.map((item) => item.pending_days) },
    ],
    [byDepartment]
  );

  const departmentChartOptions: ApexOptions = useMemo(
    () => ({
      chart: {
        type: "bar",
        stacked: true,
        fontFamily: "Outfit, sans-serif",
        toolbar: { show: false },
      },
      colors: ["#6B8FE3", "#F59E0B"],
      plotOptions: { bar: { borderRadius: 5, columnWidth: "50%" } },
      xaxis: {
        categories: byDepartment.map((item) => item.label),
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: { style: { fontSize: "11px", colors: "#64748b" } },
      },
      yaxis: {
        title: { text: "Дней", style: { fontSize: "12px", color: "#64748b" } },
        labels: { style: { fontSize: "12px", colors: ["#64748b"] } },
      },
      legend: { position: "top", horizontalAlign: "right", fontSize: "12px" },
      grid: { borderColor: "#e5e7eb", strokeDashArray: 4 },
      dataLabels: { enabled: false },
    }),
    [byDepartment]
  );

  const selectedPolicyLabel = useMemo(
    () => policyFilters.find((policy) => policy.id === selectedPolicyId)?.label ?? null,
    [policyFilters, selectedPolicyId]
  );

  const activeFiltersCount =
    Number(Boolean(selectedPolicyId)) + Number(Boolean(search)) + Number(Boolean(rowFilter));

  if (isLoading) {
    return (
      <>
        <PageMeta title="Баланс отсутствий | HRMS" description="Отчет по остаткам отсутствий" />
        <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-gray-200 bg-white">
          <Spinner />
        </div>
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageMeta title="Баланс отсутствий | HRMS" description="Отчет по остаткам отсутствий" />
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
      <PageMeta title="Баланс отсутствий | HRMS" description="Отчет по остаткам отсутствий" />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-500">
            Период отчёта:{" "}
            <span className="font-semibold text-gray-800">{periodLabel}</span>
          </p>
          <div className="inline-flex items-center overflow-hidden rounded-xl border border-gray-200 bg-white">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="inline-flex h-9 w-9 items-center justify-center text-gray-600 transition hover:bg-gray-50"
              aria-label="Предыдущий месяц"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="inline-flex h-9 min-w-[130px] items-center justify-center border-x border-gray-200 px-3 text-sm font-semibold text-gray-800">
              {periodLabel}
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              disabled={isCurrentMonth}
              className="inline-flex h-9 w-9 items-center justify-center text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Следующий месяц"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={<Users size={18} />}
            title="Сотрудников"
            value={String(Number(cards.total_employees || 0))}
            hint={`${Number(cards.total_policies || 0)} типов отсутствий`}
            accent="#3b82f6"
          />
          <SummaryCard
            icon={<Clock size={18} />}
            title="Ожидают одобрения"
            value={String(Number(cards.pending_requests || 0))}
            hint={`${formatMetric(Number(cards.pending_days || 0))} дней в заявках`}
            accent="#f59e0b"
          />
          <SummaryCard
            icon={<CalendarClock size={18} />}
            title={`Использовано за ${reportYear}`}
            value={`${formatMetric(Number(cards.used_days_year || 0))} д.`}
            hint="Всего одобренных дней отсутствий за год"
            accent="#10b981"
          />
          <SummaryCard
            icon={<AlertTriangle size={18} />}
            title="Лимит исчерпан"
            value={String(Number(cards.exhausted_count || 0))}
            hint="Строк сотрудник × тип без остатка"
            accent="#ef4444"
          />
        </section>

        {byPolicy.length > 0 ? (
          <section>
            <h3 className="mb-2 px-1 text-sm font-semibold text-gray-700">
              Использование по типам отсутствий
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {byPolicy.map((policy) => (
                <PolicyCard key={policy.id || policy.label} policy={policy} />
              ))}
            </div>
          </section>
        ) : null}

        {byDepartment.length > 0 ? (
          <section className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
            <h3 className="text-sm font-semibold text-gray-700">
              Использовано и ожидает по отделам
            </h3>
            <div className="mt-2">
              <Chart
                options={departmentChartOptions}
                series={departmentChartSeries}
                type="bar"
                height={300}
              />
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-gray-200 bg-white">
          <div className="space-y-3 px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="relative w-full sm:max-w-xs">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Поиск сотрудника"
                  className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-700 outline-none transition focus:border-brand-300"
                />
              </label>

              <select
                value={selectedPolicyId ?? "all"}
                onChange={(event) => {
                  const value = event.target.value;
                  setSelectedPolicyId(value === "all" ? null : value);
                  setTablePage(1);
                }}
                className="select-with-arrow h-10 min-w-[200px] rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-brand-300"
              >
                <option value="all">Все типы отсутствий</option>
                {policyFilters.map((policy) => (
                  <option key={policy.id || policy.label} value={policy.id || ""}>
                    {policy.label}
                  </option>
                ))}
              </select>

              <select
                value={rowFilter}
                onChange={(event) => {
                  setRowFilter(event.target.value as RowFilter);
                  setTablePage(1);
                }}
                className="select-with-arrow h-10 min-w-[200px] rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-brand-300"
              >
                {ROW_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {activeFiltersCount > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-gray-500">Фильтры:</span>
                {selectedPolicyId ? (
                  <span className="inline-flex items-center rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-600">
                    Тип: {selectedPolicyLabel || "Не указано"}
                  </span>
                ) : null}
                {rowFilter ? (
                  <span className="inline-flex items-center rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                    {ROW_FILTER_OPTIONS.find((option) => option.value === rowFilter)?.label}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPolicyId(null);
                    setRowFilter("");
                    setSearchInput("");
                    setSearch("");
                    setTablePage(1);
                  }}
                  className="inline-flex h-7 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
                >
                  Сбросить
                </button>
              </div>
            ) : null}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 bg-gray-50/60 px-4 py-2.5">
            <p className="text-xs leading-relaxed text-gray-500">
              Лимит, «Ожидает», «Доступно» и «Использование» — за{" "}
              <span className="font-semibold text-gray-600">текущий цикл</span> каждого типа
              (год или месяц, см. колонку «Период»). «Использовано за {reportYear}» — суммарно
              одобренные дни за календарный год.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-medium text-gray-500">
              {tableTotalCount > 0
                ? `Отображение ${tableFrom} - ${tableTo} из ${tableTotalCount}`
                : "Нет данных"}
            </p>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={tableCurrentPage <= 1 || isTableFetching}
                onClick={() => setTablePage((prev) => Math.max(1, prev - 1))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft size={15} />
              </button>

              {visiblePages.map((page) => {
                const isActive = page === tableCurrentPage;
                return (
                  <button
                    key={page}
                    type="button"
                    disabled={isTableFetching}
                    onClick={() => setTablePage(page)}
                    className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-70"
                    style={{
                      borderColor: isActive ? "var(--company-color)" : "#e5e7eb",
                      backgroundColor: isActive ? "var(--company-color)" : "#ffffff",
                      color: isActive ? "#ffffff" : "#334155",
                    }}
                  >
                    {page}
                  </button>
                );
              })}

              <button
                type="button"
                disabled={tableCurrentPage >= tableTotalPages || isTableFetching}
                onClick={() => setTablePage((prev) => Math.min(tableTotalPages, prev + 1))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          <div className="relative overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-gray-50">
                  {[
                    "Полное имя",
                    "Тип отсутствия",
                    "Период",
                    "Лимит",
                    `Использовано за ${reportYear}`,
                    "Ожидает",
                    "Доступно",
                    "Использование",
                  ].map((column) => (
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
                {isTableLoading ? (
                  Array.from({ length: 10 }).map((_, rowIndex) => (
                    <tr key={`table-skeleton-${rowIndex}`} className="animate-pulse">
                      {Array.from({ length: 8 }).map((__, cellIndex) => (
                        <td
                          key={`table-skeleton-cell-${rowIndex}-${cellIndex}`}
                          className="border-b border-gray-100 px-4 py-3"
                        >
                          <div className="h-4 w-full rounded bg-gray-200" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : isTableError ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-sm text-error-600">
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
                    <td colSpan={8} className="px-4 py-6 text-center text-sm text-gray-500">
                      Нет сотрудников по выбранным параметрам
                    </td>
                  </tr>
                ) : (
                  tableItems.map((item: AbsenceBalanceTableItem) => {
                    const color = resolveHexColor(item.color, "#3b82f6");
                    const util = Math.min(100, Math.max(0, item.utilization_percent));
                    return (
                      <tr
                        key={`${item.guid}-${item.absence_policy_id || item.absence_type}`}
                        className="hover:bg-gray-50"
                      >
                        <td className="border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                          <Link
                            to={`/employees/${item.guid}`}
                            className="font-semibold text-gray-800 transition hover:text-brand-500"
                          >
                            {item.full_name}
                          </Link>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {item.department
                              ? `${item.department} · ${item.work_summary}`
                              : item.work_summary}
                          </p>
                        </td>
                        <td className="border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: color }}
                            />
                            <span className="font-medium text-gray-800">{item.absence_type}</span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                item.policy_type === "unpaid"
                                  ? "bg-rose-50 text-rose-600"
                                  : "bg-emerald-50 text-emerald-600"
                              }`}
                            >
                              {item.policy_type_label}
                            </span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap border-b border-gray-100 px-4 py-2.5 text-sm text-gray-600">
                          {formatCyclePeriod(item)}
                          <span className="block text-[11px] text-gray-400">
                            {item.period_label}
                          </span>
                        </td>
                        <td className="border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                          {formatMetric(item.limit)}
                        </td>
                        <td className="border-b border-gray-100 px-4 py-2.5 text-sm font-medium text-gray-800">
                          {formatMetric(item.used_year)}
                        </td>
                        <td className="border-b border-gray-100 px-4 py-2.5 text-sm">
                          {item.pending && item.pending > 0 ? (
                            <span className="font-semibold text-amber-600">
                              {formatMetric(item.pending)}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="border-b border-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-900">
                          {formatMetric(item.available)}
                        </td>
                        <td className="border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-100">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${util}%`,
                                  backgroundColor: utilizationColor(item.utilization_percent),
                                }}
                              />
                            </div>
                            <span
                              className="text-xs font-semibold"
                              style={{ color: utilizationColor(item.utilization_percent) }}
                            >
                              {item.utilization_percent}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {isTableFetching && !isTableLoading ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
                <div className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
                  <Spinner size="sm" className="h-5 w-5" />
                  <span className="text-sm font-medium text-gray-600">Загрузка...</span>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {isFetching ? (
          <p className="text-right text-xs text-gray-400">Обновление данных...</p>
        ) : null}
      </div>
    </>
  );
}

export default observer(AbsenceBalancePage);
