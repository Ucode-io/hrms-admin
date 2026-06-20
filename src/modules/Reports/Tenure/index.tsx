import { useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import { Link } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Chart from "react-apexcharts";
import { ApexAxisChartSeries, ApexOptions } from "apexcharts";
import PageMeta from "../../../components/common/PageMeta";
import Spinner from "../../../components/ui/Spinner";
import companyStore from "../../../store/company.store";
import {
  type AverageTenureBreakdownItem,
  type TenureAnniversaryByMonthItem,
  type TenureDistributionResult,
  type TenureEmployeeInfo,
  type TenureGroupDistributionItem,
  useTenureDistributionReportQuery,
  useTenureDistributionTableQuery,
} from "../../../api/services/reports.service";

type MetricCardProps = {
  title: string;
  value: string;
  subtitle?: string;
};

type EmployeeCardProps = {
  title: string;
  employee: TenureEmployeeInfo | null | undefined;
};

type ChartBlockProps = {
  title: string;
  subtitle: string;
  options: ApexOptions;
  series: ApexAxisChartSeries;
  height?: number;
};

const TABLE_PAGE_LIMIT = 20;

const FALLBACK_RESULT: TenureDistributionResult = {
  cards: {
    average_tenure_years: 0,
    total_employees: 0,
    longest_tenure_employee: null,
  },
  charts: {
    tenure_groups: [],
    anniversaries_by_month: [],
    average_tenure_by_departments: [],
    average_tenure_by_locations: [],
  },
  filters_applied: {},
};

const formatYears = (value: number | null | undefined): string => {
  const safe = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return safe.toFixed(1).replace(".", ",");
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return "Не удалось загрузить отчет. Попробуйте снова.";
};

const formatStartDate = (value: string | null | undefined): string => {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
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

const normalizeTenureGroups = (
  source: TenureGroupDistributionItem[] | undefined
): TenureGroupDistributionItem[] => {
  if (!Array.isArray(source)) return [];
  return source.map((item) => ({
    key: item.key,
    label: item.label,
    count: item.count ?? 0,
  }));
};

const normalizeAnniversariesByMonth = (
  source: TenureAnniversaryByMonthItem[] | undefined
): TenureAnniversaryByMonthItem[] => {
  if (!Array.isArray(source)) return [];
  return source
    .map((item) => ({
      month: item.month,
      label: item.label,
      employees_count: item.employees_count ?? 0,
    }))
    .sort((a, b) => a.month - b.month);
};

const normalizeAverageTenureBreakdown = (
  source: AverageTenureBreakdownItem[] | undefined
): AverageTenureBreakdownItem[] => {
  if (!Array.isArray(source)) return [];
  return source.map((item) => ({
    id: item.id,
    label: item.label || "Не указано",
    average_tenure_years:
      typeof item.average_tenure_years === "number" && Number.isFinite(item.average_tenure_years)
        ? Number(item.average_tenure_years.toFixed(1))
        : null,
    employees_count: item.employees_count ?? 0,
  }));
};

function MetricCard({ title, value, subtitle }: MetricCardProps) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-gray-500">{subtitle}</p> : null}
    </article>
  );
}

function EmployeeCard({ title, employee }: EmployeeCardProps) {
  const hasProfile = Boolean(employee?.guid);
  const yearsText =
    typeof employee?.tenure_years === "number" && Number.isFinite(employee.tenure_years)
      ? `${formatYears(employee.tenure_years)} лет`
      : "Стаж не указан";

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="text-sm font-medium text-gray-500">{title}</p>

      {hasProfile ? (
        <Link
          to={`/employees/${employee?.guid}`}
          className="mt-2 inline-flex text-base font-semibold text-brand-500 transition hover:text-brand-600"
        >
          {employee?.full_name || "—"}
        </Link>
      ) : (
        <p className="mt-2 text-base font-semibold text-gray-900">{employee?.full_name || "—"}</p>
      )}

      <p className="mt-1 text-sm text-gray-500">{yearsText}</p>
    </article>
  );
}

function ChartBlock({ title, subtitle, options, series, height = 310 }: ChartBlockProps) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-white px-5 py-5">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
      <div className="max-w-full overflow-x-auto">
        <Chart options={options} series={series} type="bar" height={height} />
      </div>
    </article>
  );
}

function TenurePage() {
  const brandColor = companyStore.mainColor || "#2980B9";
  const [tablePage, setTablePage] = useState(1);
  const [selectedTenureGroupKey, setSelectedTenureGroupKey] = useState<string | null>(null);
  const [selectedAnniversaryMonth, setSelectedAnniversaryMonth] = useState<number | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  const tableRequestData = useMemo(
    () => ({
      ...(selectedTenureGroupKey ? { tenure_group_key: selectedTenureGroupKey } : {}),
      ...(selectedAnniversaryMonth ? { anniversary_month: selectedAnniversaryMonth } : {}),
      ...(selectedDepartmentId ? { departments_ids: [selectedDepartmentId] } : {}),
      ...(selectedLocationId ? { locations_ids: [selectedLocationId] } : {}),
    }),
    [selectedTenureGroupKey, selectedAnniversaryMonth, selectedDepartmentId, selectedLocationId]
  );

  const { data, isLoading, isFetching, isError, error, refetch } = useTenureDistributionReportQuery();
  const {
    data: tableData,
    isLoading: isTableLoading,
    isFetching: isTableFetching,
    isError: isTableError,
    error: tableError,
    refetch: refetchTable,
  } = useTenureDistributionTableQuery({
    requestData: tableRequestData,
    page: tablePage,
    limit: TABLE_PAGE_LIMIT,
  });

  const result = data?.result ?? FALLBACK_RESULT;
  const tableResult = tableData?.result;

  const tenureGroups = normalizeTenureGroups(result.charts?.tenure_groups);
  const anniversariesByMonth = normalizeAnniversariesByMonth(result.charts?.anniversaries_by_month);
  const averageTenureByDepartments = normalizeAverageTenureBreakdown(
    result.charts?.average_tenure_by_departments
  );
  const averageTenureByLocations = normalizeAverageTenureBreakdown(
    result.charts?.average_tenure_by_locations
  );
  const tableItems = tableResult?.items ?? [];
  const tablePagination = tableResult?.pagination;
  const tableTotalCount = tablePagination?.total_count ?? 0;
  const tableTotalPages = Math.max(1, tablePagination?.total_pages ?? 1);
  const tableCurrentPage = tablePage;
  const tableFrom = tablePagination?.from ?? 0;
  const tableTo = tablePagination?.to ?? 0;
  const visiblePages = getVisiblePages(tableCurrentPage, tableTotalPages);

  const selectedTenureGroupLabel = useMemo(
    () => tenureGroups.find((item) => item.key === selectedTenureGroupKey)?.label ?? null,
    [tenureGroups, selectedTenureGroupKey]
  );
  const selectedAnniversaryMonthLabel = useMemo(
    () => anniversariesByMonth.find((item) => item.month === selectedAnniversaryMonth)?.label ?? null,
    [anniversariesByMonth, selectedAnniversaryMonth]
  );
  const selectedDepartmentLabel = useMemo(
    () => averageTenureByDepartments.find((item) => item.id === selectedDepartmentId)?.label ?? null,
    [averageTenureByDepartments, selectedDepartmentId]
  );
  const selectedLocationLabel = useMemo(
    () => averageTenureByLocations.find((item) => item.id === selectedLocationId)?.label ?? null,
    [averageTenureByLocations, selectedLocationId]
  );

  const resetChartFilters = () => {
    setSelectedTenureGroupKey(null);
    setSelectedAnniversaryMonth(null);
    setSelectedDepartmentId(null);
    setSelectedLocationId(null);
    setTablePage(1);
  };

  const handleTenureGroupSelect = (index: number) => {
    const item = tenureGroups[index];
    if (!item) return;

    setSelectedTenureGroupKey((prev) => (prev === item.key ? null : item.key));
    setTablePage(1);
  };

  const handleAnniversarySelect = (index: number) => {
    const item = anniversariesByMonth[index];
    if (!item) return;

    setSelectedAnniversaryMonth((prev) => (prev === item.month ? null : item.month));
    setTablePage(1);
  };

  const handleDepartmentSelect = (index: number) => {
    const item = averageTenureByDepartments[index];
    if (!item?.id) return;

    setSelectedDepartmentId((prev) => (prev === item.id ? null : item.id));
    setTablePage(1);
  };

  const handleLocationSelect = (index: number) => {
    const item = averageTenureByLocations[index];
    if (!item?.id) return;

    setSelectedLocationId((prev) => (prev === item.id ? null : item.id));
    setTablePage(1);
  };

  const tenureGroupChartOptions: ApexOptions = {
    colors: [brandColor],
    chart: {
      fontFamily: "Outfit, sans-serif",
      type: "bar",
      toolbar: { show: false },
      events: {
        dataPointSelection: (_event, _chartContext, config) => {
          if (typeof config?.dataPointIndex === "number" && config.dataPointIndex >= 0) {
            handleTenureGroupSelect(config.dataPointIndex);
          }
        },
      },
    },
    dataLabels: { enabled: false },
    plotOptions: {
      bar: {
        columnWidth: "42%",
        borderRadius: 6,
      },
    },
    stroke: {
      show: true,
      width: 4,
      colors: ["transparent"],
    },
    xaxis: {
      categories: tenureGroups.map((item) => item.label),
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: {
          fontSize: "12px",
          colors: "#64748b",
        },
      },
    },
    yaxis: {
      labels: {
        style: {
          fontSize: "12px",
          colors: ["#64748b"],
        },
      },
    },
    grid: {
      borderColor: "#e5e7eb",
      strokeDashArray: 4,
    },
    tooltip: {
      y: {
        formatter: (value: number) => `${value} сотруд.`,
      },
    },
  };

  const anniversariesChartOptions: ApexOptions = {
    colors: [brandColor],
    chart: {
      fontFamily: "Outfit, sans-serif",
      type: "bar",
      toolbar: { show: false },
      events: {
        dataPointSelection: (_event, _chartContext, config) => {
          if (typeof config?.dataPointIndex === "number" && config.dataPointIndex >= 0) {
            handleAnniversarySelect(config.dataPointIndex);
          }
        },
      },
    },
    dataLabels: { enabled: false },
    plotOptions: {
      bar: {
        columnWidth: "46%",
        borderRadius: 5,
      },
    },
    stroke: {
      show: true,
      width: 3,
      colors: ["transparent"],
    },
    xaxis: {
      categories: anniversariesByMonth.map((item) => item.label),
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: {
          fontSize: "11px",
          colors: "#64748b",
        },
      },
    },
    yaxis: {
      labels: {
        style: {
          fontSize: "12px",
          colors: ["#64748b"],
        },
      },
    },
    grid: {
      borderColor: "#e5e7eb",
      strokeDashArray: 4,
    },
    tooltip: {
      y: {
        formatter: (value: number) => `${value} сотруд.`,
      },
    },
  };

  const horizontalBarOptions = (
    categories: string[],
    onSelect: (index: number) => void
  ): ApexOptions => ({
    colors: [brandColor],
    chart: {
      fontFamily: "Outfit, sans-serif",
      type: "bar",
      toolbar: { show: false },
      events: {
        dataPointSelection: (_event, _chartContext, config) => {
          if (typeof config?.dataPointIndex === "number" && config.dataPointIndex >= 0) {
            onSelect(config.dataPointIndex);
          }
        },
      },
    },
    dataLabels: { enabled: false },
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 6,
        barHeight: "55%",
      },
    },
    xaxis: {
      categories,
      labels: {
        style: {
          fontSize: "12px",
          colors: "#64748b",
        },
      },
    },
    yaxis: {
      labels: {
        style: {
          fontSize: "12px",
          colors: ["#64748b"],
        },
      },
    },
    grid: {
      borderColor: "#e5e7eb",
      strokeDashArray: 4,
    },
    tooltip: {
      y: {
        formatter: (value: number) => `${value.toFixed(1).replace(".", ",")} лет`,
      },
    },
  });

  const tenureGroupsSeries: ApexAxisChartSeries = [
    {
      name: "Сотрудники",
      data: tenureGroups.map((item) => item.count),
    },
  ];

  const anniversariesSeries: ApexAxisChartSeries = [
    {
      name: "Сотрудники",
      data: anniversariesByMonth.map((item) => item.employees_count),
    },
  ];

  const departmentsSeries: ApexAxisChartSeries = [
    {
      name: "Средний стаж",
      data: averageTenureByDepartments.map((item) => item.average_tenure_years ?? 0),
    },
  ];

  const locationsSeries: ApexAxisChartSeries = [
    {
      name: "Средний стаж",
      data: averageTenureByLocations.map((item) => item.average_tenure_years ?? 0),
    },
  ];

  if (isLoading) {
    return (
      <>
        <PageMeta title="Стаж | HRMS" description="Отчет по стажу сотрудников" />
        <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-gray-200 bg-white">
          <Spinner />
        </div>
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageMeta title="Стаж | HRMS" description="Отчет по стажу сотрудников" />
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
      <PageMeta title="Стаж | HRMS" description="Отчет по стажу сотрудников" />

      <div className="space-y-4">
        <section className="grid gap-4 xl:grid-cols-12">
          <div className="xl:col-span-9">
            <ChartBlock
              title="Стаж"
              subtitle="Количество сотрудников"
              options={tenureGroupChartOptions}
              series={tenureGroupsSeries}
              height={320}
            />
          </div>

          <div className="space-y-4 xl:col-span-3">
            <MetricCard
              title="Средний срок работы"
              value={formatYears(result.cards?.average_tenure_years)}
              subtitle="лет"
            />
            <EmployeeCard title="Самый длительный срок работы" employee={result.cards?.longest_tenure_employee} />
          </div>
        </section>

        <ChartBlock
          title="Когда происходят годовщины работы?"
          subtitle="Количество сотрудников по месяцам"
          options={anniversariesChartOptions}
          series={anniversariesSeries}
          height={320}
        />

        <section className="grid gap-4 xl:grid-cols-2">
          <ChartBlock
            title="Средний срок работы по департаментам"
            subtitle="В годах"
            options={horizontalBarOptions(
              averageTenureByDepartments.map((item) => item.label),
              handleDepartmentSelect
            )}
            series={departmentsSeries}
            height={320}
          />

          <ChartBlock
            title="Средний срок работы по локации"
            subtitle="В годах"
            options={horizontalBarOptions(
              averageTenureByLocations.map((item) => item.label),
              handleLocationSelect
            )}
            series={locationsSeries}
            height={320}
          />
        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {selectedTenureGroupKey || selectedAnniversaryMonth || selectedDepartmentId || selectedLocationId ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-3">
              <span className="text-xs font-medium text-gray-500">Фильтр по графику:</span>
              {selectedTenureGroupKey ? (
                <span className="inline-flex items-center rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-600">
                  Стаж: {selectedTenureGroupLabel || selectedTenureGroupKey}
                </span>
              ) : null}
              {selectedAnniversaryMonth ? (
                <span className="inline-flex items-center rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-600">
                  Месяц годовщины: {selectedAnniversaryMonthLabel || selectedAnniversaryMonth}
                </span>
              ) : null}
              {selectedDepartmentId ? (
                <span className="inline-flex items-center rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-600">
                  Департамент: {selectedDepartmentLabel || "Не указано"}
                </span>
              ) : null}
              {selectedLocationId ? (
                <span className="inline-flex items-center rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-600">
                  Локация: {selectedLocationLabel || "Не указано"}
                </span>
              ) : null}
              <button
                type="button"
                onClick={resetChartFilters}
                className="inline-flex h-7 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
              >
                Сбросить
              </button>
            </div>
          ) : null}

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
                    onClick={() => setTablePage(page)}
                    disabled={isTableFetching}
                    className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-70"
                    style={{
                      borderColor: isActive ? brandColor : "#e5e7eb",
                      backgroundColor: isActive ? brandColor : "#ffffff",
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
                  {["Полное имя", "Возраст", "Дата начала", "Срок работы"].map((column) => (
                    <th
                      key={column}
                      className="border-b border-gray-200 px-4 py-2.5 text-left text-sm font-semibold text-gray-700"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {isTableLoading ? (
                  Array.from({ length: 8 }).map((_, rowIndex) => (
                    <tr key={`table-skeleton-${rowIndex}`} className="animate-pulse">
                      {Array.from({ length: 4 }).map((__, cellIndex) => (
                        <td key={`table-skeleton-cell-${rowIndex}-${cellIndex}`} className="border-b border-gray-100 px-4 py-3">
                          <div className="h-4 w-full rounded bg-gray-200" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : isTableError ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm text-error-600">
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
                    <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">
                      Нет сотрудников по выбранным параметрам
                    </td>
                  </tr>
                ) : (
                  tableItems.map((item) => (
                    <tr key={item.guid} className="hover:bg-gray-50">
                      <td className="border-b border-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-800">
                        <Link to={`/employees/${item.guid}`} className="transition hover:text-brand-500">
                          {item.full_name}
                        </Link>
                      </td>
                      <td className="border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                        {typeof item.age === "number" ? item.age : "—"}
                      </td>
                      <td className="border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                        {formatStartDate(item.start_date)}
                      </td>
                      <td className="border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                        {item.tenure_label}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {isTableFetching && !isTableLoading ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
                <div className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
                  <Spinner size="sm" className="w-5 h-5" />
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

export default observer(TenurePage);
