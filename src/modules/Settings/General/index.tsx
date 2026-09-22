import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type RefObject,
} from "react";
import { useNavigate } from "react-router";
import { ImagePlus } from "lucide-react";
import Select, { type StylesConfig } from "react-select";
import { toast } from "sonner";
import PageMeta from "../../../components/common/PageMeta";
import Label from "../../../components/form/Label";
import Input from "../../../components/form/input/InputField";
import FileInput from "../../../components/form/input/FileInput";
import Checkbox from "../../../components/form/input/Checkbox";
import Button from "../../../components/ui/button/Button";
import Spinner from "../../../components/ui/Spinner";
import {
  type CompanySettings,
  useCurrenciesQuery,
  useCompanySettingsQuery,
  useLanguagesQuery,
  useUpdateCompanySettings,
} from "../../../api/services/companySettings.service";
import { useUploadFile } from "../../../api/services/file-upload.service";
import companyStore from "../../../store/company.store";
import TelegramGroupSection from "./TelegramGroupSection";
// Часовой пояс компании — запасной циферблат для сотрудника без филиала
// (ADR-0006, known-gaps §3). Список общий с регионами: два списка зон,
// которые обязаны совпадать, однажды не совпадут.
import { getTimezoneOptions } from "../../../utils/timezones";
import { useTranslation } from "../../../i18n";
import type { MessageKey } from "../../../i18n/messages";

type CompanyFormState = {
  guid: string;
  name: string;
  languages_id: string;
  timezone: string;
  currencies_id: string;
  name_format: string;
  date_format: string;
  logo: string;
  main_color: string;
  enabled_company_cover: boolean;
  enabled_employee_cover: boolean;
  company_cover: string;
  employee_cover: string;
};

type Option = {
  value: string;
  label: string;
};

const NAME_FORMAT_OPTIONS: { value: string; labelKey: MessageKey }[] = [
  { value: "lf", labelKey: "settings_general.name_format.last_first" },
  { value: "fl", labelKey: "settings_general.name_format.first_last" },
];

const DATE_FORMAT_OPTIONS: { value: string; labelKey: MessageKey }[] = [
  { value: "dd.MM.yyyy", labelKey: "settings_general.date_format.dmy" },
  { value: "yyyy-MM-dd", labelKey: "settings_general.date_format.ymd" },
  { value: "MM/dd/yyyy", labelKey: "settings_general.date_format.mdy" },
];

const DEFAULT_COVER_HELPER =
  "Recommended size 1090 x 155 px (PNG or JPEG). This will set the default cover photo for all employees. Personal uploads won’t be affected";

const BRAND_500 = "var(--color-brand-500)";
const BRAND_RING_DARK = "rgba(var(--company-color-rgb, 70, 95, 255), 0.3)";
const BRAND_RING_LIGHT = "rgba(var(--company-color-rgb, 70, 95, 255), 0.12)";

const getSearchSelectStyles = (isDarkMode: boolean): StylesConfig<Option, false> => {
  if (isDarkMode) {
    return {
      control: (base, state) => ({
        ...base,
        minHeight: "44px",
        height: "44px",
        backgroundColor: "rgb(17, 24, 39)",
        borderColor: state.isFocused ? BRAND_500 : "rgb(55, 65, 81)",
        borderWidth: "1px",
        borderRadius: "0.5rem",
        fontSize: "14px",
        boxShadow: state.isFocused ? `0 0 0 3px ${BRAND_RING_DARK}` : "none",
        "&:hover": {
          borderColor: state.isFocused ? BRAND_500 : "rgb(75, 85, 99)",
        },
      }),
      valueContainer: (base) => ({ ...base, padding: "0 12px", fontSize: "14px" }),
      input: (base) => ({ ...base, margin: 0, padding: 0, color: "white", fontSize: "14px" }),
      indicatorsContainer: (base) => ({ ...base, height: "42px" }),
      option: (base, state) => ({
        ...base,
        backgroundColor: state.isSelected
          ? BRAND_500
          : state.isFocused
            ? "rgb(55, 65, 81)"
            : "rgb(17, 24, 39)",
        color: "white",
        cursor: "pointer",
        padding: "10px 12px",
        fontSize: "14px",
      }),
      menu: (base) => ({
        ...base,
        zIndex: 50,
        borderRadius: "0.5rem",
        border: "1px solid rgb(55, 65, 81)",
        backgroundColor: "rgb(17, 24, 39)",
      }),
      singleValue: (base) => ({ ...base, color: "white", fontSize: "14px" }),
      placeholder: (base) => ({ ...base, color: "rgb(156, 163, 175)", fontSize: "14px" }),
    };
  }

  return {
    control: (base, state) => ({
      ...base,
      minHeight: "44px",
      height: "44px",
      backgroundColor: "white",
      borderColor: state.isFocused ? BRAND_500 : "#d1d5db",
      borderWidth: "1px",
      borderRadius: "0.5rem",
      fontSize: "14px",
      boxShadow: state.isFocused ? `0 0 0 3px ${BRAND_RING_LIGHT}` : "none",
      "&:hover": {
        borderColor: state.isFocused ? BRAND_500 : "#9ca3af",
      },
    }),
    valueContainer: (base) => ({ ...base, padding: "0 12px", fontSize: "14px" }),
    input: (base) => ({ ...base, margin: 0, padding: 0, color: "#111827", fontSize: "14px" }),
    indicatorsContainer: (base) => ({ ...base, height: "42px" }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected ? BRAND_500 : state.isFocused ? "#f3f4f6" : "white",
      color: state.isSelected ? "white" : "#111827",
      cursor: "pointer",
      padding: "10px 12px",
      fontSize: "14px",
    }),
    menu: (base) => ({
      ...base,
      zIndex: 50,
      borderRadius: "0.5rem",
      border: "1px solid #e5e7eb",
    }),
    singleValue: (base) => ({ ...base, color: "#111827", fontSize: "14px" }),
    placeholder: (base) => ({ ...base, color: "#9ca3af", fontSize: "14px" }),
  };
};

const ensureOption = (options: Option[], value?: string): Option[] => {
  if (!value) {
    return options;
  }

  if (options.some((option) => option.value === value)) {
    return options;
  }

  return [{ value, label: value }, ...options];
};

const toFormState = (company: CompanySettings): CompanyFormState => ({
  guid: company.guid,
  name: company.name || "",
  languages_id: company.languages_id || "",
  timezone: company.timezone?.[0] || "",
  currencies_id: company.currencies_id || "",
  name_format: company.name_format?.[0] || "",
  date_format: company.date_format?.[0] || "",
  logo: company.logo || "",
  main_color: company.main_color || "#2980B9",
  enabled_company_cover: Boolean(company.enabled_company_cover),
  enabled_employee_cover: Boolean(company.enabled_employee_cover),
  company_cover: company.company_cover || "",
  employee_cover: company.employee_cover || "",
});

const toUpdatePayload = (state: CompanyFormState) => ({
  guid: state.guid,
  name: state.name.trim(),
  languages_id: state.languages_id || null,
  currencies_id: state.currencies_id || null,
  date_format: state.date_format ? [state.date_format] : [],
  name_format: state.name_format ? [state.name_format] : [],
  timezone: state.timezone ? [state.timezone] : [],
  main_color: state.main_color || "#2980B9",
  logo: state.logo,
  company_cover: state.company_cover,
  employee_cover: state.employee_cover,
  enabled_company_cover: state.enabled_company_cover,
  enabled_employee_cover: state.enabled_employee_cover,
});

const CoverPreview = ({
  title,
  enabled,
  image,
  onToggle,
  onSelectFile,
  inputRef,
}: {
  title: string;
  enabled: boolean;
  image: string;
  onToggle: (checked: boolean) => void;
  onSelectFile: (file: File) => void;
  inputRef: RefObject<HTMLInputElement | null>;
}) => {
  const { t } = useTranslation();
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    onSelectFile(file);
    event.target.value = "";
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <Checkbox checked={enabled} onChange={onToggle} label={title} />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
        >
          <ImagePlus size={14} />
          {t("settings_general.cover.edit_photo")}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,.svg"
        className="hidden"
        onChange={handleFileChange}
      />

      <div
        className="h-[220px] w-full bg-gray-100 bg-cover bg-center"
        style={{
          backgroundImage: image
            ? `url(${image})`
            : "radial-gradient(circle at 10px 10px, #e7ecfb 6px, transparent 0)",
          backgroundSize: image ? "cover" : "36px 36px",
          backgroundColor: "#f8fafc",
        }}
      />

      <p className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
        {DEFAULT_COVER_HELPER}
      </p>
    </div>
  );
};

export default function SettingsGeneralPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading, isFetching, isError } = useCompanySettingsQuery();
  const {
    data: currencyApiOptions,
    isLoading: isCurrencyLoading,
    isError: isCurrencyError,
  } = useCurrenciesQuery();
  const {
    data: languageApiOptions,
    isLoading: isLanguageLoading,
    isError: isLanguageError,
  } = useLanguagesQuery();
  const updateMutation = useUpdateCompanySettings();
  const uploadMutation = useUploadFile({ folder: "Media" });

  const [form, setForm] = useState<CompanyFormState | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [uploadingField, setUploadingField] = useState<
    "logo" | "company_cover" | "employee_cover" | null
  >(null);

  const companyCoverInputRef = useRef<HTMLInputElement>(null);
  const employeeCoverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (data) {
      setForm(toFormState(data));
    }
  }, [data]);

  const isDarkMode =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");
  const searchSelectStyles = useMemo(
    () => getSearchSelectStyles(isDarkMode),
    [isDarkMode]
  );

  const languageOptions = useMemo(
    () =>
      ensureOption(
        (languageApiOptions || []).map((item) => ({
          value: item.guid,
          label: item.title,
        })),
        form?.languages_id
      ),
    [languageApiOptions, form?.languages_id]
  );
  const timezoneOptions = useMemo(
    () => ensureOption(getTimezoneOptions(), form?.timezone),
    [form?.timezone]
  );
  const currencyOptions = useMemo(
    () =>
      ensureOption(
        (currencyApiOptions || []).map((item) => ({
          value: item.guid,
          label: item.title,
        })),
        form?.currencies_id
      ),
    [currencyApiOptions, form?.currencies_id]
  );
  const nameFormatOptions = useMemo(
    () =>
      ensureOption(
        NAME_FORMAT_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) })),
        form?.name_format
      ),
    [form?.name_format, t]
  );
  const dateFormatOptions = useMemo(
    () =>
      ensureOption(
        DATE_FORMAT_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) })),
        form?.date_format
      ),
    [form?.date_format, t]
  );

  const updateField = <K extends keyof CompanyFormState>(
    field: K,
    value: CompanyFormState[K]
  ) => {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleImageUpload = async (
    field: "logo" | "company_cover" | "employee_cover",
    file: File
  ) => {
    try {
      setUploadingField(field);
      const url = await uploadMutation.mutateAsync(file);
      updateField(field, url);
      setStatusMessage(t("settings_general.status.upload_success"));
    } catch (error) {
      console.error("Upload failed:", error);
      setStatusMessage(t("settings_general.status.upload_error"));
    } finally {
      setUploadingField(null);
    }
  };

  const handleSave = async () => {
    if (!form) return;

    setStatusMessage("");
    try {
      await updateMutation.mutateAsync(toUpdatePayload(form));
      await companyStore.refreshCompany();
      setStatusMessage(t("settings_general.status.save_success"));
      toast.success(t("settings_general.status.save_success"));
      navigate("/settings");
    } catch (error) {
      console.error("Update company settings failed:", error);
      setStatusMessage(t("settings_general.status.save_error"));
      toast.error(t("settings_general.status.save_error"));
    }
  };

  if (isError) {
    return (
      <>
        <PageMeta title={t("settings_general.page_meta.title")} description={t("settings_general.page_meta.description")} />
        <div className="rounded-2xl border border-error-200 bg-error-50 p-5 text-sm text-error-700">
          {t("settings_general.load_error")}
        </div>
      </>
    );
  }

  if (isLoading || !form) {
    return (
      <>
        <PageMeta title={t("settings_general.page_meta.title")} description={t("settings_general.page_meta.description")} />
        <div className="flex min-h-[360px] items-center justify-center">
          <Spinner />
        </div>
      </>
    );
  }

  return (
    <>
      <PageMeta title={t("settings_general.page_meta.title")} description={t("settings_general.page_meta.description")} />

      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-gray-900">{t("settings_general.heading")}</h1>
        </div>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900">{t("settings_general.company_info.heading")}</h2>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="company_name">{t("settings_general.company_info.name_label")}</Label>
                <Input
                  id="company_name"
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="company_language">{t("settings_general.company_info.language_label")}</Label>
                <Select
                  inputId="company_language"
                  options={languageOptions}
                  value={languageOptions.find((option) => option.value === form.languages_id) || null}
                  onChange={(option) => updateField("languages_id", option?.value || "")}
                  isSearchable
                  isLoading={isLanguageLoading}
                  styles={searchSelectStyles}
                  placeholder={t("settings_general.company_info.language_placeholder")}
                  noOptionsMessage={() => t("settings_general.nothing_found")}
                  loadingMessage={() => t("settings_general.loading")}
                />
                <p className="mt-1.5 text-xs text-gray-500">
                  {t("settings_general.company_info.language_hint")}
                </p>
                {isLanguageError && (
                  <p className="mt-1.5 text-xs text-error-600">
                    {t("settings_general.company_info.language_load_error")}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="company_timezone">{t("settings_general.company_info.timezone_label")}</Label>
                <Select
                  inputId="company_timezone"
                  options={timezoneOptions}
                  value={timezoneOptions.find((option) => option.value === form.timezone) || null}
                  onChange={(option) => updateField("timezone", option?.value || "")}
                  isSearchable
                  styles={searchSelectStyles}
                  placeholder={t("settings_general.company_info.timezone_placeholder")}
                  noOptionsMessage={() => t("settings_general.nothing_found")}
                />
              </div>

              <div>
                <Label htmlFor="company_currency">{t("settings_general.company_info.currency_label")}</Label>
                <Select
                  inputId="company_currency"
                  options={currencyOptions}
                  value={currencyOptions.find((option) => option.value === form.currencies_id) || null}
                  onChange={(option) => updateField("currencies_id", option?.value || "")}
                  isSearchable
                  isLoading={isCurrencyLoading}
                  styles={searchSelectStyles}
                  placeholder={t("settings_general.company_info.currency_placeholder")}
                  noOptionsMessage={() => t("settings_general.nothing_found")}
                  loadingMessage={() => t("settings_general.loading")}
                />
                {isCurrencyError && (
                  <p className="mt-1.5 text-xs text-error-600">
                    {t("settings_general.company_info.currency_load_error")}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="name_format">{t("settings_general.company_info.name_format_label")}</Label>
                <select
                  id="name_format"
                  className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
                  value={form.name_format}
                  onChange={(event) => updateField("name_format", event.target.value)}
                >
                  {nameFormatOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="date_format">{t("settings_general.company_info.date_format_label")}</Label>
                <select
                  id="date_format"
                  className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
                  value={form.date_format}
                  onChange={(event) => updateField("date_format", event.target.value)}
                >
                  {dateFormatOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900">{t("settings_general.personalization.heading")}</h2>
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="grid gap-5 border-b border-gray-100 p-5 md:grid-cols-[1.4fr_1fr] md:p-6">
              <div>
                <Label>{t("settings_general.personalization.logo_label")}</Label>
                <FileInput
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    handleImageUpload("logo", file);
                    event.target.value = "";
                  }}
                />
                <p className="mt-2 text-xs text-gray-500">
                  {t("settings_general.personalization.logo_hint")}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                {form.logo ? (
                  <img src={form.logo} alt="Company logo" className="h-14 w-auto object-contain" />
                ) : (
                  <div className="flex h-14 items-center text-sm text-gray-400">{t("settings_general.personalization.logo_not_selected")}</div>
                )}
              </div>
            </div>

            <div className="grid gap-4 border-b border-gray-100 p-5 md:grid-cols-[1fr_auto] md:items-center md:p-6">
              <div>
                <Label>{t("settings_general.personalization.main_color_label")}</Label>
                <p className="text-xs text-gray-500">
                  {t("settings_general.personalization.main_color_hint")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.main_color}
                  onChange={(event) => updateField("main_color", event.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border border-gray-300 bg-white p-1"
                />
                <Input
                  value={form.main_color}
                  onChange={(event) => updateField("main_color", event.target.value)}
                  className="w-[120px]"
                />
              </div>
            </div>

            <div className="space-y-5 p-5 md:p-6">
              <CoverPreview
                title={t("settings_general.cover.company_toggle")}
                enabled={form.enabled_company_cover}
                image={form.company_cover}
                onToggle={(checked) => updateField("enabled_company_cover", checked)}
                onSelectFile={(file) => handleImageUpload("company_cover", file)}
                inputRef={companyCoverInputRef}
              />

              <CoverPreview
                title={t("settings_general.cover.employee_toggle")}
                enabled={form.enabled_employee_cover}
                image={form.employee_cover}
                onToggle={(checked) => updateField("enabled_employee_cover", checked)}
                onSelectFile={(file) => handleImageUpload("employee_cover", file)}
                inputRef={employeeCoverInputRef}
              />
            </div>
          </div>
        </section>

        <TelegramGroupSection companiesId={form.guid} />

        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white/95 p-4 backdrop-blur">
          <div className="text-sm text-gray-500">
            {isFetching ? t("settings_general.status.refreshing") : statusMessage || t("settings_general.status.unsaved")}
          </div>
          <Button
            onClick={handleSave}
            disabled={updateMutation.isLoading || Boolean(uploadingField)}
            className="min-w-[170px]"
          >
            {updateMutation.isLoading
              ? t("settings_general.action.saving")
              : uploadingField
                ? t("settings_general.action.uploading_file")
                : t("settings_general.action.save_changes")}
          </Button>
        </div>
      </div>
    </>
  );
}
