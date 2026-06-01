import { useEffect, useMemo, useState } from "react";
import Select, {
  type InputActionMeta,
  type SingleValue,
  type StylesConfig,
} from "react-select";
import { type Employee, useEmployeesQuery } from "../../../api/services/employee.service";

export type AssigneeOption = { value: string; label: string };

interface AssigneeSelectProps {
  value: string | null;
  label?: string | null;
  onChange: (option: AssigneeOption | null) => void;
  placeholder?: string;
  isDisabled?: boolean;
  menuPortalTarget?: HTMLElement | null;
}

const PAGE_LIMIT = 20;

const resolveEmployeeLabel = (employee: Employee): string => {
  const fullName = [employee.second_name, employee.first_name, employee.middle_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return fullName || employee.email || employee.phone || employee.guid;
};

const selectStyles: StylesConfig<AssigneeOption, false> = {
  control: (base, state) => ({
    ...base,
    minHeight: "44px",
    borderRadius: "12px",
    borderColor: state.isFocused ? "#93c5fd" : "#e2e8f0",
    boxShadow: state.isFocused ? "0 0 0 3px rgba(59,130,246,0.12)" : "none",
    backgroundColor: state.isDisabled ? "#f8fafc" : "#fff",
    "&:hover": { borderColor: "#cbd5e1" },
  }),
  placeholder: (base) => ({ ...base, color: "#94a3b8", fontSize: "14px" }),
  singleValue: (base) => ({ ...base, fontSize: "14px", color: "#1e293b" }),
  input: (base) => ({ ...base, fontSize: "14px" }),
  menuPortal: (base) => ({ ...base, zIndex: 100000 }),
  option: (base, state) => ({
    ...base,
    fontSize: "14px",
    backgroundColor: state.isSelected ? "#2563eb" : state.isFocused ? "#eff6ff" : "#fff",
    color: state.isSelected ? "#fff" : "#1e293b",
  }),
};

export default function AssigneeSelect({
  value,
  label,
  onChange,
  placeholder = "Выберите сотрудника",
  isDisabled = false,
  menuPortalTarget,
}: AssigneeSelectProps) {
  const [inputValue, setInputValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [options, setOptions] = useState<AssigneeOption[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(inputValue.trim()), 350);
    return () => window.clearTimeout(timeoutId);
  }, [inputValue]);

  useEffect(() => {
    setOffset(0);
    setOptions([]);
    setTotalCount(0);
  }, [debouncedSearch]);

  const queryParams = useMemo(
    () => ({
      limit: PAGE_LIMIT,
      offset,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    }),
    [debouncedSearch, offset]
  );

  const { data, isLoading, isFetching } = useEmployeesQuery(queryParams);

  useEffect(() => {
    const incoming = ((data?.response || []) as Employee[]).map((employee) => ({
      value: employee.guid,
      label: resolveEmployeeLabel(employee),
    }));
    setTotalCount(Number(data?.count || 0));
    setOptions((prev) => {
      if (offset === 0) return incoming;
      const seen = new Set(prev.map((option) => option.value));
      return [...prev, ...incoming.filter((option) => !seen.has(option.value))];
    });
  }, [data, offset]);

  const fallbackOption = useMemo<AssigneeOption | null>(
    () => (value && label ? { value, label } : null),
    [value, label]
  );

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) || fallbackOption,
    [options, value, fallbackOption]
  );

  const hasMore = options.length < totalCount;

  const handleInputChange = (next: string, meta: InputActionMeta) => {
    if (meta.action === "input-change") setInputValue(next);
    return next;
  };

  return (
    <Select<AssigneeOption, false>
      options={options}
      value={selectedOption}
      onChange={(option: SingleValue<AssigneeOption>) => onChange(option ?? null)}
      onInputChange={handleInputChange}
      onMenuScrollToBottom={() => {
        if (!isFetching && hasMore) setOffset((prev) => prev + PAGE_LIMIT);
      }}
      placeholder={placeholder}
      isSearchable
      isClearable
      isDisabled={isDisabled}
      isLoading={isLoading || isFetching}
      styles={selectStyles}
      menuPortalTarget={menuPortalTarget ?? undefined}
      menuPosition="fixed"
      classNamePrefix="assignee-select"
      noOptionsMessage={() => (isLoading || isFetching ? "Загрузка..." : "Ничего не найдено")}
      loadingMessage={() => "Загрузка..."}
    />
  );
}
