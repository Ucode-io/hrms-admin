import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import { Link } from "react-router";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import Chart from "react-apexcharts";
import { ApexAxisChartSeries, ApexNonAxisChartSeries, ApexOptions } from "apexcharts";
import PageMeta from "../../../components/common/PageMeta";
import Spinner from "../../../components/ui/Spinner";
import {
  type StaffCountCardMetrics,
  type StaffCountDynamicsItem,
  type StaffCountShareItem,
  useStaffCountReportQuery,
  useStaffCountTableQuery,
} from "../../../api/services/reports.service";

const TABLE_PAGE_LIMIT = 20;
const PIE_COLORS = ["#74A8C9", "#6B8FE3", "#666DCF", "#A78BFA", "#F59E0B", "#22C55E"];

type EmploymentStatusFilter = "all" | "active" | "dismissed";
type StaffEventType = "all" | "new_hires" | "dismissed" | "total";

const FALLBACK_CARDS: StaffCountCardMetrics = {
  average_growth_percent: 0,
  average_growth_people: 0,
  average_turnover_percent: 0,
  average_turnover_people: 0,
  current_total: 0,
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return "Не удалось загрузить отчет. Попробуйте снова.";
};

const formatPercent = (value: number | null | undefined): string => {
  const safe = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return `${safe.toFixed(1).replace(".", ",")}%`;
};

const formatPeople = (value: number | null | undefined): string => {
  const safe = typeof value === "number" && Number.isFinite(value) ? value : 0;

  if (Number.isInteger(safe)) {
    return `${safe} человек`;
  }

  return `${safe.toFixed(1).replace(".", ",")} чел.`;
};

const formatDate = (value: string | null | undefined): string => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const toPercentText = (value: number | null | undefined): string => {
  const safe = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return safe.toFixed(2).replace(".", ",");
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

function MetricCard({
  title,
  percent,
  people,
}: {
  title: string;
  percent: number;
  people: number;
}) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="flex items-baseline gap-2 font-semibold leading-none tracking-tight text-gray-900">
        <span className="text-2xl">{formatPercent(percent)}</span>
        <span className="text-lg font-medium text-gray-300">|</span>
        <span className="text-2xl">{formatPeople(people)}</span>
      </p>
      <p className="mt-2 text-sm font-medium text-gray-500">{title}</p>
    </article>
  );
}

function StaffCountPage() {
  const [tablePage, setTablePage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [employmentStatus, setEmploymentStatus] = useState<EmploymentStatusFilter>("all");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedEventMonth, setSelectedEventMonth] = useState<string | null>(null);
  const [selectedEventType, setSelectedEventType] = useState<StaffEventType>("all");

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setTablePage(1);
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setTablePage(1);
  }, [employmentStatus]);

  const tableRequestData = useMemo(
    () => ({
      search,
      employment_status: employmentStatus,
      ...(selectedDepartmentId ? { departments_ids: [selectedDepartmentId] } : {}),
      ...(selectedLocationId ? { locations_ids: [selectedLocationId] } : {}),
      ...(selectedEventMonth ? { event_month: selectedEventMonth } : {}),
      ...(selectedEventType !== "all" ? { event_type: selectedEventType } : {}),
    }),
    [
      employmentStatus,
      search,
      selectedDepartmentId,
      selectedLocationId,
      selectedEventMonth,
      selectedEventType,
    ]
  );

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useStaffCountReportQuery();

  const {
    data: tableData,
    isLoading: isTableLoading,
    isFetching: isTableFetching,
    isError: isTableError,
    error: tableError,
    refetch: refetchTable,
  } = useStaffCountTableQuery({
    requestData: tableRequestData,
    page: tablePage,
    limit: TABLE_PAGE_LIMIT,
  });

  const cards = {
    ...FALLBACK_CARDS,
    ...(data?.result?.cards ?? {}),
  };

  const dynamics: StaffCountDynamicsItem[] = data?.result?.charts?.dynamics ?? [];
  const byDepartments: StaffCountShareItem[] = data?.result?.charts?.by_departments ?? [];
  const byLocations: StaffCountShareItem[] = data?.result?.charts?.by_locations ?? [];

  const selectedDepartmentLabel = useMemo(
    () => byDepartments.find((item) => item.id === selectedDepartmentId)?.label ?? null,
    [byDepartments, selectedDepartmentId]
  );
  const selectedLocationLabel = useMemo(
    () => byLocations.find((item) => item.id === selectedLocationId)?.label ?? null,
    [byLocations, selectedLocationId]
  );
  const selectedEventMonthLabel = useMemo(
    () => dynamics.find((item) => item.month_start === selectedEventMonth)?.label ?? null,
    [dynamics, selectedEventMonth]
  );

  const selectedEventTypeLabel = useMemo(() => {
    if (selectedEventType === "new_hires") return "Новые сотрудники";
    if (selectedEventType === "dismissed") return "Уволенные";
    if (selectedEventType === "total") return "Общий";
    return null;
  }, [selectedEventType]);

  const handleDynamicsPointSelect = (seriesIndex: number, dataPointIndex: number) => {
    if (dataPointIndex < 0) {
      return;
    }

    const item = dynamics[dataPointIndex];
    if (!item?.month_start) {
      return;
    }

    const eventTypeBySeries: StaffEventType[] = ["new_hires", "dismissed", "total"];
    const nextEventType = eventTypeBySeries[seriesIndex] || "all";

    if (selectedEventMonth === item.month_start && selectedEventType === nextEventType) {
      setSelectedEventMonth(null);
      setSelectedEventType("all");
      setTablePage(1);
      return;
    }

    setSelectedEventMonth(item.month_start);
    setSelectedEventType(nextEventType);
    setTablePage(1);
  };

  const mixedChartOptions: ApexOptions = {
    chart: {
      type: "line",
      fontFamily: "Outfit, sans-serif",
      toolbar: { show: false },
      events: {
        dataPointSelection: (_event, _chartContext, config) => {
          if (
            typeof config?.seriesIndex === "number" &&
            typeof config?.dataPointIndex === "number"
          ) {
            handleDynamicsPointSelect(config.seriesIndex, config.dataPointIndex);
          }
        },
      },
    },
    colors: ["#6BCB77", "#E76F51", "#6B8FE3"],
    stroke: {
      width: [0, 0, 3],
      curve: "smooth",
    },
    dataLabels: {
      enabled: false,
    },
    xaxis: {
      categories: dynamics.map((item) => item.label),
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: {
          fontSize: "11px",
          colors: "#64748b",
        },
      },
    },
    yaxis: [
      {
        title: {
          text: "Количество сотрудников",
          style: { fontSize: "12px", color: "#64748b" },
        },
        labels: {
          style: {
            fontSize: "12px",
            colors: ["#64748b"],
          },
        },
      },
      {
        opposite: true,
        title: {
          text: "Общая численность",
          style: { fontSize: "12px", color: "#64748b" },
        },
        labels: {
          style: {
            fontSize: "12px",
            colors: ["#64748b"],
          },
        },
      },
    ],
    plotOptions: {
      bar: {
        columnWidth: "38%",
        borderRadius: 4,
      },
    },
    grid: {
      borderColor: "#e5e7eb",
      strokeDashArray: 4,
    },
    legend: {
      show: true,
      position: "bottom",
      fontSize: "14px",
      markers: {
        radius: 6,
      },
    },
    tooltip: {
      shared: true,
      intersect: false,
      y: {
        formatter: (value: number) => `${Math.round(value)} сотруд.`,
      },
    },
  };

  const mixedSeries: ApexAxisChartSeries = [
    {
      name: "Новые сотрудники",
      type: "column",
      data: dynamics.map((item) => item.new_hires),
    },
    {
      name: "Уволенные",
      type: "column",
      data: dynamics.map((item) => item.dismissed),
    },
    {
      name: "Общий",
      type: "line",
      data: dynamics.map((item) => item.total),
    },
  ];

  const createPieOptions = (
    items: StaffCountShareItem[],
    onSliceSelect: (index: number) => void
  ): ApexOptions => ({
    chart: {
      type: "pie",
      fontFamily: "Outfit, sans-serif",
      toolbar: { show: false },
      events: {
        dataPointSelection: (_event, _chartContext, config) => {
          if (typeof config?.dataPointIndex === "number" && config.dataPointIndex >= 0) {
            onSliceSelect(config.dataPointIndex);
          }
        },
      },
    },
    labels: items.map((item) => `${item.label} ${toPercentText(item.percentage)}%`),
    colors: PIE_COLORS,
    legend: {
      show: true,
      position: "bottom",
      fontSize: "13px",
      itemMargin: {
        horizontal: 10,
        vertical: 4,
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      width: 0,
    },
    tooltip: {
      y: {
        formatter: (value: number) => `${value} сотруд.`,
      },
    },
  });

  const handleDepartmentSliceSelect = (index: number) => {
    const item = byDepartments[index];
    if (!item?.id) {
      return;
    }

    setSelectedDepartmentId((prev) => (prev === item.id ? null : item.id));
    setTablePage(1);
  };

  const handleLocationSliceSelect = (index: number) => {
    const item = byLocations[index];
    if (!item?.id) {
      return;
    }

    setSelectedLocationId((prev) => (prev === item.id ? null : item.id));
    setTablePage(1);
  };

  const departmentsPieSeries: ApexNonAxisChartSeries = byDepartments.map((item) => item.employees_count);
  const locationsPieSeries: ApexNonAxisChartSeries = byLocations.map((item) => item.employees_count);
  const departmentsPieOptions = useMemo(
    () => createPieOptions(byDepartments, handleDepartmentSliceSelect),
    [byDepartments]
  );
  const locationsPieOptions = useMemo(
    () => createPieOptions(byLocations, handleLocationSliceSelect),
    [byLocations]
  );

  const tableResult = tableData?.result;
  const tableItems = tableResult?.items ?? [];
  const tablePagination = tableResult?.pagination;
  const tableTotalCount = tablePagination?.total_count ?? 0;
  const tableTotalPages = Math.max(1, tablePagination?.total_pages ?? 1);
  const tableCurrentPage = tablePage;
  const tableFrom = tablePagination?.from ?? 0;
  const tableTo = tablePagination?.to ?? 0;
  const visiblePages = getVisiblePages(tableCurrentPage, tableTotalPages);

  if (isLoading) {
    return (
      <>
        <PageMeta title="Численность персонала | HRMS" description="Отчет о приросте сотрудников" />
        <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-gray-200 bg-white">
          <Spinner />
        </div>
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageMeta title="Численность персонала | HRMS" description="Отчет о приросте сотрудников" />
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
      <PageMeta title="Численность персонала | HRMS" description="Отчет о приросте сотрудников" />

      <div className="space-y-4">
        <section className="rounded-2xl border border-gray-200 bg-white">
          <div className="space-y-4 px-4 py-3">
            <section className="grid gap-4 xl:grid-cols-12">
              <article className="rounded-2xl border border-gray-200 bg-white px-4 py-4 xl:col-span-9">
                <div className="mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">Какая численность в моей компании?</h3>
                </div>
                {dynamics.length === 0 ? (
                  <div className="flex h-[320px] items-center justify-center text-sm text-gray-500">
                    Нет данных для графика
                  </div>
                ) : (
                  <Chart options={mixedChartOptions} series={mixedSeries} type="line" height={350} />
                )}
              </article>

              <div className="space-y-4 xl:col-span-3">
                <MetricCard
                  title="Средний прирост"
                  percent={cards.average_growth_percent}
                  people={cards.average_growth_people}
                />
                <MetricCard
                  title="Средняя текучесть"
                  percent={cards.average_turnover_percent}
                  people={cards.average_turnover_people}
                />
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              <article className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
                <h3 className="text-lg font-semibold text-gray-900">Численность персонала по департаментам</h3>
                <div className="mt-2">
                  {byDepartments.length === 0 || departmentsPieSeries.every((value) => value === 0) ? (
                    <div className="flex h-[280px] items-center justify-center text-sm text-gray-500">
                      Нет данных для графика
                    </div>
                  ) : (
                    <div className="flex justify-center">
                      <Chart options={departmentsPieOptions} series={departmentsPieSeries} type="pie" height={300} />
                    </div>
                  )}
                </div>
              </article>

              <article className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
                <h3 className="text-lg font-semibold text-gray-900">Численность персонала по локациям</h3>
                <div className="mt-2">
                  {byLocations.length === 0 || locationsPieSeries.every((value) => value === 0) ? (
                    <div className="flex h-[280px] items-center justify-center text-sm text-gray-500">
                      Нет данных для графика
                    </div>
                  ) : (
                    <div className="flex justify-center">
                      <Chart options={locationsPieOptions} series={locationsPieSeries} type="pie" height={300} />
                    </div>
                  )}
                </div>
              </article>
            </section>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {selectedDepartmentId || selectedLocationId || selectedEventMonth ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-3">
              <span className="text-xs font-medium text-gray-500">Фильтр по графику:</span>
              {selectedEventMonth ? (
                <span className="inline-flex items-center rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-600">
                  Месяц: {selectedEventMonthLabel || selectedEventMonth}
                  {selectedEventTypeLabel ? ` (${selectedEventTypeLabel})` : ""}
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
                onClick={() => {
                  setSelectedDepartmentId(null);
                  setSelectedLocationId(null);
                  setSelectedEventMonth(null);
                  setSelectedEventType("all");
                  setTablePage(1);
                }}
                className="inline-flex h-7 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
              >
                Сбросить
              </button>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
              <label className="relative w-full md:max-w-sm">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Поиск..."
                  className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-700 outline-none transition focus:border-brand-300"
                />
              </label>

              <select
                value={employmentStatus}
                onChange={(event) => setEmploymentStatus(event.target.value as EmploymentStatusFilter)}
                className="select-with-arrow h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-brand-300 md:min-w-[180px]"
              >
                <option value="all">Все</option>
                <option value="active">Активные</option>
                <option value="dismissed">Уволенные</option>
              </select>
            </div>
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
                      borderColor: isActive ? "#3b82f6" : "#e5e7eb",
                      backgroundColor: isActive ? "#3b82f6" : "#ffffff",
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
                    "Дата начала",
                    "Уволен с",
                    "Уровень",
                    "Должность",
                    "Департамент",
                    "Подразделение",
                    "Локация",
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
                  tableItems.map((item) => (
                    <tr key={item.guid} className="hover:bg-gray-50">
                      <td className="border-b border-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-800">
                        <Link to={`/employees/${item.guid}`} className="transition hover:text-brand-500">
                          {item.full_name}
                        </Link>
                      </td>
                      <td className="border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                        {formatDate(item.start_date)}
                      </td>
                      <td className="border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                        {formatDate(item.dismissed_from)}
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
                        {item.division}
                      </td>
                      <td className="border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                        {item.location}
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
        {isTableFetching && !isTableLoading ? (
          <p className="text-right text-xs text-gray-400">Обновление таблицы...</p>
        ) : null}
      </div>
    </>
  );
}

export default observer(StaffCountPage);
