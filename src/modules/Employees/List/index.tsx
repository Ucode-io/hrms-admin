import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router";
import { Building2, LayoutGrid, List, Mail, Phone, SlidersHorizontal, Plus, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import Select from "react-select";
import { observer } from "mobx-react-lite";
import PageMeta from "../../../components/common/PageMeta";
import ViewSwitcher from "../../../components/common/ViewSwitcher";
import companyStore from "../../../store/company.store";
import pageSessionStore from "../../../store/pageSession.store";
import {
  useEmployeesQuery,
  type Employee,
  type EmployeeStatus,
} from "../../../api/services/employee.service";
import EmployeesPaginationFooter from "./components/EmployeesPaginationFooter";
import ExpandableSearchInput from "../../../components/form/ExpandableSearchInput";
import OrganizationStructureModule from "../../Organization/Structure";
import { useVegapharmCrmImport, useVegapharmCrmPreview, useVegapharmCrmStatus } from "../../../api/services/vegapharmCrm.service";

const PAGE_SIZE = 24;
const FILTER_SELECT_MAX_WIDTH = 260;
const DEFAULT_EMPLOYEE_STATUS: EmployeeStatus = "active";
const VEGAPHARM_COMPANY_ID = "c9a7fee7-e210-477e-bee3-5f18e388e630";

type PaginationItem = number | string;
type FilterOption = { value: string; label: string };
type StatusFilterOption = { value: EmployeeStatus; label: string };
type EmployeesListSessionState = {
  searchQuery: string;
  currentPage: number;
  departmentFilter: string;
  employmentTypeFilter: string;
  locationFilter: string;
  positionFilter: string;
  statusFilter: EmployeeStatus | "";
  crmFilter: "" | "linked" | "unlinked";
};

const EMPLOYEES_LIST_SESSION_KEY = "employees.list";
const EMPLOYEES_LIST_SESSION_DEFAULTS: EmployeesListSessionState = {
  searchQuery: "",
  currentPage: 1,
  departmentFilter: "",
  employmentTypeFilter: "",
  locationFilter: "",
  positionFilter: "",
  statusFilter: DEFAULT_EMPLOYEE_STATUS,
  crmFilter: "",
};

const STATUS_FILTER_OPTIONS: StatusFilterOption[] = [
  { value: "active", label: "Активные" },
  { value: "dismissed", label: "Уволенные" },
];

const buildPaginationItems = (currentPage: number, totalPages: number): PaginationItem[] => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);

  if (currentPage <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }

  if (currentPage >= totalPages - 2) {
    pages.add(totalPages - 1);
    pages.add(totalPages - 2);
    pages.add(totalPages - 3);
  }

  const sortedPages = [...pages]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);

  const result: PaginationItem[] = [];

  for (let i = 0; i < sortedPages.length; i += 1) {
    const page = sortedPages[i];
    const prevPage = sortedPages[i - 1];

    if (prevPage && page - prevPage > 1) {
      result.push(`ellipsis-${prevPage}-${page}`);
    }

    result.push(page);
  }

  return result;
};

const buildUniqueOptions = (
  source: Employee[],
  getValue: (employee: Employee) => string | null | undefined,
  getLabel: (employee: Employee) => string | null | undefined
): FilterOption[] => {
  const map = new Map<string, string>();

  for (const employee of source) {
    const value = String(getValue(employee) || "").trim();
    const label = String(getLabel(employee) || "").trim();
    if (!value || !label) continue;
    if (!map.has(value)) {
      map.set(value, label);
    }
  }

  return [...map.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label, "ru"));
};

function EmployeesList() {
  if (!pageSessionStore.isHydrated) {
    return (
      <>
        <PageMeta title="Сотрудники | HRMS" description="Список сотрудников" />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              border: "3px solid #e2e8f0",
              borderTopColor: companyStore.mainColor,
              animation: "spin 0.8s linear infinite",
            }}
          />
        </div>
      </>
    );
  }

  return <EmployeesListContent />;
}

const EmployeesListContent = observer(function EmployeesListContent() {
  const {
    searchQuery,
    currentPage,
    departmentFilter,
    employmentTypeFilter,
    locationFilter,
    positionFilter,
    statusFilter,
    crmFilter,
  } = pageSessionStore.getState(
    EMPLOYEES_LIST_SESSION_KEY,
    EMPLOYEES_LIST_SESSION_DEFAULTS
  );
  const [viewMode, setViewMode] = useState<"grid" | "list" | "org">("grid");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [orgSearchQuery, setOrgSearchQuery] = useState("");
  const [orgFiltersOpen, setOrgFiltersOpen] = useState(false);
  const [orgActiveFiltersCount, setOrgActiveFiltersCount] = useState(0);
  const [crmModalOpen, setCrmModalOpen] = useState(false);
  const navigate = useNavigate();

  const brandColor = companyStore.mainColor;
  const isVegapharm = companyStore.company?.guid === VEGAPHARM_COMPANY_ID;
  const crmStatus = useVegapharmCrmStatus(isVegapharm);
  const crmPreview = useVegapharmCrmPreview(isVegapharm && crmModalOpen);
  const crmImport = useVegapharmCrmImport();
  const crmLinkedIds = useMemo(() => new Set((crmStatus.data?.links || []).map((item) => item.user_base_id)), [crmStatus.data]);
  const selectPortalTarget = typeof document !== "undefined" ? document.body : null;
  const updateListSessionState = (patch: Partial<EmployeesListSessionState>) => {
    pageSessionStore.patchState(
      EMPLOYEES_LIST_SESSION_KEY,
      EMPLOYEES_LIST_SESSION_DEFAULTS,
      patch
    );
  };

  const { data: apiData, isLoading, isFetching } = useEmployeesQuery({
    limit: crmFilter ? 500 : PAGE_SIZE,
    offset: crmFilter ? 0 : (currentPage - 1) * PAGE_SIZE,
    search: searchQuery || undefined,
    status: statusFilter || undefined,
  });

  const employees: Employee[] = useMemo(() => {
    if (!apiData) return [];
    return (apiData.response || []) as Employee[];
  }, [apiData]);

  const isOrgView = viewMode === "org";

  const departmentOptions = useMemo(
    () =>
      buildUniqueOptions(
        employees,
        (employee) => employee.departments_id,
        (employee) => employee.departments_id_data?.title
      ),
    [employees]
  );
  const employmentTypeOptions = useMemo(
    () =>
      buildUniqueOptions(
        employees,
        (employee) => employee.employment_types_id,
        (employee) => employee.employment_types_id_data?.title
      ),
    [employees]
  );
  const locationOptions = useMemo(
    () =>
      buildUniqueOptions(
        employees,
        (employee) => employee.locations_id,
        (employee) => employee.locations_id_data?.title
      ),
    [employees]
  );
  const positionOptions = useMemo(
    () =>
      buildUniqueOptions(
        employees,
        (employee) => employee.positions_id,
        (employee) => employee.positions_id_data?.title
      ),
    [employees]
  );

  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      if (departmentFilter && employee.departments_id !== departmentFilter) return false;
      if (employmentTypeFilter && employee.employment_types_id !== employmentTypeFilter) return false;
      if (locationFilter && employee.locations_id !== locationFilter) return false;
      if (positionFilter && employee.positions_id !== positionFilter) return false;
      if (crmFilter === "linked" && !crmLinkedIds.has(employee.guid)) return false;
      if (crmFilter === "unlinked" && crmLinkedIds.has(employee.guid)) return false;
      return true;
    });
  }, [employees, departmentFilter, employmentTypeFilter, locationFilter, positionFilter, crmFilter, crmLinkedIds]);

  const totalCount = crmFilter ? filteredEmployees.length : (apiData?.count ?? employees.length);
  const totalPages = crmFilter ? 1 : Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const visibleFrom = totalCount > 0 ? (crmFilter ? 1 : (currentPage - 1) * PAGE_SIZE + 1) : 0;
  const visibleTo = totalCount > 0 ? (crmFilter ? totalCount : Math.min(currentPage * PAGE_SIZE, totalCount)) : 0;
  const visibleRangeLabel = totalCount > 0
    ? `Отображение ${visibleFrom} - ${visibleTo} из ${totalCount}`
    : "Нет данных";

  const activeFiltersCount = [
    departmentFilter,
    employmentTypeFilter,
    locationFilter,
    positionFilter,
    statusFilter,
    crmFilter,
  ].filter(Boolean).length;
  const isFilterButtonActive = isOrgView
    ? orgFiltersOpen || orgActiveFiltersCount > 0
    : isFiltersOpen || activeFiltersCount > 0;

  const downloadCrmIds = () => {
    const linked = (crmPreview.data?.items || []).filter((item) => item.user_base_id);
    const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = [
      ["CRM ID", "HRMS ID", "F.I.Sh."],
      ...linked.map((item) => [item.crm_id, item.user_base_id, item.full_name]),
    ];
    const blob = new Blob(["\ufeff" + rows.map((row) => row.map(escape).join(";")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `vegapharm-crm-hrms-ids-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const filterSelectStyles = useMemo(
    () => ({
      control: (base: any, state: any) => ({
        ...base,
        minHeight: 38,
        borderRadius: 10,
        backgroundColor: state.hasValue ? "var(--color-brand-50)" : "#fff",
        borderColor: state.hasValue ? "var(--color-brand-200)" : state.isFocused ? "#cbd5e1" : "#dbe2ea",
        boxShadow: "none",
        "&:hover": {
          borderColor: state.hasValue ? "#93c5fd" : "#cbd5e1",
        },
      }),
      valueContainer: (base: any) => ({
        ...base,
        padding: "0 10px",
      }),
      indicatorsContainer: (base: any, state: any) => ({
        ...base,
        color: state.hasValue ? "var(--company-color)" : "#64748b",
      }),
      dropdownIndicator: (base: any, state: any) => ({
        ...base,
        color: state.hasValue ? "var(--company-color)" : "#64748b",
        padding: 6,
        "&:hover": {
          color: state.hasValue ? "var(--color-brand-700)" : "#475569",
        },
      }),
      clearIndicator: (base: any) => ({
        ...base,
        color: "#64748b",
        padding: 6,
        "&:hover": {
          color: "#475569",
        },
      }),
      indicatorSeparator: () => ({
        display: "none",
      }),
      placeholder: (base: any) => ({
        ...base,
        color: "#94a3b8",
        fontSize: 14,
      }),
      input: (base: any) => ({
        ...base,
        color: "#1e293b",
        fontSize: 14,
        margin: 0,
        padding: 0,
      }),
      singleValue: (base: any, state: any) => ({
        ...base,
        color: state.hasValue ? "var(--company-color)" : "#334155",
        fontSize: 14,
        fontWeight: state.hasValue ? 600 : 500,
      }),
      menu: (base: any) => ({
        ...base,
        borderRadius: 10,
        overflow: "hidden",
        zIndex: 9999,
      }),
      menuPortal: (base: any) => ({
        ...base,
        zIndex: 9999,
      }),
      option: (base: any, state: any) => ({
        ...base,
        backgroundColor: state.isSelected ? "var(--color-brand-100)" : state.isFocused ? "#f8fafc" : "#fff",
        color: state.isSelected ? "var(--color-brand-700)" : "#1e293b",
        fontSize: 14,
        padding: "8px 12px",
      }),
      noOptionsMessage: (base: any) => ({
        ...base,
        color: "#64748b",
        fontSize: 13,
      }),
    }),
    []
  );

  useEffect(() => {
    if (isOrgView && isFiltersOpen) {
      setIsFiltersOpen(false);
    }
  }, [isOrgView, isFiltersOpen]);

  useEffect(() => {
    if (!isOrgView && orgFiltersOpen) {
      setOrgFiltersOpen(false);
    }
  }, [isOrgView, orgFiltersOpen]);

  useEffect(() => {
    if (apiData && currentPage > totalPages) {
      updateListSessionState({ currentPage: totalPages });
    }
  }, [apiData, currentPage, totalPages]);

  const paginationItems = useMemo(
    () => buildPaginationItems(currentPage, totalPages),
    [currentPage, totalPages]
  );

  const getDisplayName = (emp: Employee) =>
    [emp.second_name, emp.first_name].filter(Boolean).join(" ") || "—";

  const getPosition = (emp: Employee) =>
    emp.positions_id_data?.title || "";

  const getDepartment = (emp: Employee) =>
    emp.departments_id_data?.title || "";

  const getLocation = (emp: Employee) =>
    emp.locations_id_data?.title || "";

  const isDismissed = (emp: Employee) => emp.status?.includes("dismissed");

  const formatDate = (value: string | null | undefined) => {
    if (!value) return "—";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <>
      <PageMeta title="Сотрудники | HRMS" description="Список сотрудников" />

      <div
        className="-mx-3 md:-mx-4 -mt-3 md:-mt-4"
        style={
          isOrgView
            ? {
              height: "calc(100vh - 88px)",
              maxHeight: "calc(100vh - 88px)",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              overflow: "hidden",
            }
            : undefined
        }
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 0,
            marginBottom: isOrgView ? "8px" : "12px",
            flexShrink: 0,
            width: "100%",
          }}
        >
          <div
            className="px-4 lg:px-6 py-2"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
              flexWrap: "wrap",
              backgroundColor: "#fff",
              border: "1px solid #e2e8f0",
              borderTop: "none",
              borderBottom: isFiltersOpen && !isOrgView ? "none" : "1px solid #e2e8f0",
              borderRadius: "0",
            }}
          >
          <ViewSwitcher
            value={viewMode}
            onChange={setViewMode}
            buttonId={(view) =>
              view === "org" ? "employees-view-org-structure" : `employees-view-${view}`
            }
            items={[
              { key: "list", label: "Таблица", icon: <List size={16} /> },
              { key: "grid", label: "Сетка", icon: <LayoutGrid size={16} /> },
              { key: "org", label: "Орг структура", icon: <Building2 size={16} /> },
            ]}
          />

          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "auto", flexWrap: "nowrap", justifyContent: "flex-end" }}>
            <ExpandableSearchInput
              value={isOrgView ? orgSearchQuery : searchQuery}
              onChange={(value) => {
                if (isOrgView) {
                  setOrgSearchQuery(value);
                  return;
                }
                updateListSessionState({ searchQuery: value, currentPage: 1 });
              }}
              inputId="employees-search"
              placeholder={
                isOrgView
                  ? "Поиск отдела..."
                  : "Поиск по имени, электронной почте или номеру телефона"
              }
              expandedWidth={460}
              collapsedSize={38}
              brandColor={brandColor}
            />

            <button
              type="button"
              onClick={() => setCrmModalOpen(true)}
              style={{ display: isVegapharm && !isOrgView ? "inline-flex" : "none", alignItems: "center", gap: "6px", padding: "8px 12px", fontSize: "13px", fontWeight: 600, color: "#0369a1", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "10px", cursor: "pointer" }}
            >
              <RefreshCw size={15} /> Импорт из CRM
            </button>

            <button
              id="employees-filter-btn"
              type="button"
              onClick={() => {
                if (isOrgView) {
                  setOrgFiltersOpen((open) => !open);
                  return;
                }
                setIsFiltersOpen((open) => !open);
              }}
              aria-label={`Фильтр${
                (isOrgView ? orgActiveFiltersCount : activeFiltersCount) > 0
                  ? ` (${isOrgView ? orgActiveFiltersCount : activeFiltersCount})`
                  : ""
              }`}
              title={`Фильтр${
                (isOrgView ? orgActiveFiltersCount : activeFiltersCount) > 0
                  ? ` (${isOrgView ? orgActiveFiltersCount : activeFiltersCount})`
                  : ""
              }`}
              style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "40px",
                height: "40px",
                color: isFilterButtonActive ? "var(--company-color)" : "#1e293b",
                backgroundColor: isFilterButtonActive ? "var(--color-brand-50)" : "#fff",
                border: isFilterButtonActive
                  ? "1px solid var(--color-brand-200)"
                  : "1px solid #e2e8f0",
                borderRadius: "10px",
                cursor: "pointer",
                transition: "background-color 0.2s",
              }}
              onMouseEnter={(e) => {
                if (isFilterButtonActive) return;
                e.currentTarget.style.backgroundColor = "#f8fafc";
              }}
              onMouseLeave={(e) => {
                if (isFilterButtonActive) return;
                e.currentTarget.style.backgroundColor = "#fff";
              }}
            >
              <SlidersHorizontal style={{ width: "16px", height: "16px" }} />
              {(isOrgView ? orgActiveFiltersCount : activeFiltersCount) > 0 ? (
                <span
                  style={{
                    position: "absolute",
                    top: "-4px",
                    right: "-4px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "16px",
                    minWidth: "16px",
                    padding: "0 4px",
                    borderRadius: "9999px",
                    backgroundColor: "var(--company-color)",
                    color: "#fff",
                    fontSize: "10px",
                    fontWeight: 600,
                    lineHeight: 1,
                  }}
                >
                  {isOrgView ? orgActiveFiltersCount : activeFiltersCount}
                </span>
              ) : null}
            </button>

            <button
              id="employees-add-btn"
              onClick={() => {
                navigate("/employees/new");
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                fontSize: "14px",
                fontWeight: 600,
                color: "#fff",
                backgroundColor: brandColor,
                border: "none",
                borderRadius: "10px",
                cursor: "pointer",
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              <Plus style={{ width: "16px", height: "16px" }} />
              Добавить
            </button>
          </div>
          </div>

          {isFiltersOpen && !isOrgView ? (
            <div
              className="px-4 lg:px-6 py-2"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexWrap: "wrap",
                justifyContent: "flex-start",
                background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
                border: "1px solid #e2e8f0",
                borderTop: "1px solid #dbe4ee",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
              }}
            >
              <div
                style={{ minWidth: "180px", width: "100%", maxWidth: `${FILTER_SELECT_MAX_WIDTH}px`, flex: `0 1 ${FILTER_SELECT_MAX_WIDTH}px`, display: isVegapharm ? "block" : "none" }}
              >
                <Select
                  inputId="employees-filter-crm"
                  value={[{ value: "linked", label: "Из QuadraSoft CRM" }, { value: "unlinked", label: "Не связаны с CRM" }].find((option) => option.value === crmFilter) || null}
                  onChange={(option: any) => updateListSessionState({ crmFilter: option?.value || "", currentPage: 1 })}
                  options={[{ value: "linked", label: "Из QuadraSoft CRM" }, { value: "unlinked", label: "Не связаны с CRM" }]}
                  placeholder="Источник"
                  isSearchable={false}
                  isClearable
                  styles={filterSelectStyles}
                  menuPortalTarget={selectPortalTarget}
                  menuPosition="fixed"
                />
              </div>

              <div
                style={{
                  minWidth: "180px",
                  width: "100%",
                  maxWidth: `${FILTER_SELECT_MAX_WIDTH}px`,
                  flex: `0 1 ${FILTER_SELECT_MAX_WIDTH}px`,
                }}
              >
                <Select
                  inputId="employees-filter-department"
                  value={departmentOptions.find((option) => option.value === departmentFilter) || null}
                  onChange={(option: any) => {
                    updateListSessionState({
                      departmentFilter: option?.value || "",
                      currentPage: 1,
                    });
                  }}
                  options={departmentOptions}
                  placeholder="Департамент"
                  isSearchable
                  isClearable
                  styles={filterSelectStyles}
                  menuPortalTarget={selectPortalTarget}
                  menuPosition="fixed"
                  noOptionsMessage={() => "Ничего не найдено"}
                />
              </div>

              <div
                style={{
                  minWidth: "180px",
                  width: "100%",
                  maxWidth: `${FILTER_SELECT_MAX_WIDTH}px`,
                  flex: `0 1 ${FILTER_SELECT_MAX_WIDTH}px`,
                }}
              >
                <Select
                  inputId="employees-filter-employment-type"
                  value={employmentTypeOptions.find((option) => option.value === employmentTypeFilter) || null}
                  onChange={(option: any) => {
                    updateListSessionState({
                      employmentTypeFilter: option?.value || "",
                      currentPage: 1,
                    });
                  }}
                  options={employmentTypeOptions}
                  placeholder="Тип работы"
                  isSearchable
                  isClearable
                  styles={filterSelectStyles}
                  menuPortalTarget={selectPortalTarget}
                  menuPosition="fixed"
                  noOptionsMessage={() => "Ничего не найдено"}
                />
              </div>

              <div
                style={{
                  minWidth: "180px",
                  width: "100%",
                  maxWidth: `${FILTER_SELECT_MAX_WIDTH}px`,
                  flex: `0 1 ${FILTER_SELECT_MAX_WIDTH}px`,
                }}
              >
                <Select
                  inputId="employees-filter-location"
                  value={locationOptions.find((option) => option.value === locationFilter) || null}
                  onChange={(option: any) => {
                    updateListSessionState({
                      locationFilter: option?.value || "",
                      currentPage: 1,
                    });
                  }}
                  options={locationOptions}
                  placeholder="Филиал"
                  isSearchable
                  isClearable
                  styles={filterSelectStyles}
                  menuPortalTarget={selectPortalTarget}
                  menuPosition="fixed"
                  noOptionsMessage={() => "Ничего не найдено"}
                />
              </div>

              <div
                style={{
                  minWidth: "180px",
                  width: "100%",
                  maxWidth: `${FILTER_SELECT_MAX_WIDTH}px`,
                  flex: `0 1 ${FILTER_SELECT_MAX_WIDTH}px`,
                }}
              >
                <Select
                  inputId="employees-filter-position"
                  value={positionOptions.find((option) => option.value === positionFilter) || null}
                  onChange={(option: any) => {
                    updateListSessionState({
                      positionFilter: option?.value || "",
                      currentPage: 1,
                    });
                  }}
                  options={positionOptions}
                  placeholder="Должность"
                  isSearchable
                  isClearable
                  styles={filterSelectStyles}
                  menuPortalTarget={selectPortalTarget}
                  menuPosition="fixed"
                  noOptionsMessage={() => "Ничего не найдено"}
                />
              </div>

              <div
                style={{
                  minWidth: "180px",
                  width: "100%",
                  maxWidth: `${FILTER_SELECT_MAX_WIDTH}px`,
                  flex: `0 1 ${FILTER_SELECT_MAX_WIDTH}px`,
                }}
              >
                <Select
                  inputId="employees-filter-status"
                  value={STATUS_FILTER_OPTIONS.find((option) => option.value === statusFilter) || null}
                  onChange={(option: any) => {
                    updateListSessionState({
                      statusFilter: option?.value || "",
                      currentPage: 1,
                    });
                  }}
                  options={STATUS_FILTER_OPTIONS}
                  placeholder="Статус"
                  isSearchable={false}
                  isClearable
                  styles={filterSelectStyles}
                  menuPortalTarget={selectPortalTarget}
                  menuPosition="fixed"
                  noOptionsMessage={() => "Ничего не найдено"}
                />
              </div>

              {activeFiltersCount > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    updateListSessionState({
                      departmentFilter: "",
                      employmentTypeFilter: "",
                      locationFilter: "",
                      positionFilter: "",
                      statusFilter: "",
                      crmFilter: "",
                      currentPage: 1,
                    });
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "38px",
                    padding: "0 12px",
                    borderRadius: "10px",
                    border: "1px solid var(--color-brand-200)",
                    backgroundColor: "var(--color-brand-50)",
                    color: "var(--company-color)",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    marginLeft: "auto",
                  }}
                >
                  Сбросить
                </button>
              ) : null}
            </div>
          ) : null}

        </div>

        <div
          style={
            isOrgView
              ? { flex: 1, minHeight: 0, overflow: "hidden", paddingBottom: 0 }
              : { paddingBottom: "92px" }
          }
        >
          {viewMode === "org" ? (
            <OrganizationStructureModule
              embedded
              searchValue={orgSearchQuery}
              onSearchValueChange={setOrgSearchQuery}
              filtersOpen={orgFiltersOpen}
              onActiveFiltersCountChange={setOrgActiveFiltersCount}
            />
          ) : isLoading || isFetching ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  border: "3px solid #e2e8f0",
                  borderTopColor: brandColor,
                  animation: "spin 0.8s linear infinite",
                }}
              />
            </div>
          ) : viewMode === "grid" ? (
            <div style={{ padding: "0 12px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: "16px",
                }}
              >
                {filteredEmployees.length === 0 ? (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      textAlign: "center",
                      padding: "60px 0",
                      color: "#94a3b8",
                      fontSize: "15px",
                    }}
                  >
                    Сотрудники не найдены
                  </div>
                ) : (
                  filteredEmployees.map((emp) => (
                    <EmployeeCard
                      key={emp.guid}
                      employee={emp}
                      name={getDisplayName(emp)}
                      position={getPosition(emp)}
                      department={getDepartment(emp)}
                      location={getLocation(emp)}
                      crmLinked={crmLinkedIds.has(emp.guid)}
                      onClick={() => navigate(`/employees/${emp.guid}`)}
                    />
                  ))
                )}
              </div>
            </div>
          ) : (
          <div
            style={{
              overflow: "hidden",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              backgroundColor: "#fff",
            }}
          >
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f8fafc" }}>
                    {["", "Имя", "Должность", "Отдел", "Филиал", "Email", "Телефон"].map(
                      (h) => (
                        <th
                          key={h}
                          style={{
                            padding: "10px 16px",
                            textAlign: "left",
                            fontSize: "12px",
                            fontWeight: 600,
                            color: "#64748b",
                            borderBottom: "1px solid #e2e8f0",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        style={{
                          textAlign: "center",
                          padding: "40px",
                          color: "#94a3b8",
                          fontSize: "14px",
                        }}
                      >
                        Сотрудники не найдены
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((emp) => {
                      const name = getDisplayName(emp);
                      const dismissed = isDismissed(emp);
                      return (
                        <tr
                          key={emp.guid}
                          onClick={() => navigate(`/employees/${emp.guid}`)}
                          style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.15s", cursor: "pointer" }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.backgroundColor = "#f8fafc")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.backgroundColor = "transparent")
                          }
                        >
                          <td style={{ padding: "10px 16px", width: "56px" }}>
                            <Avatar name={name} photo={emp.photo} size={36} />
                          </td>
                          <td
                            style={{
                              padding: "10px 16px",
                              color: "#1e293b",
                              fontSize: "14px",
                            }}
                          >
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{name}</span>
                                {crmLinkedIds.has(emp.guid) ? <span style={{ padding: "2px 7px", borderRadius: "999px", background: "#e0f2fe", color: "#0369a1", fontSize: "10px", fontWeight: 700 }}>QuadraSoft CRM</span> : null}
                                {dismissed ? (
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      padding: "2px 8px",
                                      borderRadius: "999px",
                                      border: "1px solid #fecaca",
                                      backgroundColor: "#fef2f2",
                                      color: "#b91c1c",
                                      fontSize: "11px",
                                      fontWeight: 700,
                                    }}
                                  >
                                    Уволен
                                  </span>
                                ) : null}
                              </div>
                              {dismissed && emp.dismissal_date ? (
                                <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                                  Дата увольнения: {formatDate(emp.dismissal_date)}
                                </div>
                              ) : null}
                            </div>
                          </td>
                          <td style={{ padding: "10px 16px", fontSize: "13px", color: "#475569" }}>
                            {getPosition(emp) || "—"}
                          </td>
                          <td style={{ padding: "10px 16px", fontSize: "13px", color: "#475569" }}>
                            {getDepartment(emp) || "—"}
                          </td>
                          <td style={{ padding: "10px 16px", fontSize: "13px", color: "#475569" }}>
                            {getLocation(emp) || "—"}
                          </td>
                          <td style={{ padding: "10px 16px", fontSize: "13px", color: "#475569" }}>
                            {emp.email || "—"}
                          </td>
                          <td style={{ padding: "10px 16px", fontSize: "13px", color: "#475569" }}>
                            {emp.phone || "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </div>
      </div>
      {crmModalOpen ? (
        <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "min(920px,100%)", maxHeight: "85vh", overflow: "auto", borderRadius: 16, background: "#fff", boxShadow: "0 24px 70px rgba(15,23,42,.25)" }}>
            <div style={{ display: "flex", alignItems: "center", padding: "18px 22px", borderBottom: "1px solid #e2e8f0" }}>
              <div><div style={{ fontSize: 18, fontWeight: 700 }}>Импорт из QuadraSoft CRM</div><div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>Onboarding vazifalari yaratilmaydi</div></div>
              <button onClick={() => setCrmModalOpen(false)} style={{ marginLeft: "auto", border: 0, background: "transparent", cursor: "pointer" }}><X size={20}/></button>
            </div>
            <div style={{ padding: 22 }}>
              {crmPreview.isLoading ? <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>CRM ma’lumotlari yuklanmoqda…</div> : crmPreview.error ? <div style={{ padding: 16, background: "#fef2f2", color: "#b91c1c", borderRadius: 10 }}>{crmPreview.error instanceof Error ? crmPreview.error.message : "CRM xatosi"}</div> : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 18 }}>
                    {[['Jami',crmPreview.data?.summary.total],['Yangi',crmPreview.data?.summary.new],['Mavjudga bog‘lanadi',crmPreview.data?.summary.matched],['Tekshirish kerak',crmPreview.data?.summary.ambiguous]].map(([label,value]) => <div key={String(label)} style={{ padding: 13, border: "1px solid #e2e8f0", borderRadius: 10 }}><div style={{ fontSize: 12, color: "#64748b" }}>{label}</div><div style={{ fontSize: 22, fontWeight: 700 }}>{value ?? 0}</div></div>)}
                  </div>
                  <div style={{ maxHeight: 380, overflow: "auto", border: "1px solid #e2e8f0", borderRadius: 10 }}>
                    {(crmPreview.data?.items || []).map(item => <div key={item.crm_id} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 120px", gap: 12, padding: "10px 12px", borderBottom: "1px solid #f1f5f9", fontSize: 13 }}><strong>{item.full_name}</strong><span>{item.department || '—'}</span><span>{item.position || '—'}</span><span style={{ color: item.kind==='ambiguous'?'#b45309':item.kind==='new'?'#0369a1':'#15803d' }}>{item.kind==='new'?'Yangi':item.kind==='matched'?'Bog‘lanadi':item.kind==='linked'?'Bog‘langan':'Tekshirish'}</span></div>)}
                  </div>
                </>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 22px", borderTop: "1px solid #e2e8f0" }}>
              <button disabled={!(crmPreview.data?.items || []).some(item => item.user_base_id)} onClick={downloadCrmIds} style={{ padding: "9px 15px", border: "1px solid #bae6fd", borderRadius: 9, background: "#f0f9ff", color: "#0369a1", cursor: "pointer", marginRight: "auto" }}>Скачать ID для CRM</button>
              <button onClick={() => setCrmModalOpen(false)} style={{ padding: "9px 15px", border: "1px solid #cbd5e1", borderRadius: 9, background: "#fff", cursor: "pointer" }}>Отмена</button>
              <button disabled={!crmPreview.data || crmImport.isLoading} onClick={async()=>{ try { const ids=(crmPreview.data?.items||[]).filter(i=>i.kind!=="ambiguous").map(i=>i.crm_id); const result=await crmImport.mutateAsync(ids); toast.success(`CRM import: ${result.created} yangi, ${result.linked} bog‘landi`); setCrmModalOpen(false); } catch(e){ toast.error(e instanceof Error?e.message:"Import xatosi"); } }} style={{ padding: "9px 15px", border: 0, borderRadius: 9, background: brandColor, color: "#fff", fontWeight: 600, cursor: "pointer" }}>{crmImport.isLoading?'Импорт…':'Импортировать'}</button>
            </div>
          </div>
        </div>
      ) : null}

      {viewMode !== "org" ? (
        <EmployeesPaginationFooter
          visibleRangeLabel={visibleRangeLabel}
          paginationItems={paginationItems}
          currentPage={currentPage}
          totalPages={totalPages}
          brandColor={brandColor}
          onPrevious={() => updateListSessionState({ currentPage: Math.max(1, currentPage - 1) })}
          onNext={() => updateListSessionState({ currentPage: Math.min(totalPages, currentPage + 1) })}
          onPageChange={(page) => updateListSessionState({ currentPage: page })}
        />
      ) : null}
    </>
  );
});

export default observer(EmployeesList);

function Avatar({
  name,
  photo,
  size = 44,
}: {
  name: string;
  photo: string | null;
  size?: number;
}) {
  const initials = name
    .split(" ")
    .map((n) => n.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (photo) {
    return (
      <img
        src={photo}
        alt={name}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          minWidth: `${size}px`,
          minHeight: `${size}px`,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
          display: "block",
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
        borderRadius: "50%",
        backgroundColor: "var(--color-brand-100)",
        color: "var(--company-color)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: `${Math.round(size * 0.35)}px`,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

function ContactIcon({
  icon,
  href,
  title,
}: {
  icon: React.ReactNode;
  href?: string;
  title: string;
}) {
  const Wrapper = href ? "a" : "span";
  return (
    <Wrapper
      {...(href ? { href, target: "_blank", rel: "noopener noreferrer" } : {})}
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "28px",
        height: "28px",
        borderRadius: "6px",
        color: "#475569",
        cursor: href ? "pointer" : "default",
        transition: "color 0.15s",
      }}
      onMouseEnter={(e: any) => (e.currentTarget.style.color = "#1e293b")}
      onMouseLeave={(e: any) => (e.currentTarget.style.color = "#475569")}
    >
      {icon}
    </Wrapper>
  );
}

function EmployeeCard({
  employee,
  name,
  position,
  department,
  location,
  crmLinked,
  onClick,
}: {
  employee: Employee;
  name: string;
  position: string;
  department: string;
  location: string;
  crmLinked?: boolean;
  onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  const positionLabel = [position, department, location ? `в ${location}` : ""]
    .filter(Boolean)
    .join(" · ");
  const isDismissed = employee.status?.includes("dismissed");
  const dismissalDateLabel =
    employee.dismissal_date && !Number.isNaN(new Date(employee.dismissal_date).getTime())
      ? new Date(employee.dismissal_date).toLocaleDateString("ru-RU", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : employee.dismissal_date || "";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "20px",
        border: "1px solid #e2e8f0",
        borderRadius: "14px",
        backgroundColor: "#fff",
        transition: "box-shadow 0.2s, border-color 0.2s",
        boxShadow: hovered
          ? "0 4px 12px rgba(0,0,0,0.06)"
          : "0 1px 3px rgba(0,0,0,0.02)",
        borderColor: hovered ? "#cbd5e1" : "#e2e8f0",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <Avatar name={name} photo={employee.photo} size={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: "15px",
                color: "#1e293b",
                lineHeight: 1.3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "100%",
              }}
            >
              {name}
            </div>
            {crmLinked ? <span style={{ padding: "2px 7px", borderRadius: "999px", background: "#e0f2fe", color: "#0369a1", fontSize: "10px", fontWeight: 700 }}>QuadraSoft CRM</span> : null}
            {isDismissed ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  border: "1px solid #fecaca",
                  backgroundColor: "#fef2f2",
                  color: "#b91c1c",
                  fontSize: "11px",
                  fontWeight: 700,
                }}
              >
                Уволен
              </span>
            ) : null}
          </div>
          <div
            style={{
              fontSize: "13px",
              color: "#64748b",
              marginTop: "2px",
              lineHeight: 1.4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {positionLabel || "—"}
          </div>
          {isDismissed && dismissalDateLabel ? (
            <div
              style={{
                fontSize: "12px",
                color: "#94a3b8",
                marginTop: "4px",
                lineHeight: 1.4,
              }}
            >
              Дата увольнения: {dismissalDateLabel}
            </div>
          ) : null}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "4px",
          marginTop: "14px",
          borderTop: "1px solid #f1f5f9",
          paddingTop: "12px",
        }}
      >
        {employee.email && (
          <ContactIcon
            icon={<Mail style={{ width: "16px", height: "16px" }} />}
            href={`mailto:${employee.email}`}
            title={employee.email}
          />
        )}
        {employee.phone && (
          <ContactIcon
            icon={<Phone style={{ width: "16px", height: "16px" }} />}
            href={`tel:${employee.phone}`}
            title={employee.phone}
          />
        )}
      </div>
    </div>
  );
}
