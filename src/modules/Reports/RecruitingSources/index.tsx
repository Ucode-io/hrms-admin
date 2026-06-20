import { useMemo } from "react";
import { observer } from "mobx-react-lite";
import Chart from "react-apexcharts";
import { ApexAxisChartSeries, ApexNonAxisChartSeries, ApexOptions } from "apexcharts";
import PageMeta from "../../../components/common/PageMeta";
import Spinner from "../../../components/ui/Spinner";
import {
  type RecruitingSourcesByDateItem,
  type RecruitingSourcesShareItem,
  useRecruitingSourcesReportQuery,
} from "../../../api/services/reports.service";

const COLORS = [
  "#74A8C9",
  "#6B8FE3",
  "#666DCF",
  "#A78BFA",
  "#22C55E",
  "#F59E0B",
  "#06B6D4",
  "#EC4899",
  "#84CC16",
  "#F97316",
];

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return "Не удалось загрузить отчет. Попробуйте снова.";
};

const toPercentText = (value: number | null | undefined): string => {
  const safe = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return safe.toFixed(2).replace(".", ",");
};

function RecruitingSourcesPage() {
  const { data, isLoading, isFetching, isError, error, refetch } =
    useRecruitingSourcesReportQuery();

  const result = data?.result;
  const sources: string[] = result?.sources ?? [];
  const byDate: RecruitingSourcesByDateItem[] = result?.by_date ?? [];
  const bySource: RecruitingSourcesShareItem[] = result?.by_source ?? [];

  const lineSeries: ApexAxisChartSeries = useMemo(
    () =>
      sources.map((label) => ({
        name: label,
        data: byDate.map((bucket) => bucket.counts[label] ?? 0),
      })),
    [sources, byDate]
  );

  const lineOptions: ApexOptions = useMemo(
    () => ({
      chart: {
        type: "line",
        fontFamily: "Outfit, sans-serif",
        toolbar: { show: false },
      },
      colors: COLORS,
      stroke: { width: 2, curve: "smooth" },
      markers: { size: 3, hover: { size: 5 } },
      dataLabels: { enabled: false },
      xaxis: {
        categories: byDate.map((bucket) => bucket.label),
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: {
          rotate: -45,
          rotateAlways: byDate.length > 8,
          style: { fontSize: "11px", colors: "#64748b" },
        },
      },
      yaxis: {
        min: 0,
        labels: {
          formatter: (value: number) => `${Math.round(value)}`,
          style: { fontSize: "12px", colors: ["#64748b"] },
        },
      },
      grid: { borderColor: "#e5e7eb", strokeDashArray: 4 },
      legend: {
        show: true,
        position: "bottom",
        fontSize: "13px",
        markers: { radius: 6 },
        itemMargin: { horizontal: 10, vertical: 4 },
      },
      tooltip: {
        shared: true,
        intersect: false,
        y: { formatter: (value: number) => `${Math.round(value)} канд.` },
      },
    }),
    [byDate]
  );

  const pieSeries: ApexNonAxisChartSeries = bySource.map((item) => item.count);

  const pieOptions: ApexOptions = useMemo(
    () => ({
      chart: {
        type: "pie",
        fontFamily: "Outfit, sans-serif",
        toolbar: { show: false },
      },
      labels: bySource.map(
        (item) => `${item.label} ${toPercentText(item.percentage)}%`
      ),
      colors: COLORS,
      legend: {
        show: true,
        position: "bottom",
        fontSize: "13px",
        itemMargin: { horizontal: 10, vertical: 4 },
      },
      dataLabels: { enabled: false },
      stroke: { width: 0 },
      tooltip: {
        y: { formatter: (value: number) => `${value} канд.` },
      },
    }),
    [bySource]
  );

  if (isLoading) {
    return (
      <>
        <PageMeta title="Кандидаты по источникам | HRMS" description="Статистика по источникам кандидатов" />
        <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-gray-200 bg-white">
          <Spinner />
        </div>
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageMeta title="Кандидаты по источникам | HRMS" description="Статистика по источникам кандидатов" />
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

  const hasLine = byDate.length > 0 && lineSeries.length > 0;
  const hasPie = bySource.length > 0 && pieSeries.some((v) => v > 0);

  return (
    <>
      <PageMeta title="Кандидаты по источникам | HRMS" description="Статистика по источникам кандидатов" />

      <div className="space-y-4">
        <section className="rounded-2xl border border-gray-200 bg-white">
          <div className="space-y-4 px-4 py-3">
            <article className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
              <h3 className="mb-3 text-lg font-semibold text-gray-900">Кандидаты по датам</h3>
              {hasLine ? (
                <Chart options={lineOptions} series={lineSeries} type="line" height={360} />
              ) : (
                <div className="flex h-[320px] items-center justify-center text-sm text-gray-500">
                  Нет данных для графика
                </div>
              )}
            </article>

            <section className="grid gap-4 xl:grid-cols-2">
              <article className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
                <h3 className="text-lg font-semibold text-gray-900">Кандидаты по источникам</h3>
                <div className="mt-2">
                  {hasPie ? (
                    <div className="flex justify-center">
                      <Chart options={pieOptions} series={pieSeries} type="pie" height={320} />
                    </div>
                  ) : (
                    <div className="flex h-[280px] items-center justify-center text-sm text-gray-500">
                      Нет данных для графика
                    </div>
                  )}
                </div>
              </article>
            </section>
          </div>
        </section>

        {isFetching ? (
          <p className="text-right text-xs text-gray-400">Обновление данных...</p>
        ) : null}
      </div>
    </>
  );
}

export default observer(RecruitingSourcesPage);
