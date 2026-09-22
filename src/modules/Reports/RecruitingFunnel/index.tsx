import { useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import { ChevronDown } from "lucide-react";
import Chart from "react-apexcharts";
import { ApexNonAxisChartSeries, ApexOptions } from "apexcharts";
import PageMeta from "../../../components/common/PageMeta";
import Spinner from "../../../components/ui/Spinner";
import {
  type RecruitingFunnelRejectionItem,
  type RecruitingFunnelStep,
  type RecruitingFunnelSummary,
  type RecruitingFunnelTableRow,
  type RecruitingFunnelTableStage,
  useRecruitingFunnelReportQuery,
} from "../../../api/services/reports.service";
import { translate, useTranslation } from "../../../i18n";
import type { MessageKey } from "../../../i18n/messages";

const PIE_COLORS = [
  "#74A8C9",
  "#6B8FE3",
  "#666DCF",
  "#A78BFA",
  "#F59E0B",
  "#22C55E",
  "#06B6D4",
  "#EC4899",
  "#84CC16",
  "#F97316",
];

// Known rejection-reason keys → message keys; anything else is humanized from the raw key.
const REASON_KEYS: Record<string, MessageKey> = {
  experience_mismatch: "reports.recruiting_funnel.reason_experience_mismatch",
  skills_mismatch: "reports.recruiting_funnel.reason_skills_mismatch",
  salary_expectations: "reports.recruiting_funnel.reason_salary_expectations",
  culture_fit: "reports.recruiting_funnel.reason_culture_fit",
  location: "reports.recruiting_funnel.reason_location",
  no_show: "reports.recruiting_funnel.reason_no_show",
  candidate_declined: "reports.recruiting_funnel.reason_candidate_declined",
  position_closed: "reports.recruiting_funnel.reason_position_closed",
  other: "reports.recruiting_funnel.reason_other",
};

const humanizeReason = (value: string): string => {
  if (REASON_KEYS[value]) return translate(REASON_KEYS[value]);
  const spaced = value.replace(/[_-]+/g, " ").trim();
  return spaced
    ? spaced.charAt(0).toUpperCase() + spaced.slice(1)
    : translate("reports.common.not_specified");
};

const FALLBACK_SUMMARY: RecruitingFunnelSummary = {
  total_candidates: 0,
  active: 0,
  hired: 0,
  rejected: 0,
  reserve: 0,
  conversion_rate: 0,
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return translate("reports.common.load_error");
};

const formatPercent = (value: number | null | undefined): string => {
  const safe = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return `${safe.toFixed(1).replace(".", ",")}%`;
};

const toPercentText = (value: number | null | undefined): string => {
  const safe = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return safe.toFixed(2).replace(".", ",");
};

const truncate = (value: string, max = 34): string =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="text-2xl font-semibold leading-none tracking-tight text-gray-900">
        {value}
      </p>
      <p className="mt-2 text-sm font-medium text-gray-500">{title}</p>
    </article>
  );
}

function FunnelChart({ steps }: { steps: RecruitingFunnelStep[] }) {
  const bandHeight = 44;
  const gap = 6;
  const funnelWidth = 460;
  const labelX = funnelWidth + 28;
  const viewWidth = 1120;
  const centerX = funnelWidth / 2;
  const totalHeight = steps.length * bandHeight + (steps.length - 1) * gap;

  const maxCount = steps.reduce((max, step) => Math.max(max, step.count), 0);
  const widthFor = (count: number): number => {
    if (maxCount <= 0) return 6;
    return Math.max(6, (count / maxCount) * (funnelWidth * 0.98));
  };

  const colorFor = (step: RecruitingFunnelStep, index: number): string =>
    step.color && /^#[0-9a-f]{3,8}$/i.test(step.color)
      ? step.color
      : PIE_COLORS[index % PIE_COLORS.length];

  return (
    <svg
      viewBox={`0 0 ${viewWidth} ${totalHeight}`}
      width="100%"
      role="img"
      aria-label={translate("reports.recruiting_funnel.hiring_funnel_heading")}
      style={{ height: "auto" }}
    >
      {steps.map((step, index) => {
        const y = index * (bandHeight + gap);
        const topW = widthFor(step.count);
        const next = steps[index + 1];
        const botW = next ? widthFor(next.count) : topW * 0.8;
        const color = colorFor(step, index);

        const points = [
          `${centerX - topW / 2},${y}`,
          `${centerX + topW / 2},${y}`,
          `${centerX + botW / 2},${y + bandHeight}`,
          `${centerX - botW / 2},${y + bandHeight}`,
        ].join(" ");

        const cy = y + bandHeight / 2;

        return (
          <g key={step.stage_id}>
            <polygon points={points} fill={color} />
            {topW > 52 ? (
              <text
                x={centerX}
                y={cy}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="14"
                fontWeight="600"
                fill="#ffffff"
              >
                {step.count}
              </text>
            ) : null}

            <line
              x1={centerX + topW / 2}
              y1={cy}
              x2={labelX - 10}
              y2={cy}
              stroke="#e5e7eb"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <circle cx={labelX} cy={cy - 7} r={3.5} fill={color} />
            <text x={labelX + 12} y={cy - 4} fontSize="14" fontWeight="600" fill="#1f2937">
              <title>{step.label}</title>
              {truncate(step.label)}
            </text>
            <text x={labelX + 12} y={cy + 13} fontSize="12" fill="#64748b">
              {`${step.count} ${translate("reports.common.candidates_short")} · ${formatPercent(
                step.percentage
              )}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function RecruitingFunnelPage() {
  const { t } = useTranslation();
  const [cycleId, setCycleId] = useState<string | null>(null);

  const requestData = useMemo(
    () => (cycleId ? { stage_template_id: cycleId } : {}),
    [cycleId]
  );

  const { data, isLoading, isFetching, isError, error, refetch } =
    useRecruitingFunnelReportQuery(requestData);

  const result = data?.result;
  const cycles = result?.filters?.cycles ?? [];
  const activeCycleId =
    cycleId ?? result?.filters_applied?.stage_template_id ?? "";

  const summary: RecruitingFunnelSummary = {
    ...FALLBACK_SUMMARY,
    ...(result?.summary ?? {}),
  };
  const funnel: RecruitingFunnelStep[] = result?.funnel ?? [];
  const rejectionReasons: RecruitingFunnelRejectionItem[] =
    result?.rejection_reasons ?? [];
  const tableStages: RecruitingFunnelTableStage[] = result?.table?.stages ?? [];
  const tableRows: RecruitingFunnelTableRow[] = result?.table?.rows ?? [];
  const tableTotals = result?.table?.totals ?? { counts: {}, total: 0 };

  const pieSeries: ApexNonAxisChartSeries = rejectionReasons.map(
    (item) => item.count
  );

  const pieOptions: ApexOptions = useMemo(
    () => ({
      chart: {
        type: "pie",
        fontFamily: "Outfit, sans-serif",
        toolbar: { show: false },
      },
      labels: rejectionReasons.map(
        (item) => `${humanizeReason(item.label)} ${toPercentText(item.percentage)}%`
      ),
      colors: PIE_COLORS,
      legend: {
        show: true,
        position: "bottom",
        fontSize: "13px",
        itemMargin: { horizontal: 10, vertical: 4 },
      },
      dataLabels: { enabled: false },
      stroke: { width: 0 },
      tooltip: {
        y: {
          formatter: (value: number) => `${value} ${t("reports.common.candidates_short")}`,
        },
      },
    }),
    [rejectionReasons, t]
  );

  if (isLoading) {
    return (
      <>
        <PageMeta
          title={t("reports.recruiting_funnel.page_title")}
          description={t("reports.recruiting_funnel.page_description")}
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
          title={t("reports.recruiting_funnel.page_title")}
          description={t("reports.recruiting_funnel.page_description")}
        />
        <div className="rounded-2xl border border-error-200 bg-error-50 p-6">
          <p className="text-sm font-medium text-error-700">{getErrorMessage(error)}</p>
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

  const hasFunnel = funnel.some((step) => step.count > 0);
  const hasRejections = rejectionReasons.length > 0 && pieSeries.some((v) => v > 0);

  return (
    <>
      <PageMeta
        title={t("reports.recruiting_funnel.page_title")}
        description={t("reports.recruiting_funnel.page_description")}
      />

      <div className="space-y-4">
        <section className="rounded-2xl border border-gray-200 bg-white">
          <div className="space-y-4 px-4 py-3">
            {/* Cycle (stage template) selector */}
            <div className="w-full md:max-w-sm">
              <label className="mb-1.5 block text-xs font-medium text-gray-500">
                {t("reports.recruiting_funnel.cycle_label")}
              </label>
              <div className="relative">
                <select
                  value={activeCycleId}
                  onChange={(event) => setCycleId(event.target.value)}
                  disabled={cycles.length === 0}
                  className="h-10 w-full appearance-none rounded-xl border border-gray-200 bg-white pl-3 pr-9 text-sm font-medium text-gray-700 outline-none transition focus:border-brand-300 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                >
                  {cycles.length === 0 ? (
                    <option value="">{t("reports.recruiting_funnel.no_cycles")}</option>
                  ) : (
                    cycles.map((cycle) => (
                      <option key={cycle.value} value={cycle.value}>
                        {cycle.label}
                      </option>
                    ))
                  )}
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
              </div>
            </div>

            {/* Funnel + metric cards */}
            <section className="grid gap-4 xl:grid-cols-12">
              <article className="rounded-2xl border border-gray-200 bg-white px-4 py-4 xl:col-span-8">
                <div className="mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {t("reports.recruiting_funnel.hiring_funnel_heading")}
                  </h3>
                </div>
                {hasFunnel ? (
                  <FunnelChart steps={funnel} />
                ) : (
                  <div className="flex h-[320px] items-center justify-center text-sm text-gray-500">
                    {t("reports.recruiting_funnel.no_funnel_data")}
                  </div>
                )}
              </article>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:col-span-4 xl:grid-cols-1">
                <MetricCard
                  title={t("reports.recruiting_funnel.card_total_candidates")}
                  value={`${summary.total_candidates}`}
                />
                <MetricCard title={t("reports.recruiting_funnel.card_active")} value={`${summary.active}`} />
                <MetricCard title={t("reports.recruiting_funnel.card_hired")} value={`${summary.hired}`} />
                <MetricCard
                  title={t("reports.recruiting_funnel.card_rejected")}
                  value={`${summary.rejected}`}
                />
                <MetricCard
                  title={t("reports.recruiting_funnel.card_conversion")}
                  value={formatPercent(summary.conversion_rate)}
                />
              </div>
            </section>

            {/* Rejection reasons */}
            <section className="grid gap-4 xl:grid-cols-2">
              <article className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {t("reports.recruiting_funnel.rejection_reasons_heading")}
                </h3>
                <div className="mt-2">
                  {hasRejections ? (
                    <div className="flex justify-center">
                      <Chart options={pieOptions} series={pieSeries} type="pie" height={300} />
                    </div>
                  ) : (
                    <div className="flex h-[280px] items-center justify-center text-sm text-gray-500">
                      {t("reports.recruiting_funnel.no_rejections")}
                    </div>
                  )}
                </div>
              </article>
            </section>
          </div>
        </section>

        {/* Per-vacancy distribution */}
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3">
            <h3 className="text-lg font-semibold text-gray-900">
              {t("reports.recruiting_funnel.by_vacancy_heading")}
            </h3>
            <p className="text-xs text-gray-500">
              {t("reports.recruiting_funnel.by_vacancy_subheading")}
            </p>
          </div>

          <div className="relative overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border-b border-gray-200 px-4 py-2.5 text-left text-sm font-semibold text-gray-700">
                    {t("reports.recruiting_funnel.col_vacancy")}
                  </th>
                  {tableStages.map((stage) => (
                    <th
                      key={stage.id}
                      className="whitespace-nowrap border-b border-gray-200 px-4 py-2.5 text-right text-sm font-semibold text-gray-700"
                    >
                      {stage.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={tableStages.length + 1}
                      className="px-4 py-6 text-center text-sm text-gray-500"
                    >
                      {t("reports.recruiting_funnel.no_vacancies")}
                    </td>
                  </tr>
                ) : (
                  tableRows.map((row) => (
                    <tr key={row.vacancy_guid} className="hover:bg-gray-50">
                      <td className="border-b border-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-800">
                        {row.vacancy_title}
                      </td>
                      {tableStages.map((stage) => {
                        const value = row.counts[stage.id] ?? 0;
                        return (
                          <td
                            key={stage.id}
                            className={`border-b border-gray-100 px-4 py-2.5 text-right text-sm ${
                              value > 0 ? "text-gray-700" : "text-gray-300"
                            }`}
                          >
                            {value}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
              {tableRows.length > 0 ? (
                <tfoot>
                  <tr className="bg-gray-50">
                    <td className="border-t border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-800">
                      {t("reports.recruiting_funnel.total_row")}
                    </td>
                    {tableStages.map((stage) => (
                      <td
                        key={stage.id}
                        className="border-t border-gray-200 px-4 py-2.5 text-right text-sm font-semibold text-gray-800"
                      >
                        {tableTotals.counts[stage.id] ?? 0}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </section>

        {isFetching ? (
          <p className="text-right text-xs text-gray-400">{t("reports.common.updating")}</p>
        ) : null}
      </div>
    </>
  );
}

export default observer(RecruitingFunnelPage);
