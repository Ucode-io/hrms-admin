import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ImagePlus } from "lucide-react";
import PageMeta from "../../../components/common/PageMeta";
import Label from "../../../components/form/Label";
import Input from "../../../components/form/input/InputField";
import Button from "../../../components/ui/button/Button";
import Spinner from "../../../components/ui/Spinner";
import Switch from "../../../components/form/switch/Switch";
import {
  CAREER_SITE_DOMAIN,
  type CareerSiteConfig,
  type CareerSiteConfigInput,
  useCareerSiteConfigQuery,
  useSaveCareerSiteConfig,
} from "../../../api/services/careerSiteSettings.service";
import { useUploadFile } from "../../../api/services/file-upload.service";
import { useTranslation } from "../../../i18n";

type ImageField = "logo_url" | "favicon_url" | "bg_image_url";

type FormState = CareerSiteConfigInput;

const EMPTY_FORM: FormState = {
  enabled: false,
  subdomain: "",
  title: "",
  description: "",
  main_color: "#465FFF",
  accent_color: "#7C4DFF",
  logo_url: "",
  favicon_url: "",
  bg_image_url: "",
  hero_headline: "",
  hero_subtitle: "",
  about_text: "",
  contact_email: "",
  website_url: "",
};

const toFormState = (config: CareerSiteConfig | null): FormState => {
  if (!config) return { ...EMPTY_FORM };
  return {
    enabled: config.enabled,
    subdomain: config.subdomain,
    title: config.title,
    description: config.description,
    main_color: config.main_color || EMPTY_FORM.main_color,
    accent_color: config.accent_color || EMPTY_FORM.accent_color,
    logo_url: config.logo_url,
    favicon_url: config.favicon_url,
    bg_image_url: config.bg_image_url,
    hero_headline: config.hero_headline,
    hero_subtitle: config.hero_subtitle,
    about_text: config.about_text,
    contact_email: config.contact_email,
    website_url: config.website_url,
  };
};

// Keep the input to valid DNS-label characters as the user types.
const sanitizeSubdomain = (raw: string): string =>
  raw
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+/, "");

export default function CareerSiteSettingsPage() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useCareerSiteConfigQuery();
  const saveMutation = useSaveCareerSiteConfig();
  const uploadMutation = useUploadFile({ folder: "Media" });

  const [form, setForm] = useState<FormState | null>(null);
  const [uploadingField, setUploadingField] = useState<ImageField | null>(null);

  useEffect(() => {
    // `data` is undefined while loading, null when no config exists yet.
    if (data !== undefined) setForm(toFormState(data));
  }, [data]);

  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleImageUpload = async (field: ImageField, file: File) => {
    try {
      setUploadingField(field);
      const url = await uploadMutation.mutateAsync(file);
      updateField(field, url);
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error(t("settings_misc.career_site.upload_error"));
    } finally {
      setUploadingField(null);
    }
  };

  const handleSave = async () => {
    if (!form) return;

    if (form.enabled && !form.subdomain.trim()) {
      toast.error(t("settings_misc.career_site.subdomain_required"));
      return;
    }

    try {
      await saveMutation.mutateAsync({
        ...form,
        subdomain: form.subdomain.trim(),
        title: form.title.trim(),
        contact_email: form.contact_email.trim(),
        website_url: form.website_url.trim(),
      });
      toast.success(t("settings_misc.career_site.save_success"));
    } catch (error) {
      console.error("Save career site settings failed:", error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("settings_misc.career_site.save_error");
      toast.error(message);
    }
  };

  if (isError) {
    return (
      <>
        <PageMeta title={t("settings_misc.career_site.page_title")} description={t("settings_misc.career_site.page_description")} />
        <div className="rounded-2xl border border-error-200 bg-error-50 p-5 text-sm text-error-700">
          {t("settings_misc.career_site.load_error")}
        </div>
      </>
    );
  }

  if (isLoading || !form) {
    return (
      <>
        <PageMeta title={t("settings_misc.career_site.page_title")} description={t("settings_misc.career_site.page_description")} />
        <div className="flex min-h-[360px] items-center justify-center">
          <Spinner />
        </div>
      </>
    );
  }

  const fullUrl = form.subdomain.trim()
    ? `${form.subdomain.trim()}.${CAREER_SITE_DOMAIN}`
    : `example.${CAREER_SITE_DOMAIN}`;

  return (
    <>
      <PageMeta title={t("settings_misc.career_site.page_title")} description={t("settings_misc.career_site.page_description")} />

      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold text-gray-900">{t("settings_misc.career_site.heading")}</h1>
          <p className="text-sm text-gray-500">
            {t("settings_misc.career_site.subheading")}
          </p>
        </div>

        {/* Enable + subdomain */}
        <section className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-5 md:p-6">
              <div>
                <p className="text-base font-semibold text-gray-900">{t("settings_misc.career_site.heading")}</p>
                <p className="text-sm text-gray-500">
                  {form.enabled
                    ? t("settings_misc.career_site.status_enabled_hint")
                    : t("settings_misc.career_site.status_disabled_hint")}
                </p>
              </div>
              <Switch
                label={form.enabled ? t("settings_misc.career_site.switch_on") : t("settings_misc.career_site.switch_off")}
                defaultChecked={form.enabled}
                onChange={(checked) => updateField("enabled", checked)}
              />
            </div>

            <div className="p-5 md:p-6">
              <Label htmlFor="subdomain">{t("settings_misc.career_site.subdomain_label")}</Label>
              <div className="flex items-stretch">
                <input
                  id="subdomain"
                  value={form.subdomain}
                  onChange={(event) =>
                    updateField("subdomain", sanitizeSubdomain(event.target.value))
                  }
                  placeholder="example"
                  className="h-11 w-full min-w-0 rounded-l-lg border border-r-0 border-gray-300 px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
                />
                <span className="inline-flex select-none items-center rounded-r-lg border border-l-0 border-gray-300 bg-gray-50 px-4 text-sm font-medium text-gray-500">
                  .{CAREER_SITE_DOMAIN}
                </span>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {t("settings_misc.career_site.subdomain_rules_hint")}{" "}
                <span className="font-medium text-gray-700">https://{fullUrl}</span>
              </p>
            </div>
          </div>
        </section>

        {/* Branding */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900">{t("settings_misc.career_site.branding_heading")}</h2>
          <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 md:p-6">
            <div>
              <Label htmlFor="title">{t("settings_misc.career_site.title_label")}</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(event) => updateField("title", event.target.value)}
              />
              <p className="mt-1.5 text-xs text-gray-500">
                {t("settings_misc.career_site.title_hint")}
              </p>
            </div>

            <div>
              <Label htmlFor="description">{t("settings_misc.career_site.description_label")}</Label>
              <textarea
                id="description"
                value={form.description}
                onChange={(event) => updateField("description", event.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
              />
              <p className="mt-1.5 text-xs text-gray-500">
                {t("settings_misc.career_site.description_hint")}
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <ColorField
                label={t("settings_misc.career_site.main_color_label")}
                value={form.main_color}
                onChange={(value) => updateField("main_color", value)}
              />
              <ColorField
                label={t("settings_misc.career_site.accent_color_label")}
                value={form.accent_color}
                onChange={(value) => updateField("accent_color", value)}
              />
            </div>

            <ImageField
              label={t("settings_misc.career_site.logo_label")}
              hint={t("settings_misc.career_site.logo_hint")}
              value={form.logo_url}
              uploading={uploadingField === "logo_url"}
              onSelect={(file) => handleImageUpload("logo_url", file)}
              preview="contain"
            />

            <ImageField
              label={t("settings_misc.career_site.favicon_label")}
              hint={t("settings_misc.career_site.favicon_hint")}
              value={form.favicon_url}
              uploading={uploadingField === "favicon_url"}
              onSelect={(file) => handleImageUpload("favicon_url", file)}
              preview="contain"
            />

            <ImageField
              label={t("settings_misc.career_site.bg_image_label")}
              hint={t("settings_misc.career_site.bg_image_hint")}
              value={form.bg_image_url}
              uploading={uploadingField === "bg_image_url"}
              onSelect={(file) => handleImageUpload("bg_image_url", file)}
              preview="cover"
            />
          </div>
        </section>

        {/* Hero + content */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900">{t("settings_misc.career_site.hero_heading")}</h2>
          <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 md:p-6">
            <div>
              <Label htmlFor="hero_headline">{t("settings_misc.career_site.hero_headline_label")}</Label>
              <Input
                id="hero_headline"
                value={form.hero_headline}
                onChange={(event) => updateField("hero_headline", event.target.value)}
                placeholder={t("settings_misc.career_site.hero_headline_placeholder")}
              />
            </div>
            <div>
              <Label htmlFor="hero_subtitle">{t("settings_misc.career_site.hero_subtitle_label")}</Label>
              <textarea
                id="hero_subtitle"
                value={form.hero_subtitle}
                onChange={(event) => updateField("hero_subtitle", event.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
              />
            </div>
            <div>
              <Label htmlFor="about_text">{t("settings_misc.career_site.about_text_label")}</Label>
              <textarea
                id="about_text"
                value={form.about_text}
                onChange={(event) => updateField("about_text", event.target.value)}
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
              />
            </div>
          </div>
        </section>

        {/* Contacts */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900">{t("settings_misc.career_site.contacts_heading")}</h2>
          <div className="grid gap-5 rounded-2xl border border-gray-200 bg-white p-5 sm:grid-cols-2 md:p-6">
            <div>
              <Label htmlFor="contact_email">{t("settings_misc.career_site.contact_email_label")}</Label>
              <Input
                id="contact_email"
                type="email"
                value={form.contact_email}
                onChange={(event) => updateField("contact_email", event.target.value)}
                placeholder="hr@company.com"
              />
            </div>
            <div>
              <Label htmlFor="website_url">{t("settings_misc.career_site.website_url_label")}</Label>
              <Input
                id="website_url"
                value={form.website_url}
                onChange={(event) => updateField("website_url", event.target.value)}
                placeholder="https://company.com"
              />
            </div>
          </div>
        </section>

        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white/95 p-4 backdrop-blur">
          <div className="text-sm text-gray-500">
            {uploadingField ? t("settings_misc.career_site.uploading_file") : t("settings_misc.career_site.unsaved_changes")}
          </div>
          <Button
            onClick={handleSave}
            disabled={saveMutation.isLoading || Boolean(uploadingField)}
            className="min-w-[170px]"
          >
            {saveMutation.isLoading
              ? t("settings_misc.career_site.saving")
              : uploadingField
                ? t("settings_misc.career_site.uploading_file")
                : t("settings_misc.career_site.save_button")}
          </Button>
        </div>
      </div>
    </>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-14 cursor-pointer rounded border border-gray-300 bg-white p-1"
        />
        <Input value={value} onChange={(event) => onChange(event.target.value)} />
      </div>
    </div>
  );
}

function ImageField({
  label,
  hint,
  value,
  uploading,
  onSelect,
  preview,
}: {
  label: string;
  hint: string;
  value: string;
  uploading: boolean;
  onSelect: (file: File) => void;
  preview: "cover" | "contain";
}) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-4 border-t border-gray-100 pt-5 md:grid-cols-[1.4fr_1fr] md:items-center">
      <div>
        <Label>{label}</Label>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50">
          <ImagePlus size={14} />
          {uploading ? t("settings_misc.career_site.uploading") : value ? t("settings_misc.career_site.replace") : t("settings_misc.career_site.upload")}
          <input
            type="file"
            accept=".png,.jpg,.jpeg,.webp,.svg"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              onSelect(file);
              event.target.value = "";
            }}
          />
        </label>
        <p className="mt-2 text-xs text-gray-500">{hint}</p>
      </div>
      <div
        className="flex h-24 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
        style={
          value && preview === "cover"
            ? {
                backgroundImage: `url(${value})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        {value && preview === "contain" ? (
          <img src={value} alt={label} className="max-h-16 w-auto object-contain" />
        ) : !value ? (
          <span className="text-sm text-gray-400">{t("settings_misc.career_site.not_selected")}</span>
        ) : null}
      </div>
    </div>
  );
}
