import { useEffect, useMemo, useState } from "react";
import Select, { type InputActionMeta, type SingleValue, type StylesConfig } from "react-select";
import { type Employee, useEmployeesQuery } from "../../api/services/employee.service";

type Option = {
  value: string;
  label: string;
};

interface EmployeeInfiniteSelectProps {
  value: string;
  onChange: (value: string) => void;
  fallbackLabel?: string;
  placeholder?: string;
  styles?: StylesConfig<Option, false>;
  menuPortalTarget?: HTMLElement;
  classNamePrefix?: string;
}

const PAGE_LIMIT = 20;

const getStringValue = (value: unknown): string => (typeof value === "string" ? value : "");

const resolveEmployeeLabel = (employee: Employee): string => {
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

export default function EmployeeInfiniteSelect({
  value,
  onChange,
  fallbackLabel,
  placeholder = "Выберите сотрудника",
  styles,
  menuPortalTarget,
  classNamePrefix = "employee-infinite-select",
}: EmployeeInfiniteSelectProps) {
  const [inputValue, setInputValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [options, setOptions] = useState<Option[]>([]);
  const [totalCount, setTotalCount] = useState(0);

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
    const response = ((data?.response || []) as Employee[]).map((employee) => ({
      value: employee.guid,
      label: resolveEmployeeLabel(employee),
    }));

    setTotalCount(Number(data?.count || 0));
    setOptions((prev) => (offset === 0 ? response : mergeUniqueOptions(prev, response)));
  }, [data, offset]);

  const fallbackOption = useMemo(() => {
    if (!value || !fallbackLabel) return null;
    return { value, label: fallbackLabel };
  }, [fallbackLabel, value]);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) || fallbackOption,
    [fallbackOption, options, value]
  );

  const hasMore = options.length < totalCount;

  const handleScrollToBottom = () => {
    if (isFetching || !hasMore) {
      return;
    }

    setOffset((prev) => prev + PAGE_LIMIT);
  };

  const handleChange = (option: SingleValue<Option>) => {
    onChange(option?.value || "");
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
      value={selectedOption}
      onChange={handleChange}
      onInputChange={handleInputChange}
      onMenuScrollToBottom={handleScrollToBottom}
      placeholder={placeholder}
      isSearchable
      isClearable
      isLoading={isLoading || isFetching}
      styles={styles}
      menuPortalTarget={menuPortalTarget}
      menuPosition="fixed"
      classNamePrefix={classNamePrefix}
      noOptionsMessage={() => (isLoading || isFetching ? "Загрузка..." : "Ничего не найдено")}
      loadingMessage={() => "Загрузка..."}
    />
  );
}
