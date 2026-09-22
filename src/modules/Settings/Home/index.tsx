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
import { useTranslation } from "../../../i18n";
import type { MessageKey } from "../../../i18n/messages";

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
  labelKey: MessageKey;
  hintKey: MessageKey;
}[] = [
  {
    value: "off",
    labelKey: "settings_home.grade_policy.off_label",
    hintKey: "settings_home.grade_policy.off_hint",
  },
  {
    value: "warn",
    labelKey: "settings_home.grade_policy.warn_label",
    hintKey: "settings_home.grade_policy.warn_hint",
  },
  {
    value: "required",
    labelKey: "settings_home.grade_policy.required_label",
    hintKey: "settings_home.grade_policy.required_hint",
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
  const { t } = useTranslation();
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
      toast.success(t("settings_home.save_success"));
    } catch (error) {
      console.error("Failed to save main settings:", error);
      toast.error(t("settings_home.save_error"));
    }
  };

  return (
    <>
      <PageMeta title={t("settings_home.page_title")} description={t("settings_home.page_description")} />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold text-gray-900">{t("settings_home.heading")}</h1>
          <Button
            onClick={handleSave}
            disabled={!isDirty || saveMutation.isLoading || isLoading}
            className="h-10 px-4"
          >
            {saveMutation.isLoading ? t("settings_home.saving") : t("settings_home.save")}
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
            <p className="text-sm text-error-600">{t("settings_home.load_error")}</p>
          ) : (
            <div className="space-y-4">
              <Checkbox
                checked={form.show_new_hires_widget}
                onChange={(value) => setField("show_new_hires_widget", value)}
                label={t("settings_home.widget.newcomers")}
              />

              <Checkbox
                checked={form.show_anniversaries_widget}
                onChange={(value) => setField("show_anniversaries_widget", value)}
                label={t("settings_home.widget.anniversaries")}
              />

              <Checkbox
                checked={form.show_birthdays_widget}
                onChange={(value) => setField("show_birthdays_widget", value)}
                label={t("settings_home.widget.birthdays")}
              />

              <Checkbox
                checked={form.show_absences_widget}
                onChange={(value) => setField("show_absences_widget", value)}
                label={t("settings_home.widget.absences")}
              />

              <div className="space-y-1.5">
                <Checkbox
                  checked={form.show_business_absences}
                  onChange={(value) => setField("show_business_absences", value)}
                  label={t("settings_home.widget.work_absences")}
                />
                <p className="pl-8 text-sm leading-6 text-gray-500">
                  {t("settings_home.widget.work_absences_hint")}
                </p>
              </div>

              <div className="space-y-1.5 border-t border-gray-100 pt-4">
                <label
                  htmlFor="lateness-penalty-coefficient"
                  className="block text-sm font-medium text-gray-700"
                >
                  {t("settings_home.lateness.coefficient_label")}
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
                  {t("settings_home.lateness.coefficient_hint")}
                </p>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="lateness-grace-minutes"
                  className="block text-sm font-medium text-gray-700"
                >
                  {t("settings_home.lateness.grace_label")}
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
                  {t("settings_home.lateness.grace_hint")}
                </p>
              </div>

              <div className="space-y-2 border-t border-gray-100 pt-4">
                <p className="text-sm font-medium text-gray-700">
                  {t("settings_home.grade_policy.title")}
                </p>
                <p className="text-sm leading-6 text-gray-500">
                  {t("settings_home.grade_policy.hint_before_link")}{" "}
                  <Link to="/settings/grade-salaries" className="text-brand-500 hover:underline">
                    {t("settings_home.grade_policy.hint_link")}
                  </Link>
                  {t("settings_home.grade_policy.hint_after_link")}
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
                          {t(option.labelKey)}
                        </span>
                        <span className="block text-sm leading-6 text-gray-500">
                          {t(option.hintKey)}
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
