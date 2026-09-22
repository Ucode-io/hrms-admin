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
  type AgeDistributionResult,
  type AgeGroupDistributionItem,
  type AverageAgeBreakdownItem,
  type BirthdaysByMonthItem,
  type EmployeeAgeInfo,
  useAgeDistributionReportQuery,
  useAgeDistributionTableQuery,
} from "../../../api/services/reports.service";
import { translate, useTranslation } from "../../../i18n";
import type { MessageKey } from "../../../i18n/messages";

type MetricCardProps = {
  title: string;
  value: string;
  subtitle?: string;
};

type EmployeeCardProps = {
  title: string;
  employee: EmployeeAgeInfo | null | undefined;
};

type ChartBlockProps = {
  title: string;
  subtitle: string;
  options: ApexOptions;
  series: ApexAxisChartSeries;
  height?: number;
};

const TABLE_PAGE_LIMIT = 20;

const FALLBACK_RESULT: AgeDistributionResult = {
  cards: {
    average_age: 0,
    total_employees: 0,
    youngest_employee: null,
    oldest_employee: null,
  },
  charts: {
    age_groups: [],
    birthdays_by_month: [],
    average_age_by_departments: [],
    average_age_by_locations: [],
  },
  filters_applied: {},
};

const formatAverageAge = (value: number | null | undefined): string => {
  const safe = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return safe.toFixed(1);
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return translate("reports.common.load_error");
};

const formatBirthDate = (value: string | null | undefined, locale: string): string => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(locale, {
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

const getEmployeeAgeText = (employee: EmployeeAgeInfo | null | undefined): string => {
  if (typeof employee?.age !== "number" || !Number.isFinite(employee.age)) {
    return translate("reports.age_distribution.age_not_specified");
  }
  return `${employee.age} ${translate("reports.age_distribution.years_short")}`;
};

// The backend ships Russian bucket labels; the keys are stable, so translate by
// key and fall back to the server label for buckets we don't know yet.
const AGE_GROUP_LABEL_KEYS: Record<string, MessageKey> = {
  under_25: "reports.age_distribution.group_under_25",
  from_26_to_30: "reports.age_distribution.group_26_30",
  from_31_to_40: "reports.age_distribution.group_31_40",
  from_41_to_54: "reports.age_distribution.group_41_54",
  from_55_plus: "reports.age_distribution.group_55_plus",
};

const normalizeAgeGroups = (
  source: AgeGroupDistributionItem[] | undefined
): AgeGroupDistributionItem[] => {
  if (!Array.isArray(source)) return [];
  return source.map((item) => {
    const labelKey = AGE_GROUP_LABEL_KEYS[item.key];
    return {
      key: item.key,
      label: labelKey ? translate(labelKey) : item.label,
      count: item.count ?? 0,
    };
  });
};

const normalizeBirthdaysByMonth = (
  source: BirthdaysByMonthItem[] | undefined
): BirthdaysByMonthItem[] => {
  if (!Array.isArray(source)) return [];
  return source
    .map((item) => ({
      month: item.month,
      label: item.label,
      employees_count: item.employees_count ?? 0,
    }))
    .sort((a, b) => a.month - b.month);
};

const normalizeAverageAgeBreakdown = (
  source: AverageAgeBreakdownItem[] | undefined
): AverageAgeBreakdownItem[] => {
  if (!Array.isArray(source)) return [];
  return source.map((item) => ({
    id: item.id,
    label: item.label || translate("reports.common.not_specified"),
    average_age:
      typeof item.average_age === "number" && Number.isFinite(item.average_age)
        ? Number(item.average_age.toFixed(1))
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

      <p className="mt-1 text-sm text-gray-500">{getEmployeeAgeText(employee)}</p>
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

function ReportsPage() {
  const { t, locale } = useTranslation();
  const brandColor = companyStore.mainColor || "#2980B9";
  const [tablePage, setTablePage] = useState(1);
  const [selectedAgeGroupKey, setSelectedAgeGroupKey] = useState<string | null>(null);
  const [selectedBirthMonth, setSelectedBirthMonth] = useState<number | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  const tableRequestData = useMemo(
    () => ({
      ...(selectedAgeGroupKey ? { age_group_key: selectedAgeGroupKey } : {}),
      ...(selectedBirthMonth ? { birth_month: selectedBirthMonth } : {}),
      ...(selectedDepartmentId ? { departments_ids: [selectedDepartmentId] } : {}),
      ...(selectedLocationId ? { locations_ids: [selectedLocationId] } : {}),
    }),
    [selectedAgeGroupKey, selectedBirthMonth, selectedDepartmentId, selectedLocationId]
  );

  const { data, isLoading, isFetching, isError, error, refetch } = useAgeDistributionReportQuery();
  const {
    data: tableData,
    isLoading: isTableLoading,
    isFetching: isTableFetching,
    isError: isTableError,
    error: tableError,
    refetch: refetchTable,
  } = useAgeDistributionTableQuery({
    requestData: tableRequestData,
    page: tablePage,
    limit: TABLE_PAGE_LIMIT,
  });
  const result = data?.result ?? FALLBACK_RESULT;
  const tableResult = tableData?.result;

  const ageGroups = normalizeAgeGroups(result.charts?.age_groups);
  const birthdaysByMonth = normalizeBirthdaysByMonth(result.charts?.birthdays_by_month);
  const averageAgeByDepartments = normalizeAverageAgeBreakdown(
    result.charts?.average_age_by_departments
  );
  const averageAgeByLocations = normalizeAverageAgeBreakdown(
    result.charts?.average_age_by_locations
  );
  const tableItems = tableResult?.items ?? [];
  const tablePagination = tableResult?.pagination;
  const tableTotalCount = tablePagination?.total_count ?? 0;
  const tableTotalPages = Math.max(1, tablePagination?.total_pages ?? 1);
  const tableCurrentPage = tablePage;
  const tableFrom = tablePagination?.from ?? 0;
  const tableTo = tablePagination?.to ?? 0;
  const visiblePages = getVisiblePages(tableCurrentPage, tableTotalPages);

  const selectedAgeGroupLabel = useMemo(
    () => ageGroups.find((item) => item.key === selectedAgeGroupKey)?.label ?? null,
    [ageGroups, selectedAgeGroupKey]
  );
  const selectedBirthMonthLabel = useMemo(
    () => birthdaysByMonth.find((item) => item.month === selectedBirthMonth)?.label ?? null,
    [birthdaysByMonth, selectedBirthMonth]
  );
  const selectedDepartmentLabel = useMemo(
    () => averageAgeByDepartments.find((item) => item.id === selectedDepartmentId)?.label ?? null,
    [averageAgeByDepartments, selectedDepartmentId]
  );
  const selectedLocationLabel = useMemo(
    () => averageAgeByLocations.find((item) => item.id === selectedLocationId)?.label ?? null,
    [averageAgeByLocations, selectedLocationId]
  );

  const resetChartFilters = () => {
    setSelectedAgeGroupKey(null);
    setSelectedBirthMonth(null);
    setSelectedDepartmentId(null);
    setSelectedLocationId(null);
    setTablePage(1);
  };

  const handleAgeGroupSelect = (index: number) => {
    const item = ageGroups[index];
    if (!item) return;

    setSelectedAgeGroupKey((prev) => (prev === item.key ? null : item.key));
    setTablePage(1);
  };

  const handleBirthMonthSelect = (index: number) => {
    const item = birthdaysByMonth[index];
    if (!item) return;

    setSelectedBirthMonth((prev) => (prev === item.month ? null : item.month));
    setTablePage(1);
  };

  const handleDepartmentSelect = (index: number) => {
    const item = averageAgeByDepartments[index];
    if (!item?.id) return;

    setSelectedDepartmentId((prev) => (prev === item.id ? null : item.id));
    setTablePage(1);
  };

  const handleLocationSelect = (index: number) => {
    const item = averageAgeByLocations[index];
    if (!item?.id) return;

    setSelectedLocationId((prev) => (prev === item.id ? null : item.id));
    setTablePage(1);
  };

  const ageGroupChartOptions: ApexOptions = {
    colors: [brandColor],
    chart: {
      fontFamily: "Outfit, sans-serif",
      type: "bar",
      toolbar: { show: false },
      events: {
        dataPointSelection: (_event, _chartContext, config) => {
          if (typeof config?.dataPointIndex === "number" && config.dataPointIndex >= 0) {
            handleAgeGroupSelect(config.dataPointIndex);
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
      categories: ageGroups.map((item) => item.label),
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
        formatter: (value: number) => `${value} ${t("reports.age_distribution.employees_short")}`,
      },
    },
  };

  const birthdaysChartOptions: ApexOptions = {
    colors: [brandColor],
    chart: {
      fontFamily: "Outfit, sans-serif",
      type: "bar",
      toolbar: { show: false },
      events: {
        dataPointSelection: (_event, _chartContext, config) => {
          if (typeof config?.dataPointIndex === "number" && config.dataPointIndex >= 0) {
            handleBirthMonthSelect(config.dataPointIndex);
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
      categories: birthdaysByMonth.map((item) => item.label),
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
        formatter: (value: number) => `${value} ${t("reports.age_distribution.employees_short")}`,
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
        formatter: (value: number) =>
          `${value.toFixed(1)} ${t("reports.age_distribution.years_short")}`,
      },
    },
  });

  const ageGroupsSeries: ApexAxisChartSeries = [
    {
      name: t("reports.age_distribution.employees_series"),
      data: ageGroups.map((item) => item.count),
    },
  ];

  const birthdaysSeries: ApexAxisChartSeries = [
    {
      name: t("reports.age_distribution.employees_series"),
      data: birthdaysByMonth.map((item) => item.employees_count),
    },
  ];

  const departmentsSeries: ApexAxisChartSeries = [
    {
      name: t("reports.age_distribution.average_age_series"),
      data: averageAgeByDepartments.map((item) => item.average_age ?? 0),
    },
  ];

  const locationsSeries: ApexAxisChartSeries = [
    {
      name: t("reports.age_distribution.average_age_series"),
      data: averageAgeByLocations.map((item) => item.average_age ?? 0),
    },
  ];

  if (isLoading) {
    return (
      <>
        <PageMeta
          title={t("reports.age_distribution.page_title")}
          description={t("reports.age_distribution.page_description")}
        />
        <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-gray-200 bg-white">
          <Spinner />
        </div>
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageMeta
          title={t("reports.age_distribution.page_title")}
          description={t("reports.age_distribution.page_description")}
        />
        <div className="rounded-2xl border border-error-200 bg-error-50 p-6">
          <p className="text-sm font-medium text-error-700">
            {getErrorMessage(error)}
          </p>
          <button
            type="button"
            onClick={() => {
              void refetch();
            }}
            className="mt-3 inline-flex h-10 items-center justify-center rounded-xl bg-error-600 px-4 text-sm font-semibold text-white transition hover:bg-error-700"
          >
            {t("reports.common.retry_button")}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageMeta
        title={t("reports.age_distribution.page_title")}
        description={t("reports.age_distribution.page_description")}
      />

      <div className="space-y-4">
        <section className="grid gap-4 xl:grid-cols-12">
          <div className="xl:col-span-9">
            <ChartBlock
              title={t("reports.age_distribution.chart_age_groups_title")}
              subtitle={t("reports.age_distribution.chart_employees_count_subtitle")}
              options={ageGroupChartOptions}
              series={ageGroupsSeries}
              height={320}
            />
          </div>

          <div className="space-y-4 xl:col-span-3">
            <MetricCard
              title={t("reports.age_distribution.card_average_age")}
              value={formatAverageAge(result.cards?.average_age)}
              subtitle={t("reports.age_distribution.years_short")}
            />
            <EmployeeCard
              title={t("reports.age_distribution.card_youngest")}
              employee={result.cards?.youngest_employee}
            />
            <EmployeeCard
              title={t("reports.age_distribution.card_oldest")}
              employee={result.cards?.oldest_employee}
            />
          </div>
        </section>

        <ChartBlock
          title={t("reports.age_distribution.chart_birthdays_title")}
          subtitle={t("reports.age_distribution.chart_birthdays_subtitle")}
          options={birthdaysChartOptions}
          series={birthdaysSeries}
          height={320}
        />

        <section className="grid gap-4 xl:grid-cols-2">
          <ChartBlock
            title={t("reports.age_distribution.chart_by_department_title")}
            subtitle={t("reports.age_distribution.in_years_subtitle")}
            options={horizontalBarOptions(
              averageAgeByDepartments.map((item) => item.label),
              handleDepartmentSelect
            )}
            series={departmentsSeries}
            height={320}
          />

          <ChartBlock
            title={t("reports.age_distribution.chart_by_location_title")}
            subtitle={t("reports.age_distribution.in_years_subtitle")}
            options={horizontalBarOptions(
              averageAgeByLocations.map((item) => item.label),
              handleLocationSelect
            )}
            series={locationsSeries}
            height={320}
          />
        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {selectedAgeGroupKey || selectedBirthMonth || selectedDepartmentId || selectedLocationId ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-3">
              <span className="text-xs font-medium text-gray-500">
                {t("reports.common.chart_filter_label")}
              </span>
              {selectedAgeGroupKey ? (
                <span className="inline-flex items-center rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-600">
                  {t("reports.age_distribution.filter_age_prefix")}{" "}
                  {selectedAgeGroupLabel || selectedAgeGroupKey}
                </span>
              ) : null}
              {selectedBirthMonth ? (
                <span className="inline-flex items-center rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-600">
                  {t("reports.age_distribution.filter_birth_month_prefix")}{" "}
                  {selectedBirthMonthLabel || selectedBirthMonth}
                </span>
              ) : null}
              {selectedDepartmentId ? (
                <span className="inline-flex items-center rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-600">
                  {t("reports.common.filter_department_prefix")}{" "}
                  {selectedDepartmentLabel || t("reports.common.not_specified")}
                </span>
              ) : null}
              {selectedLocationId ? (
                <span className="inline-flex items-center rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-600">
                  {t("reports.common.filter_location_prefix")}{" "}
                  {selectedLocationLabel || t("reports.common.not_specified")}
                </span>
              ) : null}
              <button
                type="button"
                onClick={resetChartFilters}
                className="inline-flex h-7 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
              >
                {t("reports.common.reset_button")}
              </button>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-medium text-gray-500">
              {tableTotalCount > 0
                ? t("reports.common.showing_range", {
                    from: tableFrom,
                    to: tableTo,
                    total: tableTotalCount,
                  })
                : t("reports.common.no_data")}
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
                onClick={() =>
                  setTablePage((prev) => Math.min(tableTotalPages, prev + 1))
                }
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
                    t("reports.age_distribution.col_full_name"),
                    t("reports.age_distribution.col_birth_date"),
                    t("reports.age_distribution.col_age"),
                    t("reports.age_distribution.col_level"),
                    t("reports.age_distribution.col_position"),
                    t("reports.age_distribution.col_department"),
                    t("reports.age_distribution.col_region"),
                  ].map((column) => (
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
                      {Array.from({ length: 7 }).map((__, cellIndex) => (
                        <td key={`table-skeleton-cell-${rowIndex}-${cellIndex}`} className="border-b border-gray-100 px-4 py-3">
                          <div className="h-4 w-full rounded bg-gray-200" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : isTableError ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-sm text-error-600">
                      {getErrorMessage(tableError)}{" "}
                      <button
                        type="button"
                        onClick={() => {
                          void refetchTable();
                        }}
                        className="ml-2 inline-flex h-8 items-center rounded-lg bg-error-600 px-3 text-xs font-semibold text-white transition hover:bg-error-700"
                      >
                        {t("reports.common.retry_button")}
                      </button>
                    </td>
                  </tr>
                ) : tableItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-500">
                      {t("reports.common.no_employees_filtered")}
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
                        {formatBirthDate(item.birth_date, locale)}
                      </td>
                      <td className="border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                        {item.age}
                      </td>
                      <td className="border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                        {item.level}
                      </td>
                      <td className="border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                        {item.position}
                      </td>
                      <td className="border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                        {item.department}
                      </td>
                      <td className="border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                        {item.region}
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
                  <span className="text-sm font-medium text-gray-600">
                    {t("reports.common.loading")}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {isFetching ? (
          <p className="text-right text-xs text-gray-400">{t("reports.common.updating")}</p>
        ) : null}
        {isTableFetching && !isTableLoading ? (
          <p className="text-right text-xs text-gray-400">{t("reports.common.updating_table")}</p>
        ) : null}
      </div>
    </>
  );
}

export default observer(ReportsPage);
