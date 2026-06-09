import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { ChevronLeft, Loader2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import PageMeta from "../../../../components/common/PageMeta";
import Button from "../../../../components/ui/button/Button";
import SidebarAwareFixedFooter from "../../../../components/layout/SidebarAwareFixedFooter";
import { useHeaderBreadcrumbItems } from "../../../../context/HeaderBreadcrumbContext";
import Avatar from "../../components/Avatar";
import { RatingStars } from "../../components/Chips";
import FormSelect from "../../components/FormSelect";
import FormDatePicker from "../../components/FormDatePicker";
import TagsInput from "../../components/TagsInput";
import { MOCK_EMPLOYEES } from "../../mock/mockStore";
import { RECRUITING_USE_MOCK } from "../../mock/mockConfig";
import {
  mapCandidateRow,
  useCandidateQuery,
  useCreateCandidate,
  useUpdateCandidate,
} from "../../../../api/services/candidate.service";
import { mapVacancyRow, useVacanciesQuery } from "../../../../api/services/vacancy.service";
import {
  CANDIDATE_REJECTION_REASON_CONFIG,
  CANDIDATE_REJECTION_REASON_ORDER,
  CANDIDATE_SOURCE_CONFIG,
  CANDIDATE_SOURCE_ORDER,
  CANDIDATE_STAGE_CONFIG,
  CANDIDATE_STAGE_ORDER,
  GENDER_CONFIG,
  NEGATIVE_STAGES,
  createEmptyCandidateDraft,
  candidateDraftFromItem,
  type CandidateDraft,
  type CandidateRejectionReason,
  type CandidateSource,
  type CandidateStage,
  type Gender,
} from "../../types";

const inputCls =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-800 transition placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";
const labelCls = "mb-1.5 block text-sm font-medium text-gray-700";

const LEVELS = ["Junior", "Middle", "Senior", "Lead"].map((v) => ({ value: v, label: v }));
const STAGE_OPTIONS = CANDIDATE_STAGE_ORDER.map((v) => ({ value: v, label: CANDIDATE_STAGE_CONFIG[v].label }));
const SOURCE_OPTIONS = CANDIDATE_SOURCE_ORDER.map((v) => ({ value: v, label: CANDIDATE_SOURCE_CONFIG[v].label }));
const REASON_OPTIONS = CANDIDATE_REJECTION_REASON_ORDER.map((v) => ({
  value: v,
  label: CANDIDATE_REJECTION_REASON_CONFIG[v].label,
}));
const CURRENCY_OPTIONS = [
  { value: "UZS", label: "UZS" },
  { value: "USD", label: "USD" },
];
const GENDER_OPTIONS = (["male", "female"] as Gender[]).map((v) => ({ value: v, label: GENDER_CONFIG[v].label }));

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
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);
  const presetVacancyId = searchParams.get("vacancy") || "";

  useHeaderBreadcrumbItems([
    { label: "Рекрутинг", to: "/recruiting/vacancies" },
    { label: "Кандидаты", to: "/recruiting/candidates" },
    { label: isEdit ? "Редактировать" : "Новый кандидат", to: "#" },
  ]);

  const { data: candidateRow, isLoading } = useCandidateQuery(isEdit ? id : undefined);
  const { data: vacanciesData } = useVacanciesQuery({ limit: 100, offset: 0 });
  const createMutation = useCreateCandidate();
  const updateMutation = useUpdateCandidate();

  const [draft, setDraft] = useState<CandidateDraft>(createEmptyCandidateDraft);
  const [error, setError] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [resumeUploading, setResumeUploading] = useState(false);

  const vacancyOptions = useMemo(() => {
    return (vacanciesData?.response ?? []).map((row) => {
      const v = mapVacancyRow(row);
      return { value: v.id, label: v.title, tag: v.tag, level: v.experienceLevel };
    });
  }, [vacanciesData]);

  useEffect(() => {
    if (isEdit && candidateRow) {
      setDraft(candidateDraftFromItem(mapCandidateRow(candidateRow)));
    } else if (!isEdit && presetVacancyId) {
      setDraft((prev) => ({ ...prev, vacancyId: presetVacancyId }));
    }
  }, [isEdit, candidateRow, presetVacancyId]);

  const set = <K extends keyof CandidateDraft>(key: K, value: CandidateDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const setEmployee = (
    idKey: "recruiterId" | "addedById",
    nameKey: "recruiterName" | "addedByName",
    value: string
  ) => {
    const name = MOCK_EMPLOYEES.find((e) => e.value === value)?.label ?? null;
    setDraft((prev) => ({ ...prev, [idKey]: value || null, [nameKey]: name }));
  };

  const handleVacancyChange = (vacancyId: string) => {
    const vac = vacancyOptions.find((o) => o.value === vacancyId);
    setDraft((prev) => ({
      ...prev,
      vacancyId: vacancyId || null,
      positionTitle: vac?.label ?? prev.positionTitle,
      tag: vac?.tag || prev.tag,
      level: vac?.level || prev.level,
    }));
  };

  // While mocking, files become local object URLs (no upload API call).
  const handleFile = (
    file: File | undefined,
    field: "photo" | "resumeUrl",
    setUploading: (v: boolean) => void
  ) => {
    if (!file) return;
    if (RECRUITING_USE_MOCK) {
      set(field, URL.createObjectURL(file));
      return;
    }
    setUploading(true); // real upload wired in the API stage
  };

  const isSaving = createMutation.isLoading || updateMutation.isLoading;
  const showReason = NEGATIVE_STAGES.includes(draft.stage);

  const handleSubmit = async () => {
    if (!draft.firstName.trim() && !draft.lastName.trim()) {
      setError("Укажите имя кандидата");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    try {
      const payload = {
        ...draft,
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        rejectionReason: showReason ? draft.rejectionReason : null,
      };
      if (isEdit && id) {
        await updateMutation.mutateAsync({ guid: id, draft: payload });
        toast.success("Кандидат обновлён");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Кандидат добавлен");
      }
      navigate(presetVacancyId ? `/recruiting/candidates?vacancy=${presetVacancyId}` : "/recruiting/candidates");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить");
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
        title={isEdit ? "Редактировать кандидата | Рекрутинг" : "Новый кандидат | Рекрутинг"}
        description="Форма кандидата"
      />

      {/* Back + breadcrumb */}
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex items-center gap-2 text-sm">
          <span className="cursor-pointer text-brand-600" onClick={() => navigate("/recruiting/candidates")}>
            Кандидаты
          </span>
          <span className="text-gray-300">/</span>
          <span className="font-medium text-gray-800">{isEdit ? "Редактировать" : "Новый кандидат"}</span>
        </div>
      </div>

      <div className="mx-auto max-w-[920px] space-y-5 pb-24">
        {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p>}

        <Card title="Кандидат">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="group relative cursor-pointer">
                <Avatar firstName={draft.firstName} lastName={draft.lastName} photo={draft.photo} size={64} />
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100">
                  {photoUploading ? <Loader2 size={16} className="animate-spin" /> : "Фото"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0], "photo", setPhotoUploading)}
                />
              </label>
              <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Фамилия">
                  <input
                    className={inputCls}
                    value={draft.lastName}
                    onChange={(e) => set("lastName", e.target.value)}
                    placeholder="Петров"
                  />
                </Field>
                <Field label="Имя">
                  <input
                    className={inputCls}
                    value={draft.firstName}
                    onChange={(e) => set("firstName", e.target.value)}
                    placeholder="Алексей"
                  />
                </Field>
              </div>
            </div>

            <Field label="Вакансия">
              <FormSelect
                options={vacancyOptions}
                value={draft.vacancyId}
                onChange={handleVacancyChange}
                placeholder="Без привязки к вакансии"
                isClearable
                menuPortal
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_160px_160px]">
              <Field label="Должность">
                <input
                  className={inputCls}
                  value={draft.positionTitle}
                  onChange={(e) => set("positionTitle", e.target.value)}
                  placeholder="Backend Developer"
                />
              </Field>
              <Field label="Тег">
                <input
                  className={`${inputCls} uppercase`}
                  value={draft.tag}
                  onChange={(e) => set("tag", e.target.value.toUpperCase())}
                  placeholder="BACKEND"
                />
              </Field>
              <Field label="Уровень">
                <FormSelect
                  options={LEVELS}
                  value={draft.level}
                  onChange={(v) => set("level", v)}
                  isSearchable={false}
                  menuPortal
                />
              </Field>
            </div>

            <Field label="Навыки">
              <TagsInput
                value={draft.skills}
                onChange={(v) => set("skills", v)}
                placeholder="Введите навык и нажмите Enter"
              />
            </Field>
            <Field label="Ссылки (hh.ru, LinkedIn, GitHub)">
              <TagsInput
                value={draft.links}
                onChange={(v) => set("links", v)}
                placeholder="Вставьте ссылку и нажмите Enter"
              />
            </Field>
          </div>
        </Card>

        <Card title="Воронка и источник">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Этап">
                <FormSelect
                  options={STAGE_OPTIONS}
                  value={draft.stage}
                  onChange={(v) => set("stage", v as CandidateStage)}
                  isSearchable={false}
                  menuPortal
                />
              </Field>
              <Field label="Источник">
                <FormSelect
                  options={SOURCE_OPTIONS}
                  value={draft.source}
                  onChange={(v) => set("source", v as CandidateSource)}
                  menuPortal
                />
              </Field>
              <Field label="Дата отклика">
                <FormDatePicker value={draft.appliedDate} onChange={(v) => set("appliedDate", v)} />
              </Field>
            </div>

            {showReason && (
              <Field label="Причина отказа">
                <FormSelect
                  options={REASON_OPTIONS}
                  value={draft.rejectionReason}
                  onChange={(v) => set("rejectionReason", (v || null) as CandidateRejectionReason | null)}
                  placeholder="Выберите причину"
                  isClearable
                  menuPortal
                />
              </Field>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Ответственный рекрутер">
                <FormSelect
                  options={MOCK_EMPLOYEES}
                  value={draft.recruiterId}
                  onChange={(v) => setEmployee("recruiterId", "recruiterName", v)}
                  placeholder="Выберите рекрутера"
                  isClearable
                  menuPortal
                />
              </Field>
              <Field label="Кем добавлен">
                <FormSelect
                  options={MOCK_EMPLOYEES}
                  value={draft.addedById}
                  onChange={(v) => setEmployee("addedById", "addedByName", v)}
                  placeholder="Выберите сотрудника"
                  isClearable
                  menuPortal
                />
              </Field>
            </div>
          </div>
        </Card>

        <Card title="Контакты и условия">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Email">
                <input
                  type="email"
                  className={inputCls}
                  value={draft.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="name@mail.com"
                />
              </Field>
              <Field label="Телефон">
                <input
                  className={inputCls}
                  value={draft.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="+998 90 123 45 67"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Дата рождения">
                <FormDatePicker value={draft.dateOfBirth} onChange={(v) => set("dateOfBirth", v)} />
              </Field>
              <Field label="Пол">
                <FormSelect
                  options={GENDER_OPTIONS}
                  value={draft.gender}
                  onChange={(v) => set("gender", (v || null) as Gender | null)}
                  placeholder="Не указан"
                  isSearchable={false}
                  isClearable
                  menuPortal
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_120px_220px]">
              <Field label="Зарплатные ожидания">
                <input
                  type="number"
                  className={inputCls}
                  value={draft.salaryExpectation ?? ""}
                  onChange={(e) => set("salaryExpectation", e.target.value ? Number(e.target.value) : null)}
                  placeholder="Сумма"
                />
              </Field>
              <Field label="Валюта">
                <FormSelect
                  options={CURRENCY_OPTIONS}
                  value={draft.salaryCurrency}
                  onChange={(v) => set("salaryCurrency", v)}
                  isSearchable={false}
                  menuPortal
                />
              </Field>
              <Field label="Оценка">
                <div className="flex h-11 items-center">
                  <RatingStars value={draft.rating} size={22} onChange={(v) => set("rating", v)} />
                </div>
              </Field>
            </div>

            <Field label="Резюме (CV)">
              <label className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-gray-300 px-3.5 text-sm text-gray-500 transition hover:border-brand-300 hover:text-brand-600">
                {resumeUploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
                {draft.resumeUrl ? "Файл загружен — заменить" : "Загрузить PDF / DOCX"}
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0], "resumeUrl", setResumeUploading)}
                />
              </label>
              {draft.resumeUrl && (
                <a
                  href={draft.resumeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 inline-block text-xs text-brand-600 underline"
                >
                  Открыть текущее резюме
                </a>
              )}
            </Field>

            <Field label="Сопроводительное письмо">
              <textarea
                rows={3}
                className={`${inputCls} h-auto resize-none py-2.5`}
                value={draft.coverLetter}
                onChange={(e) => set("coverLetter", e.target.value)}
                placeholder="Текст сопроводительного письма кандидата..."
              />
            </Field>

            <Field label="Заметки">
              <textarea
                rows={3}
                className={`${inputCls} h-auto resize-none py-2.5`}
                value={draft.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Комментарии рекрутера, итоги интервью..."
              />
            </Field>
          </div>
        </Card>
      </div>

      {/* Sticky save bar */}
      <SidebarAwareFixedFooter>
        <span className="text-sm text-gray-500">{isEdit ? "Редактирование кандидата" : "Новый кандидат"}</span>
        <div className="ml-auto flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate("/recruiting/candidates")} className="px-5">
            Отменить
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving} className="px-6">
            {isSaving ? "Сохранение..." : isEdit ? "Сохранить" : "Добавить кандидата"}
          </Button>
        </div>
      </SidebarAwareFixedFooter>
    </>
  );
}
