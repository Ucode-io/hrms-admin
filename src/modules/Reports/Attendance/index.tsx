import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import { Link } from "react-router";
import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import PageMeta from "../../../components/common/PageMeta";
import MonthNavigator from "../../../components/common/MonthNavigator";
import Spinner from "../../../components/ui/Spinner";
import reportsService, {
  type AttendanceMonthOption,
  useAttendanceReportQuery,
  useAttendanceTableQuery,
} from "../../../api/services/reports.service";
import { translate, useTranslation } from "../../../i18n";

const TABLE_PAGE_LIMIT = 20;

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return translate("reports.common.load_error");
};

const base64ToBlob = (base64: string, mimeType?: string): Blob => {
  const binaryString = window.atob(base64);
  const length = binaryString.length;
  const bytes = new Uint8Array(length);

  for (let index = 0; index < length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType || "application/octet-stream" });
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

function MetricCard({ title, value }: { title: string; value: number }) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
    </article>
  );
}

function AttendancePage() {
  const { t } = useTranslation();
  const [tablePage, setTablePage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setTablePage(1);
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const reportRequestData = useMemo(
    () => (selectedMonth ? { month: selectedMonth } : {}),
    [selectedMonth]
  );

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useAttendanceReportQuery(reportRequestData);

  const months: AttendanceMonthOption[] = data?.result?.filters?.available_months ?? [];

  useEffect(() => {
    if (selectedMonth) return;

    const fallback = data?.result?.cards?.month || months[0]?.key || "";
    if (fallback) {
      setSelectedMonth(fallback);
    }
  }, [selectedMonth, data?.result?.cards?.month, months]);

  const tableRequestData = useMemo(
    () => ({
      ...(selectedMonth ? { month: selectedMonth } : {}),
      ...(search ? { search } : {}),
    }),
    [selectedMonth, search]
  );

  const {
    data: tableData,
    isLoading: isTableLoading,
    isFetching: isTableFetching,
    isError: isTableError,
    error: tableError,
    refetch: refetchTable,
  } = useAttendanceTableQuery({
    requestData: tableRequestData,
    page: tablePage,
    limit: TABLE_PAGE_LIMIT,
  });

  const handleExportExcel = async () => {
    if (isExporting) return;

    try {
      setIsExporting(true);

      const response = await reportsService.getAttendanceExcel(tableRequestData);
      const payload = response.result;

      if (!payload.file_base64) {
        throw new Error(t("reports.common.file_not_received"));
      }

      const blob = base64ToBlob(payload.file_base64, payload.mime_type);
      const fileName = payload.file_name || "attendance.xlsx";
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Attendance excel export error:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const cards = data?.result?.cards ?? {};

  const tableResult = tableData?.result;
  const tableItems = tableResult?.items ?? [];
  const tablePagination = tableResult?.pagination;
  const tableTotalCount = tablePagination?.total_count ?? 0;
  const tableTotalPages = Math.max(1, tablePagination?.total_pages ?? 1);
  const tableCurrentPage = tablePage;
  const tableFrom = tablePagination?.from ?? 0;
  const tableTo = tablePagination?.to ?? 0;
  const visiblePages = getVisiblePages(tableCurrentPage, tableTotalPages);

  const tableColumns = [
    t("reports.attendance.col_employee"),
    t("reports.attendance.col_working_days"),
    t("reports.attendance.col_worked"),
    t("reports.attendance.col_absent_days"),
    t("reports.attendance.col_paid"),
    t("reports.attendance.col_unpaid"),
  ];

  if (isLoading) {
    return (
      <>
        <PageMeta
          title={t("reports.attendance.page_title")}
          description={t("reports.attendance.page_description")}
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
          title={t("reports.attendance.page_title")}
          description={t("reports.attendance.page_description")}
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

  return (
    <>
      <PageMeta
        title={t("reports.attendance.page_title")}
        description={t("reports.attendance.page_description")}
      />

      <div className="space-y-4">
        <section className="rounded-2xl border border-gray-200 bg-white">
          <div className="space-y-4 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <MonthNavigator
                value={selectedMonth}
                onChange={(monthKey) => {
                  setSelectedMonth(monthKey);
                  setTablePage(1);
                }}
              />

              <button
                type="button"
                onClick={() => {
                  void handleExportExcel();
                }}
                disabled={isExporting || isTableLoading || isTableFetching}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-brand-500 bg-brand-500 px-4 text-sm font-medium text-white transition hover:border-brand-600 hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download size={16} />
                {isExporting ? t("reports.common.exporting") : t("reports.common.export_to_excel")}
              </button>
            </div>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              <MetricCard
                title={t("reports.attendance.card_employees")}
                value={Number(cards.employees_count || 0)}
              />
              <MetricCard
                title={t("reports.attendance.card_scheduled_working_days")}
                value={Number(cards.scheduled_working_days || 0)}
              />
              <MetricCard
                title={t("reports.attendance.card_worked_days")}
                value={Number(cards.worked_days || 0)}
              />
              <MetricCard
                title={t("reports.attendance.card_total_absent_days")}
                value={Number(cards.total_absent_days || 0)}
              />
              <MetricCard
                title={t("reports.attendance.card_paid")}
                value={Number(cards.paid_absence_days || 0)}
              />
              <MetricCard
                title={t("reports.attendance.card_unpaid")}
                value={Number(cards.unpaid_absence_days || 0) + Number(cards.unexcused_absent_days || 0)}
              />
            </section>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 md:flex-row md:items-center md:justify-between">
            <label className="relative w-full md:max-w-sm">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={t("reports.common.search_placeholder")}
                className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-700 outline-none transition focus:border-brand-300"
              />
            </label>
          </div>

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
                  {tableColumns.map((column) => (
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
                      {tableColumns.map((__, cellIndex) => (
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
                    <td colSpan={tableColumns.length} className="px-4 py-6 text-center text-sm text-error-600">
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
                    <td colSpan={tableColumns.length} className="px-4 py-6 text-center text-sm text-gray-500">
                      {t("reports.common.no_employees_filtered")}
                    </td>
                  </tr>
                ) : (
                  tableItems.map((item) => {
                    const unpaidTotal =
                      Number(item.unpaid_absence_days) + Number(item.unexcused_absent_days);
                    return (
                      <tr key={item.guid} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap border-b border-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-800">
                          <span className="inline-flex items-center gap-2">
                            <Link to={`/employees/${item.guid}`} className="transition hover:text-brand-500">
                              {item.employee}
                            </Link>
                            {item.is_remote ? (
                              <span className="inline-flex items-center rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-600">
                                {t("reports.attendance.remote_badge")}
                              </span>
                            ) : null}
                          </span>
                        </td>
                        <td className="border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">
                          {item.scheduled_working_days}
                        </td>
                        <td className="border-b border-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-800">
                          {item.worked_days}
                        </td>
                        <td className="border-b border-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-800">{item.total_absent_days}</td>
                        <td className="border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">{item.paid_absence_days}</td>
                        <td className="border-b border-gray-100 px-4 py-2.5 text-sm text-gray-700">{unpaidTotal}</td>
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

export default observer(AttendancePage);
