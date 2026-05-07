import { useEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { Link } from "react-router";
import { ArrowLeft, Download, MoreHorizontal, Search, SlidersHorizontal } from "lucide-react";
import Select from "react-select";
import PageMeta from "../../../components/common/PageMeta";
import Spinner from "../../../components/ui/Spinner";
import reportsService, {
  useBonusDeductionsReportQuery,
  useBonusDeductionsTableQuery,
} from "../../../api/services/reports.service";

const getErrorMessage = (error) => {
  if (error instanceof Error) return error.message;
  return "Не удалось загрузить отчет. Попробуйте снова.";
};

const toOptions = (items) => {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    value: String(item.value),
    label: String(item.label),
  }));
};

const collectSelectedOptions = (all, selectedValues) => {
  const set = new Set(selectedValues);
  return all.filter((item) => set.has(item.value));
};

const selectStyles = {
  control: (base) => ({
    ...base,
    minHeight: 38,
    borderRadius: 8,
    borderColor: "#e5e7eb",
    boxShadow: "none",
    "&:hover": {
      borderColor: "#cbd5e1",
    },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: "1px 8px",
  }),
  input: (base) => ({
    ...base,
    margin: 0,
    padding: 0,
  }),
  indicatorsContainer: (base) => ({
    ...base,
    paddingRight: 4,
    gap: 0,
  }),
  clearIndicator: (base) => ({
    ...base,
    color: "#94a3b8",
    padding: 6,
    "&:hover": {
      color: "#64748b",
    },
  }),
  dropdownIndicator: (base) => ({
    ...base,
    color: "#94a3b8",
    padding: 6,
    "&:hover": {
      color: "#64748b",
    },
  }),
  indicatorSeparator: (base) => ({
    ...base,
    marginTop: 6,
    marginBottom: 6,
  }),
  placeholder: (base) => ({
    ...base,
    color: "#94a3b8",
    fontSize: 13,
  }),
  singleValue: (base) => ({
    ...base,
    fontSize: 14,
  }),
  multiValue: (base) => ({
    ...base,
    backgroundColor: "#eef2ff",
    borderRadius: 6,
    border: "1px solid #dbeafe",
    paddingLeft: 1,
    minHeight: 24,
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: "#1e3a8a",
    fontWeight: 600,
    fontSize: 12,
    paddingRight: 2,
    paddingTop: 1,
    paddingBottom: 1,
  }),
  multiValueRemove: (base) => ({
    ...base,
    color: "#1d4ed8",
    borderRadius: 6,
    "&:hover": {
      backgroundColor: "#dbeafe",
      color: "#1e40af",
    },
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected ? "#dbeafe" : state.isFocused ? "#f8fafc" : "#fff",
    color: "#1e293b",
    fontSize: 14,
    lineHeight: "20px",
    padding: "8px 12px",
  }),
  menuList: (base) => ({
    ...base,
    paddingTop: 4,
    paddingBottom: 4,
  }),
  menu: (base) => ({
    ...base,
    zIndex: 9999,
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 9999,
  }),
};

const EMPTY_TOTALS = {
  base_salary: null,
  accruals: {},
  deductions: {},
  total_accrued: null,
  total_deducted: null,
  net_payable: null,
};

const formatCompactMoney = (value) => {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);

  if (abs >= 1_000_000) {
    const scaled = abs / 1_000_000;
    const text = Number.isInteger(scaled) ? String(scaled) : scaled.toFixed(1).replace(".0", "");
    return `${sign}${text}M`;
  }

  if (abs >= 1_000) {
    const scaled = abs / 1_000;
    const text = Number.isInteger(scaled) ? String(scaled) : scaled.toFixed(1).replace(".0", "");
    return `${sign}${text}k`;
  }

  return `${sign}${Math.round(abs)}`;
};

const renderMoneyValue = (value) => {
  if (value == null) {
    return "-";
  }

  return formatCompactMoney(value);
};

const renderNegativeMoneyValue = (value) => {
  if (value == null) {
    return "-";
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return "-";
  }

  const absoluteValue = Math.abs(numericValue);
  if (absoluteValue === 0) {
    return "0";
  }

  return `-${formatCompactMoney(absoluteValue)}`;
};

const getEmployeeFullName = (firstName, secondName) => {
  const fullName = [firstName, secondName].filter((value) => typeof value === "string" && value.trim()).join(" ");
  return fullName || "—";
};

const base64ToBlob = (base64, mimeType) => {
  const binaryString = window.atob(base64);
  const length = binaryString.length;
  const bytes = new Uint8Array(length);

  for (let index = 0; index < length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType || "application/octet-stream" });
};

function BonusDeductionsPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState([]);
  const advancedFiltersRef = useRef(null);
  const selectPortalTarget = typeof document !== "undefined" ? document.body : null;

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!advancedFiltersRef.current) {
        return;
      }
      if (!advancedFiltersRef.current.contains(event.target)) {
        setIsAdvancedFiltersOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const {
    data: reportData,
    isLoading: isReportLoading,
    isError: isReportError,
    error: reportError,
    refetch: refetchReport,
  } = useBonusDeductionsReportQuery();

  const filters = reportData?.result?.filters;
  const yearOptions = useMemo(() => toOptions(filters?.years), [filters?.years]);
  const monthOptions = useMemo(() => toOptions(filters?.months), [filters?.months]);
  const employeeOptions = useMemo(() => toOptions(filters?.employees), [filters?.employees]);
  const departmentOptions = useMemo(() => toOptions(filters?.departments), [filters?.departments]);

  const defaultYear = filters?.defaults?.year != null ? String(filters.defaults.year) : "";
  const defaultMonth = filters?.defaults?.month != null ? String(filters.defaults.month) : "";

  useEffect(() => {
    if (!selectedYear && defaultYear) {
      setSelectedYear(defaultYear);
    }
    if (!selectedMonth && defaultMonth) {
      setSelectedMonth(defaultMonth);
    }
  }, [defaultMonth, defaultYear, selectedMonth, selectedYear]);

  const tableRequestData = useMemo(
    () => ({
      ...(selectedYear ? { year: Number(selectedYear) } : {}),
      ...(selectedMonth ? { month: Number(selectedMonth) } : {}),
      ...(selectedEmployeeIds.length > 0 ? { employee_ids: selectedEmployeeIds } : {}),
      ...(selectedDepartmentIds.length > 0 ? { department_ids: selectedDepartmentIds } : {}),
      ...(search ? { search } : {}),
    }),
    [search, selectedDepartmentIds, selectedEmployeeIds, selectedMonth, selectedYear]
  );

  const {
    data: tableData,
    isLoading: isTableLoading,
    isFetching: isTableFetching,
    isError: isTableError,
    error: tableError,
    refetch: refetchTable,
  } = useBonusDeductionsTableQuery({
    requestData: tableRequestData,
  });

  const accrualTypes = tableData?.result?.accrual_types ?? [];
  const deductionTypes = tableData?.result?.deduction_types ?? [];
  const items = tableData?.result?.items ?? [];
  const totals = tableData?.result?.totals ?? EMPTY_TOTALS;
  const activeAdvancedFilterCount = selectedEmployeeIds.length + selectedDepartmentIds.length;
  const hasActiveFilters =
    (defaultYear ? selectedYear !== defaultYear : Boolean(selectedYear)) ||
    (defaultMonth ? selectedMonth !== defaultMonth : Boolean(selectedMonth)) ||
    selectedEmployeeIds.length > 0 ||
    selectedDepartmentIds.length > 0 ||
    searchInput.trim().length > 0;

  const resetFilters = () => {
    setSelectedYear(defaultYear || "");
    setSelectedMonth(defaultMonth || "");
    setSelectedEmployeeIds([]);
    setSelectedDepartmentIds([]);
    setSearch("");
    setSearchInput("");
    setIsAdvancedFiltersOpen(false);
  };

  const handleExportExcel = async () => {
    if (isExporting) return;

    try {
      setIsExporting(true);

      const response = await reportsService.getBonusDeductionsExcel(tableRequestData);
      const payload = response.result;

      if (!payload.file_base64) {
        throw new Error("Файл не получен.");
      }

      const blob = base64ToBlob(payload.file_base64, payload.mime_type);
      const fileName = payload.file_name || "bonus-deductions.xlsx";
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Bonus deductions excel export error:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const accrualColumnCount = Math.max(1, accrualTypes.length);
  const deductionColumnCount = Math.max(1, deductionTypes.length);
  const metricsColumnCount = accrualColumnCount + deductionColumnCount + 3;
  const totalColumns = 3 + metricsColumnCount;

  if (isReportLoading) {
    return (
      <>
        <PageMeta title="Ведомость бонусов и удержаний | HRMS" description="Отчет по начислениям и удержаниям" />
        <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-gray-200 bg-white">
          <Spinner />
        </div>
      </>
    );
  }

  if (isReportError) {
    return (
      <>
        <PageMeta title="Ведомость бонусов и удержаний | HRMS" description="Отчет по начислениям и удержаниям" />
        <div className="rounded-2xl border border-error-200 bg-error-50 p-6">
          <p className="text-sm font-medium text-error-700">{getErrorMessage(reportError)}</p>
          <button
            type="button"
            onClick={() => {
              void refetchReport();
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
      <PageMeta title="Ведомость бонусов и удержаний | HRMS" description="Отчет по начислениям и удержаниям" />

      <div className="-mx-4 -mt-4 -mb-4 flex h-[calc(100dvh-64px)] min-h-0 flex-col md:-mx-6 md:-mt-6 md:-mb-6 md:h-[calc(100dvh-64px)]">
        <section className="flex h-full min-h-0 flex-col bg-white">
          <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-3 py-2 md:px-4 md:py-2.5">
            <div className="space-y-0.5">
              <Link
                to="/reports"
                className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 transition hover:text-gray-700"
              >
                <ArrowLeft size={14} />
                Назад
              </Link>
              <h1 className="text-xl font-semibold leading-tight text-gray-900">
                Ведомость бонусов и удержаний
              </h1>
              {/* <p className="text-[11px] leading-tight text-gray-500">
                Начисления и удержания сотрудников по типам за{" "}
                {period?.label || "выбранный месяц"}
              </p> */}
            </div>

            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50"
            >
              <MoreHorizontal size={16} />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="border-b border-gray-100 px-3 py-1.5 md:px-4 md:py-2">
              <div className="flex flex-wrap items-end gap-2">
                <label className="relative min-w-[220px] flex-1">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Поиск..."
                    className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-700 outline-none transition focus:border-brand-300"
                  />
                </label>

                <div className="min-w-[120px]">
                  <p className="sr-only">Год</p>
                  <Select
                    options={yearOptions}
                    value={yearOptions.find((item) => item.value === selectedYear) || null}
                    onChange={(value) => {
                      const nextValue =
                        value && typeof value === "object" && "value" in value
                          ? String(value.value)
                          : "";
                      setSelectedYear(nextValue);
                    }}
                    isClearable={false}
                    menuPosition="fixed"
                    menuPortalTarget={selectPortalTarget}
                    styles={selectStyles}
                  />
                </div>

                <div className="min-w-[120px]">
                  <p className="sr-only">Месяц</p>
                  <Select
                    options={monthOptions}
                    value={monthOptions.find((item) => item.value === selectedMonth) || null}
                    onChange={(value) => {
                      const nextValue =
                        value && typeof value === "object" && "value" in value
                          ? String(value.value)
                          : "";
                      setSelectedMonth(nextValue);
                    }}
                    isClearable={false}
                    menuPosition="fixed"
                    menuPortalTarget={selectPortalTarget}
                    styles={selectStyles}
                  />
                </div>

                <div className="relative min-w-[150px]" ref={advancedFiltersRef}>
                  <button
                    type="button"
                    onClick={() => setIsAdvancedFiltersOpen((prev) => !prev)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    <SlidersHorizontal size={16} />
                    <span>Фильтры</span>
                    {activeAdvancedFilterCount > 0 ? (
                      <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand-50 px-1.5 text-xs font-semibold text-brand-600">
                        {activeAdvancedFilterCount}
                      </span>
                    ) : null}
                  </button>

                  {isAdvancedFiltersOpen ? (
                    <div className="absolute right-0 top-12 z-[60] w-[340px] rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-gray-600">Сотрудник</p>
                          <Select
                            isMulti
                            options={employeeOptions}
                            value={collectSelectedOptions(employeeOptions, selectedEmployeeIds)}
                            onChange={(value) => {
                              const values = Array.isArray(value) ? value : [];
                              setSelectedEmployeeIds(values.map((item) => String(item.value)));
                            }}
                            placeholder={`${employeeOptions.length} вариантов`}
                            closeMenuOnSelect={false}
                            menuPosition="fixed"
                            menuPortalTarget={selectPortalTarget}
                            styles={selectStyles}
                          />
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs font-medium text-gray-600">Департамент</p>
                          <Select
                            isMulti
                            options={departmentOptions}
                            value={collectSelectedOptions(departmentOptions, selectedDepartmentIds)}
                            onChange={(value) => {
                              const values = Array.isArray(value) ? value : [];
                              setSelectedDepartmentIds(values.map((item) => String(item.value)));
                            }}
                            placeholder={`${departmentOptions.length} вариантов`}
                            closeMenuOnSelect={false}
                            menuPosition="fixed"
                            menuPortalTarget={selectPortalTarget}
                            styles={selectStyles}
                          />
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    Сбросить фильтры
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => {
                    void handleExportExcel();
                  }}
                  disabled={isExporting || isTableLoading || isTableFetching}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download size={15} />
                  {isExporting ? "Экспорт..." : "Экспорт в excel"}
                </button>
              </div>
            </div>

            <div className="relative min-h-0 flex-1 overflow-auto" style={{ scrollbarGutter: "stable" }}>
              <table className="min-w-max border-separate border-spacing-0">
                <thead>
                  <tr className="h-10 bg-[#f8fbff]">
                    <th
                      rowSpan={2}
                      className="sticky left-0 top-0 z-40 w-[240px] min-w-[240px] max-w-[240px] whitespace-nowrap border-b border-r border-gray-200 bg-[#f8fbff] px-3 py-2 text-left text-xs font-semibold text-gray-700"
                    >
                      Имя и фамилия
                    </th>
                    <th
                      rowSpan={2}
                      className="sticky left-[240px] top-0 z-40 w-[130px] min-w-[130px] max-w-[130px] whitespace-nowrap border-b border-r border-gray-200 bg-[#f8fbff] px-2 py-2 text-left text-xs font-semibold text-gray-700"
                    >
                      Департамент
                    </th>
                    <th
                      rowSpan={2}
                      className="sticky left-[370px] top-0 z-40 w-[110px] min-w-[110px] max-w-[110px] whitespace-nowrap border-b border-r border-gray-200 bg-[#f8fbff] px-2 py-2 text-center text-xs font-semibold text-gray-700"
                    >
                      Оклад
                    </th>

                    <th
                      colSpan={accrualColumnCount}
                      className="sticky top-0 z-30 border-b border-r border-gray-200 bg-[#f8fbff] px-3 py-2 text-center text-xs font-semibold text-gray-700"
                    >
                      Начисления
                    </th>
                    <th
                      colSpan={deductionColumnCount}
                      className="sticky top-0 z-30 border-b border-r border-gray-200 bg-[#f8fbff] px-3 py-2 text-center text-xs font-semibold text-gray-700"
                    >
                      Удержания
                    </th>

                    <th
                      rowSpan={2}
                      className="sticky top-0 z-30 border-b border-r border-gray-200 bg-[#f8fbff] px-3 py-2 text-center text-xs font-semibold text-emerald-700"
                    >
                      Итого начислено
                    </th>
                    <th
                      rowSpan={2}
                      className="sticky top-0 z-30 border-b border-r border-gray-200 bg-[#f8fbff] px-3 py-2 text-center text-xs font-semibold text-rose-700"
                    >
                      Итого удержано
                    </th>
                    <th
                      rowSpan={2}
                      className="sticky top-0 z-30 border-b border-r border-gray-200 bg-[#f8fbff] px-3 py-2 text-center text-xs font-semibold text-gray-700"
                    >
                      К выплате
                    </th>
                  </tr>

                  <tr className="h-10 bg-[#f8fbff]">
                    {accrualTypes.length > 0 ? (
                      accrualTypes.map((type) => (
                        <th
                          key={`accrual-${type.key}`}
                          className="sticky top-10 z-30 border-b border-r border-gray-200 bg-[#f8fbff] px-3 py-2 text-center text-xs font-semibold text-gray-700"
                        >
                          {type.label}
                        </th>
                      ))
                    ) : (
                      <th className="sticky top-10 z-30 border-b border-r border-gray-200 bg-[#f8fbff] px-3 py-2 text-center text-xs font-semibold text-gray-400">
                        —
                      </th>
                    )}

                    {deductionTypes.length > 0 ? (
                      deductionTypes.map((type) => (
                        <th
                          key={`deduction-${type.key}`}
                          className="sticky top-10 z-30 border-b border-r border-gray-200 bg-[#f8fbff] px-3 py-2 text-center text-xs font-semibold text-gray-700"
                        >
                          {type.label}
                        </th>
                      ))
                    ) : (
                      <th className="sticky top-10 z-30 border-b border-r border-gray-200 bg-[#f8fbff] px-3 py-2 text-center text-xs font-semibold text-gray-400">
                        —
                      </th>
                    )}
                  </tr>
                </thead>

                <tbody className="bg-white">
                  {isTableLoading ? (
                    Array.from({ length: 8 }).map((_, rowIndex) => (
                      <tr key={`bonus-deductions-skeleton-${rowIndex}`} className="animate-pulse">
                        <td className="sticky left-0 z-10 w-[240px] min-w-[240px] max-w-[240px] border-b border-r border-gray-100 bg-white px-3 py-2">
                          <div className="h-4 w-20 rounded bg-gray-200" />
                        </td>
                        <td className="sticky left-[240px] z-10 w-[130px] min-w-[130px] max-w-[130px] border-b border-r border-gray-100 bg-white px-2 py-2">
                          <div className="h-4 w-24 rounded bg-gray-200" />
                        </td>
                        <td className="sticky left-[370px] z-10 w-[110px] min-w-[110px] max-w-[110px] border-b border-r border-gray-100 bg-white px-2 py-2">
                          <div className="h-4 w-20 rounded bg-gray-200" />
                        </td>

                        {Array.from({ length: metricsColumnCount }).map((__, metricIndex) => (
                          <td
                            key={`bonus-deductions-skeleton-${rowIndex}-${metricIndex}`}
                            className={`border-b border-r border-gray-100 px-3 py-2 ${metricIndex >= metricsColumnCount - 3 ? "bg-[#f8fbff]" : ""
                              }`}
                          >
                            <div className="h-4 w-14 rounded bg-gray-200" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : isTableError ? (
                    <tr>
                      <td colSpan={totalColumns} className="px-4 py-6 text-center text-sm text-error-600">
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
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={totalColumns} className="px-4 py-6 text-center text-sm text-gray-500">
                        Нет данных по выбранным фильтрам
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.guid} className="hover:bg-gray-50">
                        <td className="sticky left-0 z-10 w-[240px] min-w-[240px] max-w-[240px] whitespace-nowrap border-b border-r border-gray-100 bg-white px-3 py-2 text-sm font-semibold text-gray-800">
                          <Link to={`/employees/${item.guid}`} className="transition hover:text-brand-500">
                            {getEmployeeFullName(item.first_name, item.second_name)}
                          </Link>
                        </td>
                        <td className="sticky left-[240px] z-10 w-[130px] min-w-[130px] max-w-[130px] whitespace-nowrap border-b border-r border-gray-100 bg-white px-2 py-2 text-sm text-gray-700">
                          {item.department}
                        </td>
                        <td className="sticky left-[370px] z-10 w-[110px] min-w-[110px] max-w-[110px] whitespace-nowrap border-b border-r border-gray-100 bg-white px-2 py-2 text-center text-sm text-gray-700">
                          {renderMoneyValue(item.base_salary)}
                        </td>

                        {accrualTypes.length > 0 ? (
                          accrualTypes.map((type) => (
                            <td
                              key={`${item.guid}-accrual-${type.key}`}
                              className="border-b border-r border-gray-100 px-3 py-2 text-center text-sm text-gray-700"
                            >
                              {renderMoneyValue(item.accruals?.[type.key])}
                            </td>
                          ))
                        ) : (
                          <td className="border-b border-r border-gray-100 px-3 py-2 text-center text-sm text-gray-400">
                            —
                          </td>
                        )}

                        {deductionTypes.length > 0 ? (
                          deductionTypes.map((type) => (
                            <td
                              key={`${item.guid}-deduction-${type.key}`}
                              className="border-b border-r border-gray-100 px-3 py-2 text-center text-sm text-gray-700"
                            >
                              {renderNegativeMoneyValue(item.deductions?.[type.key])}
                            </td>
                          ))
                        ) : (
                          <td className="border-b border-r border-gray-100 px-3 py-2 text-center text-sm text-gray-400">
                            —
                          </td>
                        )}

                        <td className="border-b border-r border-gray-100 bg-[#f8fbff] px-3 py-2 text-center text-sm font-semibold text-emerald-700">
                          {renderMoneyValue(item.total_accrued)}
                        </td>
                        <td className="border-b border-r border-gray-100 bg-[#f8fbff] px-3 py-2 text-center text-sm font-semibold text-rose-700">
                          {renderNegativeMoneyValue(item.total_deducted)}
                        </td>
                        <td className="border-b border-r border-gray-100 bg-[#f8fbff] px-3 py-2 text-center text-sm font-semibold text-gray-800">
                          {renderMoneyValue(item.net_payable)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>

                {!isTableLoading && !isTableError && items.length > 0 ? (
                  <tfoot className="relative sticky bottom-2 z-30 after:pointer-events-none after:absolute after:-bottom-2 after:left-px after:right-px after:h-2 after:bg-[#f8fbff] after:content-['']">
                    <tr className="bg-[#f8fbff] shadow-[0_-1px_0_0_#e5edf7]">
                      <td
                        colSpan={2}
                        className="sticky left-0 z-30 border-r border-gray-200 bg-[#f8fbff] px-3 py-2 text-right text-sm font-semibold text-gray-900"
                      >
                        Итого (сумма)
                      </td>
                      <td className="sticky left-[370px] z-30 border-r border-gray-200 bg-[#f8fbff] px-2 py-2 text-center text-sm font-semibold text-gray-900">
                        {renderMoneyValue(totals.base_salary)}
                      </td>

                      {accrualTypes.length > 0 ? (
                        accrualTypes.map((type) => (
                          <td
                            key={`totals-accrual-${type.key}`}
                            className="border-r border-gray-200 bg-[#f8fbff] px-3 py-2 text-center text-sm font-semibold text-gray-900"
                          >
                            {renderMoneyValue(totals.accruals?.[type.key])}
                          </td>
                        ))
                      ) : (
                        <td className="border-r border-gray-200 bg-[#f8fbff] px-3 py-2 text-center text-sm font-semibold text-gray-400">
                          —
                        </td>
                      )}

                      {deductionTypes.length > 0 ? (
                        deductionTypes.map((type) => (
                          <td
                            key={`totals-deduction-${type.key}`}
                            className="border-r border-gray-200 bg-[#f8fbff] px-3 py-2 text-center text-sm font-semibold text-gray-900"
                          >
                            {renderNegativeMoneyValue(totals.deductions?.[type.key])}
                          </td>
                        ))
                      ) : (
                        <td className="border-r border-gray-200 bg-[#f8fbff] px-3 py-2 text-center text-sm font-semibold text-gray-400">
                          —
                        </td>
                      )}

                      <td className="border-r border-gray-200 bg-[#f8fbff] px-3 py-2 text-center text-sm font-semibold text-emerald-700">
                        {renderMoneyValue(totals.total_accrued)}
                      </td>
                      <td className="border-r border-gray-200 bg-[#f8fbff] px-3 py-2 text-center text-sm font-semibold text-rose-700">
                        {renderNegativeMoneyValue(totals.total_deducted)}
                      </td>
                      <td className="border-r border-gray-200 bg-[#f8fbff] px-3 py-2 text-center text-sm font-semibold text-gray-900">
                        {renderMoneyValue(totals.net_payable)}
                      </td>
                    </tr>
                  </tfoot>
                ) : null}
              </table>

              {isTableFetching && !isTableLoading ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
                  <div className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
                    <Spinner size="sm" className="h-5 w-5" />
                    <span className="text-sm font-medium text-gray-600">Загрузка...</span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export default observer(BonusDeductionsPage);
