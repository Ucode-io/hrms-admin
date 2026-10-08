import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { UserRound } from "lucide-react";
import { toast } from "sonner";
import PageMeta from "../../../../components/common/PageMeta";
import Button from "../../../../components/ui/button/Button";
import SidebarAwareFixedFooter from "../../../../components/layout/SidebarAwareFixedFooter";
import { useHeaderBreadcrumbItems } from "../../../../context/HeaderBreadcrumbContext";
import FormSelect from "../../components/FormSelect";
import FormDatePicker from "../../components/FormDatePicker";
import TagsInput from "../../components/TagsInput";
import {
  mapCandidateRow,
  useCandidateQuery,
  useCreateCandidate,
  useUpdateCandidate,
} from "../../../../api/services/candidate.service";
import { useVacanciesQuery } from "../../../../api/services/vacancy.service";
import {
  CANDIDATE_SOURCE_CONFIG,
  CANDIDATE_SOURCE_ORDER,
  createEmptyCandidateDraft,
  candidateDraftFromItem,
  type CandidateDraft,
} from "../../types";
import { useSettingsDirectoryQuery } from "../../../../api/services/settingsDirectory.service";
import { useDynamicValues } from "../../../Settings/CustomFields/useDynamicValues";
import DynamicFieldsBlock from "../../../Settings/CustomFields/DynamicFieldsBlock";
import { useTranslation } from "../../../../i18n";

const CANDIDATE_SOURCES_SLUG = "candidate_sources";

const inputCls =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-800 transition placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";
const labelCls = "mb-1.5 block text-sm font-medium text-gray-700";

const LEVELS = ["Junior", "Middle", "Senior", "Lead"].map((v) => ({ value: v, label: v }));
// Fallback used until the `candidate_sources` directory is populated.
// Значение — код источника: sourceLabel() переводит его при показе.
const FALLBACK_SOURCE_OPTIONS = CANDIDATE_SOURCE_ORDER.map((s) => ({
  value: s,
  get label() {
    return CANDIDATE_SOURCE_CONFIG[s].label;
  },
}));
const CURRENCY_OPTIONS = [
  { value: "UZS", label: "UZS" },
  { value: "USD", label: "USD" },
];

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
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

export default function CandidateForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);
  const presetVacancyId = searchParams.get("vacancyId");

  // Стабильная ссылка — иначе useHeaderBreadcrumbItems зациклит рендер.
  useHeaderBreadcrumbItems(
    useMemo(
      () => [
        { label: t("recruiting.common.breadcrumb_recruiting"), to: "/recruiting/vacancies" },
        { label: t("recruiting.common.breadcrumb_candidates"), to: "/recruiting/candidates" },
        { label: isEdit ? t("recruiting.common.edit") : t("recruiting.candidate_form.new"), to: "#" },
      ],
      [isEdit, t]
    )
  );

  const { data: candidateRow, isLoading } = useCandidateQuery(isEdit ? id : undefined);
  const { data: vacanciesData } = useVacanciesQuery({ limit: 200, offset: 0 });
  const createMutation = useCreateCandidate();
  const updateMutation = useUpdateCandidate();

  const [draft, setDraft] = useState<CandidateDraft>(() =>
    createEmptyCandidateDraft(presetVacancyId)
  );
  /** Динамические поля таблицы candidates. */
  const dynamic = useDynamicValues("candidates");
  const [error, setError] = useState("");

  const { data: sourcesData } = useSettingsDirectoryQuery({
    slug: CANDIDATE_SOURCES_SLUG,
    params: { limit: 200 },
  });
  const sourceOptions = useMemo(() => {
    const fromDirectory = (sourcesData?.response ?? [])
      .map((item) => ({
        value: item.guid,
        label: String(item.title || "").trim() || t("recruiting.common.untitled"),
      }))
      .filter((item) => item.value);
    return fromDirectory.length > 0 ? fromDirectory : FALLBACK_SOURCE_OPTIONS;
  }, [sourcesData, t]);

  const candidate = useMemo(
    () => (candidateRow ? mapCandidateRow(candidateRow) : null),
    [candidateRow]
  );

  useEffect(() => {
    if (isEdit && candidate) {
      setDraft(candidateDraftFromItem(candidate));
      dynamic.reset((candidate as { custom_data?: unknown }).custom_data);
    }
  }, [isEdit, candidate]);

  const vacancyOptions = useMemo(
    () =>
      (vacanciesData?.response ?? [])
        .filter((row) => {
          const status = Array.isArray(row.status) ? row.status[0] : row.status;
          // В выборе — только активные вакансии (текущая вакансия кандидата остаётся).
          return status === "open" || status === "paused" || row.guid === draft.vacancyId;
        })
        .map((row) => ({ value: row.guid, label: String(row.title ?? t("recruiting.common.untitled")) })),
    [vacanciesData, draft.vacancyId, t]
  );

  // Смена вакансии заблокирована, если кандидат уже двигался по этапам.
  const vacancyLocked = isEdit && (candidate?.history.length ?? 0) > 1;

  const set = <K extends keyof CandidateDraft>(key: K, value: CandidateDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const isSaving = createMutation.isLoading || updateMutation.isLoading;

  const handleSubmit = async () => {
    if (!draft.firstName.trim() || !draft.lastName.trim()) {
      setError(t("recruiting.candidate_form.name_required"));
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (!draft.vacancyId) {
      setError(t("recruiting.candidate_form.vacancy_required"));
      window.scrollTo({ top: 0, behavior: "smooth" });
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
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
      };
      if (isEdit && id) {
        await updateMutation.mutateAsync({ guid: id, draft: payload });
        toast.success(t("recruiting.candidate_form.updated"));
        navigate(`/recruiting/candidates/${id}`);
      } else {
        await createMutation.mutateAsync(payload);
        toast.success(t("recruiting.candidate_form.created"));
        navigate(
          presetVacancyId ? `/recruiting/vacancies/${presetVacancyId}` : "/recruiting/candidates"
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t("recruiting.common.save_failed");
      setError(message);
      toast.error(message);
      window.scrollTo({ top: 0, behavior: "smooth" });
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
        title={t("recruiting.common.page_suffix", { title: isEdit ? t("recruiting.candidate_form.edit_title") : t("recruiting.candidate_form.new") })}
        description={t("recruiting.candidate_form.description")}
      />

      <div className="mx-auto max-w-[920px] space-y-5 pb-24">
        {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p>}

        {/* Header banner */}
        <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-6 py-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <UserRound size={20} />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {isEdit ? t("recruiting.candidate_form.editing") : t("recruiting.candidate_form.new")}
            </h2>
            <p className="text-sm text-gray-500">
              {isEdit
                ? t("recruiting.candidate_form.edit_hint")
                : t("recruiting.candidate_form.create_hint")}
            </p>
          </div>
        </div>

        <Card title={t("recruiting.candidate_form.personal")}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("recruiting.candidate_form.last_name")} required>
                <input
                  className={inputCls}
                  value={draft.lastName}
                  onChange={(e) => set("lastName", e.target.value)}
                  placeholder={t("recruiting.candidate_form.last_name")}
                />
              </Field>
              <Field label={t("recruiting.candidate_form.first_name")} required>
                <input
                  className={inputCls}
                  value={draft.firstName}
                  onChange={(e) => set("firstName", e.target.value)}
                  placeholder={t("recruiting.candidate_form.first_name")}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Email">
                <input
                  type="email"
                  className={inputCls}
                  value={draft.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="email@example.com"
                />
              </Field>
              <Field label={t("recruiting.common.phone")}>
                <input
                  className={inputCls}
                  value={draft.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="+998 90 123 45 67"
                />
              </Field>
            </div>
            <Field label={t("recruiting.candidate_form.links")}>
              <TagsInput
                value={draft.links}
                onChange={(v) => set("links", v)}
                placeholder={t("recruiting.candidate_form.links_placeholder")}
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("recruiting.common.level")}>
                <FormSelect
                  options={LEVELS}
                  value={draft.level}
                  onChange={(v) => set("level", v)}
                  isSearchable={false}
                  menuPortal
                />
              </Field>
              <Field label={t("recruiting.common.skills")}>
                <TagsInput
                  value={draft.skills}
                  onChange={(v) => set("skills", v)}
                  placeholder={t("recruiting.candidate_form.skill_placeholder")}
                />
              </Field>
            </div>

            <DynamicFieldsBlock
              fields={dynamic.fields}
              values={dynamic.values}
              errors={dynamic.errors}
              onChange={dynamic.setValue}
              brandColor="#465FFF"
            />
          </div>
        </Card>

        <Card title={t("recruiting.common.applied")}>
          <div className="space-y-4">
            <Field label={t("recruiting.common.vacancy")} required>
              <FormSelect
                options={vacancyOptions}
                value={draft.vacancyId}
                onChange={(v) => set("vacancyId", v || null)}
                placeholder={t("recruiting.candidate_form.select_vacancy")}
                isDisabled={vacancyLocked}
                menuPortal
              />
              {vacancyLocked && (
                <p className="mt-1.5 text-xs text-gray-400">
                  {t("recruiting.candidate_form.vacancy_locked")}
                </p>
              )}
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("recruiting.common.source")}>
                <FormSelect
                  options={sourceOptions}
                  value={draft.source}
                  onChange={(v) => set("source", (v as string) || "")}
                  isSearchable={false}
                  menuPortal
                />
              </Field>
              <Field label={t("recruiting.common.applied_date")}>
                <FormDatePicker value={draft.appliedDate} onChange={(v) => set("appliedDate", v)} />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_120px]">
              <Field label={t("recruiting.common.salary_expectation")}>
                <input
                  type="number"
                  className={inputCls}
                  value={draft.salaryExpectation ?? ""}
                  onChange={(e) =>
                    set("salaryExpectation", e.target.value ? Number(e.target.value) : null)
                  }
                  placeholder={t("recruiting.candidate_form.amount")}
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
            <Field label={t("recruiting.candidate_form.resume_link")}>
              <input
                className={inputCls}
                value={draft.resumeUrl ?? ""}
                onChange={(e) => set("resumeUrl", e.target.value || null)}
                placeholder="https://..."
              />
            </Field>
            <Field label={t("recruiting.common.notes")}>
              <textarea
                rows={3}
                className={`${inputCls} h-auto resize-none py-2.5`}
                value={draft.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder={t("recruiting.candidate_form.notes_placeholder")}
              />
            </Field>
          </div>
        </Card>
      </div>

      {/* Sticky save bar */}
      <SidebarAwareFixedFooter>
        <span className="text-sm text-gray-500">
          {isEdit ? t("recruiting.candidate_form.editing") : t("recruiting.candidate_form.new")}
        </span>
        <div className="ml-auto flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate(-1)} className="px-5">
            {t("recruiting.common.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving} className="px-6">
            {isSaving ? t("recruiting.common.saving") : isEdit ? t("recruiting.common.save") : t("recruiting.create_candidate")}
          </Button>
        </div>
      </SidebarAwareFixedFooter>
    </>
  );
}
