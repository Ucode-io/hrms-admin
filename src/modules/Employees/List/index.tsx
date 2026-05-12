import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router";
import { Building2, LayoutGrid, List, Mail, Phone, SlidersHorizontal, Plus } from "lucide-react";
import Select from "react-select";
import { observer } from "mobx-react-lite";
import PageMeta from "../../../components/common/PageMeta";
import companyStore from "../../../store/company.store";
import { useEmployeesQuery, type Employee } from "../../../api/services/employee.service";
import EmployeesPaginationFooter from "./components/EmployeesPaginationFooter";
import ExpandableSearchInput from "../../../components/form/ExpandableSearchInput";
import OrganizationStructureModule from "../../Organization/Structure";

const PAGE_SIZE = 24;
const FILTER_SELECT_MAX_WIDTH = 260;

type PaginationItem = number | string;
type FilterOption = { value: string; label: string };

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
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list" | "org">("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [orgSearchQuery, setOrgSearchQuery] = useState("");
  const [orgFiltersOpen, setOrgFiltersOpen] = useState(false);
  const [orgActiveFiltersCount, setOrgActiveFiltersCount] = useState(0);
  const navigate = useNavigate();

  const brandColor = companyStore.mainColor;
  const selectPortalTarget = typeof document !== "undefined" ? document.body : null;

  const { data: apiData, isLoading } = useEmployeesQuery({
    limit: PAGE_SIZE,
    offset: (currentPage - 1) * PAGE_SIZE,
    search: searchQuery || undefined,
  });

  const employees: Employee[] = useMemo(() => {
    if (!apiData) return [];
    return (apiData.response || []) as Employee[];
  }, [apiData]);

  const totalCount = apiData?.count ?? employees.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const visibleFrom = totalCount > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const visibleTo = totalCount > 0 ? Math.min(currentPage * PAGE_SIZE, totalCount) : 0;

  const visibleRangeLabel = totalCount > 0
    ? `Отображение ${visibleFrom} - ${visibleTo} из ${totalCount}`
    : "Нет данных";
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
      return true;
    });
  }, [employees, departmentFilter, employmentTypeFilter, locationFilter, positionFilter]);

  const activeFiltersCount = [
    departmentFilter,
    employmentTypeFilter,
    locationFilter,
    positionFilter,
  ].filter(Boolean).length;
  const isFilterButtonActive = isOrgView
    ? orgFiltersOpen || orgActiveFiltersCount > 0
    : isFiltersOpen || activeFiltersCount > 0;

  const filterSelectStyles = useMemo(
    () => ({
      control: (base: any, state: any) => ({
        ...base,
        minHeight: 38,
        borderRadius: 10,
        backgroundColor: state.hasValue ? "#eff6ff" : "#fff",
        borderColor: state.hasValue ? "#bfdbfe" : state.isFocused ? "#cbd5e1" : "#dbe2ea",
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
        color: state.hasValue ? "#2563eb" : "#64748b",
      }),
      dropdownIndicator: (base: any, state: any) => ({
        ...base,
        color: state.hasValue ? "#2563eb" : "#64748b",
        padding: 6,
        "&:hover": {
          color: state.hasValue ? "#1d4ed8" : "#475569",
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
        color: state.hasValue ? "#2563eb" : "#334155",
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
        backgroundColor: state.isSelected ? "#dbeafe" : state.isFocused ? "#f8fafc" : "#fff",
        color: state.isSelected ? "#1d4ed8" : "#1e293b",
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
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "3px",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              backgroundColor: "#f8fafc",
              height: "38px",
            }}
          >
            <button
              id="employees-view-list"
              onClick={() => setViewMode("list")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                height: "30px",
                padding: "0 12px",
                border: viewMode === "list" ? "1px solid #dbeafe" : "1px solid transparent",
                borderRadius: "8px",
                backgroundColor: viewMode === "list" ? "#fff" : "transparent",
                color: viewMode === "list" ? "#2563eb" : "#64748b",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
                transition: "all 0.2s",
                boxShadow: viewMode === "list" ? "0 1px 2px rgba(15, 23, 42, 0.06)" : "none",
              }}
            >
              <List style={{ width: "17px", height: "17px" }} />
              Таблица
            </button>

            <button
              id="employees-view-grid"
              onClick={() => setViewMode("grid")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                height: "30px",
                padding: "0 12px",
                border: viewMode === "grid" ? "1px solid #dbeafe" : "1px solid transparent",
                borderRadius: "8px",
                backgroundColor: viewMode === "grid" ? "#fff" : "transparent",
                color: viewMode === "grid" ? "#2563eb" : "#64748b",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
                transition: "all 0.2s",
                boxShadow: viewMode === "grid" ? "0 1px 2px rgba(15, 23, 42, 0.06)" : "none",
              }}
            >
              <LayoutGrid style={{ width: "17px", height: "17px" }} />
              Сетка
            </button>

            <button
              id="employees-view-org-structure"
              onClick={() => setViewMode("org")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                height: "30px",
                padding: "0 12px",
                border: viewMode === "org" ? "1px solid #dbeafe" : "1px solid transparent",
                borderRadius: "8px",
                backgroundColor: viewMode === "org" ? "#fff" : "transparent",
                color: viewMode === "org" ? "#2563eb" : "#64748b",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
                transition: "all 0.2s",
                boxShadow: viewMode === "org" ? "0 1px 2px rgba(15, 23, 42, 0.06)" : "none",
              }}
            >
              <Building2 style={{ width: "17px", height: "17px" }} />
              Орг структура
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "auto", flexWrap: "nowrap", justifyContent: "flex-end" }}>
            <ExpandableSearchInput
              value={isOrgView ? orgSearchQuery : searchQuery}
              onChange={(value) => {
                if (isOrgView) {
                  setOrgSearchQuery(value);
                  return;
                }
                setSearchQuery(value);
                setCurrentPage(1);
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
              id="employees-filter-btn"
              type="button"
              onClick={() => {
                if (isOrgView) {
                  setOrgFiltersOpen((open) => !open);
                  return;
                }
                setIsFiltersOpen((open) => !open);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                fontSize: "14px",
                fontWeight: 500,
                color: isFilterButtonActive ? "#2563eb" : "#1e293b",
                backgroundColor: isFilterButtonActive ? "#eff6ff" : "#fff",
                border: isFilterButtonActive
                  ? "1px solid #bfdbfe"
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
              Фильтр
              {(isOrgView ? orgActiveFiltersCount : activeFiltersCount) > 0
                ? ` (${isOrgView ? orgActiveFiltersCount : activeFiltersCount})`
                : ""}
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
                    setDepartmentFilter(option?.value || "");
                    setCurrentPage(1);
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
                    setEmploymentTypeFilter(option?.value || "");
                    setCurrentPage(1);
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
                    setLocationFilter(option?.value || "");
                    setCurrentPage(1);
                  }}
                  options={locationOptions}
                  placeholder="Локация"
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
                    setPositionFilter(option?.value || "");
                    setCurrentPage(1);
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

              {activeFiltersCount > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setDepartmentFilter("");
                    setEmploymentTypeFilter("");
                    setLocationFilter("");
                    setPositionFilter("");
                    setCurrentPage(1);
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "38px",
                    padding: "0 12px",
                    borderRadius: "10px",
                    border: "1px solid #bfdbfe",
                    backgroundColor: "#eff6ff",
                    color: "#2563eb",
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
          ) : isLoading ? (
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
                    {["", "Имя", "Должность", "Отдел", "Локация", "Email", "Телефон"].map(
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

      {viewMode !== "org" ? (
        <EmployeesPaginationFooter
          visibleRangeLabel={visibleRangeLabel}
          paginationItems={paginationItems}
          currentPage={currentPage}
          totalPages={totalPages}
          brandColor={brandColor}
          onPrevious={() => setCurrentPage((page) => Math.max(1, page - 1))}
          onNext={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
          onPageChange={(page) => setCurrentPage(page)}
        />
      ) : null}
    </>
  );
}

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
        backgroundColor: "#dbeafe",
        color: "#3b82f6",
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
  onClick,
}: {
  employee: Employee;
  name: string;
  position: string;
  department: string;
  location: string;
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
