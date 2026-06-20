import { useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { CalendarDays } from "lucide-react";
import PageMeta from "../../../components/common/PageMeta";
import Spinner from "../../../components/ui/Spinner";
import FormSelect from "../../Recruiting/components/FormSelect";
import {
  type RecruitingClosureTimesDimension,
  type RecruitingClosureTimesRow,
  type RecruitingClosureTimesSummary,
  useRecruitingClosureTimesReportQuery,
} from "../../../api/services/reports.service";

const DIMENSION_LABELS: Record<RecruitingClosureTimesDimension, string> = {
  vacancies: "Вакансии",
  positions: "Должности",
  departments: "Департаменты",
  locations: "Локации",
};

const DIMENSION_FIRST_COLUMN: Record<RecruitingClosureTimesDimension, string> = {
  vacancies: "Вакансия",
  positions: "Должность",
  departments: "Департамент",
  locations: "Локация",
};

const EMPTY_SUMMARY: RecruitingClosureTimesSummary = {
  total_vacancies: 0,
  total_candidates: 0,
  hired_count: 0,
  hired_percentage: 0,
  avg_days_to_fill: null,
};

type FilterState = {
  date_from: string;
  date_to: string;
  level: string;
};

const todayIso = (): string => new Date().toISOString().slice(0, 10);
const defaultStartIso = (): string => `${new Date().getFullYear() - 2}-01-01`;

const formatDate = (value: string | null): string => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const formatPercent = (value: number | null | undefined): string => {
  const safe = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return `${safe.toFixed(safe % 1 === 0 ? 0 : 1).replace(".", ",")} %`;
};

const formatDays = (value: number | null): string => {
  if (value == null) return "";
  return `${value} дней`;
};

const toDateValue = (value: string): Date | null => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toIsoDate = (value: Date | null): string => {
  if (!value) return "";
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return "Не удалось загрузить отчет. Попробуйте снова.";
};

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <article className="rounded-lg border border-gray-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-xl font-semibold leading-tight text-gray-900">{value}</p>
      <p className="mt-1 text-sm font-medium text-gray-500">{title}</p>
    </article>
  );
}

function TimeCell({ value }: { value: number | null }) {
  return (
    <td className="whitespace-nowrap border-b border-gray-100 px-4 py-2.5 text-right text-sm font-medium text-gray-700">
      {formatDays(value) || <span className="text-gray-300">—</span>}
    </td>
  );
}

function RecruitingClosureTimesPage() {
  const [dimension, setDimension] = useState<RecruitingClosureTimesDimension>("vacancies");
  const [draftFilters, setDraftFilters] = useState<FilterState>({
    date_from: defaultStartIso(),
    date_to: todayIso(),
    level: "",
  });
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(draftFilters);

  const requestData = useMemo(
    () => ({
      dimension,
      ...(appliedFilters.date_from ? { date_from: appliedFilters.date_from } : {}),
      ...(appliedFilters.date_to ? { date_to: appliedFilters.date_to } : {}),
      ...(appliedFilters.level ? { level: appliedFilters.level } : {}),
    }),
    [dimension, appliedFilters]
  );

  const { data, isLoading, isFetching, isError, error, refetch } =
    useRecruitingClosureTimesReportQuery(requestData);

  const result = data?.result;
  const summary: RecruitingClosureTimesSummary = {
    ...EMPTY_SUMMARY,
    ...(result?.summary ?? {}),
  };
  const rows: RecruitingClosureTimesRow[] = result?.rows ?? [];
  const levels = result?.filters?.levels ?? [];
  const dateRange = [toDateValue(draftFilters.date_from), toDateValue(draftFilters.date_to)] as [
    Date | null,
    Date | null
  ];
  const hasCustomDateRange =
    Boolean(appliedFilters.date_from || appliedFilters.date_to) &&
    (appliedFilters.date_from !== defaultStartIso() || appliedFilters.date_to !== todayIso());
  const activeFiltersCount =
    Number(hasCustomDateRange) + Number(Boolean(appliedFilters.level));

  const handleFilter = () => setAppliedFilters(draftFilters);
  const resetFilters = () => {
    const next = { date_from: "", date_to: "", level: "" };
    setDraftFilters(next);
    setAppliedFilters(next);
  };

  if (isLoading) {
    return (
      <>
        <PageMeta title="Сроки закрытия вакансий | HRMS" description="Отчет по срокам закрытия вакансий" />
        <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-gray-200 bg-white">
          <Spinner />
        </div>
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageMeta title="Сроки закрытия вакансий | HRMS" description="Отчет по срокам закрытия вакансий" />
        <div className="rounded-lg border border-error-200 bg-error-50 p-6">
          <p className="text-sm font-medium text-error-700">{getErrorMessage(error)}</p>
          <button
            type="button"
            onClick={() => {
              void refetch();
            }}
            className="mt-3 inline-flex h-10 items-center justify-center rounded-lg bg-error-600 px-4 text-sm font-semibold text-white transition hover:bg-error-700"
          >
            Повторить
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageMeta title="Сроки закрытия вакансий | HRMS" description="Отчет по срокам закрытия вакансий" />

      <div className="space-y-4">
        <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="px-4 py-3">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(DIMENSION_LABELS) as RecruitingClosureTimesDimension[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setDimension(item)}
                  className={`h-9 rounded-lg px-3 text-sm font-semibold transition ${
                    dimension === item
                      ? "border border-gray-200 bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                  }`}
                >
                  {DIMENSION_LABELS[item]}
                </button>
              ))}
            </div>
          </div>

          <div
            className="border-t border-gray-200 px-4 py-2.5"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              gap: "10px",
              flexWrap: "wrap",
              backgroundColor: "#fff",
              borderBottom: "1px solid #e2e8f0",
            }}
          >
            <span className="text-sm font-medium text-gray-600">
              {DIMENSION_LABELS[dimension]} · {rows.length} строк
            </span>
          </div>

          <div
            className="px-4 lg:px-6 py-3"
            style={{
              display: "flex",
              alignItems: "end",
              gap: "10px",
              flexWrap: "wrap",
              background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
            }}
          >
            <label className="block min-w-[300px] flex-1">
              <span className="mb-1.5 block text-xs font-semibold text-gray-600">
                Кандидат подал заявку
              </span>
              <span className="relative block">
                <CalendarDays
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-brand-600"
                />
                <DatePicker
                  selected={dateRange[0]}
                  onChange={(update) => {
                    const [start, end] = update as [Date | null, Date | null];
                    setDraftFilters((prev) => ({
                      ...prev,
                      date_from: toIsoDate(start),
                      date_to: toIsoDate(end),
                    }));
                  }}
                  startDate={dateRange[0]}
                  endDate={dateRange[1]}
                  selectsRange
                  isClearable
                  dateFormat="dd.MM.yyyy"
                  placeholderText="Выберите период"
                  className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm font-medium text-gray-700 outline-none transition focus:border-brand-300"
                />
              </span>
            </label>

            <div className="min-w-[260px] flex-1">
              <span className="mb-1.5 block text-xs font-semibold text-gray-600">Уровень</span>
              <FormSelect
                options={levels}
                value={draftFilters.level}
                onChange={(value) => setDraftFilters((prev) => ({ ...prev, level: value }))}
                placeholder="Все"
                isClearable
                menuPortal
              />
            </div>

            <button
              type="button"
              onClick={handleFilter}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white transition hover:bg-brand-600"
            >
              Применить
            </button>

            {activeFiltersCount > 0 ? (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex h-10 items-center rounded-xl border border-gray-200 bg-white px-3.5 text-sm font-medium text-gray-500 transition hover:bg-gray-50 hover:text-gray-700"
              >
                Сбросить
              </button>
            ) : null}
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Всего вакансий" value={`${summary.total_vacancies}`} />
          <MetricCard title="Всего заявок" value={`${summary.total_candidates}`} />
          <MetricCard
            title="Стадия “Нанято”"
            value={`${summary.hired_count} (${formatPercent(summary.hired_percentage)})`}
          />
          <MetricCard
            title="В среднем до заполнения"
            value={summary.avg_days_to_fill == null ? "—" : formatDays(summary.avg_days_to_fill)}
          />
        </section>

        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[1060px] w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-50">
                  <th className="border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    {DIMENSION_FIRST_COLUMN[dimension]}
                  </th>
                  <th className="whitespace-nowrap border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Дата открытия
                  </th>
                  <th className="whitespace-nowrap border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Дата закрытия
                  </th>
                  <th className="whitespace-nowrap border-b border-gray-200 px-4 py-3 text-right text-sm font-semibold text-gray-700">
                    Кандидаты
                  </th>
                  <th className="whitespace-nowrap border-b border-gray-200 px-4 py-3 text-right text-sm font-semibold text-gray-700">
                    Нанято
                  </th>
                  <th className="whitespace-nowrap border-b border-gray-200 px-4 py-3 text-right text-sm font-semibold text-gray-700">
                    Мин. время до заполнения
                  </th>
                  <th className="whitespace-nowrap border-b border-gray-200 px-4 py-3 text-right text-sm font-semibold text-gray-700">
                    Макс. время до заполнения
                  </th>
                  <th className="whitespace-nowrap border-b border-gray-200 px-4 py-3 text-right text-sm font-semibold text-gray-700">
                    Среднее время до заполнения
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
                      Нет данных для выбранных фильтров
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={`${row.id}-${row.title}`} className="hover:bg-gray-50">
                      <td className="border-b border-gray-100 px-4 py-2.5 text-sm font-semibold text-slate-700">
                        {row.title}
                      </td>
                      <td className="whitespace-nowrap border-b border-gray-100 px-4 py-2.5 text-sm font-medium text-gray-600">
                        {formatDate(row.opened_at)}
                      </td>
                      <td className="whitespace-nowrap border-b border-gray-100 px-4 py-2.5 text-sm font-medium text-gray-600">
                        {row.closed_at ? formatDate(row.closed_at) : "—"}
                      </td>
                      <td className="whitespace-nowrap border-b border-gray-100 px-4 py-2.5 text-right text-sm font-medium text-gray-700">
                        {row.candidates_count}
                      </td>
                      <td className="whitespace-nowrap border-b border-gray-100 px-4 py-2.5 text-right text-sm font-medium text-gray-700">
                        {row.hired_count} ({formatPercent(row.hired_percentage)})
                      </td>
                      <TimeCell value={row.min_days_to_fill} />
                      <TimeCell value={row.max_days_to_fill} />
                      <TimeCell value={row.avg_days_to_fill} />
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {isFetching ? (
          <p className="text-right text-xs text-gray-400">Обновление данных...</p>
        ) : null}
      </div>
    </>
  );
}

export default observer(RecruitingClosureTimesPage);
