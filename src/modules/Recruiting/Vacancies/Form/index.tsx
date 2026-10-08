import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Briefcase, ListChecks } from "lucide-react";
import { toast } from "sonner";
import PageMeta from "../../../../components/common/PageMeta";
import Button from "../../../../components/ui/button/Button";
import SidebarAwareFixedFooter from "../../../../components/layout/SidebarAwareFixedFooter";
import { useHeaderBreadcrumbItems } from "../../../../context/HeaderBreadcrumbContext";
import FormSelect from "../../components/FormSelect";
import FormDatePicker from "../../components/FormDatePicker";
import TagsInput from "../../components/TagsInput";
import RichTextEditor from "../../../../components/form/RichTextEditor";
import { sanitizeRichText } from "../../../../components/form/richText";
import { MOCK_DEPARTMENTS, MOCK_LOCATIONS, MOCK_POSITIONS } from "../../mock/mockApi";
import { RECRUITING_USE_MOCK } from "../../mock/mockConfig";
import { useDepartmentsSettingsQuery } from "../../../../api/services/department.service";
import { useLocationsQuery } from "../../../../api/services/location.service";
import { usePositionsQuery } from "../../../../api/services/position.service";
import {
  mapVacancyRow,
  useCreateVacancy,
  useUpdateVacancy,
  useVacancyQuery,
} from "../../../../api/services/vacancy.service";
import {
  mapStageTemplateRow,
  useStageTemplatesQuery,
} from "../../../../api/services/stageTemplate.service";
import { useDynamicValues } from "../../../Settings/CustomFields/useDynamicValues";
import DynamicFieldsBlock from "../../../Settings/CustomFields/DynamicFieldsBlock";
import {
  STAGE_COLOR_CONFIG,
  VACANCY_PRIORITY_CONFIG,
  VACANCY_STATUS_CONFIG,
  VACANCY_STATUS_ORDER,
  WORK_MODE_CONFIG,
  EMPLOYMENT_TYPE_KEYS,
  employmentTypeLabel,
  cloneStagesWithNewIds,
  createEmptyVacancyDraft,
  vacancyDraftFromItem,
  type VacancyDraft,
  type VacancyPriority,
  type VacancyStatus,
  type WorkMode,
} from "../../types";
import { useTranslation } from "../../../../i18n";

const inputCls =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-800 transition placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";
const labelCls = "mb-1.5 block text-sm font-medium text-gray-700";

const LEVELS = ["Junior", "Middle", "Senior", "Lead"].map((v) => ({ value: v, label: v }));
const EMPLOYMENT_TYPES = Object.keys(EMPLOYMENT_TYPE_KEYS).map((v) => ({
  value: v,
  get label() {
    return employmentTypeLabel(v);
  },
}));
const WORK_MODE_OPTIONS = (["office", "remote", "hybrid"] as WorkMode[]).map((v) => ({
  value: v,
  get label() {
    return WORK_MODE_CONFIG[v].label;
  },
}));
const STATUS_OPTIONS = VACANCY_STATUS_ORDER.map((v) => ({
  value: v,
  get label() {
    return VACANCY_STATUS_CONFIG[v].label;
  },
}));
const PRIORITY_OPTIONS = (["high", "medium", "low"] as VacancyPriority[]).map((v) => ({
  value: v,
  get label() {
    return VACANCY_PRIORITY_CONFIG[v].label;
  },
}));
const CURRENCY_OPTIONS = [
  { value: "UZS", label: "UZS" },
  { value: "USD", label: "USD" },
];

const Card = ({ title, children }: { title: React.ReactNode; children: React.ReactNode }) => (
  <div className="rounded-2xl border border-gray-200 bg-white">
    <div className="border-b border-gray-100 px-6 py-4 text-[15px] font-semibold text-gray-900">{title}</div>
    <div className="p-6">{children}</div>
  </div>
);

const Field = ({
  label,
  required,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={className}>
    <label className={labelCls}>
      {label} {required && <span className="text-rose-500">*</span>}
    </label>
    {children}
  </div>
);

export default function VacancyForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  // Стабильная ссылка — иначе useHeaderBreadcrumbItems зациклит рендер.
  useHeaderBreadcrumbItems(
    useMemo(
      () => [
        { label: t("recruiting.common.breadcrumb_recruiting"), to: "/recruiting/vacancies" },
        { label: t("recruiting.vacancies_list.breadcrumb_vacancies"), to: "/recruiting/vacancies" },
        { label: isEdit ? t("recruiting.common.edit") : t("recruiting.vacancy_form.new"), to: "#" },
      ],
      [isEdit, t]
    )
  );

  const { data: vacancyRow, isLoading } = useVacancyQuery(isEdit ? id : undefined);
  const { data: templatesData } = useStageTemplatesQuery();
  const { data: departmentsData } = useDepartmentsSettingsQuery({
    params: { limit: 200 },
    querySettings: { enabled: !RECRUITING_USE_MOCK },
  });
  const { data: positionsData } = usePositionsQuery({
    params: { all: true },
    querySettings: { enabled: !RECRUITING_USE_MOCK },
  });
  const { data: locationsData } = useLocationsQuery({
    params: { limit: 200 },
    querySettings: { enabled: !RECRUITING_USE_MOCK },
  });
  const createMutation = useCreateVacancy();
  const updateMutation = useUpdateVacancy();

  const [draft, setDraft] = useState<VacancyDraft>(createEmptyVacancyDraft);
  /** Динамические поля таблицы vacancies. */
  const dynamic = useDynamicValues("vacancies");
  const [error, setError] = useState("");
  const [templateApplied, setTemplateApplied] = useState(false);

  const templates = useMemo(
    () => (templatesData?.response ?? []).map(mapStageTemplateRow),
    [templatesData]
  );
  const departmentOptions = useMemo(
    () =>
      RECRUITING_USE_MOCK
        ? MOCK_DEPARTMENTS
        : (departmentsData?.response ?? []).map((item) => ({
            value: item.guid,
            label: item.title || t("recruiting.common.untitled"),
          })),
    [departmentsData?.response, t]
  );
  const positionOptions = useMemo(
    () =>
      RECRUITING_USE_MOCK
        ? MOCK_POSITIONS
        : (positionsData?.response ?? []).map((item) => ({
            value: item.guid,
            label: item.title || t("recruiting.common.untitled"),
          })),
    [positionsData?.response, t]
  );
  const locationOptions = useMemo(
    () =>
      RECRUITING_USE_MOCK
        ? MOCK_LOCATIONS
        : (locationsData?.response ?? []).map((item) => ({
            value: item.guid,
            label: item.title || t("recruiting.common.untitled"),
          })),
    [locationsData?.response, t]
  );

  useEffect(() => {
    if (isEdit && vacancyRow) {
      setDraft(vacancyDraftFromItem(mapVacancyRow(vacancyRow)));
      dynamic.reset((vacancyRow as { custom_data?: unknown }).custom_data);
      setTemplateApplied(true);
    }
  }, [isEdit, vacancyRow]);

  // Create mode: pre-fill stages from the default template once templates load.
  useEffect(() => {
    if (isEdit || templateApplied || templates.length === 0) return;
    const def = templates.find((t) => t.isDefault) ?? templates[0];
    setDraft((prev) => ({
      ...prev,
      stageTemplateId: def.id,
      stages: cloneStagesWithNewIds(def.stages),
    }));
    setTemplateApplied(true);
  }, [isEdit, templateApplied, templates]);

  const set = <K extends keyof VacancyDraft>(key: K, value: VacancyDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const applyTemplate = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    setDraft((prev) => ({
      ...prev,
      stageTemplateId: template.id,
      stages: cloneStagesWithNewIds(template.stages),
    }));
  };

  const templateOptions = useMemo(
    () => templates.map((tpl) => ({
      value: tpl.id,
      label: tpl.isDefault ? t("recruiting.vacancy_form.template_default", { name: tpl.name }) : tpl.name,
    })),
    [templates, t]
  );

  const isSaving = createMutation.isLoading || updateMutation.isLoading;

  const handleSubmit = async () => {
    if (!draft.title.trim()) {
      setError(t("recruiting.vacancy_form.title_required"));
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (draft.salaryMin && draft.salaryMax && draft.salaryMin > draft.salaryMax) {
      setError(t("recruiting.vacancy_form.salary_range_error"));
      return;
    }
    if (draft.stages.length === 0) {
      setError(t("recruiting.common.no_stages_error"));
      return;
    }
    if (draft.stages.some((s) => !s.name.trim())) {
      setError(t("recruiting.common.stage_names_error"));
      return;
    }
    // Правила динамических полей проверяем до запроса.
    if (!dynamic.validate()) {
      setError(t("recruiting.common.extra_fields_error"));
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      return;
    }
    try {
      const payload = {
        ...draft,
        ...dynamic.toPayload("customData"),
        title: draft.title.trim(),
        description: sanitizeRichText(draft.description),
        responsibilities: "",
        requirements: "",
        conditions: "",
      };
      if (isEdit && id) {
        await updateMutation.mutateAsync({ guid: id, draft: payload });
        toast.success(t("recruiting.vacancy_form.updated"));
        navigate(`/recruiting/vacancies/${id}`);
      } else {
        await createMutation.mutateAsync(payload);
        toast.success(t("recruiting.vacancy_form.created"));
        navigate("/recruiting/vacancies");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("recruiting.common.save_failed"));
    }
  };

  if (isEdit && isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <PageMeta
        title={t("recruiting.common.page_suffix", { title: isEdit ? t("recruiting.vacancy_form.edit_title") : t("recruiting.vacancy_form.new") })}
        description={t("recruiting.vacancy_form.description")}
      />

      <div className="mx-auto max-w-[920px] space-y-5 pb-24">
        {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p>}

        {/* Header banner */}
        <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-6 py-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Briefcase size={20} />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {isEdit ? t("recruiting.vacancy_form.editing") : t("recruiting.vacancy_form.new")}
            </h2>
            <p className="text-sm text-gray-500">{t("recruiting.vacancy_form.subtitle")}</p>
          </div>
        </div>

        <Card title={t("recruiting.vacancy_form.main")}>
          <div className="space-y-4">
            <Field label={t("recruiting.vacancy_form.title_label")} required>
              <input
                className={inputCls}
                value={draft.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder={t("recruiting.vacancy_form.title_placeholder")}
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("recruiting.common.department")}>
                <FormSelect
                  options={departmentOptions}
                  value={draft.departmentId}
                  onChange={(v) => set("departmentId", v || null)}
                  placeholder={t("recruiting.vacancy_form.select_department")}
                  isClearable
                  menuPortal
                />
              </Field>
              <Field label={t("recruiting.common.position")}>
                <FormSelect
                  options={positionOptions}
                  value={draft.positionId}
                  onChange={(v) => set("positionId", v || null)}
                  placeholder={t("recruiting.common.position")}
                  isClearable
                  menuPortal
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("recruiting.vacancy_form.tag")}>
                <input
                  className={`${inputCls} uppercase`}
                  value={draft.tag}
                  onChange={(e) => set("tag", e.target.value.toUpperCase())}
                  placeholder="BACKEND"
                />
              </Field>
              <Field label={t("recruiting.common.level")}>
                <FormSelect
                  options={LEVELS}
                  value={draft.experienceLevel}
                  onChange={(v) => set("experienceLevel", v)}
                  isSearchable={false}
                  menuPortal
                />
              </Field>
            </div>
            <Field label={t("recruiting.vacancy_form.key_skills")}>
              <TagsInput
                value={draft.skills}
                onChange={(v) => set("skills", v)}
                placeholder={t("recruiting.vacancy_form.skill_placeholder")}
              />
            </Field>

            {dynamic.fields.length > 0 && (
              <div className="sm:col-span-2">
                <DynamicFieldsBlock
                  fields={dynamic.fields}
                  values={dynamic.values}
                  errors={dynamic.errors}
                  onChange={dynamic.setValue}
                  brandColor="#465FFF"
                />
              </div>
            )}
          </div>
        </Card>

        <Card
          title={
            <span className="inline-flex items-center gap-2">
              <ListChecks size={17} className="text-brand-500" />
              {t("recruiting.common.recruiting_stages")}
            </span>
          }
        >
          <div className="space-y-4">
            <Field label={t("recruiting.vacancy_form.stage_template")}>
              <FormSelect
                options={templateOptions}
                value={draft.stageTemplateId}
                onChange={applyTemplate}
                placeholder={templates.length ? t("recruiting.vacancy_form.select_template") : t("recruiting.templates.empty")}
                isSearchable={false}
                isDisabled={templates.length === 0}
                menuPortal
              />
              <p className="mt-1.5 text-xs text-gray-400">
                {t("recruiting.vacancy_form.template_hint")}
              </p>
            </Field>
            {draft.stages.length > 0 && (
              <ol className="space-y-2">
                {draft.stages.map((stage, i) => (
                  <li
                    key={stage.id}
                    className="flex items-center gap-2.5 rounded-xl border border-gray-100 px-3 py-2.5"
                  >
                    <span className="w-4 text-center text-[11px] font-semibold text-gray-300">
                      {i + 1}
                    </span>
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${STAGE_COLOR_CONFIG[stage.color].dotClassName}`}
                    />
                    <span className="flex-1 truncate text-sm text-gray-700">{stage.name}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </Card>

        <Card title={t("recruiting.vacancy_description.conditions")}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label={t("recruiting.common.location")}>
                <FormSelect
                  options={locationOptions}
                  value={draft.locationId}
                  onChange={(v) => set("locationId", v || null)}
                  placeholder={t("recruiting.common.location")}
                  isClearable
                  menuPortal
                />
              </Field>
              <Field label={t("recruiting.common.work_mode")}>
                <FormSelect
                  options={WORK_MODE_OPTIONS}
                  value={draft.workMode}
                  onChange={(v) => set("workMode", v as WorkMode)}
                  isSearchable={false}
                  menuPortal
                />
              </Field>
              <Field label={t("recruiting.common.employment_type")}>
                <FormSelect
                  options={EMPLOYMENT_TYPES}
                  value={draft.employmentType}
                  onChange={(v) => set("employmentType", v)}
                  isSearchable={false}
                  menuPortal
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_1fr_120px]">
              <Field label={t("recruiting.vacancy_form.salary_from")}>
                <input
                  type="number"
                  className={inputCls}
                  value={draft.salaryMin ?? ""}
                  onChange={(e) => set("salaryMin", e.target.value ? Number(e.target.value) : null)}
                  placeholder={t("recruiting.vacancy_form.from")}
                />
              </Field>
              <Field label={t("recruiting.vacancy_form.salary_to")}>
                <input
                  type="number"
                  className={inputCls}
                  value={draft.salaryMax ?? ""}
                  onChange={(e) => set("salaryMax", e.target.value ? Number(e.target.value) : null)}
                  placeholder={t("recruiting.vacancy_form.to")}
                />
              </Field>
              <Field label={t("recruiting.vacancy_form.openings")}>
                <input
                  type="number"
                  min={1}
                  className={inputCls}
                  value={draft.openings}
                  onChange={(e) => set("openings", Math.max(1, Number(e.target.value) || 1))}
                />
              </Field>
              <Field label={t("recruiting.common.currency")}>
                <FormSelect
                  options={CURRENCY_OPTIONS}
                  value={draft.salaryCurrency}
                  onChange={(v) => set("salaryCurrency", v)}
                  isSearchable={false}
                  menuPortal
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("recruiting.common.status")}>
                <FormSelect
                  options={STATUS_OPTIONS}
                  value={draft.status}
                  onChange={(v) => {
                    const next = v as VacancyStatus;
                    set("status", next);
                    // Auto-stamp / clear the closing date alongside the status.
                    if (next === "closed") {
                      if (!draft.closedAt) set("closedAt", new Date().toISOString().slice(0, 10));
                    } else {
                      set("closedAt", null);
                    }
                  }}
                  isSearchable={false}
                  menuPortal
                />
              </Field>
              <Field label={t("recruiting.common.priority")}>
                <FormSelect
                  options={PRIORITY_OPTIONS}
                  value={draft.priority}
                  onChange={(v) => set("priority", v as VacancyPriority)}
                  isSearchable={false}
                  menuPortal
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("recruiting.vacancy_form.opened_at")}>
                <FormDatePicker value={draft.openedAt} onChange={(v) => set("openedAt", v)} />
              </Field>
              <Field label={t("recruiting.common.deadline")}>
                <FormDatePicker value={draft.deadline} onChange={(v) => set("deadline", v)} />
              </Field>
            </div>

            {draft.status === "closed" && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={t("recruiting.vacancy_form.closed_at")}>
                  <FormDatePicker value={draft.closedAt} onChange={(v) => set("closedAt", v)} />
                </Field>
              </div>
            )}
          </div>
        </Card>

        <Card title={t("recruiting.vacancy_description.description")}>
          <p className="mb-3 text-xs text-gray-400">
            {t("recruiting.vacancy_form.description_hint")}
          </p>
          <RichTextEditor
            value={draft.description}
            onChange={(html) => set("description", html)}
            disabled={isSaving}
            minHeight={280}
          />
        </Card>
      </div>

      {/* Sticky save bar */}
      <SidebarAwareFixedFooter>
        <span className="text-sm text-gray-500">
          {isEdit ? t("recruiting.vacancy_form.editing") : t("recruiting.vacancy_form.new")}
        </span>
        <div className="ml-auto flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate(-1)} className="px-5">
            {t("recruiting.common.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving} className="px-6">
            {isSaving ? t("recruiting.common.saving") : isEdit ? t("recruiting.common.save") : t("recruiting.create_vacancy")}
          </Button>
        </div>
      </SidebarAwareFixedFooter>
    </>
  );
}
