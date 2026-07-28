import Select, { type StylesConfig } from "react-select";

export interface FormSelectOption {
  value: string;
  label: string;
}

interface FormSelectProps {
  options: FormSelectOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  isSearchable?: boolean;
  isClearable?: boolean;
  isDisabled?: boolean;
  /** Render inside a portal — use inside scrollable/overflow containers. */
  menuPortal?: boolean;
}

const styles: StylesConfig<FormSelectOption, false> = {
  control: (base, state) => ({
    ...base,
    minHeight: "44px",
    borderRadius: "0.75rem",
    borderColor: state.isFocused ? "#93c5fd" : "#e2e8f0",
    boxShadow: state.isFocused ? "0 0 0 2px var(--color-brand-100)" : "none",
    "&:hover": { borderColor: state.isFocused ? "#93c5fd" : "#cbd5e1" },
  }),
  valueContainer: (base) => ({ ...base, padding: "0 12px", fontSize: "14px" }),
  input: (base) => ({ ...base, margin: 0, padding: 0, fontSize: "14px" }),
  singleValue: (base) => ({ ...base, fontSize: "14px", color: "#1e293b" }),
  placeholder: (base) => ({ ...base, fontSize: "14px", color: "#94a3b8" }),
  option: (base, state) => ({
    ...base,
    fontSize: "14px",
    cursor: "pointer",
    backgroundColor: state.isSelected ? "var(--color-brand-50)" : state.isFocused ? "#f8fafc" : "#fff",
    color: state.isSelected ? "var(--color-brand-700)" : "#334155",
  }),
  menu: (base) => ({
    ...base,
    zIndex: 120100,
    borderRadius: "0.75rem",
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
    overflow: "hidden",
  }),
  menuPortal: (base) => ({ ...base, zIndex: 120100 }),
};

export default function FormSelect({
  options,
  value,
  onChange,
  placeholder = "Выберите...",
  isSearchable = true,
  isClearable = false,
  isDisabled = false,
  menuPortal = false,
}: FormSelectProps) {
  const selected = options.find((o) => o.value === value) ?? null;
  return (
    <Select<FormSelectOption, false>
      options={options}
      value={selected}
      onChange={(opt) => onChange(opt?.value ?? "")}
      placeholder={placeholder}
      isSearchable={isSearchable}
      isClearable={isClearable}
      isDisabled={isDisabled}
      noOptionsMessage={() => "Ничего не найдено"}
      styles={styles}
      classNamePrefix="recruiting-select"
      menuPortalTarget={menuPortal && typeof document !== "undefined" ? document.body : undefined}
      menuPosition={menuPortal ? "fixed" : "absolute"}
    />
  );
}
