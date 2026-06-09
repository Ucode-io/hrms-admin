import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Briefcase, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import PageMeta from "../../../../components/common/PageMeta";
import Button from "../../../../components/ui/button/Button";
import SidebarAwareFixedFooter from "../../../../components/layout/SidebarAwareFixedFooter";
import { useHeaderBreadcrumbItems } from "../../../../context/HeaderBreadcrumbContext";
import FormSelect from "../../components/FormSelect";
import FormDatePicker from "../../components/FormDatePicker";
import TagsInput from "../../components/TagsInput";
import {
  MOCK_DEPARTMENTS,
  MOCK_DIVISIONS,
  MOCK_EMPLOYEES,
  MOCK_LOCATIONS,
  MOCK_POSITIONS,
} from "../../mock/mockStore";
import {
  mapVacancyRow,
  useCreateVacancy,
  useUpdateVacancy,
  useVacancyQuery,
} from "../../../../api/services/vacancy.service";
import {
  VACANCY_PRIORITY_CONFIG,
  VACANCY_STATUS_CONFIG,
  VACANCY_STATUS_ORDER,
  WORK_MODE_CONFIG,
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
const STATUS_OPTIONS = VACANCY_STATUS_ORDER.map((v) => ({ value: v, label: VACANCY_STATUS_CONFIG[v].label }));
const PRIORITY_OPTIONS = (["high", "medium", "low"] as VacancyPriority[]).map((v) => ({
  value: v,
  label: VACANCY_PRIORITY_CONFIG[v].label,
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

export default function VacancyForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  useHeaderBreadcrumbItems([
    { label: "Рекрутинг", to: "/recruiting/vacancies" },
    { label: "Вакансии", to: "/recruiting/vacancies" },
    { label: isEdit ? "Редактировать" : "Новая вакансия", to: "#" },
  ]);

  const { data: vacancyRow, isLoading } = useVacancyQuery(isEdit ? id : undefined);
  const createMutation = useCreateVacancy();
  const updateMutation = useUpdateVacancy();

  const [draft, setDraft] = useState<VacancyDraft>(createEmptyVacancyDraft);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isEdit && vacancyRow) setDraft(vacancyDraftFromItem(mapVacancyRow(vacancyRow)));
  }, [isEdit, vacancyRow]);

  const set = <K extends keyof VacancyDraft>(key: K, value: VacancyDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const setEmployee = (
    idKey: "recruiterId" | "hiringManagerId",
    nameKey: "recruiterName" | "hiringManagerName",
    value: string
  ) => {
    const name = MOCK_EMPLOYEES.find((e) => e.value === value)?.label ?? null;
    setDraft((prev) => ({ ...prev, [idKey]: value || null, [nameKey]: name }));
  };

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
    try {
      const payload = { ...draft, title: draft.title.trim() };
      if (isEdit && id) {
        await updateMutation.mutateAsync({ guid: id, draft: payload });
        toast.success("Вакансия обновлена");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Вакансия создана");
      }
      navigate("/recruiting/vacancies");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить");
    }
  };

  const departmentOptions = useMemo(() => MOCK_DEPARTMENTS, []);

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
          <span className="cursor-pointer text-brand-600" onClick={() => navigate("/recruiting/vacancies")}>
            Вакансии
          </span>
          <span className="text-gray-300">/</span>
          <span className="font-medium text-gray-800">{isEdit ? "Редактировать" : "Новая вакансия"}</span>
        </div>
      </div>

      <div className="mx-auto max-w-[920px] space-y-5 pb-24">
        {error && (
          <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p>
        )}

        {/* Header banner */}
        <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-6 py-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Briefcase size={20} />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {isEdit ? "Редактирование вакансии" : "Новая вакансия"}
            </h2>
            <p className="text-sm text-gray-500">Заполните данные о позиции</p>
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
              <Field label="Подразделение">
                <FormSelect
                  options={MOCK_DIVISIONS}
                  value={draft.divisionId}
                  onChange={(v) => set("divisionId", v || null)}
                  placeholder="Выберите подразделение"
                  isClearable
                  menuPortal
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Должность">
                <FormSelect
                  options={MOCK_POSITIONS}
                  value={draft.positionId}
                  onChange={(v) => set("positionId", v || null)}
                  placeholder="Должность"
                  isClearable
                  menuPortal
                />
              </Field>
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

        <Card title="Условия">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Локация">
                <FormSelect
                  options={MOCK_LOCATIONS}
                  value={draft.locationId}
                  onChange={(v) => {
                    const label = MOCK_LOCATIONS.find((l) => l.value === v)?.label ?? "";
                    setDraft((prev) => ({ ...prev, locationId: v || null, location: label }));
                  }}
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
                  onChange={(v) => set("status", v as VacancyStatus)}
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
              <Field label="Нанимающий менеджер">
                <FormSelect
                  options={MOCK_EMPLOYEES}
                  value={draft.hiringManagerId}
                  onChange={(v) => setEmployee("hiringManagerId", "hiringManagerName", v)}
                  placeholder="Выберите менеджера"
                  isClearable
                  menuPortal
                />
              </Field>
            </div>
          </div>
        </Card>

        <Card title="Описание">
          <div className="space-y-4">
            <Field label="Описание">
              <textarea
                rows={3}
                className={`${inputCls} h-auto resize-none py-2.5`}
                value={draft.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Коротко о роли, команде и продукте"
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Обязанности">
                <textarea
                  rows={5}
                  className={`${inputCls} h-auto resize-none py-2.5`}
                  value={draft.responsibilities}
                  onChange={(e) => set("responsibilities", e.target.value)}
                  placeholder="Каждый пункт с новой строки"
                />
              </Field>
              <Field label="Требования">
                <textarea
                  rows={5}
                  className={`${inputCls} h-auto resize-none py-2.5`}
                  value={draft.requirements}
                  onChange={(e) => set("requirements", e.target.value)}
                  placeholder="Каждый пункт с новой строки"
                />
              </Field>
            </div>
            <Field label="Условия">
              <textarea
                rows={3}
                className={`${inputCls} h-auto resize-none py-2.5`}
                value={draft.conditions}
                onChange={(e) => set("conditions", e.target.value)}
                placeholder="Оформление, ДМС, график, бонусы..."
              />
            </Field>
          </div>
        </Card>
      </div>

      {/* Sticky save bar */}
      <SidebarAwareFixedFooter>
        <span className="text-sm text-gray-500">
          {isEdit ? "Редактирование вакансии" : "Новая вакансия"}
        </span>
        <div className="ml-auto flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate("/recruiting/vacancies")} className="px-5">
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
