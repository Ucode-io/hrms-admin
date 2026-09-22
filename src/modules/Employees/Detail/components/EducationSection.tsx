import { useMemo, useState } from "react";
import {
  CalendarDays,
  GraduationCap,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Modal } from "../../../../components/ui/modal";
import DateInput from "../../../../components/form/DateInput";
import {
  useCreateEmployeeEducation,
  useDeleteEmployeeEducation,
  useEmployeeEducationsQuery,
  useUpdateEmployeeEducation,
} from "../../../../api/services/employeeEducation.service";
import { useTranslation, translate } from "../../../../i18n";

type EducationSectionProps = {
  employeeGuid: string;
  brandColor: string;
};

type EducationFormDraft = {
  institution: string;
  degree: string;
  specialization: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  description: string;
};

type EducationRow = {
  guid: string;
  institution: string;
  degree: string;
  specialization: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  description: string;
};

const EMPTY_DRAFT: EducationFormDraft = {
  institution: "",
  degree: "",
  specialization: "",
  start_date: "",
  end_date: "",
  is_current: false,
  description: "",
};

const getDegreeOptions = (): Array<{ label: string; value: string }> => [
  { label: translate("employees.education.degree_secondary_specialized"), value: "secondary_specialized" },
  { label: translate("employees.education.degree_bachelor"), value: "bachelor" },
  { label: translate("employees.education.degree_master"), value: "master" },
  { label: translate("employees.education.degree_doctorate_phd"), value: "doctorate_phd" },
  { label: translate("employees.education.degree_professional_program"), value: "professional_program" },
  { label: translate("employees.education.degree_course_certificate"), value: "course_certificate" },
];

const getDegreeLabel = (slug: string) =>
  getDegreeOptions().find((option) => option.value === slug)?.label || slug;

const toTime = (date: string) => {
  const ts = new Date(date).getTime();
  return Number.isNaN(ts) ? 0 : ts;
};

function formatMonthYear(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";
  const months = Array.from({ length: 12 }, (_, i) => translate(`employees.detail.month_${i}` as never));
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

function formatEducationPeriod(
  startDate: string,
  endDate: string,
  isCurrent: boolean
): string {
  const startLabel = formatMonthYear(startDate);
  const endLabel = formatMonthYear(endDate);
  if (!startLabel) return translate("employees.education.period_not_specified");
  if (isCurrent) return translate("employees.education.period_current_suffix", { startLabel });
  if (!endLabel) return `${startLabel} —`;
  return `${startLabel} — ${endLabel}`;
}

function EducationSection({ employeeGuid, brandColor }: EducationSectionProps) {
  const { t } = useTranslation();
  const [isEducationModalOpen, setIsEducationModalOpen] = useState(false);
  const [editingEducationGuid, setEditingEducationGuid] = useState<string | null>(
    null
  );
  const [educationDraft, setEducationDraft] =
    useState<EducationFormDraft>(EMPTY_DRAFT);
  const [educationError, setEducationError] = useState("");
  const [educationToDelete, setEducationToDelete] = useState<EducationRow | null>(
    null
  );

  const { data, isLoading } = useEmployeeEducationsQuery({
    userBaseId: employeeGuid,
    limit: 100,
    offset: 0,
  });

  const createMutation = useCreateEmployeeEducation(employeeGuid);
  const updateMutation = useUpdateEmployeeEducation(employeeGuid);
  const deleteMutation = useDeleteEmployeeEducation(employeeGuid);

  const isEducationSaving =
    createMutation.isLoading || updateMutation.isLoading || deleteMutation.isLoading;

  const records = useMemo<EducationRow[]>(() => {
    const rows = (data?.response || []).map((item) => {
      const degreeValue = Array.isArray(item.degree)
        ? item.degree[0] || ""
        : typeof item.degree === "string"
          ? item.degree
          : "";
      return {
        guid: item.guid,
        institution: typeof item.institution === "string" ? item.institution : "",
        degree: degreeValue,
        specialization:
          typeof item.specialization === "string" ? item.specialization : "",
        start_date: typeof item.start_date === "string" ? item.start_date : "",
        end_date: typeof item.end_date === "string" ? item.end_date : "",
        is_current: Boolean(item.is_current),
        description: typeof item.description === "string" ? item.description : "",
      };
    });

    return rows.sort((a, b) => toTime(b.start_date) - toTime(a.start_date));
  }, [data?.response]);

  const degreeOptions = useMemo(() => {
    const options = getDegreeOptions();
    if (
      !educationDraft.degree ||
      options.some((option) => option.value === educationDraft.degree)
    ) {
      return options;
    }
    return [
      ...options,
      { label: educationDraft.degree, value: educationDraft.degree },
    ];
  }, [educationDraft.degree, t]);

  const openCreateEducation = () => {
    setEditingEducationGuid(null);
    setEducationDraft(EMPTY_DRAFT);
    setEducationError("");
    setIsEducationModalOpen(true);
  };

  const openEditEducation = (record: EducationRow) => {
    setEditingEducationGuid(record.guid);
    setEducationDraft({
      institution: record.institution,
      degree: record.degree,
      specialization: record.specialization,
      start_date: record.start_date,
      end_date: record.end_date,
      is_current: record.is_current,
      description: record.description,
    });
    setEducationError("");
    setIsEducationModalOpen(true);
  };

  const closeEducationModal = () => {
    if (isEducationSaving) return;
    setIsEducationModalOpen(false);
    setEditingEducationGuid(null);
    setEducationDraft(EMPTY_DRAFT);
    setEducationError("");
  };

  const handleEducationSave = async () => {
    const institution = educationDraft.institution.trim();
    const degree = educationDraft.degree.trim();
    const specialization = educationDraft.specialization.trim();
    const description = educationDraft.description.trim();
    const startDate = educationDraft.start_date;
    const endDate = educationDraft.is_current ? "" : educationDraft.end_date;

    if (!institution) {
      setEducationError(t("employees.education.institution_required"));
      return;
    }
    if (!degree) {
      setEducationError(t("employees.education.degree_required"));
      return;
    }
    if (!startDate) {
      setEducationError(t("employees.education.start_date_required"));
      return;
    }
    if (!educationDraft.is_current && endDate && endDate < startDate) {
      setEducationError(t("employees.education.end_before_start"));
      return;
    }

    const payload = {
      user_base_id: employeeGuid,
      institution,
      degree: [degree],
      specialization: specialization || null,
      start_date: startDate,
      end_date: educationDraft.is_current ? null : endDate || null,
      is_current: educationDraft.is_current,
      description: description || null,
    };

    try {
      if (editingEducationGuid) {
        await updateMutation.mutateAsync({
          guid: editingEducationGuid,
          ...payload,
        });
      } else {
        await createMutation.mutateAsync(payload);
      }
      closeEducationModal();
    } catch (error) {
      console.error("Education save error:", error);
      setEducationError(t("employees.education.save_failed"));
    }
  };

  const handleEducationDelete = async () => {
    if (!educationToDelete) return;

    try {
      await deleteMutation.mutateAsync(educationToDelete.guid);
      setEducationToDelete(null);
    } catch (error) {
      console.error("Education delete error:", error);
      setEducationError(t("employees.education.delete_failed"));
    }
  };

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span style={{ color: brandColor }}>
              <GraduationCap className="w-4 h-4" />
            </span>
            <h3 className="text-[15px] font-bold text-slate-900 m-0">{t("employees.education.title")}</h3>
            <span className="text-[12px] font-medium text-slate-400">
              {records.length}
            </span>
          </div>
          <button
            type="button"
            onClick={openCreateEducation}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[12px] font-semibold cursor-pointer transition-colors hover:bg-slate-50"
            style={{ color: brandColor }}
          >
            <Plus className="w-3.5 h-3.5" />
            {t("common.add")}
          </button>
        </div>

        <div className="px-6 pt-4 pb-5">
          {isLoading ? (
            <div className="py-8 flex items-center justify-center">
              <div
                className="w-7 h-7 rounded-full border-2 border-slate-200 animate-spin"
                style={{ borderTopColor: brandColor }}
              />
            </div>
          ) : records.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center">
              <div
                className="w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center"
                style={{ backgroundColor: `${brandColor}14` }}
              >
                <GraduationCap className="w-5 h-5" style={{ color: brandColor }} />
              </div>
              <p className="text-[13px] text-slate-500 mb-3">
                {t("employees.education.empty")}
              </p>
              <button
                type="button"
                onClick={openCreateEducation}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 bg-white text-[12px] font-semibold cursor-pointer transition-colors hover:bg-slate-100"
                style={{ color: brandColor }}
              >
                <Plus className="w-3.5 h-3.5" />
                {t("employees.education.add_first")}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {records.map((record) => (
                <div
                  key={record.guid}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="text-[14px] font-semibold text-slate-900 leading-tight m-0">
                        {record.institution}
                      </h4>
                      <p className="mt-1 text-[13px] text-slate-600 m-0">
                        {[getDegreeLabel(record.degree), record.specialization]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[12px] text-slate-600">
                          <CalendarDays className="w-3.5 h-3.5" />
                          {formatEducationPeriod(
                            record.start_date,
                            record.end_date,
                            record.is_current
                          )}
                        </span>
                        {record.is_current && (
                          <span
                            className="inline-flex items-center rounded-md px-2.5 py-1 text-[12px] font-medium"
                            style={{
                              color: "#0f766e",
                              backgroundColor: "#ccfbf1",
                            }}
                          >
                            {t("employees.education.in_progress")}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditEducation(record)}
                        className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-500 cursor-pointer transition-colors hover:bg-slate-100 hover:text-slate-700"
                        title={t("common.edit")}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEducationToDelete(record)}
                        className="flex items-center justify-center w-8 h-8 rounded-lg border border-red-100 bg-white text-red-500 cursor-pointer transition-colors hover:bg-red-50"
                        title={t("common.delete")}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {record.description && (
                    <p className="mt-3 text-[13px] text-slate-500 leading-relaxed m-0">
                      {record.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={isEducationModalOpen}
        onClose={closeEducationModal}
        className="max-w-2xl w-full p-6"
      >
        <div>
          <h3 className="text-[18px] font-bold text-slate-900 m-0 mb-1">
            {editingEducationGuid ? t("employees.education.edit_title") : t("employees.education.add_title")}
          </h3>
          <p className="text-[13px] text-slate-500 m-0 mb-5">
            {t("employees.education.form_description")}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-[13px] font-medium text-slate-600 mb-1.5">
                {t("employees.education.field_institution")}
              </label>
              <input
                type="text"
                value={educationDraft.institution}
                onChange={(event) =>
                  setEducationDraft((prev) => ({
                    ...prev,
                    institution: event.target.value,
                  }))
                }
                placeholder={t("employees.education.field_institution_placeholder")}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[14px] text-slate-800 outline-none transition-colors focus:border-slate-400"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-slate-600 mb-1.5">
                {t("employees.education.field_degree")}
              </label>
              <select
                value={educationDraft.degree}
                onChange={(event) =>
                  setEducationDraft((prev) => ({
                    ...prev,
                    degree: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[14px] text-slate-800 outline-none transition-colors focus:border-slate-400"
              >
                <option value="">{t("employees.education.select_degree")}</option>
                {degreeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-slate-600 mb-1.5">
                {t("employees.education.field_specialization")}
              </label>
              <input
                type="text"
                value={educationDraft.specialization}
                onChange={(event) =>
                  setEducationDraft((prev) => ({
                    ...prev,
                    specialization: event.target.value,
                  }))
                }
                placeholder={t("employees.education.field_specialization_placeholder")}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[14px] text-slate-800 outline-none transition-colors focus:border-slate-400"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-slate-600 mb-1.5">
                {t("employees.education.field_start_date")}
              </label>
              <DateInput
                value={educationDraft.start_date}
                onChange={(next) => setEducationDraft((prev) => ({ ...prev, start_date: next }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-9 text-[14px] text-slate-800 outline-none transition-colors focus:border-slate-400"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-slate-600 mb-1.5">
                {t("employees.education.field_end_date")}
              </label>
              <DateInput
                value={educationDraft.end_date}
                onChange={(next) => setEducationDraft((prev) => ({ ...prev, end_date: next }))}
                min={educationDraft.start_date || undefined}
                disabled={educationDraft.is_current}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-9 text-[14px] text-slate-800 outline-none transition-colors focus:border-slate-400 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <label className="mt-3.5 inline-flex items-center gap-2 text-[13px] text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={educationDraft.is_current}
              onChange={(event) =>
                setEducationDraft((prev) => ({
                  ...prev,
                  is_current: event.target.checked,
                  end_date: event.target.checked ? "" : prev.end_date,
                }))
              }
              className="h-4 w-4 rounded border-slate-300 text-slate-700"
            />
            {t("employees.education.still_studying")}
          </label>

          <div className="mt-3">
            <label className="block text-[13px] font-medium text-slate-600 mb-1.5">
              {t("employees.licenses.field_description")}
            </label>
            <textarea
              value={educationDraft.description}
              onChange={(event) =>
                setEducationDraft((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              rows={3}
              placeholder={t("employees.education.description_placeholder")}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[14px] text-slate-800 outline-none transition-colors focus:border-slate-400 resize-none"
            />
          </div>

          {educationError && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
              {educationError}
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={closeEducationModal}
              disabled={isEducationSaving}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-[13px] font-medium cursor-pointer transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={handleEducationSave}
              disabled={isEducationSaving}
              className="px-4 py-2.5 rounded-xl border-none text-white text-[13px] font-semibold cursor-pointer transition-opacity disabled:cursor-not-allowed disabled:opacity-60 hover:opacity-90"
              style={{ backgroundColor: brandColor }}
            >
              {isEducationSaving
                ? t("common.saving")
                : editingEducationGuid
                  ? t("common.save")
                  : t("common.add")}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!educationToDelete}
        onClose={() => !isEducationSaving && setEducationToDelete(null)}
        showCloseButton={false}
        className="max-w-md w-full p-6"
      >
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 mb-4">
            <Trash2 className="h-6 w-6 text-red-600" />
          </div>
          <h3 className="text-[18px] font-bold text-slate-900 m-0 mb-2">
            {t("employees.education.delete_modal_title")}
          </h3>
          <p className="text-[13px] text-slate-500 m-0 mb-6">
            {educationToDelete?.institution
              ? t("employees.education.delete_with_title", { title: educationToDelete.institution })
              : t("employees.licenses.delete_generic")}
          </p>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => setEducationToDelete(null)}
              disabled={isEducationSaving}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={handleEducationDelete}
              disabled={isEducationSaving}
              className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-[13px] font-medium text-white hover:bg-red-700 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isEducationSaving ? t("employees.sport_attendance.deleting") : t("common.delete")}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default EducationSection;
