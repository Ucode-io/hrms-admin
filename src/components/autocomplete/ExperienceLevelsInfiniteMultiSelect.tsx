import { useEffect, useMemo, useState } from "react";
import Select, {
  type InputActionMeta,
  type MultiValue,
  type StylesConfig,
} from "react-select";
import {
  type ExperienceLevel,
  useExperienceLevelsQuery,
} from "../../api/services/experienceLevel.service";
import { useTranslation, translate } from "../../i18n";

type Option = {
  value: string;
  label: string;
};

interface ExperienceLevelsInfiniteMultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  fallbackOptions?: Option[];
  placeholder?: string;
  styles?: StylesConfig<Option, true>;
  menuPortalTarget?: HTMLElement;
  classNamePrefix?: string;
}

const PAGE_LIMIT = 20;

const resolveExperienceLevelLabel = (item: ExperienceLevel): string =>
  String(item.title || translate("common.untitled"));

const mergeUniqueOptions = (base: Option[], incoming: Option[]): Option[] => {
  const seen = new Set<string>();
  const merged = [...base, ...incoming].filter((option) => {
    if (seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });

  return merged;
};

export default function ExperienceLevelsInfiniteMultiSelect({
  value,
  onChange,
  fallbackOptions = [],
  placeholder,
  styles,
  menuPortalTarget,
  classNamePrefix = "experience-levels-infinite-multi-select",
}: ExperienceLevelsInfiniteMultiSelectProps) {
  const { t } = useTranslation();
  placeholder ??= t("autocomplete.select_experience_levels");
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

  const { data, isLoading, isFetching } = useExperienceLevelsQuery({ params: queryParams });

  useEffect(() => {
    const response = ((data?.response || []) as ExperienceLevel[]).map((item) => ({
      value: item.guid,
      label: resolveExperienceLevelLabel(item),
    }));

    setTotalCount(Number(data?.count || 0));
    setOptions((prev) => (offset === 0 ? response : mergeUniqueOptions(prev, response)));
  }, [data, offset]);

  const selectedOptions = useMemo(() => {
    const byId = new Map<string, Option>();

    for (const option of fallbackOptions) {
      byId.set(option.value, option);
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
      closeMenuOnSelect={false}
      isLoading={isLoading || isFetching}
      styles={styles}
      menuPortalTarget={menuPortalTarget}
      menuPosition="fixed"
      classNamePrefix={classNamePrefix}
      noOptionsMessage={() => (isLoading || isFetching ? t("common.loading") : t("common.no_options_found"))}
      loadingMessage={() => t("common.loading")}
    />
  );
}
