import { useEffect, useMemo, useRef, useState } from "react";
import Select, {
  type InputActionMeta,
  type MultiValue,
  type StylesConfig,
} from "react-select";
import { type Employee, useEmployeesQuery } from "../../api/services/employee.service";

type Option = {
  value: string;
  label: string;
};

interface EmployeesInfiniteMultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  fallbackOptions?: Option[];
  placeholder?: string;
  styles?: StylesConfig<Option, true>;
  menuPortalTarget?: HTMLElement;
  classNamePrefix?: string;
  /** Limit options to employees holding this position (guid). */
  positionsId?: string;
  isDisabled?: boolean;
}

const PAGE_LIMIT = 20;

const getStringValue = (value: unknown): string => (typeof value === "string" ? value : "");

export const resolveEmployeeFullName = (employee: Employee): string => {
  const fullName = [
    getStringValue(employee.second_name),
    getStringValue(employee.first_name),
    getStringValue(employee.middle_name),
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (fullName) return fullName;
  return getStringValue(employee.email) || getStringValue(employee.phone) || employee.guid;
};

const mergeUniqueOptions = (base: Option[], incoming: Option[]): Option[] => {
  const seen = new Set<string>();
  const merged = [...base, ...incoming].filter((option) => {
    if (seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });

  return merged;
};

export default function EmployeesInfiniteMultiSelect({
  value,
  onChange,
  fallbackOptions = [],
  placeholder = "Выберите сотрудников",
  styles,
  menuPortalTarget,
  classNamePrefix = "employees-infinite-multi-select",
  positionsId,
  isDisabled = false,
}: EmployeesInfiniteMultiSelectProps) {
  const [inputValue, setInputValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [options, setOptions] = useState<Option[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  // Labels of every option ever loaded, so selected chips keep their names
  // after the option list is replaced by a new search/filter.
  const seenLabelsRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(inputValue.trim());
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [inputValue]);

  useEffect(() => {
    setOffset(0);
    setOptions([]);
    setTotalCount(0);
  }, [debouncedSearch, positionsId]);

  const queryParams = useMemo(
    () => ({
      limit: PAGE_LIMIT,
      offset,
      status: "active" as const,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(positionsId ? { positions_id: [positionsId] } : {}),
      enabled: !isDisabled,
    }),
    [debouncedSearch, offset, positionsId, isDisabled]
  );

  const { data, isLoading, isFetching } = useEmployeesQuery(queryParams);

  useEffect(() => {
    const response = ((data?.response || []) as Employee[]).map((item) => ({
      value: item.guid,
      label: resolveEmployeeFullName(item),
    }));

    for (const option of response) {
      seenLabelsRef.current.set(option.value, option.label);
    }

    setTotalCount(Number(data?.count || 0));
    setOptions((prev) => (offset === 0 ? response : mergeUniqueOptions(prev, response)));
  }, [data, offset]);

  const selectedOptions = useMemo(() => {
    const byId = new Map<string, Option>();

    for (const option of fallbackOptions) {
      byId.set(option.value, option);
    }
    for (const [id, label] of seenLabelsRef.current) {
      byId.set(id, { value: id, label });
    }
    for (const option of options) {
      byId.set(option.value, option);
    }

    return value.map((id) => byId.get(id) || { value: id, label: id });
  }, [fallbackOptions, options, value]);

  const hasMore = options.length < totalCount;

  const handleScrollToBottom = () => {
    if (isFetching || !hasMore) {
      return;
    }

    setOffset((prev) => prev + PAGE_LIMIT);
  };

  const handleChange = (selected: MultiValue<Option>) => {
    onChange(selected.map((option) => option.value));
  };

  const handleInputChange = (nextInputValue: string, actionMeta: InputActionMeta) => {
    if (actionMeta.action === "input-change") {
      setInputValue(nextInputValue);
    }

    return nextInputValue;
  };

  return (
    <Select
      options={options}
      value={selectedOptions}
      onChange={handleChange}
      onInputChange={handleInputChange}
      onMenuScrollToBottom={handleScrollToBottom}
      placeholder={placeholder}
      isSearchable
      isMulti
      isDisabled={isDisabled}
      closeMenuOnSelect={false}
      isLoading={!isDisabled && (isLoading || isFetching)}
      styles={styles}
      menuPortalTarget={menuPortalTarget}
      menuPosition="fixed"
      classNamePrefix={classNamePrefix}
      noOptionsMessage={() => (isLoading || isFetching ? "Загрузка..." : "Ничего не найдено")}
      loadingMessage={() => "Загрузка..."}
    />
  );
}
