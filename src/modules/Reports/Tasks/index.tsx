import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import { Link } from "react-router";
import { ChevronLeft, ChevronRight, RotateCcw, Search } from "lucide-react";
import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";
import type { StylesConfig } from "react-select";
import PageMeta from "../../../components/common/PageMeta";
import Spinner from "../../../components/ui/Spinner";
import EmployeeInfiniteSelect from "../../../components/autocomplete/EmployeeInfiniteSelect";
import {
  type TaskDeadlineBucketKey,
  type TasksByStatusItem,
  useTasksByEmployeeQuery,
  useTasksByStatusReportQuery,
  useTasksByStatusTableQuery,
} from "../../../api/services/reports.service";
import { translate, useTranslation } from "../../../i18n";
import type { MessageKey } from "../../../i18n/messages";

const TABLE_PAGE_LIMIT = 20;

type DetailTab = "tasks" | "employees";

/** Глобальный период отчёта — пресет плюс стрелки «назад/вперёд». */
type PeriodPreset = "week" | "month" | "year" | "all";

type DateRange = { from: string; to: string };

const PERIOD_PRESETS: { key: PeriodPreset; labelKey: MessageKey }[] = [
  { key: "week", labelKey: "reports.tasks.period_week" },
  { key: "month", labelKey: "reports.tasks.period_month" },
  { key: "year", labelKey: "reports.tasks.period_year_label" },
  { key: "all", labelKey: "reports.tasks.period_all_time" },
];

const DEFAULT_PERIOD: PeriodPreset = "year";

const pad = (value: number): string => String(value).padStart(2, "0");

const toIsoDate = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const parseIsoDate = (value: string): Date => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year || 1970, (month || 1) - 1, day || 1);
};

/**
 * Границы периода вокруг опорной даты. Неделя считается с понедельника —
 * отчёт про рабочие сроки, и воскресный старт резал бы рабочую неделю пополам.
 */
const periodRange = (preset: PeriodPreset, anchor: string): DateRange => {
  const date = parseIsoDate(anchor);

  if (preset === "week") {
    const start = new Date(date);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { from: toIsoDate(start), to: toIsoDate(end) };
  }

  if (preset === "month") {
    return {
      from: toIsoDate(new Date(date.getFullYear(), date.getMonth(), 1)),
      to: toIsoDate(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
    };
  }

  return { from: `${date.getFullYear()}-01-01`, to: `${date.getFullYear()}-12-31` };
};

/**
 * Сдвиг периода стрелками. Опорная дата всегда хранится как начало периода:
 * от 31-го числа `setMonth(+1)` перепрыгнуло бы февраль.
 */
const shiftPeriod = (preset: PeriodPreset, anchor: string, direction: 1 | -1): string => {
  const date = parseIsoDate(anchor);

  if (preset === "week") date.setDate(date.getDate() + direction * 7);
  else if (preset === "month") date.setMonth(date.getMonth() + direction);
  else date.setFullYear(date.getFullYear() + direction);

  return periodRange(preset, toIsoDate(date)).from;
};

const defaultAnchor = (): string => periodRange(DEFAULT_PERIOD, toIsoDate(new Date())).from;

/**
 * Порядок и цвета бакетов срока — общие для диаграммы, фильтра и таблицы,
 * чтобы «Просрочено» везде было одним и тем же красным.
 */
const DEADLINE_BUCKETS: {
  key: TaskDeadlineBucketKey;
  labelKey: MessageKey;
  /** Короткая подпись — для центра кольца, куда полная не помещается. */
  shortKey: MessageKey;
  color: string;
}[] = [
  {
    key: "overdue",
    labelKey: "reports.tasks.bucket_overdue",
    shortKey: "reports.tasks.bucket_overdue",
    color: "#F04438",
  },
  {
    key: "today",
    labelKey: "reports.tasks.bucket_today",
    shortKey: "reports.tasks.bucket_today",
    color: "#F79009",
  },
  {
    key: "week",
    labelKey: "reports.tasks.bucket_week",
    shortKey: "reports.tasks.bucket_week_short",
    color: "#0BA5EC",
  },
  {
    key: "later",
    labelKey: "reports.tasks.bucket_later",
    shortKey: "reports.tasks.bucket_later",
    color: "#7A5AF8",
  },
  {
    key: "no_deadline",
    labelKey: "reports.tasks.bucket_no_deadline",
    shortKey: "reports.tasks.bucket_no_deadline",
    color: "#94A3B8",
  },
  {
    key: "completed",
    labelKey: "reports.tasks.bucket_completed",
    shortKey: "reports.tasks.bucket_completed",
    color: "#12B76A",
  },
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
  return translate("reports.common.load_error");
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
const daysKey = (count: number): MessageKey => {
  const abs = Math.abs(count);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return "reports.tasks.days_one";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "reports.tasks.days_few";
  return "reports.tasks.days_many";
};

const formatDays = (count: number): string => translate(daysKey(count), { count });

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

/** Один сотрудник за раз: фильтр отвечает на вопрос «а как у него», не «у группы». */
const employeeSelectStyles: StylesConfig<{ value: string; label: string }, false> = {
  control: (base, state) => ({
    ...base,
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderColor: state.isFocused ? "#cbd5e1" : "#e5e7eb",
    boxShadow: "none",
    "&:hover": { borderColor: "#cbd5e1" },
  }),
  valueContainer: (base) => ({ ...base, padding: "2px 10px" }),
  placeholder: (base) => ({ ...base, color: "#94a3b8", fontSize: 13 }),
  input: (base) => ({ ...base, color: "#1e293b", fontSize: 13, margin: 0, padding: 0 }),
  singleValue: (base) => ({ ...base, color: "#1e293b", fontSize: 13, fontWeight: 500 }),
  indicatorSeparator: () => ({ display: "none" }),
  dropdownIndicator: (base) => ({ ...base, color: "#94a3b8", padding: 6 }),
  clearIndicator: (base) => ({ ...base, color: "#94a3b8", padding: 6 }),
  menu: (base) => ({ ...base, borderRadius: 12, overflow: "hidden", zIndex: 60 }),
  menuPortal: (base) => ({ ...base, zIndex: 100100 }),
  // Дефолтные 16px в списке смотрятся крупнее всей панели фильтров.
  option: (base) => ({ ...base, fontSize: 13, padding: "8px 12px" }),
  noOptionsMessage: (base) => ({ ...base, fontSize: 13 }),
  loadingMessage: (base) => ({ ...base, fontSize: 13 }),
};

const MONTH_KEYS: MessageKey[] = [
  "reports.common.month_january",
  "reports.common.month_february",
  "reports.common.month_march",
  "reports.common.month_april",
  "reports.common.month_may",
  "reports.common.month_june",
  "reports.common.month_july",
  "reports.common.month_august",
  "reports.common.month_september",
  "reports.common.month_october",
  "reports.common.month_november",
  "reports.common.month_december",
];

const periodCaption = (preset: PeriodPreset, range: DateRange): string => {
  if (preset === "all" || !range.from) return translate("reports.tasks.period_all_time_label");
  const date = parseIsoDate(range.from);
  if (preset === "month") {
    const monthKey = MONTH_KEYS[date.getMonth()];
    return `${monthKey ? translate(monthKey) : ""} ${date.getFullYear()}`.trim();
  }
  if (preset === "year")
    return translate("reports.tasks.period_year_caption", { year: date.getFullYear() });
  return `${formatDate(range.from)} — ${formatDate(range.to)}`;
};

interface ReportFiltersProps {
  preset: PeriodPreset;
  range: DateRange;
  employeeId: string;
  isDirty: boolean;
  onPreset: (preset: PeriodPreset) => void;
  onShift: (direction: 1 | -1) => void;
  onEmployee: (id: string) => void;
  onReset: () => void;
}

/**
 * Глобальные фильтры отчёта: они сужают весь отчёт разом — и карточки, и
 * графики, и обе таблицы, — поэтому стоят над ними, а не в шапке таблицы, где
 * живут фильтры одного только среза (статус, срок, «только с просрочкой»).
 */
function ReportFilters({
  preset,
  range,
  employeeId,
  isDirty,
  onPreset,
  onShift,
  onEmployee,
  onReset,
}: ReportFiltersProps) {
  const { t } = useTranslation();
  const canShift = preset !== "all";
  const portalTarget = typeof document !== "undefined" ? document.body : undefined;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {/* Переключатель периода — тот же, что в модуле KPI. */}
          <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
            {PERIOD_PRESETS.map((item) => {
              const isActive = preset === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onPreset(item.key)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    height: "30px",
                    padding: "0 12px",
                    border: isActive ? "1px solid var(--color-brand-100)" : "1px solid transparent",
                    borderRadius: "8px",
                    backgroundColor: isActive ? "#fff" : "transparent",
                    color: isActive ? "var(--company-color)" : "#64748b",
                    fontWeight: 600,
                    fontSize: "13px",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    boxShadow: isActive ? "0 1px 2px rgba(15, 23, 42, 0.06)" : "none",
                  }}
                >
                  {t(item.labelKey)}
                </button>
              );
            })}
          </div>

          <div className="inline-flex h-[38px] items-center rounded-xl border border-slate-200 bg-slate-50 p-[3px]">
            <button
              type="button"
              onClick={() => onShift(-1)}
              disabled={!canShift}
              aria-label={t("reports.tasks.previous_period_aria")}
              className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-transparent text-slate-600 transition hover:border-slate-200 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-transparent disabled:hover:bg-transparent"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[170px] px-3 text-center text-[13px] font-semibold text-slate-700">
              {periodCaption(preset, range)}
            </span>
            <button
              type="button"
              onClick={() => onShift(1)}
              disabled={!canShift}
              aria-label={t("reports.tasks.next_period_aria")}
              className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-transparent text-slate-600 transition hover:border-slate-200 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-transparent disabled:hover:bg-transparent"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Ширина селекта фиксирована: имена сотрудников длинные, и «резиновый»
            селект на каждом выборе переносил бы «Сбросить» на вторую строку. */}
        <div className="flex items-center gap-2">
          <div className="w-full min-w-0 sm:w-[280px]">
            <EmployeeInfiniteSelect
              value={employeeId}
              onChange={onEmployee}
              placeholder={t("reports.tasks.all_employees_placeholder")}
              styles={employeeSelectStyles}
              menuPortalTarget={portalTarget}
              classNamePrefix="tasks-report-employee"
            />
          </div>

          {isDirty ? (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-500 transition hover:bg-gray-50 hover:text-gray-700"
            >
              <RotateCcw size={14} />
              {t("reports.common.reset_button")}
            </button>
          ) : null}
        </div>
      </div>

      <p className="mt-2 text-xs text-gray-400">
        {range.from && range.to ? `${formatDate(range.from)} — ${formatDate(range.to)} · ` : ""}
        {t("reports.tasks.period_overlap_note")}
      </p>
    </section>
  );
}

function TasksReportPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<DetailTab>("tasks");
  const [tablePage, setTablePage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [bucket, setBucket] = useState<TaskDeadlineBucketKey | "">("");
  const [statusId, setStatusId] = useState("");
  const [onlyDelayed, setOnlyDelayed] = useState(false);

  const [preset, setPreset] = useState<PeriodPreset>(DEFAULT_PERIOD);
  const [anchor, setAnchor] = useState(defaultAnchor);
  const [employeeId, setEmployeeId] = useState("");

  const range = useMemo<DateRange>(
    () => (preset === "all" ? { from: "", to: "" } : periodRange(preset, anchor)),
    [preset, anchor]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setTablePage(1);
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Глобальные фильтры меняют состав данных целиком: остаться на седьмой
  // странице после смены периода означало бы увидеть пустую таблицу.
  useEffect(() => {
    setTablePage(1);
  }, [range.from, range.to, employeeId]);

  /** Общая часть запроса — период и сотрудник сужают весь отчёт сразу. */
  const globalRequestData = useMemo(
    () => ({
      ...(range.from ? { date_from: range.from } : {}),
      ...(range.to ? { date_to: range.to } : {}),
      ...(employeeId ? { employees_ids: [employeeId] } : {}),
    }),
    [range.from, range.to, employeeId]
  );

  const { data, isLoading, isFetching, isError, error, refetch } =
    useTasksByStatusReportQuery(globalRequestData);

  const tasksRequestData = useMemo(
    () => ({
      ...globalRequestData,
      ...(search ? { search } : {}),
      ...(bucket ? { deadline_bucket: bucket } : {}),
      ...(statusId ? { status_ids: [statusId] } : {}),
      // В срезе опозданий сортируем по размеру просрочки: там важно «на сколько»,
      // а не «когда дедлайн».
      ...(onlyDelayed ? { only_delayed: true, sort: "overdue" } : {}),
    }),
    [globalRequestData, search, bucket, statusId, onlyDelayed]
  );

  const employeesRequestData = useMemo(
    () => ({
      ...globalRequestData,
      ...(search ? { search } : {}),
      ...(onlyDelayed ? { only_delayed: true } : {}),
    }),
    [globalRequestData, search, onlyDelayed]
  );

  const isFiltersDirty =
    preset !== DEFAULT_PERIOD || anchor !== defaultAnchor() || Boolean(employeeId);

  const handlePreset = (next: PeriodPreset) => {
    if (next === preset) return;

    if (next !== "all") {
      // Если текущий период включает сегодня — сужаемся к сегодняшнему дню:
      // переход «2026 год → Месяц» должен давать текущий месяц, а не январь.
      // Для прошлых периодов остаёмся на их начале.
      const today = toIsoDate(new Date());
      const insideRange =
        (!range.from || range.from <= today) && (!range.to || today <= range.to);
      setAnchor(periodRange(next, insideRange ? today : range.from || today).from);
    }

    setPreset(next);
  };

  const handleShift = (direction: 1 | -1) => {
    setAnchor((prev) => shiftPeriod(preset, prev, direction));
  };

  const handleResetFilters = () => {
    setPreset(DEFAULT_PERIOD);
    setAnchor(defaultAnchor());
    setEmployeeId("");
  };

  const filtersBar = (
    <ReportFilters
      preset={preset}
      range={range}
      employeeId={employeeId}
      isDirty={isFiltersDirty}
      onPreset={handlePreset}
      onShift={handleShift}
      onEmployee={setEmployeeId}
      onReset={handleResetFilters}
    />
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

  const countSeries = [
    { name: t("reports.tasks.tasks_series"), data: byStatus.map((item) => item.count) },
  ];

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
    tooltip: {
      y: { formatter: (value: number) => t("reports.tasks.tasks_count_short", { count: value }) },
    },
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
    labels: deadlineSlices.map((item) => t(item.labelKey)),
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
              formatter: (value: string) => {
                const slice = deadlineSlices.find((item) => t(item.labelKey) === value);
                return slice ? t(slice.shortKey) : value;
              },
            },
            value: {
              fontSize: "20px",
              fontWeight: 600,
              color: "#101828",
              formatter: (value: string) =>
                t("reports.tasks.tasks_count_short", { count: Number(value) }),
            },
            total: {
              show: true,
              label: t("reports.tasks.total_tasks_label"),
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
      y: { formatter: (value: number) => t("reports.tasks.tasks_count_short", { count: value }) },
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
    t("reports.tasks.column_code"),
    t("reports.tasks.column_task"),
    t("reports.tasks.column_status"),
    t("reports.tasks.column_assignees"),
    t("reports.tasks.column_deadline"),
    t("reports.tasks.column_closed"),
    t("reports.tasks.column_overdue"),
    t("reports.tasks.column_deadline_status"),
  ];

  const employeeColumns = [
    t("reports.tasks.column_employee"),
    t("reports.tasks.column_total"),
    t("reports.tasks.column_open"),
    t("reports.tasks.bucket_overdue"),
    t("reports.tasks.column_completed"),
    t("reports.tasks.column_on_time"),
    t("reports.tasks.column_late"),
    t("reports.tasks.column_on_time_percent"),
    t("reports.tasks.column_overdue_days_total"),
    t("reports.tasks.column_average"),
    t("reports.tasks.column_maximum"),
  ];

  const detailColumns = tab === "tasks" ? taskColumns : employeeColumns;

  if (isLoading) {
    return (
      <>
        <PageMeta
          title={t("reports.tasks.page_title")}
          description={t("reports.tasks.page_description")}
        />
        <div className="space-y-4">
          {filtersBar}
          <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-gray-200 bg-white">
            <Spinner />
          </div>
        </div>
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageMeta
          title={t("reports.tasks.page_title")}
          description={t("reports.tasks.page_description")}
        />
        <div className="space-y-4">
          {filtersBar}
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
        </div>
      </>
    );
  }

  return (
    <>
      <PageMeta
        title={t("reports.tasks.page_title")}
        description={t("reports.tasks.page_description")}
      />

      <div className="space-y-4">
        {filtersBar}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title={t("reports.tasks.total_tasks_title")}
            value={String(cards.total ?? 0)}
          />
          <MetricCard
            title={t("reports.tasks.open_title")}
            value={String(cards.open ?? 0)}
            hint={t("reports.tasks.open_hint", {
              todo: cards.todo ?? 0,
              in_progress: cards.in_progress ?? 0,
            })}
          />
          <MetricCard
            title={t("reports.tasks.overdue_now_title")}
            value={String(cards.overdue ?? 0)}
            accent={(cards.overdue ?? 0) > 0 ? DANGER : undefined}
            hint={t("reports.tasks.overdue_now_hint", {
              today: cards.due_today ?? 0,
              week: cards.due_week ?? 0,
            })}
          />
          <MetricCard
            title={t("reports.tasks.completed_title")}
            value={`${cards.completed ?? 0} (${formatPercent(cards.completion_rate ?? 0)})`}
            hint={t("reports.tasks.completed_hint", {
              count: cards.completed_without_deadline ?? 0,
            })}
          />
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title={t("reports.tasks.closed_on_time_title")}
            value={String(cards.completed_on_time ?? 0)}
            accent={SUCCESS}
            hint={t("reports.tasks.closed_on_time_hint", {
              percent: formatPercent(cards.on_time_rate ?? 0),
            })}
          />
          <MetricCard
            title={t("reports.tasks.closed_late_title")}
            value={String(cards.completed_late ?? 0)}
            accent={(cards.completed_late ?? 0) > 0 ? DANGER : undefined}
            hint={t("reports.tasks.closed_late_hint", {
              days: formatDays(cards.late_days_completed ?? 0),
            })}
          />
          <MetricCard
            title={t("reports.tasks.total_overdue_title")}
            value={formatDays(cards.late_days_total ?? 0)}
            accent={(cards.late_days_total ?? 0) > 0 ? DANGER : undefined}
            hint={t("reports.tasks.total_overdue_hint", {
              closed: cards.late_days_completed ?? 0,
              open: cards.late_days_open ?? 0,
            })}
          />
          <MetricCard
            title={t("reports.tasks.overdue_per_task_title")}
            value={formatDays(cards.avg_overdue_days ?? 0)}
            hint={t("reports.tasks.overdue_per_task_hint", {
              count: cards.tasks_with_delay ?? 0,
              max: formatDays(cards.max_overdue_days ?? 0),
            })}
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <article className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {t("reports.tasks.by_status_title")}
            </h3>
            <p className="text-sm text-gray-500">{t("reports.tasks.by_status_subtitle")}</p>
            {byStatus.length === 0 ? (
              <div className="mt-2 flex h-[280px] items-center justify-center text-sm text-gray-500">
                {t("reports.common.no_chart_data")}
              </div>
            ) : (
              <div className="mt-2">
                <Chart options={countOptions} series={countSeries} type="bar" height={300} />
              </div>
            )}
          </article>

          <article className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {t("reports.tasks.by_deadline_title")}
            </h3>
            <p className="text-sm text-gray-500">{t("reports.tasks.by_deadline_subtitle")}</p>
            {deadlineSeries.length === 0 ? (
              <div className="mt-2 flex h-[280px] items-center justify-center text-sm text-gray-500">
                {t("reports.common.no_chart_data")}
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
            <h3 className="text-lg font-semibold text-gray-900">
              {t("reports.tasks.top_overdue_title")}
            </h3>
            <p className="text-sm text-gray-500">{t("reports.tasks.top_overdue_subtitle")}</p>
          </div>

          {topOverdue.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">
              {t("reports.tasks.no_overdue_tasks")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-gray-50">
                    {[
                      t("reports.tasks.column_code"),
                      t("reports.tasks.column_task"),
                      t("reports.tasks.column_status"),
                      t("reports.tasks.column_assignees"),
                      t("reports.tasks.column_deadline"),
                      t("reports.tasks.column_closed"),
                      t("reports.tasks.column_overdue"),
                    ].map(
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
                          {item.title || t("reports.tasks.no_title")}
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
                  { key: "tasks", label: t("reports.tasks.tab_tasks") },
                  { key: "employees", label: t("reports.tasks.tab_employees") },
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
                  placeholder={
                    tab === "tasks"
                      ? t("reports.tasks.search_title_or_code")
                      : t("reports.tasks.search_employee")
                  }
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
                    <option value="">{t("reports.tasks.all_statuses")}</option>
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
                    <option value="">{t("reports.tasks.all_deadlines")}</option>
                    {DEADLINE_BUCKETS.map((item) => {
                      const count = byDeadline.find((entry) => entry.key === item.key)?.count ?? 0;
                      return (
                        <option key={item.key} value={item.key}>
                          {t(item.labelKey)} ({count})
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
                {t("reports.tasks.only_delayed_label")}
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-medium text-gray-500">
              {totalCount > 0
                ? t("reports.common.showing_range", { from, to, total: totalCount })
                : t("reports.common.no_data")}
              {tab === "employees" && (employeesResult?.unassigned ?? 0) > 0
                ? ` · ${t("reports.tasks.unassigned_count", {
                    count: employeesResult?.unassigned ?? 0,
                  })}`
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
                        {t("reports.common.retry_button")}
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
                        {t("reports.tasks.no_tasks_for_filters")}
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
                              {item.title || t("reports.tasks.no_title")}
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
                                  ? t("reports.tasks.status_late")
                                  : item.completed_on_time === true
                                    ? t("reports.tasks.status_on_time")
                                    : t("reports.tasks.status_no_deadline_completed")}
                              </span>
                            ) : daysLeft == null ? (
                              <span className="text-xs text-gray-400">{t("reports.tasks.status_no_deadline")}</span>
                            ) : (
                              <span
                                className="text-xs font-medium"
                                style={{ color: bucketMeta?.color || "#475569" }}
                              >
                                {daysLeft < 0
                                  ? t("reports.tasks.overdue_by", {
                                      days: formatDays(Math.abs(daysLeft)),
                                    })
                                  : daysLeft === 0
                                    ? t("reports.tasks.status_today")
                                    : t("reports.tasks.days_left", {
                                        days: formatDays(daysLeft),
                                      })}
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
                      {t("reports.tasks.no_employees_for_filters")}
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
      </div>
    </>
  );
}

export default observer(TasksReportPage);
