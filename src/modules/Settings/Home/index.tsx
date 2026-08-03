import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { toast } from "sonner";
import PageMeta from "../../../components/common/PageMeta";
import Button from "../../../components/ui/button/Button";
import Checkbox from "../../../components/form/input/Checkbox";
import {
  DEFAULT_GRADE_SALARY_POLICY,
  type GradeSalaryPolicy,
  type MainSettings,
  type MainSettingsPayload,
  normalizeGradeSalaryPolicy,
  useMainSettingsQuery,
  useSaveMainSettings,
} from "../../../api/services/mainSettings.service";

/**
 * Насколько строго оклад обязан укладываться в матрицу грейдов.
 *
 * Проверка сравнивает оклад с потолком той ступени, на которой стоит грейд
 * сотрудника (его должность × уровень опыта). Если такой пары в матрице нет
 * или у ступени не задан потолок — сравнивать не с чем, и оклад проходит
 * в любом режиме.
 */
const GRADE_SALARY_POLICY_OPTIONS: {
  value: GradeSalaryPolicy;
  label: string;
  hint: string;
}[] = [
  {
    value: "off",
    label: "Не должен",
    hint: "Оклад с матрицей грейдов не сверяется.",
  },
  {
    value: "warn",
    label: "Должен, но не обязательно",
    hint: "Если оклад выше потолка ступени, покажем предупреждение, но сохранить дадим.",
  },
  {
    value: "required",
    label: "Должен",
    hint: "Оклад выше потолка ступени сохранить нельзя.",
  },
];

const DEFAULT_LATENESS_COEFFICIENT = 4;
const DEFAULT_LATENESS_GRACE_MINUTES = 30;

const DEFAULT_FORM: MainSettingsPayload = {
  show_new_hires_widget: true,
  show_anniversaries_widget: false,
  show_birthdays_widget: true,
  show_absences_widget: true,
  show_business_absences: true,
  lateness_penalty_coefficient: DEFAULT_LATENESS_COEFFICIENT,
  lateness_grace_minutes: DEFAULT_LATENESS_GRACE_MINUTES,
  grade_salary_policy: DEFAULT_GRADE_SALARY_POLICY,
};

export default function HomeSettingsPage() {
  const { data, isLoading, isError } = useMainSettingsQuery();
  const saveMutation = useSaveMainSettings();

  const [form, setForm] = useState<MainSettingsPayload>(DEFAULT_FORM);
  const [initialForm, setInitialForm] = useState<MainSettingsPayload>(DEFAULT_FORM);
  const [settingsGuid, setSettingsGuid] = useState<string | null>(null);
  const [sourceSettings, setSourceSettings] = useState<MainSettings | null>(null);

  useEffect(() => {
    if (!data) {
      setForm(DEFAULT_FORM);
      setInitialForm(DEFAULT_FORM);
      setSettingsGuid(null);
      setSourceSettings(null);
      return;
    }

    const next: MainSettingsPayload = {
      show_new_hires_widget: Boolean(data.show_new_hires_widget),
      show_anniversaries_widget: Boolean(data.show_anniversaries_widget),
      show_birthdays_widget: Boolean(data.show_birthdays_widget),
      show_absences_widget: Boolean(data.show_absences_widget),
      show_business_absences: Boolean(data.show_business_absences),
      lateness_penalty_coefficient:
        Number(data.lateness_penalty_coefficient) > 0
          ? Number(data.lateness_penalty_coefficient)
          : DEFAULT_LATENESS_COEFFICIENT,
      lateness_grace_minutes:
        Number(data.lateness_grace_minutes) >= 0
          ? Number(data.lateness_grace_minutes)
          : DEFAULT_LATENESS_GRACE_MINUTES,
      grade_salary_policy: normalizeGradeSalaryPolicy(data.grade_salary_policy),
    };

    setForm(next);
    setInitialForm(next);
    setSettingsGuid(data.guid || null);
    setSourceSettings(data);
  }, [data]);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm]
  );

  const setField = (key: keyof MainSettingsPayload, value: boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const setLatenessCoefficient = (value: number) => {
    setForm((prev) => ({ ...prev, lateness_penalty_coefficient: value }));
  };

  const setLatenessGraceMinutes = (value: number) => {
    setForm((prev) => ({ ...prev, lateness_grace_minutes: value }));
  };

  const setGradeSalaryPolicy = (value: GradeSalaryPolicy) => {
    setForm((prev) => ({ ...prev, grade_salary_policy: value }));
  };

  const handleSave = async () => {
    try {
      const payload = settingsGuid && sourceSettings
        ? { ...sourceSettings, ...form }
        : form;

      await saveMutation.mutateAsync({
        guid: settingsGuid,
        data: payload,
      });

      setInitialForm(form);
      toast.success("Настройки главной страницы сохранены.");
    } catch (error) {
      console.error("Failed to save main settings:", error);
      toast.error("Не удалось сохранить настройки. Попробуйте еще раз.");
    }
  };

  return (
    <>
      <PageMeta title="Главная | Настройки" description="Настройки главной страницы" />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold text-gray-900">Главная</h1>
          <Button
            onClick={handleSave}
            disabled={!isDirty || saveMutation.isLoading || isLoading}
            className="h-10 px-4"
          >
            {saveMutation.isLoading ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div key={idx} className="h-6 w-full max-w-[460px] animate-pulse rounded bg-gray-200" />
              ))}
            </div>
          ) : isError ? (
            <p className="text-sm text-error-600">Не удалось загрузить настройки.</p>
          ) : (
            <div className="space-y-4">
              <Checkbox
                checked={form.show_new_hires_widget}
                onChange={(value) => setField("show_new_hires_widget", value)}
                label="Показывать виджет приветствия новичков"
              />

              <Checkbox
                checked={form.show_anniversaries_widget}
                onChange={(value) => setField("show_anniversaries_widget", value)}
                label="Показать виджет годовщин"
              />

              <Checkbox
                checked={form.show_birthdays_widget}
                onChange={(value) => setField("show_birthdays_widget", value)}
                label="Показать виджет дней рождения"
              />

              <Checkbox
                checked={form.show_absences_widget}
                onChange={(value) => setField("show_absences_widget", value)}
                label="Показать виджет отсутствий"
              />

              <div className="space-y-1.5">
                <Checkbox
                  checked={form.show_business_absences}
                  onChange={(value) => setField("show_business_absences", value)}
                  label="Показать сотрудников, находящихся в рабочем отсутствии"
                />
                <p className="pl-8 text-sm leading-6 text-gray-500">
                  По умолчанию мы показываем сотрудников в нерабочих отсутствиях (например, отпуск, больничный).
                  Включите эту опцию, чтобы также показывать сотрудников в рабочих отсутствиях
                  (например, командировка, удаленная работа).
                </p>
              </div>

              <div className="space-y-1.5 border-t border-gray-100 pt-4">
                <label
                  htmlFor="lateness-penalty-coefficient"
                  className="block text-sm font-medium text-gray-700"
                >
                  Коэффициент штрафа за опоздания
                </label>
                <input
                  id="lateness-penalty-coefficient"
                  type="number"
                  min={0}
                  step="0.1"
                  value={form.lateness_penalty_coefficient}
                  onChange={(event) => setLatenessCoefficient(Number(event.target.value))}
                  className="h-10 w-full max-w-[200px] rounded-lg border border-gray-300 px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
                />
                <p className="text-sm leading-6 text-gray-500">
                  Удержание за опоздания в ведомости зарплаты рассчитывается как
                  (Оклад ÷ рабочие минуты в месяце) × (минуты опозданий − прощаемые минуты) × этот коэффициент.
                </p>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="lateness-grace-minutes"
                  className="block text-sm font-medium text-gray-700"
                >
                  Прощаемые минуты опоздания
                </label>
                <input
                  id="lateness-grace-minutes"
                  type="number"
                  min={0}
                  step="1"
                  value={form.lateness_grace_minutes}
                  onChange={(event) => setLatenessGraceMinutes(Number(event.target.value))}
                  className="h-10 w-full max-w-[200px] rounded-lg border border-gray-300 px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
                />
                <p className="text-sm leading-6 text-gray-500">
                  Это количество минут опоздания вычитается из минут опозданий сотрудника
                  перед расчетом штрафа (не может уйти ниже 0).
                </p>
              </div>

              <div className="space-y-2 border-t border-gray-100 pt-4">
                <p className="text-sm font-medium text-gray-700">
                  Оклад сотрудника должен соответствовать матрице грейдов
                </p>
                <p className="text-sm leading-6 text-gray-500">
                  Оклад сверяется с потолком той ступени, на которой стоит грейд сотрудника
                  (его должность × уровень опыта в{" "}
                  <Link to="/settings/grade-salaries" className="text-brand-500 hover:underline">
                    зарплатах по грейдам
                  </Link>
                  ). Если этой пары в матрице нет или у ступени не задан потолок — сверять не
                  с чем, и оклад проходит в любом режиме.
                </p>

                <div className="space-y-2 pt-1">
                  {GRADE_SALARY_POLICY_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-3 transition hover:border-brand-300 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50/40"
                    >
                      <input
                        type="radio"
                        name="grade-salary-policy"
                        value={option.value}
                        checked={form.grade_salary_policy === option.value}
                        onChange={() => setGradeSalaryPolicy(option.value)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-brand-500"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-gray-800">
                          {option.label}
                        </span>
                        <span className="block text-sm leading-6 text-gray-500">
                          {option.hint}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
