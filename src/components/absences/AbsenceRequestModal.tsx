import type { ChangeEvent } from "react";
import { Icon } from "@iconify/react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Upload, X } from "lucide-react";
import Select from "react-select";
import type { StylesConfig } from "react-select";
import Button from "../ui/button/Button";
import { Modal } from "../ui/modal";
import EmployeeInfiniteSelect from "../autocomplete/EmployeeInfiniteSelect";
import { useTranslation } from "../../i18n";

const INPUT_CLASSNAME =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-slate-300";

const DATEPICKER_CLASSNAME =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-slate-300";

const DEFAULT_POLICY_ICON = "mdi:airplane";

type EmployeeSelectOption = {
  value: string;
  label: string;
};

type PolicySelectOption = {
  value: string;
  label: string;
  icon?: string;
  color?: string;
};

const getEmployeeSelectStyles = (): StylesConfig<EmployeeSelectOption, false> => ({
  control: (base, state) => ({
    ...base,
    minHeight: "40px",
    height: "40px",
    borderColor: state.isFocused ? "var(--color-brand-500)" : "#e2e8f0",
    borderRadius: "0.5rem",
    boxShadow: state.isFocused ? "0 0 0 3px rgba(var(--company-color-rgb, 70, 95, 255), 0.12)" : "none",
    "&:hover": {
      borderColor: state.isFocused ? "var(--color-brand-500)" : "#cbd5e1",
    },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: "0 12px",
    fontSize: "13px",
  }),
  input: (base) => ({
    ...base,
    margin: 0,
    padding: 0,
    fontSize: "13px",
  }),
  indicatorsContainer: (base) => ({
    ...base,
    height: "38px",
  }),
  singleValue: (base) => ({
    ...base,
    fontSize: "13px",
    color: "#1e293b",
  }),
  placeholder: (base) => ({
    ...base,
    fontSize: "13px",
    color: "#94a3b8",
  }),
  option: (base, state) => ({
    ...base,
    fontSize: "13px",
    cursor: "pointer",
    backgroundColor: state.isSelected ? "var(--color-brand-500)" : state.isFocused ? "#f8fafc" : "white",
    color: state.isSelected ? "white" : "#0f172a",
    padding: "8px 10px",
  }),
  menu: (base) => ({
    ...base,
    zIndex: 100100,
    borderRadius: "0.5rem",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 100100,
  }),
});

const getPolicySelectStyles = (): StylesConfig<PolicySelectOption, false> => ({
  control: (base, state) => ({
    ...base,
    minHeight: "40px",
    borderColor: state.isFocused ? "var(--color-brand-500)" : "#e2e8f0",
    borderRadius: "0.5rem",
    boxShadow: state.isFocused
      ? "0 0 0 3px rgba(var(--company-color-rgb, 70, 95, 255), 0.12)"
      : "none",
    "&:hover": {
      borderColor: state.isFocused ? "var(--color-brand-500)" : "#cbd5e1",
    },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: "0 12px",
    fontSize: "13px",
  }),
  input: (base) => ({
    ...base,
    margin: 0,
    padding: 0,
    fontSize: "13px",
  }),
  indicatorsContainer: (base) => ({
    ...base,
    height: "38px",
  }),
  singleValue: (base) => ({
    ...base,
    fontSize: "13px",
    color: "#1e293b",
  }),
  placeholder: (base) => ({
    ...base,
    fontSize: "13px",
    color: "#94a3b8",
  }),
  option: (base, state) => ({
    ...base,
    fontSize: "13px",
    cursor: "pointer",
    backgroundColor: state.isSelected ? "rgba(70, 95, 255, 0.08)" : state.isFocused ? "#f8fafc" : "white",
    color: "#0f172a",
    padding: "8px 10px",
  }),
  menu: (base) => ({
    ...base,
    zIndex: 100100,
    borderRadius: "0.5rem",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 100100,
  }),
});

const parseIsoDate = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
};

const toIsoDate = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const resolveHexColor = (value: string | undefined, fallback: string): string => {
  if (!value) return fallback;
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
};

export type AbsenceRequestPolicyOption = {
  guid: string;
  title: string;
  icon?: string;
  color?: string;
};

export type AbsenceRequestAttachmentItem = {
  name: string;
  size: number;
  url: string;
};

export type AbsenceRequestBreakdownItem = {
  iso: string;
  day: string;
  month: string;
  weekday: string;
  isWeekend: boolean;
  value?: number;
};

type EmployeeFieldConfig = {
  value: string;
  onChange: (value: string) => void;
  fallbackLabel?: string;
  placeholder?: string;
};

interface AbsenceRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  policies: AbsenceRequestPolicyOption[];
  policyId: string;
  onPolicyIdChange: (value: string) => void;
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
  note: string;
  onNoteChange: (value: string) => void;
  attachmentInputId: string;
  attachments: AbsenceRequestAttachmentItem[];
  onAttachmentFiles: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveAttachment: (url: string) => void;
  isUploadingAttachments: boolean;
  maxAttachments: number;
  breakdown: AbsenceRequestBreakdownItem[];
  availableDays: number;
  requestedDays: number;
  forecastDays: number;
  brandColor: string;
  isSubmitting: boolean;
  submitDisabled: boolean;
  onSubmit: () => void;
  submitIdleLabel?: string;
  submitLoadingLabel?: string;
  employeeField?: EmployeeFieldConfig;
}

export default function AbsenceRequestModal({
  isOpen,
  onClose,
  policies,
  policyId,
  onPolicyIdChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  note,
  onNoteChange,
  attachmentInputId,
  attachments,
  onAttachmentFiles,
  onRemoveAttachment,
  isUploadingAttachments,
  maxAttachments,
  breakdown,
  availableDays,
  requestedDays,
  forecastDays,
  brandColor,
  isSubmitting,
  submitDisabled,
  onSubmit,
  submitIdleLabel,
  submitLoadingLabel,
  employeeField,
}: AbsenceRequestModalProps) {
  const { t } = useTranslation();
  submitIdleLabel ??= t("absence_request.submit");
  submitLoadingLabel ??= t("absence_request.submitting");
  const policyOptions: PolicySelectOption[] = policies.map((policy) => ({
    value: policy.guid,
    label: policy.title,
    icon: policy.icon,
    color: policy.color,
  }));
  const selectedPolicy = policyOptions.find((option) => option.value === policyId) || null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      showCloseButton={false}
      className="mx-4 w-full max-w-[980px] overflow-visible rounded-2xl border border-slate-200 bg-white shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <h3 className="m-0 text-[18px] font-semibold text-slate-900">{t("absence_request.title")}</h3>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label={t("common.close")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 divide-y divide-slate-200 md:grid-cols-2 md:divide-x md:divide-y-0">
        <div className="space-y-4 px-6 py-5">
          {employeeField ? (
            <div>
              <label className="mb-1 block text-[12px] font-medium text-slate-700">{t("absence_request.employee")}</label>
              <EmployeeInfiniteSelect
                value={employeeField.value}
                onChange={employeeField.onChange}
                fallbackLabel={employeeField.fallbackLabel}
                placeholder={employeeField.placeholder || t("autocomplete.select_employee")}
                menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                classNamePrefix="absence-request-employee-select"
                styles={getEmployeeSelectStyles()}
              />
            </div>
          ) : null}

          <div>
            <label className="mb-1 block text-[12px] font-medium text-slate-700">{t("absence_request.type")}</label>
            <Select<PolicySelectOption, false>
              options={policyOptions}
              value={selectedPolicy}
              onChange={(option) => onPolicyIdChange(option?.value || "")}
              placeholder={t("absence_request.select_type")}
              isSearchable
              menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
              styles={getPolicySelectStyles()}
              formatOptionLabel={(option) => {
                const iconValue = option.icon || DEFAULT_POLICY_ICON;
                const iconColor = resolveHexColor(option.color, "#64748b");

                return (
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100">
                      <Icon icon={iconValue} width={16} height={16} color={iconColor} />
                    </span>
                    <span className="text-[13px] font-medium text-slate-900">
                      {option.label}
                    </span>
                  </div>
                );
              }}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[12px] font-medium text-slate-700">{t("absence_request.start_date")}</label>
              <DatePicker
                selected={parseIsoDate(dateFrom)}
                onChange={(date) => onDateFromChange(date ? toIsoDate(date) : "")}
                dateFormat="dd.MM.yyyy"
                placeholderText={t("common.date_placeholder")}
                showYearDropdown
                showMonthDropdown
                dropdownMode="select"
                className={DATEPICKER_CLASSNAME}
                wrapperClassName="w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-slate-700">{t("absence_request.end_date")}</label>
              <DatePicker
                selected={parseIsoDate(dateTo)}
                onChange={(date) => onDateToChange(date ? toIsoDate(date) : "")}
                minDate={parseIsoDate(dateFrom) || undefined}
                dateFormat="dd.MM.yyyy"
                placeholderText={t("common.date_placeholder")}
                showYearDropdown
                showMonthDropdown
                dropdownMode="select"
                className={DATEPICKER_CLASSNAME}
                wrapperClassName="w-full"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-medium text-slate-700">{t("absence_request.note")}</label>
            <textarea
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              placeholder={t("absence_request.note_placeholder")}
              className="h-24 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none transition focus:border-slate-300"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-[12px] font-medium text-slate-700">{t("absence_request.attachments")}</label>
              <span className="text-[11px] text-slate-400">{t("absence_request.attachments_limit", { count: maxAttachments })}</span>
            </div>

            <label
              htmlFor={attachmentInputId}
              className={`flex h-28 w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center transition ${isUploadingAttachments ? "cursor-default opacity-70" : "cursor-pointer hover:border-slate-400 hover:bg-slate-100"}`}
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-500">
                <Upload className="h-4 w-4" style={{ color: brandColor }} />
              </span>
              <span className="mt-2 text-[12px] font-semibold text-slate-700">
                {isUploadingAttachments ? t("common.loading") : t("absence_request.click_to_add_files")}
              </span>
            </label>
            <input
              id={attachmentInputId}
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.docx,.doc,.xlsx,.xls,.jpeg,.jpg,.png,.sig,.p7s"
              disabled={isUploadingAttachments}
              onChange={onAttachmentFiles}
            />

            {attachments.length > 0 ? (
              <div className="mt-2 space-y-1.5">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.url}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-2.5 py-2"
                  >
                    <a
                      href={attachment.url}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate pr-3 text-[12px] text-slate-700 hover:underline"
                    >
                      {attachment.name}
                    </a>
                    <button
                      type="button"
                      onClick={() => onRemoveAttachment(attachment.url)}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                      aria-label={t("absence_request.remove_file")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col px-6 py-5">
          <h4 className="m-0 text-[14px] font-semibold text-slate-900">{t("absence_request.breakdown")}</h4>

          <div className="mt-3 max-h-[320px] overflow-auto rounded-xl border border-slate-200">
            {breakdown.length === 0 ? (
              <div className="px-4 py-6 text-[12px] text-slate-400">{t("absence_request.invalid_range")}</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {breakdown.map((item) => (
                  <div key={item.iso} className="flex items-center gap-2 px-3 py-2">
                    <div
                      className={`inline-flex min-w-[48px] flex-col items-center rounded-md px-1.5 py-1 text-[11px] font-semibold ${
                        item.isWeekend ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      <span>{item.day}</span>
                      <span className="text-[10px] font-medium">{item.month}</span>
                    </div>
                    <span className="min-w-[18px] text-[12px] font-medium text-slate-700">{item.weekday}</span>
                    <span className="h-px flex-1 bg-slate-200" />
                    <span className="inline-flex min-w-[48px] items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] font-medium text-slate-700">
                      {(item.value ?? 1).toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-700">
            <div className="flex items-center justify-between py-0.5">
              <span>{t("absence_request.available")}</span>
              <strong>{t("absence_request.days_short", { days: availableDays.toFixed(1) })}</strong>
            </div>
            <div className="flex items-center justify-between py-0.5">
              <span>{t("absence_request.requested")}</span>
              <strong>{t("absence_request.days_short", { days: requestedDays.toFixed(1) })}</strong>
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-slate-200 pt-1.5">
              <span>{t("absence_request.forecast")}</span>
              <strong>{t("absence_request.days_short", { days: forecastDays.toFixed(1) })}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end border-t border-slate-200 px-6 py-3.5">
        <Button
          type="button"
          onClick={onSubmit}
          disabled={submitDisabled}
          className="px-4 py-2 text-[13px] font-semibold"
        >
          {isSubmitting ? submitLoadingLabel : submitIdleLabel}
        </Button>
      </div>
    </Modal>
  );
}
