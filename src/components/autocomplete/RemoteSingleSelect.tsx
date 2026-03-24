import { useEffect, useMemo, useState } from "react";
import Select, {
  type InputActionMeta,
  type SingleValue,
  type StylesConfig,
} from "react-select";

export type RemoteSelectOption = {
  value: string;
  label: string;
};

type RemoteSingleSelectResponse = {
  count: number;
  options: RemoteSelectOption[];
};

interface RemoteSingleSelectProps {
  value: string;
  onChange: (value: string) => void;
  loadOptions: (params: {
    search: string;
    limit: number;
    offset: number;
  }) => Promise<RemoteSingleSelectResponse>;
  fallbackOption?: RemoteSelectOption | null;
  placeholder?: string;
  disabled?: boolean;
  classNamePrefix?: string;
  menuPortalTarget?: HTMLElement;
}

const PAGE_LIMIT = 20;

const mergeUniqueOptions = (
  base: RemoteSelectOption[],
  incoming: RemoteSelectOption[]
): RemoteSelectOption[] => {
  const byValue = new Map<string, RemoteSelectOption>();

  for (const option of [...base, ...incoming]) {
    byValue.set(option.value, option);
  }

  return Array.from(byValue.values());
};

const selectStyles: StylesConfig<RemoteSelectOption, false> = {
  control: (base, state) => ({
    ...base,
    minHeight: "40px",
    borderColor: state.isFocused ? "#cbd5e1" : "#e2e8f0",
    borderRadius: "0.5rem",
    boxShadow: "none",
    "&:hover": {
      borderColor: "#cbd5e1",
    },
  }),
  valueContainer: (base) => ({ ...base, padding: "0 12px", fontSize: "13px" }),
  input: (base) => ({ ...base, margin: 0, padding: 0, fontSize: "13px" }),
  singleValue: (base) => ({ ...base, fontSize: "13px", color: "#0f172a" }),
  placeholder: (base) => ({ ...base, fontSize: "13px", color: "#94a3b8" }),
  option: (base, state) => ({
    ...base,
    fontSize: "13px",
    cursor: "pointer",
    backgroundColor: state.isSelected ? "#eff6ff" : state.isFocused ? "#f8fafc" : "#fff",
    color: state.isSelected ? "#0f172a" : "#334155",
  }),
  menu: (base) => ({
    ...base,
    zIndex: 120100,
    borderRadius: "0.75rem",
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
    overflow: "hidden",
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 120100,
  }),
};

export default function RemoteSingleSelect({
  value,
  onChange,
  loadOptions,
  fallbackOption,
  placeholder = "Выберите...",
  disabled = false,
  classNamePrefix = "remote-single-select",
  menuPortalTarget,
}: RemoteSingleSelectProps) {
  const [inputValue, setInputValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [options, setOptions] = useState<RemoteSelectOption[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(inputValue.trim());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [inputValue]);

  useEffect(() => {
    setOffset(0);
    setOptions([]);
    setTotalCount(0);
  }, [debouncedSearch]);

  useEffect(() => {
    let isMounted = true;

    const fetchOptions = async () => {
      setIsLoading(true);

      try {
        const res = await loadOptions({
          search: debouncedSearch,
          limit: PAGE_LIMIT,
          offset,
        });

        if (!isMounted) return;

        const nextOptions = Array.isArray(res.options) ? res.options : [];
        setTotalCount(Number(res.count || 0));
        setOptions((prev) =>
          offset === 0 ? nextOptions : mergeUniqueOptions(prev, nextOptions)
        );
      } catch {
        if (!isMounted) return;
        setTotalCount(0);
        setOptions((prev) => (offset === 0 ? [] : prev));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void fetchOptions();

    return () => {
      isMounted = false;
    };
  }, [debouncedSearch, loadOptions, offset]);

  const selectedOption = useMemo(() => {
    const byValue = new Map<string, RemoteSelectOption>();
    if (fallbackOption?.value) {
      byValue.set(fallbackOption.value, fallbackOption);
    }
    for (const option of options) {
      byValue.set(option.value, option);
    }

    return byValue.get(value) || null;
  }, [fallbackOption, options, value]);

  const hasMore = options.length < totalCount;

  const handleChange = (selected: SingleValue<RemoteSelectOption>) => {
    onChange(selected?.value || "");
  };

  const handleInputChange = (nextInputValue: string, actionMeta: InputActionMeta) => {
    if (actionMeta.action === "input-change") {
      setInputValue(nextInputValue);
    }

    if (actionMeta.action === "menu-close") {
      setInputValue("");
    }

    return nextInputValue;
  };

  return (
    <Select
      options={options}
      value={selectedOption}
      onChange={handleChange}
      onInputChange={handleInputChange}
      onMenuScrollToBottom={() => {
        if (!isLoading && hasMore) {
          setOffset((prev) => prev + PAGE_LIMIT);
        }
      }}
      isSearchable
      isClearable
      isDisabled={disabled}
      isLoading={isLoading}
      placeholder={placeholder}
      noOptionsMessage={() => (isLoading ? "Загрузка..." : "Ничего не найдено")}
      loadingMessage={() => "Загрузка..."}
      filterOption={null}
      styles={selectStyles}
      classNamePrefix={classNamePrefix}
      menuPortalTarget={menuPortalTarget}
      menuPosition="fixed"
    />
  );
}
