import type { StylesConfig } from "react-select";
import type { Department } from "../../../api/services/department.service";
import type { Option } from "./types";

const getStringValue = (value: unknown): string => (typeof value === "string" ? value : "");

export const resolveEmployeesCount = (department: Department): number => {
  if (typeof department.employees_count === "number") return department.employees_count;
  if (typeof department.employee_count === "number") return department.employee_count;
  if (Array.isArray(department.employees)) return department.employees.length;
  return 0;
};

export const resolveDepartmentLeaderName = (department: Department): string => {
  const relationData = department.user_base_id_data;
  if (relationData && typeof relationData === "object") {
    const relation = relationData as Record<string, unknown>;
    const leaderName = [
      getStringValue(relation.second_name),
      getStringValue(relation.first_name),
      getStringValue(relation.middle_name),
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    if (leaderName) return leaderName;
    return getStringValue(relation.email) || getStringValue(relation.phone) || "—";
  }

  return "—";
};

export const getDepartmentSelectStyles = (): StylesConfig<Option, false> => ({
  control: (base, state) => ({
    ...base,
    minHeight: "36px",
    height: "36px",
    borderColor: state.isFocused ? "var(--color-brand-500)" : "#d1d5db",
    borderRadius: "0.5rem",
    boxShadow: state.isFocused ? "0 0 0 3px rgba(var(--company-color-rgb, 70, 95, 255), 0.12)" : "none",
    "&:hover": {
      borderColor: state.isFocused ? "var(--color-brand-500)" : "#9ca3af",
    },
  }),
  valueContainer: (base) => ({ ...base, padding: "0 10px", fontSize: "14px" }),
  input: (base) => ({ ...base, margin: 0, padding: 0, fontSize: "14px" }),
  indicatorsContainer: (base) => ({ ...base, height: "34px" }),
  option: (base, state) => ({
    ...base,
    fontSize: "14px",
    cursor: "pointer",
    backgroundColor: state.isSelected ? "var(--color-brand-500)" : state.isFocused ? "#f3f4f6" : "white",
    color: state.isSelected ? "white" : "#111827",
    padding: "8px 10px",
  }),
  menu: (base) => ({
    ...base,
    zIndex: 100000,
    borderRadius: "0.5rem",
    border: "1px solid #e5e7eb",
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 100000,
  }),
  singleValue: (base) => ({ ...base, fontSize: "14px" }),
  placeholder: (base) => ({ ...base, fontSize: "14px", color: "#9ca3af" }),
});

export const getDepartmentExperienceLevelsSelectStyles = (): StylesConfig<Option, true> => ({
  control: (base, state) => ({
    ...base,
    minHeight: "36px",
    borderColor: state.isFocused ? "var(--color-brand-500)" : "#d1d5db",
    borderRadius: "0.5rem",
    boxShadow: state.isFocused ? "0 0 0 3px rgba(var(--company-color-rgb, 70, 95, 255), 0.12)" : "none",
    "&:hover": {
      borderColor: state.isFocused ? "var(--color-brand-500)" : "#9ca3af",
    },
  }),
  valueContainer: (base) => ({ ...base, padding: "2px 10px", gap: "4px", fontSize: "14px" }),
  input: (base) => ({ ...base, margin: 0, padding: 0, fontSize: "14px" }),
  option: (base, state) => ({
    ...base,
    fontSize: "14px",
    cursor: "pointer",
    backgroundColor: state.isSelected ? "var(--color-brand-500)" : state.isFocused ? "#f3f4f6" : "white",
    color: state.isSelected ? "white" : "#111827",
    padding: "8px 10px",
  }),
  menu: (base) => ({
    ...base,
    zIndex: 100000,
    borderRadius: "0.5rem",
    border: "1px solid #e5e7eb",
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 100000,
  }),
  multiValue: (base) => ({
    ...base,
    borderRadius: "0.5rem",
    backgroundColor: "#eef2ff",
  }),
  multiValueLabel: (base) => ({
    ...base,
    fontSize: "12px",
    color: "#3730a3",
  }),
  multiValueRemove: (base) => ({
    ...base,
    color: "#3730a3",
    ":hover": {
      backgroundColor: "#dbe4ff",
      color: "#1e1b4b",
    },
  }),
  placeholder: (base) => ({ ...base, fontSize: "14px", color: "#9ca3af" }),
});
