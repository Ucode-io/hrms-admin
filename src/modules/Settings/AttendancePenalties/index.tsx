import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarX2,
  Check,
  Clock3,
  ChevronDown,
  Info,
  LogOut,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import Select, { type StylesConfig } from "react-select";
import PageMeta from "../../../components/common/PageMeta";
import authStore from "../../../store/auth.store";
import EmployeesInfiniteMultiSelect from "../../../components/autocomplete/EmployeesInfiniteMultiSelect";
import DepartmentsInfiniteMultiSelect, { type DepartmentOption } from "../../../components/autocomplete/DepartmentsInfiniteMultiSelect";
import LocationsInfiniteMultiSelect from "../../../components/autocomplete/LocationsInfiniteMultiSelect";
import { useCompanySettingsQuery, useCurrenciesQuery } from "../../../api/services/companySettings.service";
import reportsService from "../../../api/services/reports.service";

type TimedPenaltyType = "late" | "early_leave";
type FixedPenaltyType = "missing_checkout" | "absence";

type PenaltyRule = {
  id: string;
  thresholdMinutes: number;
  amount: number;
};

type TimedPenaltyConfig = {
  enabled: boolean;
  rules: PenaltyRule[];
};

type FixedPenaltyConfig = {
  enabled: boolean;
  amount: number;
};

export type AttendancePenaltySettings = {
  version: 2;
  enabled: boolean;
  applyTo: "all" | "departments" | "employees" | "locations";
  employeeIds: string[];
  departmentOptions: Array<{ value: string; label: string }>;
  locationOptions: Array<{ value: string; label: string }>;
  late: TimedPenaltyConfig;
  early_leave: TimedPenaltyConfig;
  missing_checkout: FixedPenaltyConfig;
  absence: FixedPenaltyConfig;
};

const PRESETS = [5, 10, 15, 30, 60, 120];

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `rule-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const defaultSettings = (): AttendancePenaltySettings => ({
  version: 2,
  enabled: true,
  applyTo: "all",
  employeeIds: [],
  departmentOptions: [],
  locationOptions: [],
  late: {
    enabled: true,
    rules: [
      { id: createId(), thresholdMinutes: 15, amount: 15_000 },
      { id: createId(), thresholdMinutes: 30, amount: 30_000 },
      { id: createId(), thresholdMinutes: 60, amount: 60_000 },
    ],
  },
  early_leave: {
    enabled: true,
    rules: [
      { id: createId(), thresholdMinutes: 15, amount: 15_000 },
      { id: createId(), thresholdMinutes: 30, amount: 30_000 },
    ],
  },
  missing_checkout: { enabled: true, amount: 20_000 },
  absence: { enabled: true, amount: 100_000 },
});

const formatMoney = (value: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.max(0, value));

const formatDuration = (minutes: number) => {
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
};

const parseAmount = (value: string) => {
  const parsed = Number(value.replace(/\D/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const getStorageKey = () =>
  `hrms:attendance-penalties:${authStore.companyId || authStore.user_data?.companies_id || "local"}`;

type SelectOption = { value: string; label: string };
const createCompactSelectStyles = <IsMulti extends boolean>(): StylesConfig<SelectOption, IsMulti> => ({
  control: (base, state) => ({
    ...base,
    minHeight: 36,
    borderColor: state.isFocused ? "var(--color-brand-500, #465fff)" : "#e5e7eb",
    borderRadius: 8,
    boxShadow: state.isFocused ? "0 0 0 2px rgba(70,95,255,.09)" : "none",
    "&:hover": { borderColor: state.isFocused ? "var(--color-brand-500, #465fff)" : "#cbd5e1" },
  }),
  valueContainer: base => ({ ...base, padding: "0 9px", fontSize: 13, gap: 3 }),
  singleValue: base => ({ ...base, fontSize: 13, color: "#344054" }),
  placeholder: base => ({ ...base, fontSize: 13, color: "#9ca3af" }),
  input: base => ({ ...base, fontSize: 13, margin: 0, padding: 0 }),
  indicatorsContainer: base => ({ ...base, height: 34 }),
  indicatorSeparator: base => ({ ...base, display: "none" }),
  dropdownIndicator: base => ({ ...base, padding: 7, color: "#667085", "&:hover": { color: "#344054" } }),
  clearIndicator: base => ({ ...base, padding: 6 }),
  multiValue: base => ({ ...base, borderRadius: 5, backgroundColor: "#f2f4f7", margin: 2 }),
  multiValueLabel: base => ({ ...base, fontSize: 12, color: "#344054", padding: "2px 5px" }),
  multiValueRemove: base => ({ ...base, borderRadius: 5, color: "#667085", "&:hover": { backgroundColor: "#e4e7ec", color: "#344054" } }),
  option: (base, state) => ({ ...base, padding: "7px 10px", fontSize: 13, cursor: "pointer", backgroundColor: state.isSelected ? "#eef2ff" : state.isFocused ? "#f8fafc" : "#fff", color: state.isSelected ? "#3446a0" : "#344054", "&:active": { backgroundColor: "#eef2ff" } }),
  menu: base => ({ ...base, zIndex: 100000, marginTop: 5, border: "1px solid #e5e7eb", borderRadius: 8, boxShadow: "0 8px 24px rgba(16,24,40,.12)", overflow: "hidden" }),
  menuList: base => ({ ...base, maxHeight: 176, padding: 4 }),
  noOptionsMessage: base => ({ ...base, padding: "10px 8px", fontSize: 13, color: "#667085" }),
  loadingMessage: base => ({ ...base, padding: "10px 8px", fontSize: 13, color: "#667085" }),
  menuPortal: base => ({ ...base, zIndex: 100000 }),
});
const compactSelectStyles = createCompactSelectStyles<true>();
const scopeSelectStyles = createCompactSelectStyles<false>();
const scopeOptions: SelectOption[] = [
  { value: "all", label: "Всем сотрудникам" },
  { value: "employees", label: "Выбранным сотрудникам" },
  { value: "departments", label: "Выбранным отделам" },
  { value: "locations", label: "Выбранным филиалам" },
];

const Toggle = ({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) => (
  <label className="inline-flex cursor-pointer items-center gap-2">
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="peer sr-only"
      aria-label={label}
    />
    <span className="relative h-6 w-11 rounded-full bg-gray-200 transition peer-checked:bg-brand-500 peer-focus-visible:ring-3 peer-focus-visible:ring-brand-500/20 after:absolute after:left-[3px] after:top-[3px] after:h-[18px] after:w-[18px] after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:after:translate-x-5" />
  </label>
);

const MoneyInput = ({ value, onChange, currency }: { value: number; onChange: (value: number) => void; currency: string }) => (
  <div className="flex h-10 items-center rounded-lg border border-gray-200 bg-white transition focus-within:border-brand-300 focus-within:ring-3 focus-within:ring-brand-500/10">
    <input
      type="text"
      inputMode="numeric"
      value={formatMoney(value)}
      onChange={(event) => onChange(parseAmount(event.target.value))}
      className="h-full min-w-[90px] flex-1 bg-transparent px-3 text-right text-sm font-medium text-gray-800 outline-none"
      aria-label="Сумма штрафа"
    />
    {currency && <span className="max-w-[72px] shrink-0 truncate pr-3 text-xs text-gray-400" title={currency}>{currency}</span>}
  </div>
);

const PenaltyCard = ({
  title,
  description,
  icon,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  onToggle: (checked: boolean) => void;
  children: React.ReactNode;
}) => (
  <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
    <header className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="m-0 text-[15px] font-semibold text-gray-900">{title}</h2>
        <p className="mt-0.5 text-xs text-gray-500">{description}</p>
      </div>
      <Toggle checked={enabled} onChange={onToggle} label={`Включить: ${title}`} />
    </header>
    <div className={`px-5 py-4 transition ${enabled ? "" : "pointer-events-none opacity-45"}`}>{children}</div>
  </section>
);

const DurationPicker = ({ value, onChange }: { value: number; onChange: (value: number) => void }) => {
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState(Math.floor(value / 60));
  const [minutes, setMinutes] = useState(value % 60);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const listener = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, []);
  useEffect(() => { setHours(Math.floor(value / 60)); setMinutes(value % 60); }, [value]);

  return <div ref={root} className="relative min-w-0">
    <button type="button" aria-label="Выбрать порог времени" aria-expanded={open} onClick={() => setOpen(!open)} className="flex h-10 w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-left text-sm text-gray-800 outline-none hover:border-brand-300 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/10">
      <Clock3 size={16} className="shrink-0 text-gray-400" /><span className="flex-1 truncate">{formatDuration(value)}</span><ChevronDown size={15} className="shrink-0 text-gray-400" />
    </button>
    {open && <div className="absolute left-0 top-[calc(100%+5px)] z-50 w-[min(310px,80vw)] rounded-xl border border-gray-200 bg-white p-2 shadow-xl">
      <div className="grid grid-cols-2 gap-1">{PRESETS.map(preset => <button type="button" key={preset} onClick={() => { onChange(preset); setOpen(false); }} className={`rounded-lg px-3 py-2 text-left text-sm ${value === preset ? "bg-brand-50 font-semibold text-brand-600" : "text-gray-700 hover:bg-gray-50"}`}>{formatDuration(preset)}</button>)}</div>
      <div className="mt-2 border-t border-gray-100 pt-2"><p className="mb-2 px-1 text-xs font-medium text-gray-500">Другое время</p><div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-gray-500">Часы<input type="number" min={0} max={24} value={hours} onChange={event => setHours(Math.min(24, Math.max(0, Number(event.target.value) || 0)))} className="mt-1 h-9 w-full rounded-lg border border-gray-200 px-2 text-sm text-gray-800" /></label>
        <label className="text-xs text-gray-500">Минуты<input type="number" min={0} max={59} value={minutes} onChange={event => setMinutes(Math.min(59, Math.max(0, Number(event.target.value) || 0)))} className="mt-1 h-9 w-full rounded-lg border border-gray-200 px-2 text-sm text-gray-800" /></label>
      </div><button type="button" onClick={() => { if (hours * 60 + minutes > 0) { onChange(hours * 60 + minutes); setOpen(false); } }} className="mt-2 h-9 w-full rounded-lg bg-brand-500 text-sm font-semibold text-white hover:bg-brand-600">Применить</button></div>
    </div>}
  </div>;
};

const TimedRules = ({
  rules,
  onChange,
  currency,
}: {
  rules: PenaltyRule[];
  onChange: (rules: PenaltyRule[]) => void;
  currency: string;
}) => {
  const updateRule = (id: string, patch: Partial<PenaltyRule>) =>
    onChange(rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));

  return (
    <div>
      <div className="mb-2 hidden grid-cols-[minmax(160px,1fr)_minmax(150px,0.8fr)_36px] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400 sm:grid">
        <span>Порог времени</span>
        <span>Сумма штрафа</span>
        <span />
      </div>
      <div className="space-y-2.5">
        {rules.map((rule) => {
          return (
            <div key={rule.id} className="rounded-xl border border-gray-100 bg-gray-50/70 p-2.5 sm:border-0 sm:bg-transparent sm:p-0">
              <div className="grid grid-cols-[minmax(0,1fr)_36px] gap-2 sm:grid-cols-[minmax(160px,1fr)_minmax(150px,0.8fr)_36px]">
                <DurationPicker value={rule.thresholdMinutes} onChange={thresholdMinutes => updateRule(rule.id, { thresholdMinutes })} />
                <div className="sm:col-auto sm:row-auto col-start-1 row-start-2">
                  <MoneyInput value={rule.amount} onChange={(amount) => updateRule(rule.id, { amount })} currency={currency} />
                </div>
                <button
                  type="button"
                  onClick={() => onChange(rules.filter((item) => item.id !== rule.id))}
                  className="row-span-2 flex h-9 w-9 items-center justify-center self-center rounded-lg text-gray-400 transition hover:bg-error-50 hover:text-error-500 sm:row-span-1"
                  aria-label="Удалить правило"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => {
          const used = new Set(rules.map(rule => rule.thresholdMinutes));
          const next = PRESETS.find(value => !used.has(value)) ?? Math.max(0, ...used) + 15;
          onChange([...rules, { id: createId(), thresholdMinutes: next, amount: 0 }]);
        }}
        className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 text-sm font-medium text-gray-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600"
      >
        <Plus size={16} /> Добавить порог
      </button>
      <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-gray-500">
        <Info size={14} className="mt-0.5 shrink-0" />
        За один случай применяется только достигнутый максимальный порог. Штрафы не суммируются между собой.
      </p>
    </div>
  );
};

export default function AttendancePenaltiesSettingsPage() {
  const { data: companySettings } = useCompanySettingsQuery();
  const { data: currencies } = useCurrenciesQuery();
  const currency = currencies?.find((item) => item.guid === companySettings?.currencies_id)?.title || "";
  const [settings, setSettings] = useState<AttendancePenaltySettings>(() => defaultSettings());
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const storageKey = getStorageKey();
    const load = async () => {
      let serverSettings: AttendancePenaltySettings | null = null;
      try {
        const response = await reportsService.getAttendancePenaltySettings();
        serverSettings = response.settings as AttendancePenaltySettings | null;
      } catch {
        toast.error("Не удалось загрузить настройки штрафов из API.");
      }
      if (!active) return;
      let localSettings: AttendancePenaltySettings | null = null;
      try {
        const stored = window.localStorage.getItem(storageKey);
        localSettings = stored ? JSON.parse(stored) as AttendancePenaltySettings : null;
      } catch { /* Invalid local cache is ignored. */ }
      const source = serverSettings || localSettings;
      const next = source ? { ...defaultSettings(), ...source, version: 2 as const } : defaultSettings();
      next.late.rules = next.late.rules.map((rule) => ({ ...rule, id: rule.id || createId() }));
      next.early_leave.rules = next.early_leave.rules.map((rule) => ({ ...rule, id: rule.id || createId() }));
      setSettings(next);
      // Cached local rules require an explicit save before payroll uses them.
      setSavedSnapshot(serverSettings ? JSON.stringify(next) : "");
      setIsLoadingSettings(false);
    };
    void load();
    return () => { active = false; };
  }, []);

  const currentSnapshot = JSON.stringify(settings);
  const hasChanges = currentSnapshot !== savedSnapshot;

  const updateTimed = (type: TimedPenaltyType, patch: Partial<TimedPenaltyConfig>) =>
    setSettings((previous) => ({ ...previous, [type]: { ...previous[type], ...patch } }));

  const updateFixed = (type: FixedPenaltyType, patch: Partial<FixedPenaltyConfig>) =>
    setSettings((previous) => ({ ...previous, [type]: { ...previous[type], ...patch } }));

  const handleSave = async () => {
    const allRules = [...settings.late.rules, ...settings.early_leave.rules];
    if (allRules.some((rule) => rule.thresholdMinutes <= 0)) {
      toast.error("Порог времени должен быть больше нуля.");
      return;
    }
    if (allRules.some((rule) => rule.amount < 0)) {
      toast.error("Сумма штрафа не может быть отрицательной.");
      return;
    }
    if ([settings.late, settings.early_leave].some(config => settings.enabled && config.enabled && !config.rules.length)) return toast.error("Добавьте порог для включённого штрафа.");
    if ([settings.late, settings.early_leave].some(config => new Set(config.rules.map(rule => rule.thresholdMinutes)).size !== config.rules.length)) return toast.error("Одинаковые пороги нельзя добавлять дважды.");
    if (settings.enabled && settings.applyTo === "employees" && !settings.employeeIds.length) return toast.error("Выберите сотрудников.");
    if (settings.enabled && settings.applyTo === "departments" && !settings.departmentOptions.length) return toast.error("Выберите отделы.");
    if (settings.enabled && settings.applyTo === "locations" && !settings.locationOptions.length) return toast.error("Выберите филиалы.");

    setIsSaving(true);
    try {
      await reportsService.saveAttendancePenaltySettings(settings);
      window.localStorage.setItem(getStorageKey(), currentSnapshot);
      setSavedSnapshot(currentSnapshot);
      toast.success("Настройки штрафов сохранены.");
    } catch {
      toast.error("Не удалось сохранить настройки штрафов в API.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <PageMeta title="Штрафы | HRMS" description="Настройка штрафов за нарушения посещаемости" />
      <div className="mx-auto max-w-[1000px] pb-10">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <nav className="mb-2 flex items-center gap-1.5 text-sm text-gray-500">
              <Link to="/settings" className="hover:text-gray-700">Настройки</Link>
              <span>/</span>
              <span className="text-gray-800">Штрафы</span>
            </nav>
            <h1 className="m-0 text-xl font-semibold text-gray-900">Штрафы</h1>
            <p className="mt-1 text-sm text-gray-500">Правила удержаний за опоздания, ранний уход и пропуски.</p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || isLoadingSettings || isSaving}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {hasChanges ? <Save size={16} /> : <Check size={16} />}
            {isLoadingSettings ? "Загрузка..." : isSaving ? "Сохранение..." : hasChanges ? "Сохранить изменения" : "Сохранено"}
          </button>
        </div>

        <section className="mb-4 rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 px-5 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Clock3 size={20} /></span>
            <div className="min-w-0 flex-1">
              <h2 className="m-0 text-[15px] font-semibold text-gray-900">Автоматические штрафы</h2>
              <p className="mt-0.5 text-xs text-gray-500">Настройте правила удержаний по данным посещаемости.</p>
            </div>
            <Toggle checked={settings.enabled} onChange={(enabled) => setSettings((previous) => ({ ...previous, enabled }))} label="Включить автоматические штрафы" />
          </div>
          <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-gray-100 px-5 py-3 ${settings.enabled ? "" : "pointer-events-none opacity-45"}`}>
            <span className="shrink-0 text-[13px] font-medium text-gray-600">Применять к</span>
            <div className="w-[215px] max-w-full shrink-0">
              <Select<SelectOption, false>
                inputId="penalty-scope"
                aria-label="Применять к"
                options={scopeOptions}
                value={scopeOptions.find(option => option.value === settings.applyTo)}
                onChange={option => option && setSettings(previous => ({ ...previous, applyTo: option.value as AttendancePenaltySettings["applyTo"] }))}
                isSearchable={false}
                styles={scopeSelectStyles}
                menuPortalTarget={document.body}
                menuPosition="fixed"
              />
            </div>
            {settings.applyTo !== "all" && <div className="min-w-[220px] max-w-[420px] flex-1" aria-label="Выбранная область применения">
              {settings.applyTo === "employees" && <EmployeesInfiniteMultiSelect value={settings.employeeIds} onChange={employeeIds => setSettings(previous => ({ ...previous, employeeIds }))} placeholder="Выберите..." styles={compactSelectStyles} menuPortalTarget={document.body} />}
              {settings.applyTo === "departments" && <DepartmentsInfiniteMultiSelect value={settings.departmentOptions as DepartmentOption[]} onChange={departmentOptions => setSettings(previous => ({ ...previous, departmentOptions }))} placeholder="Выберите..." styles={compactSelectStyles} menuPortalTarget={document.body} />}
              {settings.applyTo === "locations" && <LocationsInfiniteMultiSelect value={settings.locationOptions} onChange={locationOptions => setSettings(previous => ({ ...previous, locationOptions }))} placeholder="Выберите..." styles={compactSelectStyles} menuPortalTarget={document.body} />}
            </div>}
          </div>
        </section>
        <div className={`space-y-4 ${settings.enabled ? "" : "pointer-events-none opacity-60"}`}>
            <PenaltyCard title="Опоздание" description="Сотрудник пришёл после начала рабочего дня" icon={<ArrowDownRight size={19} />} enabled={settings.late.enabled} onToggle={(enabled) => updateTimed("late", { enabled })}>
              <TimedRules rules={settings.late.rules} onChange={(rules) => updateTimed("late", { rules })} currency={currency} />
            </PenaltyCard>

            <PenaltyCard title="Ранний уход" description="Сотрудник ушёл до окончания рабочего дня" icon={<ArrowUpRight size={19} />} enabled={settings.early_leave.enabled} onToggle={(enabled) => updateTimed("early_leave", { enabled })}>
              <TimedRules rules={settings.early_leave.rules} onChange={(rules) => updateTimed("early_leave", { rules })} currency={currency} />
            </PenaltyCard>

            <PenaltyCard title="Нет отметки выхода" description="Приход отмечен, но выход не зафиксирован" icon={<LogOut size={19} />} enabled={settings.missing_checkout.enabled} onToggle={(enabled) => updateFixed("missing_checkout", { enabled })}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-gray-600">Штраф за каждый случай</span>
                <div className="w-full sm:w-[190px]"><MoneyInput value={settings.missing_checkout.amount} onChange={(amount) => updateFixed("missing_checkout", { amount })} currency={currency} /></div>
              </div>
            </PenaltyCard>

            <PenaltyCard title="Пропущенный рабочий день" description="Сотрудник не пришёл без подтверждённой причины" icon={<CalendarX2 size={19} />} enabled={settings.absence.enabled} onToggle={(enabled) => updateFixed("absence", { enabled })}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-gray-600">Штраф за каждый рабочий день</span>
                <div className="w-full sm:w-[190px]"><MoneyInput value={settings.absence.amount} onChange={(amount) => updateFixed("absence", { amount })} currency={currency} /></div>
              </div>
            </PenaltyCard>

          </div>
      </div>
    </>
  );
}
