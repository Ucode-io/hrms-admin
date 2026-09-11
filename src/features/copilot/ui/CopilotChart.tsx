import { useMemo } from "react";
import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import { observer } from "mobx-react-lite";
import companyStore from "../../../store/company.store";
import type {
  CopilotChart as CopilotChartModel,
  CopilotChartFormat,
} from "../types";

/**
 * The brand's blue family, in the same muted register the HRMS reports use for
 * categorical charts (see Reports/GenderDistribution). The first colour is the
 * company's own brand, which is what the reports paint their bars with — a
 * copilot chart should look like part of the product, not like a widget that
 * arrived from somewhere else.
 *
 * Every entry is deliberately dark enough to carry white text: the product's
 * global chart CSS forces one label colour on all slices, so the palette has to
 * be uniform in weight rather than running from navy to pale.
 */
const categoricalPalette = (brand: string): string[] => [
  brand,
  "#3E5FBF",
  "#4A7BA7",
  "#5B5FC7",
  "#5E86A8",
  "#6B6FA8",
];

/** Kept out of the memo so the card can size itself to the same decision. */
const isHorizontal = (chart: CopilotChartModel): boolean =>
  chart.kind === "bar" &&
  (chart.data.length > 8 ||
    chart.data.some(
      (row) => String(row[chart.xKey ?? "label"] ?? "").length > 12,
    ));

const AXIS_COLOR = "#64748b";
const GRID_COLOR = "#EAECF0";

const formatValue = (value: number, format?: CopilotChartFormat): string => {
  if (format === "percent") return `${value}%`;
  if (format === "duration") {
    // Durations arrive in minutes; hours are what a person actually reads.
    const hours = Math.floor(value / 60);
    const minutes = Math.round(value % 60);
    return hours > 0 ? `${hours} ч ${minutes} мин` : `${minutes} мин`;
  }
  return value.toLocaleString("ru-RU");
};

/**
 * Renders a chart the service built from a query result.
 *
 * Nothing here reshapes or recomputes anything — the numbers arrive plotted and
 * are drawn as given, which is what keeps a charted figure identical to the one
 * on the matching Reports page.
 */
const CopilotChartView: React.FC<{ chart: CopilotChartModel }> = observer(
  ({ chart }) => {
    const brand = companyStore.mainColor;
    const isCircular = chart.kind === "pie" || chart.kind === "donut";

    const { series, options } = useMemo(() => {
      const palette = categoricalPalette(brand);

      const base: ApexOptions = {
        chart: {
          type: chart.kind,
          fontFamily: "Outfit, sans-serif",
          toolbar: { show: false },
          animations: { enabled: false },
        },
        colors: palette,
        legend: {
          position: "bottom",
          horizontalAlign: "center",
          fontFamily: "Outfit, sans-serif",
          fontSize: "12px",
          markers: { size: 5, strokeWidth: 0 },
          itemMargin: { horizontal: 8, vertical: 2 },
          labels: { colors: AXIS_COLOR },
        },
        dataLabels: { enabled: false },
        tooltip: {
          theme: "light",
          style: { fontFamily: "Outfit, sans-serif", fontSize: "12px" },
        },
        states: {
          hover: { filter: { type: "lighten" } },
          active: { filter: { type: "none" } },
        },
      };

      if (isCircular) {
        const values = chart.data.map((row) => Number(row.value ?? 0));
        const total = values.reduce((sum, v) => sum + v, 0);

        return {
          series: values,
          options: {
            ...base,
            labels: chart.data.map((row) => String(row.name ?? "—")),
            // A hairline of card background between slices; without it the
            // muted palette's neighbours bleed into one another.
            stroke: { width: 2, colors: ["#fff"] },
            grid: { padding: { top: 0, bottom: 0, left: 8, right: 8 } },
            // A ring without its percentages is just a coloured circle: reading
            // the shares off it directly is the entire reason to draw one.
            dataLabels: {
              enabled: true,
              formatter: (percent: number) => `${Math.round(Number(percent))}%`,
              // The colour comes from copilot.css: the product's global
              // `.apexcharts-text` rule is !important and would override
              // anything set here.
              style: { fontSize: "12px", fontWeight: 600 },
              dropShadow: { enabled: false },
            },
            plotOptions: {
              pie: {
                expandOnClick: false,
                donut: {
                  // A thinner ring leaves no room for the percentages, which
                  // then get pushed onto its edge and clipped by the card.
                  size: chart.kind === "donut" ? "62%" : "0%",
                  labels: {
                    show: chart.kind === "donut",
                    // The name slot carries the centre caption: "Всего" when
                    // nothing is hovered, the slice's name when one is.
                    name: {
                      show: true,
                      fontSize: "12px",
                      fontWeight: 500,
                      color: AXIS_COLOR,
                      offsetY: 18,
                    },
                    value: {
                      show: true,
                      fontSize: "24px",
                      fontWeight: 700,
                      color: "#101828",
                      offsetY: -14,
                      formatter: (v: string) => formatValue(Number(v)),
                    },
                    // The centre answers "how many altogether" without needing a
                    // second chart or a sentence.
                    total: {
                      show: true,
                      showAlways: true,
                      label: "Всего",
                      fontSize: "12px",
                      color: AXIS_COLOR,
                      formatter: () => formatValue(total),
                    },
                  },
                },
              },
            },
            tooltip: {
              ...base.tooltip,
              y: { formatter: (v: number) => formatValue(v) },
            },
          } as ApexOptions,
        };
      }

      const xKey = chart.xKey ?? "label";
      const seriesDefs = chart.series ?? [{ key: "value", label: "Значение" }];
      const singleSeries = seriesDefs.length === 1;
      const categories = chart.data.map((row) => String(row[xKey] ?? "—"));
      // Names are the common category here, and a rotated "Юсупова Мад…" is not
      // a label — it is a shape. Lay the bars down when the words are long, not
      // only when there are many of them.
      const longLabels = categories.some((c) => c.length > 12);
      const horizontal =
        chart.kind === "bar" && (chart.data.length > 8 || longLabels);

      return {
        series: seriesDefs.map((s) => ({
          name: s.label ?? s.key,
          data: chart.data.map((row) => Number(row[s.key] ?? 0)),
        })),
        options: {
          ...base,
          // One series needs no legend — the title already says what it is.
          legend: { ...base.legend, show: !singleSeries },
          // Laying the bars down swaps the axes: ApexCharts keeps the
          // categories in `xaxis.categories` but draws them along the y-axis,
          // and the numbers move to the x-axis. So the value formatter has to
          // move with them — left on the y-axis it formats the category itself,
          // which is how a chart of people ends up labelled "NaN мин".
          xaxis: {
            categories,
            labels: {
              style: { fontSize: "11px", colors: AXIS_COLOR },
              rotate: horizontal ? 0 : -30,
              rotateAlways: false,
              trim: true,
              hideOverlappingLabels: true,
              ...(horizontal
                ? { formatter: (v: string) => formatValue(Number(v), seriesDefs[0]?.format) }
                : {}),
            },
            axisBorder: { show: false },
            axisTicks: { show: false },
            tooltip: { enabled: false },
          },
          yaxis: {
            labels: {
              style: { fontSize: "11px", colors: AXIS_COLOR },
              ...(horizontal
                ? {}
                : { formatter: (v: number) => formatValue(v, seriesDefs[0]?.format) }),
            },
          },
          tooltip: {
            ...base.tooltip,
            y: { formatter: (v: number) => formatValue(v, seriesDefs[0]?.format) },
          },
          // Bars want a transparent stroke to sit apart from each other; lines
          // and areas want an actual curve. Note `fill` is spread in only when
          // it applies: writing `fill: undefined` creates the key with an
          // undefined value, and ApexCharts then dereferences config.fill.type
          // and gives up mid-draw — the chart renders its legend and nothing else.
          stroke:
            chart.kind === "bar"
              ? { show: true, width: 3, colors: ["transparent"] }
              : { curve: "smooth", width: 2 },
          ...(chart.kind === "area"
            ? {
                fill: {
                  type: "gradient",
                  gradient: {
                    opacityFrom: 0.35,
                    opacityTo: 0,
                    shadeIntensity: 1,
                  },
                },
              }
            : {}),
          plotOptions: {
            bar: {
              borderRadius: 6,
              borderRadiusApplication: "end",
              columnWidth: chart.data.length > 6 ? "70%" : "45%",
              // Many categories read far better lying down: the names get room
              // instead of being rotated into illegibility.
              horizontal,
            },
          },
          grid: {
            borderColor: GRID_COLOR,
            strokeDashArray: 4,
            padding: { left: 4, right: 8, top: 0 },
            xaxis: { lines: { show: false } },
          },
        } as ApexOptions,
      };
    }, [chart, isCircular, brand]);

    if (chart.data.length === 0) return null;

    // Horizontal bars need room per category, or they squash together.
    const height = isHorizontal(chart)
      ? Math.min(420, 90 + chart.data.length * 30)
      : 260;

    return (
      <div className="copilot-chart rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="mb-1">
          <p className="text-sm font-medium text-gray-800 dark:text-white/90">
            {chart.title}
          </p>
          {chart.subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {chart.subtitle}
            </p>
          )}
        </div>
        <Chart
          options={options}
          series={series as never}
          type={chart.kind}
          height={height}
        />
      </div>
    );
  },
);

export default CopilotChartView;
