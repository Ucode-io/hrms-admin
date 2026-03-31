import { useEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { Link } from "react-router";
import { ArrowLeft, MoreHorizontal, Search, SlidersHorizontal } from "lucide-react";
import Select from "react-select";
import PageMeta from "../../../components/common/PageMeta";
import Spinner from "../../../components/ui/Spinner";
import {
  usePayrollReportQuery,
  usePayrollTableQuery,
} from "../../../api/services/reports.service";

const PAYROLL_FIXED_YEAR = "2026";
const PAYROLL_YEAR_OPTIONS = [
  { value: "all", label: "Все" },
  { value: PAYROLL_FIXED_YEAR, label: PAYROLL_FIXED_YEAR },
];
const PAYROLL_MONTH_COUNT_OPTIONS = Array.from({ length: 12 }, (_, index) => {
  const value = String(index + 1);
  return { value, label: value };
});

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

const emptyMetrics = {
  salary: null,
  bonus: null,
  work_days: null,
  actual_work_days: null,
  total: null,
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

const renderNumberValue = (value) => {
  if (value == null) {
    return "-";
  }

  return value;
};

const getMonthLabel = (period) => {
  if (period?.label && typeof period.label === "string") {
    const [monthLabel] = period.label.trim().split(" ");
    if (monthLabel) {
      return monthLabel;
    }
  }

  return String(period?.month ?? "");
};

function PayrollPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);

  const [selectedYear, setSelectedYear] = useState("all");
  const [selectedMonthCount, setSelectedMonthCount] = useState("3");
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
    data: payrollData,
    isLoading: isPayrollLoading,
    isError: isPayrollError,
    error: payrollError,
    refetch: refetchPayroll,
  } = usePayrollReportQuery();

  const filters = payrollData?.result?.filters;
  const employeeOptions = useMemo(() => toOptions(filters?.employees), [filters?.employees]);
  const departmentOptions = useMemo(() => toOptions(filters?.departments), [filters?.departments]);

  const tableRequestData = useMemo(
    () => ({
      year: selectedYear,
      period_count: Number(selectedMonthCount),
      ...(selectedEmployeeIds.length > 0 ? { employee_ids: selectedEmployeeIds } : {}),
      ...(selectedDepartmentIds.length > 0 ? { department_ids: selectedDepartmentIds } : {}),
      ...(search ? { search } : {}),
    }),
    [search, selectedDepartmentIds, selectedEmployeeIds, selectedMonthCount, selectedYear]
  );

  const {
    data: tableData,
    isLoading: isTableLoading,
    isFetching: isTableFetching,
    isError: isTableError,
    error: tableError,
    refetch: refetchTable,
  } = usePayrollTableQuery({
    requestData: tableRequestData,
  });

  const periods = tableData?.result?.periods ?? [];
  const items = tableData?.result?.items ?? [];
  const totals = tableData?.result?.totals ?? [];
  const activeAdvancedFilterCount = selectedEmployeeIds.length + selectedDepartmentIds.length;
  const hasActiveFilters =
    selectedYear !== "all" ||
    selectedMonthCount !== "3" ||
    selectedEmployeeIds.length > 0 ||
    selectedDepartmentIds.length > 0 ||
    searchInput.trim().length > 0;

  const resetFilters = () => {
    setSelectedYear("all");
    setSelectedMonthCount("3");
    setSelectedEmployeeIds([]);
    setSelectedDepartmentIds([]);
    setSearch("");
    setSearchInput("");
    setIsAdvancedFiltersOpen(false);
  };

  const periodGroups = useMemo(() => {
    const grouped = new Map();
    for (const period of periods) {
      const yearList = grouped.get(period.year) || [];
      yearList.push(period);
      grouped.set(period.year, yearList);
    }

    return Array.from(grouped.entries()).map(([year, yearPeriods]) => ({
      year,
      periods: yearPeriods,
    }));
  }, [periods]);

  if (isPayrollLoading) {
    return (
      <>
        <PageMeta title="Payroll | HRMS" description="Отчет по зарплатам и бонусам" />
        <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-gray-200 bg-white">
          <Spinner />
        </div>
      </>
    );
  }

  if (isPayrollError) {
    return (
      <>
        <PageMeta title="Payroll | HRMS" description="Отчет по зарплатам и бонусам" />
        <div className="rounded-2xl border border-error-200 bg-error-50 p-6">
          <p className="text-sm font-medium text-error-700">{getErrorMessage(payrollError)}</p>
          <button
            type="button"
            onClick={() => {
              void refetchPayroll();
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
      <PageMeta title="Payroll | HRMS" description="Отчет по зарплатам и бонусам" />

      <div className="flex h-[calc(100dvh-96px)] min-h-0 flex-col md:h-[calc(100dvh-112px)]">
        <section className="flex h-full min-h-0 flex-col rounded-2xl border border-gray-200 bg-white shadow-theme-xs">
          <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
            <div>
              <Link
                to="/reports"
                className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-gray-700"
              >
                <ArrowLeft size={14} />
                Назад
              </Link>
              <h1 className="text-2xl font-semibold text-gray-900">Payroll</h1>
              <p className="text-xs text-gray-500">Отчет по зарплатам, бонусам и рабочим дням сотрудников</p>
            </div>

            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50"
            >
              <MoreHorizontal size={18} />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col bg-gray-50/40 pb-0 pt-1">
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
              <div className="border-b border-gray-100 px-4 py-2">
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
                      className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-700 outline-none transition focus:border-brand-300"
                    />
                  </label>

                  <div className="min-w-[110px]">
                    <p className="mb-1 text-xs font-medium text-gray-600">Год</p>
                    <Select
                      options={PAYROLL_YEAR_OPTIONS}
                      value={
                        PAYROLL_YEAR_OPTIONS.find((item) => item.value === selectedYear) ||
                        PAYROLL_YEAR_OPTIONS[0]
                      }
                      onChange={(value) => {
                        const nextValue =
                          value && typeof value === "object" && "value" in value
                            ? String(value.value)
                            : "all";
                        setSelectedYear(nextValue);
                      }}
                      isClearable={false}
                      menuPosition="fixed"
                      menuPortalTarget={selectPortalTarget}
                      styles={selectStyles}
                    />
                  </div>

                  <div className="min-w-[110px]">
                    <p className="mb-1 text-xs font-medium text-gray-600">Месяц</p>
                    <Select
                      options={PAYROLL_MONTH_COUNT_OPTIONS}
                      value={
                        PAYROLL_MONTH_COUNT_OPTIONS.find((item) => item.value === selectedMonthCount) ||
                        PAYROLL_MONTH_COUNT_OPTIONS[2]
                      }
                      onChange={(value) => {
                        const nextValue =
                          value && typeof value === "object" && "value" in value
                            ? String(value.value)
                            : "3";
                        setSelectedMonthCount(nextValue);
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
                      className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                      Сбросить фильтры
                    </button>
                  ) : null}
                </div>

              </div>

              <div
                className="relative min-h-0 flex-1 overflow-auto border-x border-b border-gray-200"
                style={{ scrollbarGutter: "stable" }}
              >
                <table className="min-w-max border-separate border-spacing-0">
                  <thead>
                    <tr className="h-11 bg-[#f8fbff]">
                      <th
                        rowSpan={3}
                        className="sticky left-0 top-0 z-40 w-[180px] min-w-[180px] max-w-[180px] border-b border-r border-gray-200 bg-[#f8fbff] px-3 py-2 text-left text-xs font-semibold text-gray-700"
                      >
                        Имя
                      </th>
                      <th
                        rowSpan={3}
                        className="sticky left-[180px] top-0 z-40 w-[180px] min-w-[180px] max-w-[180px] border-b border-r border-gray-200 bg-[#f8fbff] px-3 py-2 text-left text-xs font-semibold text-gray-700"
                      >
                        Фамилия
                      </th>
                      <th
                        rowSpan={3}
                        className="sticky left-[360px] top-0 z-40 w-[180px] min-w-[180px] max-w-[180px] border-b border-r border-gray-200 bg-[#f8fbff] px-3 py-2 text-left text-xs font-semibold text-gray-700"
                      >
                        Департамент
                      </th>

                      {periodGroups.map((group) => (
                        <th
                          key={`year-${group.year}`}
                          colSpan={group.periods.length * 5}
                          className="sticky top-0 z-30 border-b border-r border-gray-200 bg-[#f8fbff] px-3 py-2 text-center text-xs font-semibold text-gray-700"
                        >
                          {group.year}
                        </th>
                      ))}
                    </tr>
                    <tr className="h-11 bg-[#f8fbff]">
                      {periodGroups.flatMap((group) =>
                        group.periods.map((period) => (
                          <th
                            key={`month-${period.key}`}
                            colSpan={5}
                            className="sticky top-[44px] z-30 border-b border-r border-gray-200 bg-[#f8fbff] px-3 py-2 text-center text-xs font-semibold text-gray-700"
                          >
                            {getMonthLabel(period)}
                          </th>
                        ))
                      )}
                    </tr>
                    <tr className="h-11 bg-[#f8fbff]">
                      {periods.flatMap((period) =>
                        ["Зарплата", "Бонус", "Рабочие дни", "Факт. дни", "Итого"].map((metric) => (
                          <th
                            key={`${period.key}-${metric}`}
                            className="sticky top-[88px] z-30 border-b border-r border-gray-200 bg-[#f8fbff] px-3 py-2 text-center text-xs font-semibold text-gray-700"
                          >
                            {metric}
                          </th>
                        ))
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {isTableLoading ? (
                      Array.from({ length: 8 }).map((_, rowIndex) => (
                        <tr key={`payroll-skeleton-${rowIndex}`} className="animate-pulse">
                          <td className="sticky left-0 z-10 w-[180px] min-w-[180px] max-w-[180px] border-b border-r border-gray-100 bg-white px-3 py-2">
                            <div className="h-4 w-20 rounded bg-gray-200" />
                          </td>
                          <td className="sticky left-[180px] z-10 w-[180px] min-w-[180px] max-w-[180px] border-b border-r border-gray-100 bg-white px-3 py-2">
                            <div className="h-4 w-20 rounded bg-gray-200" />
                          </td>
                          <td className="sticky left-[360px] z-10 w-[180px] min-w-[180px] max-w-[180px] border-b border-r border-gray-100 bg-white px-3 py-2">
                            <div className="h-4 w-24 rounded bg-gray-200" />
                          </td>
                          {periods.flatMap((period) =>
                            Array.from({ length: 5 }).map((__, metricIndex) => (
                              <td
                                key={`payroll-skeleton-${rowIndex}-${period.key}-${metricIndex}`}
                                className="border-b border-r border-gray-100 px-3 py-2"
                              >
                                <div className="h-4 w-14 rounded bg-gray-200" />
                              </td>
                            ))
                          )}
                        </tr>
                      ))
                    ) : isTableError ? (
                      <tr>
                        <td
                          colSpan={Math.max(3, 3 + periods.length * 5)}
                          className="px-4 py-6 text-center text-sm text-error-600"
                        >
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
                    ) : items.length === 0 || periods.length === 0 ? (
                      <tr>
                        <td
                          colSpan={Math.max(3, 3 + periods.length * 5)}
                          className="px-4 py-6 text-center text-sm text-gray-500"
                        >
                          Нет данных по выбранным фильтрам
                        </td>
                      </tr>
                    ) : items.map((item) => (
                      <tr key={item.guid} className="hover:bg-gray-50">
                        <td className="sticky left-0 z-10 w-[180px] min-w-[180px] max-w-[180px] border-b border-r border-gray-100 bg-white px-3 py-2 text-sm font-semibold text-gray-800">
                          <Link to={`/employees/${item.guid}`} className="transition hover:text-brand-500">
                            {item.first_name}
                          </Link>
                        </td>
                        <td className="sticky left-[180px] z-10 w-[180px] min-w-[180px] max-w-[180px] border-b border-r border-gray-100 bg-white px-3 py-2 text-sm text-gray-700">
                          {item.second_name || "—"}
                        </td>
                        <td className="sticky left-[360px] z-10 w-[180px] min-w-[180px] max-w-[180px] border-b border-r border-gray-100 bg-white px-3 py-2 text-sm text-gray-700">
                          {item.department}
                        </td>

                        {periods.flatMap((period) => {
                          const metrics = item.periods[period.key] || emptyMetrics;
                          return [
                            <td
                              key={`${item.guid}-${period.key}-salary`}
                              className="border-b border-r border-gray-100 px-3 py-2 text-center text-sm text-gray-700"
                            >
                              {renderMoneyValue(metrics.salary)}
                            </td>,
                            <td
                              key={`${item.guid}-${period.key}-bonus`}
                              className="border-b border-r border-gray-100 px-3 py-2 text-center text-sm text-gray-700"
                            >
                              {renderMoneyValue(metrics.bonus)}
                            </td>,
                            <td
                              key={`${item.guid}-${period.key}-work`}
                              className="border-b border-r border-gray-100 px-3 py-2 text-center text-sm text-gray-700"
                            >
                              {renderNumberValue(metrics.work_days)}
                            </td>,
                            <td
                              key={`${item.guid}-${period.key}-actual`}
                              className="border-b border-r border-gray-100 px-3 py-2 text-center text-sm text-gray-700"
                            >
                              {renderNumberValue(metrics.actual_work_days)}
                            </td>,
                            <td
                              key={`${item.guid}-${period.key}-total`}
                              className="border-b border-r border-gray-100 px-3 py-2 text-center text-sm font-semibold text-gray-800"
                            >
                              {renderMoneyValue(metrics.total)}
                            </td>,
                          ];
                        })}
                      </tr>
                    ))}
                  </tbody>

                  {!isTableLoading && !isTableError && items.length > 0 && periods.length > 0 ? (
                    <tfoot className="relative sticky bottom-[14px] z-30 after:pointer-events-none after:absolute after:-bottom-[14px] after:left-px after:right-px after:h-[14px] after:bg-[#f8fbff] after:content-['']">
                      <tr className="bg-[#f8fbff] shadow-[0_-1px_0_0_#e5edf7]">
                        <td
                          colSpan={3}
                          className="sticky left-0 z-30 border-r border-gray-200 bg-[#f8fbff] px-3 py-2 text-right text-sm font-semibold text-gray-900"
                        >
                          Итого (сумма)
                        </td>
                        {periods.flatMap((period) => {
                          const periodTotal = totals.find((item) => item.key === period.key);
                          const metrics = periodTotal || {
                            salary: null,
                            bonus: null,
                            work_days: null,
                            actual_work_days: null,
                            total: null,
                          };
                          return [
                            <td
                              key={`total-${period.key}-salary`}
                              className="border-r border-gray-200 bg-[#f8fbff] px-3 py-2 text-center text-sm font-semibold text-gray-900"
                            >
                              {renderMoneyValue(metrics.salary)}
                            </td>,
                            <td
                              key={`total-${period.key}-bonus`}
                              className="border-r border-gray-200 bg-[#f8fbff] px-3 py-2 text-center text-sm font-semibold text-gray-900"
                            >
                              {renderMoneyValue(metrics.bonus)}
                            </td>,
                            <td
                              key={`total-${period.key}-work`}
                              className="border-r border-gray-200 bg-[#f8fbff] px-3 py-2 text-center text-sm font-semibold text-gray-900"
                            >
                              {renderNumberValue(metrics.work_days)}
                            </td>,
                            <td
                              key={`total-${period.key}-actual`}
                              className="border-r border-gray-200 bg-[#f8fbff] px-3 py-2 text-center text-sm font-semibold text-gray-900"
                            >
                              {renderNumberValue(metrics.actual_work_days)}
                            </td>,
                            <td
                              key={`total-${period.key}-total`}
                              className="border-r border-gray-200 bg-[#f8fbff] px-3 py-2 text-center text-sm font-semibold text-gray-900"
                            >
                              {renderMoneyValue(metrics.total)}
                            </td>,
                          ];
                        })}
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
          </div>
        </section>
      </div>
    </>
  );
}

export default observer(PayrollPage);
