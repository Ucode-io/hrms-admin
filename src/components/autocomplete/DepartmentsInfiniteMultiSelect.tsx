import { useEffect, useMemo, useState } from "react";
import Select, {
  type InputActionMeta,
  type MultiValue,
  type StylesConfig,
} from "react-select";
import {
  type Department,
  useDepartmentsSettingsQuery,
} from "../../api/services/department.service";
import { useTranslation } from "../../i18n";

export type DepartmentOption = {
  value: string;
  label: string;
};

interface DepartmentsInfiniteMultiSelectProps {
  value: DepartmentOption[];
  onChange: (value: DepartmentOption[]) => void;
  placeholder?: string;
  menuPortalTarget?: HTMLElement;
  styles?: StylesConfig<DepartmentOption, true>;
}

const PAGE_LIMIT = 20;

const defaultStyles: StylesConfig<DepartmentOption, true> = {
  control: (base, state) => ({
    ...base,
    minHeight: "44px",
    borderColor: state.isFocused ? "var(--color-brand-500, #465fff)" : "#d1d5db",
    borderRadius: "0.5rem",
    boxShadow: state.isFocused
      ? "0 0 0 3px rgba(var(--company-color-rgb, 70, 95, 255), 0.12)"
      : "none",
    "&:hover": {
      borderColor: state.isFocused ? "var(--color-brand-500, #465fff)" : "#9ca3af",
    },
  }),
  valueContainer: (base) => ({ ...base, padding: "2px 8px", fontSize: "14px" }),
  input: (base) => ({ ...base, margin: 0, padding: 0, fontSize: "14px" }),
  placeholder: (base) => ({ ...base, fontSize: "14px", color: "#9ca3af" }),
  multiValue: (base) => ({ ...base, backgroundColor: "#f1f5f9", borderRadius: "9999px" }),
  multiValueLabel: (base) => ({ ...base, fontSize: "13px", color: "#334155" }),
  option: (base, state) => ({
    ...base,
    fontSize: "14px",
    cursor: "pointer",
    backgroundColor: state.isSelected
      ? "var(--color-brand-500, #465fff)"
      : state.isFocused
      ? "#f3f4f6"
      : "white",
    color: state.isSelected ? "white" : "#111827",
    padding: "8px 12px",
  }),
  menu: (base) => ({ ...base, zIndex: 100000, borderRadius: "0.5rem", border: "1px solid #e5e7eb" }),
  menuPortal: (base) => ({ ...base, zIndex: 100000 }),
};

const mergeUnique = (base: DepartmentOption[], incoming: DepartmentOption[]) => {
  const seen = new Set<string>();
  return [...base, ...incoming].filter((option) => {
    if (seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
};

export default function DepartmentsInfiniteMultiSelect({
  value,
  onChange,
  placeholder,
  menuPortalTarget,
  styles,
}: DepartmentsInfiniteMultiSelectProps) {
  const { t } = useTranslation();
  placeholder ??= t("autocomplete.select_departments");
  const [inputValue, setInputValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [options, setOptions] = useState<DepartmentOption[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(inputValue.trim());
    }, 350);
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

  const { data, isLoading, isFetching } = useDepartmentsSettingsQuery({ params: queryParams });

  useEffect(() => {
    const response = ((data?.response || []) as Department[]).map((item) => ({
      value: item.guid,
      label: String(item.title || t("common.untitled")),
    }));
    setTotalCount(Number(data?.count || 0));
    setOptions((prev) => (offset === 0 ? response : mergeUnique(prev, response)));
  }, [data, offset, t]);

  const hasMore = options.length < totalCount;

  const handleScrollToBottom = () => {
    if (isFetching || !hasMore) return;
    setOffset((prev) => prev + PAGE_LIMIT);
  };

  const handleChange = (selected: MultiValue<DepartmentOption>) => {
    onChange(selected.map((option) => ({ value: option.value, label: option.label })));
  };

  const handleInputChange = (next: string, actionMeta: InputActionMeta) => {
    if (actionMeta.action === "input-change") setInputValue(next);
    return next;
  };

  return (
    <Select
      options={options}
      value={value}
      onChange={handleChange}
      onInputChange={handleInputChange}
      onMenuScrollToBottom={handleScrollToBottom}
      placeholder={placeholder}
      isSearchable
      isMulti
      closeMenuOnSelect={false}
      isLoading={isLoading || isFetching}
      styles={styles || defaultStyles}
      menuPortalTarget={menuPortalTarget}
      menuPosition="fixed"
      classNamePrefix="departments-infinite-multi-select"
      noOptionsMessage={() => (isLoading || isFetching ? t("common.loading") : t("common.no_options_found"))}
      loadingMessage={() => t("common.loading")}
    />
  );
}
