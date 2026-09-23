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
  Pause,
  Play,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import Select, { type StylesConfig } from "react-select";
import PageMeta from "../../../components/common/PageMeta";
import Badge from "../../../components/ui/badge/Badge";
import Button from "../../../components/ui/button/Button";
import { Modal } from "../../../components/ui/modal";
import HoverTooltip from "../../../components/ui/tooltip/HoverTooltip";
import { Tabs, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import EmployeesInfiniteMultiSelect from "../../../components/autocomplete/EmployeesInfiniteMultiSelect";
import LocationsInfiniteMultiSelect from "../../../components/autocomplete/LocationsInfiniteMultiSelect";
import { useCompanySettingsQuery, useCurrenciesQuery } from "../../../api/services/companySettings.service";
import reportsService, { type PenaltyAssignment, type PenaltyPolicy } from "../../../api/services/reports.service";
import { BCP47, useTranslation } from "../../../i18n";
import type { Locale } from "../../../i18n/messages";

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

type PenaltyRules = {
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

const defaultRules = (): PenaltyRules => ({
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

type TranslateFn = ReturnType<typeof useTranslation>["t"];

const formatDuration = (minutes: number, t: TranslateFn) => {
  if (minutes < 60) return t("settings_misc.attendance_penalties.duration_minutes", { minutes });
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest
    ? t("settings_misc.attendance_penalties.duration_hours_minutes", { hours, minutes: rest })
    : t("settings_misc.attendance_penalties.duration_hours", { hours });
};

const parseAmount = (value: string) => {
  const parsed = Number(value.replace(/\D/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

type SelectOption = { value: string; label: string };
const createCompactSelectStyles = <IsMulti extends boolean>(): StylesConfig<SelectOption, IsMulti> => ({
  control: (base, state) => ({
    ...base,
    minHeight: 40,
    alignItems: "flex-start",
    borderColor: state.isFocused ? "var(--color-brand-500, #465fff)" : "#e5e7eb",
    borderRadius: 8,
    boxShadow: state.isFocused ? "0 0 0 2px rgba(70,95,255,.09)" : "none",
    "&:hover": { borderColor: state.isFocused ? "var(--color-brand-500, #465fff)" : "#cbd5e1" },
  }),
  valueContainer: base => ({ ...base, minHeight: 38, padding: "2px 9px", fontSize: 13, gap: 3 }),
  singleValue: base => ({ ...base, fontSize: 13, color: "#344054" }),
  placeholder: base => ({ ...base, fontSize: 13, color: "#9ca3af" }),
  input: base => ({ ...base, fontSize: 13, margin: 0, padding: 0 }),
  indicatorsContainer: base => ({ ...base, height: 38 }),
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
const singleSelectStyles = createCompactSelectStyles<false>();

const Toggle = ({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) => (
  // relative обязателен: sr-only — это position:absolute, и без якоря чекбокс
  // привязывается к окну, а не к прокручиваемой панели настроек, и растягивает
  // высоту всего документа (лишний скролл под страницей).
  <label className="relative inline-flex cursor-pointer items-center gap-2">
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="peer sr-only"
      aria-label={label}
    />
    <span className="relative h-6 w-11 shrink-0 rounded-full bg-gray-200 transition peer-checked:bg-brand-500 peer-focus-visible:ring-3 peer-focus-visible:ring-brand-500/20 after:absolute after:left-[3px] after:top-[3px] after:h-[18px] after:w-[18px] after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:after:translate-x-5" />
  </label>
);

const MoneyInput = ({ value, onChange, currency }: { value: number; onChange: (value: number) => void; currency: string }) => {
  const { t } = useTranslation();
  return (
  <div className="flex h-10 items-center rounded-lg border border-gray-200 bg-white transition focus-within:border-brand-300 focus-within:ring-3 focus-within:ring-brand-500/10">
    <input
      type="text"
      inputMode="numeric"
      value={formatMoney(value)}
      onChange={(event) => onChange(parseAmount(event.target.value))}
      className="h-full min-w-[90px] flex-1 bg-transparent px-3 text-right text-sm font-medium text-gray-800 outline-none"
      aria-label={t("settings_misc.attendance_penalties.money_aria")}
    />
    {currency && <span className="max-w-[72px] shrink-0 truncate pr-3 text-xs text-gray-400" title={currency}>{currency}</span>}
  </div>
  );
};

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
}) => {
  const { t } = useTranslation();
  return (
  <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
    <header className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="m-0 text-[15px] font-semibold text-gray-900">{title}</h2>
        <p className="mt-0.5 text-xs text-gray-500">{description}</p>
      </div>
      <Toggle checked={enabled} onChange={onToggle} label={t("settings_misc.attendance_penalties.enable_prefix", { title })} />
    </header>
    <div className={`px-5 py-4 transition ${enabled ? "" : "pointer-events-none opacity-45"}`}>{children}</div>
  </section>
  );
};

const DurationPicker = ({ value, onChange }: { value: number; onChange: (value: number) => void }) => {
  const { t } = useTranslation();
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
    <button type="button" aria-label={t("settings_misc.attendance_penalties.duration_picker_aria")} aria-expanded={open} onClick={() => setOpen(!open)} className="flex h-10 w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-left text-sm text-gray-800 outline-none hover:border-brand-300 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/10">
      <Clock3 size={16} className="shrink-0 text-gray-400" /><span className="flex-1 truncate">{formatDuration(value, t)}</span><ChevronDown size={15} className="shrink-0 text-gray-400" />
    </button>
    {open && <div className="absolute left-0 top-[calc(100%+5px)] z-50 w-[min(310px,80vw)] rounded-xl border border-gray-200 bg-white p-2 shadow-xl">
      <div className="grid grid-cols-2 gap-1">{PRESETS.map(preset => <button type="button" key={preset} onClick={() => { onChange(preset); setOpen(false); }} className={`rounded-lg px-3 py-2 text-left text-sm ${value === preset ? "bg-brand-50 font-semibold text-brand-600" : "text-gray-700 hover:bg-gray-50"}`}>{formatDuration(preset, t)}</button>)}</div>
      <div className="mt-2 border-t border-gray-100 pt-2"><p className="mb-2 px-1 text-xs font-medium text-gray-500">{t("settings_misc.attendance_penalties.duration_picker_custom_label")}</p><div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-gray-500">{t("settings_misc.attendance_penalties.duration_picker_hours_label")}<input type="number" min={0} max={24} value={hours} onChange={event => setHours(Math.min(24, Math.max(0, Number(event.target.value) || 0)))} className="mt-1 h-9 w-full rounded-lg border border-gray-200 px-2 text-sm text-gray-800" /></label>
        <label className="text-xs text-gray-500">{t("settings_misc.attendance_penalties.duration_picker_minutes_label")}<input type="number" min={0} max={59} value={minutes} onChange={event => setMinutes(Math.min(59, Math.max(0, Number(event.target.value) || 0)))} className="mt-1 h-9 w-full rounded-lg border border-gray-200 px-2 text-sm text-gray-800" /></label>
      </div><button type="button" onClick={() => { if (hours * 60 + minutes > 0) { onChange(hours * 60 + minutes); setOpen(false); } }} className="mt-2 h-9 w-full rounded-lg bg-brand-500 text-sm font-semibold text-white hover:bg-brand-600">{t("settings_misc.attendance_penalties.duration_picker_apply")}</button></div>
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
  const { t } = useTranslation();
  const updateRule = (id: string, patch: Partial<PenaltyRule>) =>
    onChange(rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));

  return (
    <div>
      <div className="mb-2 hidden grid-cols-[minmax(160px,1fr)_minmax(150px,0.8fr)_36px] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400 sm:grid">
        <span>{t("settings_misc.attendance_penalties.rules_threshold_header")}</span>
        <span>{t("settings_misc.attendance_penalties.rules_amount_header")}</span>
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
                  aria-label={t("settings_misc.attendance_penalties.rule_delete_aria")}
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
        <Plus size={16} /> {t("settings_misc.attendance_penalties.add_threshold_button")}
      </button>
      <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-gray-500">
        <Info size={14} className="mt-0.5 shrink-0" />
        {t("settings_misc.attendance_penalties.rules_info_text")}
      </p>
    </div>
  );
};


const withRuleIds = (rules: PenaltyRules): PenaltyRules => ({
  ...rules,
  late: { ...rules.late, rules: rules.late.rules.map((rule) => ({ ...rule, id: rule.id || createId() })) },
  early_leave: { ...rules.early_leave, rules: rules.early_leave.rules.map((rule) => ({ ...rule, id: rule.id || createId() })) },
});

const rulesError = (rules: PenaltyRules, t: TranslateFn) => {
  const allRules = [...rules.late.rules, ...rules.early_leave.rules];
  if (allRules.some((rule) => rule.thresholdMinutes <= 0)) return t("settings_misc.attendance_penalties.error_threshold_positive");
  if (allRules.some((rule) => rule.amount < 0)) return t("settings_misc.attendance_penalties.error_amount_negative");
  if ([rules.late, rules.early_leave].some((config) => config.enabled && !config.rules.length)) return t("settings_misc.attendance_penalties.error_threshold_required");
  if ([rules.late, rules.early_leave].some((config) => new Set(config.rules.map((rule) => rule.thresholdMinutes)).size !== config.rules.length)) return t("settings_misc.attendance_penalties.error_duplicate_threshold");
  return "";
};

// Бэк отвечает 201 и кладёт причину в server_error — показываем её, а не только
// «не удалось»: иначе конфликт филиалов неотличим от сбоя.
const errorText = (error: unknown) => (error instanceof Error ? error.message : undefined);

type PolicyDraft = { guid?: string; title: string; rules: PenaltyRules };

// Подпись над полем строки назначения: одна высота у всех столбцов, включая бейдж паузы.
const FIELD_LABEL = "mb-1.5 flex h-6 items-center text-xs font-medium text-gray-500";

// YYYY-MM-DD с бэка — в дату локали; T00:00 без зоны, чтобы день не съехал.
const formatDay = (day: string, locale: Locale) =>
  new Date(`${day}T00:00:00`).toLocaleDateString(BCP47[locale], { day: "numeric", month: "long", year: "numeric" });

type ConfirmRequest = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
};

// Подтверждение на Modal + Button, как удаление в «Регионах»: одно на страницу,
// строки назначений получают его через проп.
const ConfirmModal = ({ request, onClose }: { request: ConfirmRequest | null; onClose: () => void }) => {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    if (!request) return;
    setBusy(true);
    try {
      await request.onConfirm();
    } finally {
      setBusy(false);
      onClose();
    }
  };
  return (
    <Modal isOpen={!!request} onClose={onClose} showCloseButton={false} className="mx-4 w-full max-w-[380px] overflow-hidden rounded-2xl border border-gray-200 p-0 shadow-xl">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h3 className="text-base font-semibold text-gray-900">{request?.title}</h3>
        <button type="button" onClick={onClose} className="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600" aria-label={t("settings_misc.attendance_penalties.cancel")}>
          <X size={16} />
        </button>
      </div>
      <div className="space-y-4 px-4 py-4">
        <p className="text-sm text-gray-600">{request?.message}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy} className="w-full justify-center px-3 py-2 text-sm">
            {t("settings_misc.attendance_penalties.cancel")}
          </Button>
          <Button onClick={confirm} disabled={busy} className="w-full justify-center bg-error-600 px-3 py-2 text-sm hover:bg-error-700">
            {request?.confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

type AssignmentDraft = {
  guid?: string;
  scope: PenaltyAssignment["scope"];
  policy_id: string;
  branches: SelectOption[];
  excluded: string[];
  paused: boolean;
};

const toDraft = (assignment: PenaltyAssignment): AssignmentDraft => ({
  guid: assignment.guid,
  scope: assignment.scope,
  policy_id: assignment.policy_id,
  branches: assignment.branches,
  excluded: assignment.excluded.map((item) => item.value),
  paused: assignment.paused,
});

const AssignmentRow = ({
  assignment,
  initial,
  policies,
  takenBranches,
  onSaved,
  onRemoved,
  onConfirm,
}: {
  assignment?: PenaltyAssignment;
  initial: AssignmentDraft;
  policies: SelectOption[];
  takenBranches: Map<string, string>;
  onSaved: () => void;
  onRemoved: () => void;
  onConfirm: (request: ConfirmRequest) => void;
}) => {
  const { t, locale } = useTranslation();
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const dirty = !draft.guid || JSON.stringify(draft) !== JSON.stringify(initial);
  // Бэк всё равно откажет; здесь только подсветка, чтобы не гадать почему.
  const conflicts = draft.branches.filter((branch) => takenBranches.has(branch.value));
  const saveLabel = busy ? t("settings_misc.attendance_penalties.saving") : dirty ? t("settings_misc.attendance_penalties.save") : t("settings_misc.attendance_penalties.saved");
  const scopeHint = draft.scope === "all_branches" ? t("settings_misc.attendance_penalties.all_branches_hint") : draft.scope === "no_branch" ? t("settings_misc.attendance_penalties.no_branch_hint") : "";

  const save = async () => {
    if (!draft.policy_id) return toast.error(t("settings_misc.attendance_penalties.error_select_policy"));
    if (draft.scope === "branches" && !draft.branches.length) return toast.error(t("settings_misc.attendance_penalties.error_select_locations"));
    setBusy(true);
    try {
      await reportsService.savePenaltyAssignment({
        guid: draft.guid,
        policy_id: draft.policy_id,
        scope: draft.scope,
        location_ids: draft.branches.map((branch) => branch.value),
        excluded_ids: draft.excluded,
        paused: draft.paused,
      });
      toast.success(t("settings_misc.attendance_penalties.save_success_toast"));
      onSaved();
    } catch (error) {
      toast.error(t("settings_misc.attendance_penalties.save_error_toast"), { description: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    const guid = draft.guid;
    if (!guid) return onRemoved();
    onConfirm({
      title: t("settings_misc.attendance_penalties.delete_assignment_title"),
      message: t("settings_misc.attendance_penalties.delete_assignment_confirm"),
      confirmLabel: t("settings_misc.attendance_penalties.delete"),
      onConfirm: async () => {
        setBusy(true);
        try {
          await reportsService.deletePenaltyAssignment(guid);
          onRemoved();
        } catch (error) {
          toast.error(t("settings_misc.attendance_penalties.delete_error_toast"), { description: errorText(error) });
          setBusy(false);
        }
      },
    });
  };

  return (
    // Сетка строки: у каждого столбца подпись высотой h-6, под ней контрол h-10, всё
    // прижато к верху — растущий мультиселект уходит вниз, не сдвигая соседей.
    <div className="grid items-start gap-x-3 gap-y-2 border-t border-gray-100 px-5 py-4 first:border-t-0 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto]">
      <div className="min-w-0">
        <p className={FIELD_LABEL}>{t(`settings_misc.attendance_penalties.scope_${draft.scope}` as const)}</p>
        {draft.scope === "branches"
          ? <LocationsInfiniteMultiSelect value={draft.branches} onChange={(branches) => setDraft({ ...draft, branches })} placeholder={t("settings_misc.attendance_penalties.scope_select_placeholder")} styles={compactSelectStyles} menuPortalTarget={document.body} />
          : <p className="flex h-10 items-center text-[13px] text-gray-700">{scopeHint}</p>}
        {conflicts.length > 0 && <p className="mt-1 text-xs text-error-500">{t("settings_misc.attendance_penalties.branch_conflict", { branches: conflicts.map((branch) => branch.label).join(", ") })}</p>}
      </div>
      <div className="min-w-0">
        <p className={FIELD_LABEL}>{t("settings_misc.attendance_penalties.policy_label")}</p>
        <Select<SelectOption, false>
          options={policies}
          value={policies.find((option) => option.value === draft.policy_id) || null}
          onChange={(option) => option && setDraft({ ...draft, policy_id: option.value })}
          placeholder={t("settings_misc.attendance_penalties.policy_select_placeholder")}
          isSearchable={false}
          styles={singleSelectStyles}
          menuPortalTarget={document.body}
          menuPosition="fixed"
        />
      </div>
      <div className="min-w-0">
        <p className={FIELD_LABEL}>{t("settings_misc.attendance_penalties.exceptions_label")}</p>
        <EmployeesInfiniteMultiSelect
          value={draft.excluded}
          onChange={(excluded) => setDraft({ ...draft, excluded })}
          fallbackOptions={(assignment?.excluded || []).map((item) => ({ value: item.value, label: item.label || item.value }))}
          // Исключать есть смысл только людей своих филиалов; до выбора филиалов — некого.
          locationsId={draft.scope === "branches" ? draft.branches.map((branch) => branch.value) : undefined}
          isDisabled={draft.scope === "branches" && !draft.branches.length}
          placeholder={t("settings_misc.attendance_penalties.exceptions_placeholder")}
          styles={compactSelectStyles}
          menuPortalTarget={document.body}
        />
      </div>
      <div className="flex flex-col items-end">
        <div className={FIELD_LABEL}>
          <HoverTooltip align="end" text={draft.paused ? t("settings_misc.attendance_penalties.resume_hint") : t("settings_misc.attendance_penalties.pause_hint")}>
            <button
              type="button"
              onClick={() => setDraft({ ...draft, paused: !draft.paused })}
              aria-pressed={!draft.paused}
              className="cursor-pointer rounded-full transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-brand-500/20"
            >
              <Badge size="sm" color={draft.paused ? "warning" : "success"} startIcon={draft.paused ? <Pause size={11} /> : <Play size={11} />}>
                {draft.paused ? t("settings_misc.attendance_penalties.paused_label") : t("settings_misc.attendance_penalties.active_label")}
              </Badge>
            </button>
          </HoverTooltip>
        </div>
        <div className="flex h-10 items-center gap-1">
          <HoverTooltip text={saveLabel}>
            <button type="button" onClick={save} disabled={!dirty || busy || conflicts.length > 0} aria-label={saveLabel} className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition disabled:pointer-events-none ${dirty ? "bg-brand-500 text-white hover:bg-brand-600 disabled:bg-gray-300" : "text-success-500"}`}>
              {dirty ? <Save size={16} /> : <Check size={16} />}
            </button>
          </HoverTooltip>
          <HoverTooltip align="end" text={t("settings_misc.attendance_penalties.delete")}>
            <button type="button" onClick={remove} disabled={busy} aria-label={t("settings_misc.attendance_penalties.delete")} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition hover:bg-error-50 hover:text-error-500 disabled:pointer-events-none">
              <Trash2 size={16} />
            </button>
          </HoverTooltip>
        </div>
      </div>
      {assignment && <p className="text-xs text-gray-400 lg:col-span-4">{t("settings_misc.attendance_penalties.effective_from", { date: formatDay(assignment.effective_from, locale) })}</p>}
    </div>
  );
};

export default function AttendancePenaltiesSettingsPage() {
  const { t } = useTranslation();
  const { data: companySettings } = useCompanySettingsQuery();
  const { data: currencies } = useCurrenciesQuery();
  const currency = currencies?.find((item) => item.guid === companySettings?.currencies_id)?.title || "";
  const [policies, setPolicies] = useState<PenaltyPolicy[]>([]);
  const [assignments, setAssignments] = useState<PenaltyAssignment[]>([]);
  const [newAssignments, setNewAssignments] = useState<Array<{ key: string; draft: AssignmentDraft }>>([]);
  const [policy, setPolicy] = useState<PolicyDraft | null>(null);
  const [policySnapshot, setPolicySnapshot] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [tab, setTab] = useState<"assignments" | "policies">("assignments");
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);

  const toPolicyDraft = (item: PenaltyPolicy): PolicyDraft =>
    ({ guid: item.guid, title: item.title, rules: withRuleIds({ ...defaultRules(), ...(item.rules as PenaltyRules) }) });
  const openPolicy = (next: PolicyDraft) => {
    setPolicy(next);
    setPolicySnapshot(JSON.stringify(next));
  };
  const closePolicy = () => {
    setPolicy(null);
    setPolicySnapshot("");
  };

  // open: guid — раскрыть эту политику свежей; null — свернуть всё; не передан —
  // не трогать открытую: сохранение назначения не должно сбрасывать правку политики.
  const load = async (open?: string | null) => {
    try {
      const response = await reportsService.getAttendancePenalties();
      setPolicies(response.policies);
      setAssignments(response.assignments);
      if (open !== undefined) {
        const selected = open ? response.policies.find((item) => item.guid === open) : undefined;
        if (selected) openPolicy(toPolicyDraft(selected));
        else closePolicy();
      }
      return response;
    } catch (error) {
      toast.error(t("settings_misc.attendance_penalties.load_error_toast"), { description: errorText(error) });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Без политик назначать нечего — сразу ведём туда, где их создают.
  useEffect(() => { void load(null).then((response) => { if (response && !response.policies.length) setTab("policies"); }); }, []);

  const policyOptions: SelectOption[] = policies.map((item) => ({ value: item.guid, label: item.title }));
  const usedPolicies = new Set(assignments.map((item) => item.policy_id));
  const policyDirty = !!policy && JSON.stringify(policy) !== policySnapshot;
  const policyInUse = !!policy?.guid && usedPolicies.has(policy.guid);
  // Уход с открытой политики: с несохранёнными правками — только через подтверждение.
  const leavePolicy = (next: () => void) => {
    if (!policyDirty) return next();
    setConfirmRequest({
      title: t("settings_misc.attendance_penalties.discard_changes_title"),
      message: t("settings_misc.attendance_penalties.discard_changes_confirm"),
      confirmLabel: t("settings_misc.attendance_penalties.discard_changes_button"),
      onConfirm: next,
    });
  };
  const togglePolicy = (item: PenaltyPolicy) =>
    leavePolicy(() => (policy?.guid === item.guid ? closePolicy() : openPolicy(toPolicyDraft(item))));
  const startNewPolicy = () => {
    if (policy && !policy.guid) return;
    leavePolicy(() => openPolicy({ title: t("settings_misc.attendance_penalties.new_policy_title"), rules: defaultRules() }));
  };

  // Сводка для свёрнутой строки: что включено и с какого порога / на какую сумму.
  const summarize = (rules: PenaltyRules) => {
    const money = (amount: number) => `${formatMoney(amount)}${currency ? ` ${currency}` : ""}`;
    const from = (title: string, config: TimedPenaltyConfig) => config.rules.length
      ? t("settings_misc.attendance_penalties.summary_from", { title, duration: formatDuration(Math.min(...config.rules.map((rule) => rule.thresholdMinutes)), t) })
      : title;
    return [
      rules.late.enabled && from(t("settings_misc.attendance_penalties.late_title"), rules.late),
      rules.early_leave.enabled && from(t("settings_misc.attendance_penalties.early_leave_title"), rules.early_leave),
      rules.missing_checkout.enabled && `${t("settings_misc.attendance_penalties.missing_checkout_title")}: ${money(rules.missing_checkout.amount)}`,
      rules.absence.enabled && `${t("settings_misc.attendance_penalties.absence_title")}: ${money(rules.absence.amount)}`,
    ].filter((item): item is string => !!item);
  };

  // Какие филиалы уже заняты чужими сохранёнными назначениями.
  const takenBranchesFor = (guid?: string) => new Map(
    assignments.filter((item) => item.guid !== guid).flatMap((item) => item.branches.map((branch) => [branch.value, branch.label] as const)),
  );

  const addAssignment = (scope: PenaltyAssignment["scope"]) =>
    setNewAssignments((previous) => [...previous, {
      key: createId(),
      draft: { scope, policy_id: policies.length === 1 ? policies[0].guid : "", branches: [], excluded: [], paused: false },
    }]);
  const hasScope = (scope: PenaltyAssignment["scope"]) =>
    [...assignments, ...newAssignments.map((item) => item.draft)].some((item) => item.scope === scope);

  const updateRules = (patch: Partial<PenaltyRules>) =>
    setPolicy((previous) => previous && { ...previous, rules: { ...previous.rules, ...patch } });

  const savePolicy = async () => {
    if (!policy) return;
    if (!policy.title.trim()) return toast.error(t("settings_misc.attendance_penalties.policy_title_required"));
    const error = rulesError(policy.rules, t);
    if (error) return toast.error(error);
    setIsSaving(true);
    try {
      const saved = await reportsService.savePenaltyPolicy({ guid: policy.guid, title: policy.title.trim(), rules: policy.rules });
      toast.success(t("settings_misc.attendance_penalties.save_success_toast"));
      await load(saved.guid);
    } catch (error) {
      toast.error(t("settings_misc.attendance_penalties.save_error_toast"), { description: errorText(error) });
    } finally {
      setIsSaving(false);
    }
  };

  const deletePolicy = () => {
    const guid = policy?.guid;
    if (!guid) return closePolicy();
    setConfirmRequest({
      title: t("settings_misc.attendance_penalties.delete_policy_title"),
      message: t("settings_misc.attendance_penalties.delete_policy_confirm", { title: policy.title }),
      confirmLabel: t("settings_misc.attendance_penalties.delete"),
      onConfirm: async () => {
        try {
          await reportsService.deletePenaltyPolicy(guid);
          await load(null);
        } catch (error) {
          toast.error(t("settings_misc.attendance_penalties.delete_error_toast"), { description: errorText(error) });
        }
      },
    });
  };

  return (
    <>
      <PageMeta title={t("settings_misc.attendance_penalties.page_meta_title")} description={t("settings_misc.attendance_penalties.page_meta_description")} />
      <div className="mx-auto max-w-[1100px] pb-10">
        <div className="mb-5">
          <nav className="mb-2 flex items-center gap-1.5 text-sm text-gray-500">
            <Link to="/settings" className="hover:text-gray-700">{t("settings_misc.attendance_penalties.breadcrumb_settings")}</Link>
            <span>/</span>
            <span className="text-gray-800">{t("settings_misc.attendance_penalties.breadcrumb_current")}</span>
          </nav>
          <h1 className="m-0 text-xl font-semibold text-gray-900">{t("settings_misc.attendance_penalties.page_title")}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("settings_misc.attendance_penalties.page_description")}</p>
        </div>

        <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
          <TabsList className="mb-4">
            <TabsTrigger value="assignments">{t("settings_misc.attendance_penalties.tab_assignments")}</TabsTrigger>
            <TabsTrigger value="policies">{t("settings_misc.attendance_penalties.tab_policies")}</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Обе вкладки смонтированы: несохранённые правки строк не теряются при переключении. */}
        <div className={tab === "assignments" ? "" : "hidden"}>
        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
            <div className="flex flex-wrap gap-2">
              {(["branches", "all_branches", "no_branch"] as const).filter((scope) => scope === "branches" || !hasScope(scope)).map((scope) => (
                <HoverTooltip key={scope} text={policies.length ? "" : t("settings_misc.attendance_penalties.add_needs_policy")}>
                  <button type="button" disabled={!policies.length} onClick={() => addAssignment(scope)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 text-sm font-medium text-gray-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600 disabled:pointer-events-none disabled:opacity-50">
                    <Plus size={15} /> {t(`settings_misc.attendance_penalties.scope_${scope}` as const)}
                  </button>
                </HoverTooltip>
              ))}
            </div>
            <HoverTooltip align="end" text={t("settings_misc.attendance_penalties.assignments_description")}>
              <button type="button" aria-label={t("settings_misc.attendance_penalties.assignments_description")} className="inline-flex h-8 w-8 cursor-help items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-brand-500/20">
                <Info size={17} />
              </button>
            </HoverTooltip>
          </header>
          {isLoading
            ? <p className="px-5 py-4 text-sm text-gray-500">{t("settings_misc.attendance_penalties.loading")}</p>
            : !assignments.length && !newAssignments.length
              ? <p className="px-5 py-4 text-sm text-gray-500">
                {policies.length
                  ? t("settings_misc.attendance_penalties.no_assignments_hint")
                  // {tab} в переводе режем на части и подставляем ссылку на вкладку — порядок слов остаётся за переводом.
                  : t("settings_misc.attendance_penalties.no_policies_hint").split("{tab}").map((part, index) => (
                    <span key={index}>
                      {index > 0 && <button type="button" onClick={() => setTab("policies")} className="cursor-pointer font-medium text-brand-500 underline-offset-2 hover:underline">{t("settings_misc.attendance_penalties.tab_policies")}</button>}
                      {part}
                    </span>
                  ))}
              </p>
              : <>
                {assignments.map((item) => (
                  <AssignmentRow key={`${item.guid}:${item.effective_from}`} assignment={item} initial={toDraft(item)} policies={policyOptions} takenBranches={takenBranchesFor(item.guid)} onSaved={() => void load()} onRemoved={() => void load()} onConfirm={setConfirmRequest} />
                ))}
                {newAssignments.map((item) => {
                  const drop = () => setNewAssignments((previous) => previous.filter((row) => row.key !== item.key));
                  return <AssignmentRow key={item.key} initial={item.draft} policies={policyOptions} takenBranches={takenBranchesFor()} onSaved={() => { drop(); void load(); }} onRemoved={drop} onConfirm={setConfirmRequest} />;
                })}
              </>}
          <p className="flex items-start gap-2 border-t border-gray-100 px-5 py-3 text-xs leading-5 text-gray-500">
            <Info size={14} className="mt-0.5 shrink-0" /> {t("settings_misc.attendance_penalties.changes_from_today")}
          </p>
        </section>

        </div>

        <div className={tab === "policies" ? "" : "hidden"}>
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
            <p className="m-0 min-w-0 max-w-[560px] text-[13px] leading-5 text-gray-600">{t("settings_misc.attendance_penalties.policies_description")}</p>
            <button type="button" onClick={startNewPolicy} disabled={!!policy && !policy.guid} className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-gray-300">
              <Plus size={15} /> {t("settings_misc.attendance_penalties.new_policy")}
            </button>
          </div>

          {isLoading
            ? <p className="rounded-2xl border border-gray-200 bg-white px-5 py-4 text-sm text-gray-500">{t("settings_misc.attendance_penalties.loading")}</p>
            : !policies.length && !policy
              ? <p className="rounded-2xl border border-dashed border-gray-300 bg-white px-5 py-6 text-center text-sm text-gray-500">{t("settings_misc.attendance_penalties.policies_empty")}</p>
              : <div className="space-y-3">
                {[...(policy && !policy.guid ? [null] : []), ...policies].map((item) => {
                  const open = item ? policy?.guid === item.guid : true;
                  const shown = open && policy ? policy : item && toPolicyDraft(item);
                  if (!shown) return null;
                  const usage = item ? assignments.filter((assignment) => assignment.policy_id === item.guid).length : 0;
                  const chips = summarize(shown.rules);
                  const unsaved = !item || (open && policyDirty);
                  return (
                    <div key={item?.guid ?? "new"} className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${open ? "border-brand-200" : "border-gray-200"}`}>
                      <button type="button" aria-expanded={open} onClick={() => (item ? togglePolicy(item) : leavePolicy(closePolicy))} className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-gray-50">
                        <ChevronDown size={18} className={`shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-[15px] font-semibold text-gray-900">{shown.title || t("settings_misc.attendance_penalties.new_policy_title")}</span>
                            {unsaved && <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">{t("settings_misc.attendance_penalties.unsaved")}</span>}
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {chips.length
                              ? chips.map((chip) => <span key={chip} className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{chip}</span>)
                              : <span className="text-xs text-gray-400">{t("settings_misc.attendance_penalties.summary_none")}</span>}
                          </div>
                        </div>
                        {item && <span className={`hidden shrink-0 rounded-full px-2.5 py-1 text-xs font-medium sm:inline ${usage ? "bg-brand-50 text-brand-600" : "bg-gray-100 text-gray-500"}`}>
                          {usage ? t("settings_misc.attendance_penalties.used_in", { count: usage }) : t("settings_misc.attendance_penalties.not_used")}
                        </span>}
                      </button>
                      {open && policy && <div className="space-y-4 border-t border-gray-100 bg-gray-50/60 px-5 py-4">
                        <label className="block text-xs font-medium text-gray-500">
                          {t("settings_misc.attendance_penalties.policy_title_label")}
                          <input value={policy.title} maxLength={200} onChange={(event) => setPolicy({ ...policy, title: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/10" />
                        </label>
                      <PenaltyCard title={t("settings_misc.attendance_penalties.late_title")} description={t("settings_misc.attendance_penalties.late_description")} icon={<ArrowDownRight size={19} />} enabled={policy.rules.late.enabled} onToggle={(enabled) => updateRules({ late: { ...policy.rules.late, enabled } })}>
                        <TimedRules rules={policy.rules.late.rules} onChange={(rules) => updateRules({ late: { ...policy.rules.late, rules } })} currency={currency} />
                      </PenaltyCard>

                      <PenaltyCard title={t("settings_misc.attendance_penalties.early_leave_title")} description={t("settings_misc.attendance_penalties.early_leave_description")} icon={<ArrowUpRight size={19} />} enabled={policy.rules.early_leave.enabled} onToggle={(enabled) => updateRules({ early_leave: { ...policy.rules.early_leave, enabled } })}>
                        <TimedRules rules={policy.rules.early_leave.rules} onChange={(rules) => updateRules({ early_leave: { ...policy.rules.early_leave, rules } })} currency={currency} />
                      </PenaltyCard>

                      <PenaltyCard title={t("settings_misc.attendance_penalties.missing_checkout_title")} description={t("settings_misc.attendance_penalties.missing_checkout_description")} icon={<LogOut size={19} />} enabled={policy.rules.missing_checkout.enabled} onToggle={(enabled) => updateRules({ missing_checkout: { ...policy.rules.missing_checkout, enabled } })}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <span className="text-sm text-gray-600">{t("settings_misc.attendance_penalties.missing_checkout_amount_label")}</span>
                          <div className="w-full sm:w-[190px]"><MoneyInput value={policy.rules.missing_checkout.amount} onChange={(amount) => updateRules({ missing_checkout: { ...policy.rules.missing_checkout, amount } })} currency={currency} /></div>
                        </div>
                      </PenaltyCard>

                      <PenaltyCard title={t("settings_misc.attendance_penalties.absence_title")} description={t("settings_misc.attendance_penalties.absence_description")} icon={<CalendarX2 size={19} />} enabled={policy.rules.absence.enabled} onToggle={(enabled) => updateRules({ absence: { ...policy.rules.absence, enabled } })}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <span className="text-sm text-gray-600">{t("settings_misc.attendance_penalties.absence_amount_label")}</span>
                          <div className="w-full sm:w-[190px]"><MoneyInput value={policy.rules.absence.amount} onChange={(amount) => updateRules({ absence: { ...policy.rules.absence, amount } })} currency={currency} /></div>
                        </div>
                      </PenaltyCard>

                        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                          {/* Причина блокировки — сразу при наведении. disabled-кнопка не отдаёт событий мыши,
                              поэтому у неё pointer-events-none, а наведение ловит обёртка тултипа. */}
                          <HoverTooltip text={policyInUse ? t("settings_misc.attendance_penalties.policy_in_use") : ""}>
                            <button type="button" onClick={deletePolicy} disabled={policyInUse} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-600 transition hover:border-error-300 hover:text-error-500 disabled:pointer-events-none disabled:opacity-50 sm:w-auto">
                              <Trash2 size={16} /> {policy.guid ? t("settings_misc.attendance_penalties.delete") : t("settings_misc.attendance_penalties.cancel")}
                            </button>
                          </HoverTooltip>
                          <button type="button" onClick={savePolicy} disabled={(!policyDirty && !!policy.guid) || isSaving} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-gray-300">
                            {policyDirty || !policy.guid ? <Save size={16} /> : <Check size={16} />}
                            {isSaving ? t("settings_misc.attendance_penalties.saving") : policyDirty || !policy.guid ? t("settings_misc.attendance_penalties.save_changes") : t("settings_misc.attendance_penalties.saved")}
                          </button>
                        </div>
                      </div>}
                    </div>
                  );
                })}
              </div>}
        </div>
      </div>
      <ConfirmModal request={confirmRequest} onClose={() => setConfirmRequest(null)} />
    </>
  );
}
