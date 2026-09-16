import { useEffect, useMemo, useState } from "react";
import Select, { type InputActionMeta, type MultiValue, type StylesConfig } from "react-select";
import { type Location, useLocationsQuery } from "../../api/services/location.service";

type Option = { value: string; label: string };
const PAGE_SIZE = 20;

export default function LocationsInfiniteMultiSelect({ value, onChange, menuPortalTarget, styles, placeholder = "Выберите филиалы" }: { value: Option[]; onChange: (value: Option[]) => void; menuPortalTarget?: HTMLElement; styles?: StylesConfig<Option, true>; placeholder?: string }) {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [options, setOptions] = useState<Option[]>([]);
  const [count, setCount] = useState(0);
  useEffect(() => { const timer = window.setTimeout(() => setSearch(input.trim()), 300); return () => clearTimeout(timer); }, [input]);
  useEffect(() => { setOffset(0); setOptions([]); setCount(0); }, [search]);
  const params = useMemo(() => ({ limit: PAGE_SIZE, offset, ...(search ? { search } : {}) }), [offset, search]);
  const { data, isLoading, isFetching } = useLocationsQuery({ params });
  useEffect(() => {
    const next = ((data?.response || []) as Location[]).map(item => ({ value: item.guid, label: item.title || "Без названия" }));
    setCount(Number(data?.count || 0));
    setOptions(previous => offset === 0 ? next : [...new Map([...previous, ...next].map(item => [item.value, item])).values()]);
  }, [data, offset]);
  const handleInputChange = (next: string, action: InputActionMeta) => { if (action.action === "input-change") setInput(next); return next; };
  return <Select<Option, true>
    options={options} value={value}
    onChange={(selected: MultiValue<Option>) => onChange(selected.map(item => ({ value: item.value, label: item.label })))}
    onInputChange={handleInputChange}
    onMenuScrollToBottom={() => { if (!isFetching && options.length < count) setOffset(previous => previous + PAGE_SIZE); }}
    isMulti isSearchable closeMenuOnSelect={false} isLoading={isLoading || isFetching}
    placeholder={placeholder} noOptionsMessage={() => isFetching ? "Загрузка..." : "Ничего не найдено"}
    menuPortalTarget={menuPortalTarget} menuPosition="fixed"
    styles={styles || { control: (base, state) => ({ ...base, minHeight: 44, borderRadius: 10, borderColor: state.isFocused ? "#465fff" : "#e5e7eb", boxShadow: state.isFocused ? "0 0 0 3px rgba(70,95,255,.1)" : "none" }), menuPortal: base => ({ ...base, zIndex: 100000 }), menu: base => ({ ...base, zIndex: 100000 }) }}
  />;
}
