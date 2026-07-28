import { useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import { Link } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Chart from "react-apexcharts";
import { ApexNonAxisChartSeries, ApexOptions } from "apexcharts";
import PageMeta from "../../../components/common/PageMeta";
import Spinner from "../../../components/ui/Spinner";
import {
  type GenderDistributionItem,
  useGenderDistributionReportQuery,
  useGenderDistributionTableQuery,
} from "../../../api/services/reports.service";

const TABLE_PAGE_LIMIT = 20;

const CHART_COLORS = ["#74A8C9", "#6B8FE3", "#666DCF"];

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return "Не удалось загрузить отчет. Попробуйте снова.";
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

function GenderDistributionPage() {
  const [tablePage, setTablePage] = useState(1);
  const [selectedGenderKey, setSelectedGenderKey] = useState<string | null>(null);

  const tableRequestData = useMemo(
    () => ({
      ...(selectedGenderKey ? { gender_key: selectedGenderKey } : {}),
    }),
    [selectedGenderKey]
  );

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useGenderDistributionReportQuery();

  const {
    data: tableData,
    isLoading: isTableLoading,
    isFetching: isTableFetching,
    isError: isTableError,
    error: tableError,
    refetch: refetchTable,
  } = useGenderDistributionTableQuery({
    requestData: tableRequestData,
    page: tablePage,
    limit: TABLE_PAGE_LIMIT,
  });

  const distribution: GenderDistributionItem[] = data?.result?.chart?.distribution ?? [];
  const pieSeries: ApexNonAxisChartSeries = distribution.map((item) => item.count);
  const pieLabels = distribution.map(
    (item) => `${item.label} ${toPercentText(item.percentage)}%`
  );
  const selectedGenderLabel =
    distribution.find((item) => item.key === selectedGenderKey)?.label ?? null;

  const pieOptions: ApexOptions = useMemo(
    () => ({
      chart: {
        type: "pie",
        fontFamily: "Outfit, sans-serif",
        toolbar: { show: false },
        events: {
          dataPointSelection: (_event, _chartContext, config) => {
            if (typeof config?.dataPointIndex !== "number" || config.dataPointIndex < 0) {
              return;
            }

            const selected = distribution[config.dataPointIndex];
            if (!selected?.key) {
              return;
            }

            setSelectedGenderKey((prev) => (prev === selected.key ? null : selected.key));
            setTablePage(1);
          },
        },
      },
      labels: pieLabels,
      colors: CHART_COLORS,
      legend: {
        show: true,
        position: "bottom",
        fontSize: "14px",
        itemMargin: {
          horizontal: 10,
          vertical: 5,
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
      responsive: [
        {
          breakpoint: 768,
          options: {
            chart: {
              height: 300,
            },
            legend: {
              position: "bottom",
              fontSize: "12px",
            },
          },
        },
      ],
    }),
    [distribution, pieLabels]
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
        <PageMeta title="Гендерное распределение | HRMS" description="Гендерный отчет сотрудников" />
        <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-gray-200 bg-white">
          <Spinner />
        </div>
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageMeta title="Гендерное распределение | HRMS" description="Гендерный отчет сотрудников" />
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
      <PageMeta title="Гендерное распределение | HRMS" description="Гендерный отчет сотрудников" />

      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
          {distribution.length === 0 || pieSeries.every((value) => value === 0) ? (
            <div className="flex h-[280px] items-center justify-center text-sm text-gray-500">
              Нет данных для графика
            </div>
          ) : (
            <div className="flex justify-center">
              <Chart options={pieOptions} series={pieSeries} type="pie" height={320} />
            </div>
          )}
        </div>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {selectedGenderKey ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-3">
              <span className="text-xs font-medium text-gray-500">Фильтр по графику:</span>
              <span className="inline-flex items-center rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-600">
                Пол: {selectedGenderLabel || selectedGenderKey}
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedGenderKey(null);
                  setTablePage(1);
                }}
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
                    "Полное имя",
                    "Пол",
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
                      {Array.from({ length: 7 }).map((__, cellIndex) => (
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
                    <td colSpan={7} className="px-4 py-6 text-center text-sm text-error-600">
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
                    <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-500">
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
                      <td className="border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">{item.gender}</td>
                      <td className="border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">{item.level}</td>
                      <td className="border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">{item.position}</td>
                      <td className="border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">{item.department}</td>
                      <td className="border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">{item.division}</td>
                      <td className="border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">{item.location}</td>
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

export default observer(GenderDistributionPage);
