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
import RichTextEditor, { sanitizeRichText } from "../../components/RichTextEditor";
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
import {
  STAGE_COLOR_CONFIG,
  VACANCY_PRIORITY_CONFIG,
  VACANCY_STATUS_CONFIG,
  VACANCY_STATUS_ORDER,
  WORK_MODE_CONFIG,
  cloneStagesWithNewIds,
  createEmptyVacancyDraft,
  vacancyDraftFromItem,
  type VacancyDraft,
  type VacancyPriority,
  type VacancyStatus,
  type WorkMode,
} from "../../types";

const inputCls =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-800 transition placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";
const labelCls = "mb-1.5 block text-sm font-medium text-gray-700";

const LEVELS = ["Junior", "Middle", "Senior", "Lead"].map((v) => ({ value: v, label: v }));
const EMPLOYMENT_TYPES = [
  "Полная занятость",
  "Частичная занятость",
  "Проектная работа",
  "Стажировка",
].map((v) => ({ value: v, label: v }));
const WORK_MODE_OPTIONS = (["office", "remote", "hybrid"] as WorkMode[]).map((v) => ({
  value: v,
  label: WORK_MODE_CONFIG[v].label,
}));
const STATUS_OPTIONS = VACANCY_STATUS_ORDER.map((v) => ({
  value: v,
  label: VACANCY_STATUS_CONFIG[v].label,
}));
const PRIORITY_OPTIONS = (["high", "medium", "low"] as VacancyPriority[]).map((v) => ({
  value: v,
  label: VACANCY_PRIORITY_CONFIG[v].label,
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
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  // Стабильная ссылка — иначе useHeaderBreadcrumbItems зациклит рендер.
  useHeaderBreadcrumbItems(
    useMemo(
      () => [
        { label: "Рекрутинг", to: "/recruiting/vacancies" },
        { label: "Вакансии", to: "/recruiting/vacancies" },
        { label: isEdit ? "Редактировать" : "Новая вакансия", to: "#" },
      ],
      [isEdit]
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
            label: item.title || "Без названия",
          })),
    [departmentsData?.response]
  );
  const positionOptions = useMemo(
    () =>
      RECRUITING_USE_MOCK
        ? MOCK_POSITIONS
        : (positionsData?.response ?? []).map((item) => ({
            value: item.guid,
            label: item.title || "Без названия",
          })),
    [positionsData?.response]
  );
  const locationOptions = useMemo(
    () =>
      RECRUITING_USE_MOCK
        ? MOCK_LOCATIONS
        : (locationsData?.response ?? []).map((item) => ({
            value: item.guid,
            label: item.title || "Без названия",
          })),
    [locationsData?.response]
  );

  useEffect(() => {
    if (isEdit && vacancyRow) {
      setDraft(vacancyDraftFromItem(mapVacancyRow(vacancyRow)));
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
    () => templates.map((t) => ({ value: t.id, label: t.isDefault ? `${t.name} (по умолчанию)` : t.name })),
    [templates]
  );

  const isSaving = createMutation.isLoading || updateMutation.isLoading;

  const handleSubmit = async () => {
    if (!draft.title.trim()) {
      setError("Укажите название вакансии");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (draft.salaryMin && draft.salaryMax && draft.salaryMin > draft.salaryMax) {
      setError("Минимальная зарплата не может быть больше максимальной");
      return;
    }
    if (draft.stages.length === 0) {
      setError("Добавьте хотя бы один этап подбора");
      return;
    }
    if (draft.stages.some((s) => !s.name.trim())) {
      setError("У всех этапов должно быть название");
      return;
    }
    try {
      const payload = {
        ...draft,
        title: draft.title.trim(),
        description: sanitizeRichText(draft.description),
        responsibilities: "",
        requirements: "",
        conditions: "",
      };
      if (isEdit && id) {
        await updateMutation.mutateAsync({ guid: id, draft: payload });
        toast.success("Вакансия обновлена");
        navigate(`/recruiting/vacancies/${id}`);
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Вакансия создана");
        navigate("/recruiting/vacancies");
      }
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
        title={isEdit ? "Редактировать вакансию | Рекрутинг" : "Новая вакансия | Рекрутинг"}
        description="Форма вакансии"
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
              {isEdit ? "Редактирование вакансии" : "Новая вакансия"}
            </h2>
            <p className="text-sm text-gray-500">Заполните данные о позиции и настройте этапы подбора</p>
          </div>
        </div>

        <Card title="Основное">
          <div className="space-y-4">
            <Field label="Название вакансии" required>
              <input
                className={inputCls}
                value={draft.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Напр. Backend Developer (Senior)"
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Департамент">
                <FormSelect
                  options={departmentOptions}
                  value={draft.departmentId}
                  onChange={(v) => set("departmentId", v || null)}
                  placeholder="Выберите департамент"
                  isClearable
                  menuPortal
                />
              </Field>
              <Field label="Должность">
                <FormSelect
                  options={positionOptions}
                  value={draft.positionId}
                  onChange={(v) => set("positionId", v || null)}
                  placeholder="Должность"
                  isClearable
                  menuPortal
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Тег (BACKEND, QA…)">
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
                  value={draft.experienceLevel}
                  onChange={(v) => set("experienceLevel", v)}
                  isSearchable={false}
                  menuPortal
                />
              </Field>
            </div>
            <Field label="Ключевые навыки">
              <TagsInput
                value={draft.skills}
                onChange={(v) => set("skills", v)}
                placeholder="Введите навык и нажмите Enter"
              />
            </Field>
          </div>
        </Card>

        <Card
          title={
            <span className="inline-flex items-center gap-2">
              <ListChecks size={17} className="text-brand-500" />
              Этапы подбора
            </span>
          }
        >
          <div className="space-y-4">
            <Field label="Шаблон этапов">
              <FormSelect
                options={templateOptions}
                value={draft.stageTemplateId}
                onChange={applyTemplate}
                placeholder={templates.length ? "Выберите шаблон" : "Шаблонов пока нет"}
                isSearchable={false}
                isDisabled={templates.length === 0}
                menuPortal
              />
              <p className="mt-1.5 text-xs text-gray-400">
                Этапы берутся из выбранного шаблона. Изменить набор шаблонов можно в разделе
                «Шаблоны этапов».
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

        <Card title="Условия">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Локация">
                <FormSelect
                  options={locationOptions}
                  value={draft.locationId}
                  onChange={(v) => set("locationId", v || null)}
                  placeholder="Локация"
                  isClearable
                  menuPortal
                />
              </Field>
              <Field label="Формат">
                <FormSelect
                  options={WORK_MODE_OPTIONS}
                  value={draft.workMode}
                  onChange={(v) => set("workMode", v as WorkMode)}
                  isSearchable={false}
                  menuPortal
                />
              </Field>
              <Field label="Тип занятости">
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
              <Field label="Зарплата от">
                <input
                  type="number"
                  className={inputCls}
                  value={draft.salaryMin ?? ""}
                  onChange={(e) => set("salaryMin", e.target.value ? Number(e.target.value) : null)}
                  placeholder="От"
                />
              </Field>
              <Field label="Зарплата до">
                <input
                  type="number"
                  className={inputCls}
                  value={draft.salaryMax ?? ""}
                  onChange={(e) => set("salaryMax", e.target.value ? Number(e.target.value) : null)}
                  placeholder="До"
                />
              </Field>
              <Field label="Кол-во позиций">
                <input
                  type="number"
                  min={1}
                  className={inputCls}
                  value={draft.openings}
                  onChange={(e) => set("openings", Math.max(1, Number(e.target.value) || 1))}
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
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Статус">
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
              <Field label="Приоритет">
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
              <Field label="Дата открытия">
                <FormDatePicker value={draft.openedAt} onChange={(v) => set("openedAt", v)} />
              </Field>
              <Field label="Дедлайн">
                <FormDatePicker value={draft.deadline} onChange={(v) => set("deadline", v)} />
              </Field>
            </div>

            {draft.status === "closed" && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Дата закрытия">
                  <FormDatePicker value={draft.closedAt} onChange={(v) => set("closedAt", v)} />
                </Field>
              </div>
            )}
          </div>
        </Card>

        <Card title="Описание">
          <p className="mb-3 text-xs text-gray-400">
            Разделы «Описание», «Обязанности», «Требования», «Условия» можно переименовать или
            дополнить — это обычный текст.
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
          {isEdit ? "Редактирование вакансии" : "Новая вакансия"}
        </span>
        <div className="ml-auto flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate(-1)} className="px-5">
            Отменить
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving} className="px-6">
            {isSaving ? "Сохранение..." : isEdit ? "Сохранить" : "Создать вакансию"}
          </Button>
        </div>
      </SidebarAwareFixedFooter>
    </>
  );
}
