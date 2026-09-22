import { ChangeEvent, useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Clock3, Eye, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "../../../../components/ui/modal";
import companyStore from "../../../../store/company.store";
import { useUploadFile } from "../../../../api/services/file-upload.service";
import {
  COMPANY_ID,
  useCreateSettingsDirectoryItem,
  useDeleteSettingsDirectoryItem,
  useSettingsDirectoryQuery,
  useUpdateSettingsDirectoryItem,
} from "../../../../api/services/settingsDirectory.service";
import encodeJsonToUrlParam from "../../../../utils/encodeJsonToUrlParam";
import TimeInput from "../../../../components/form/TimeInput";
import { useTranslation } from "../../../../i18n";

type SportAttendanceSectionProps = {
  employeeGuid: string;
  brandColor: string;
};

type SportAttendanceItem = {
  guid: string;
  time?: string | null;
  video?: string | null;
  [key: string]: unknown;
};

type SportAttendanceRecord = {
  guid: string;
  time: string;
  video: string;
};

type SportAttendanceDraft = {
  date: Date | null;
  time: string;
  video: string;
};

const SPORT_ATTENDANCE_SLUG = "sport_attendance";

const EMPTY_DRAFT: SportAttendanceDraft = {
  date: null,
  time: "",
  video: "",
};

const getDefaultDraft = (): SportAttendanceDraft => {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  return {
    ...EMPTY_DRAFT,
    date: now,
    time: `${hours}:${minutes}`,
  };
};

const toTimestamp = (value: string | null | undefined): number => {
  if (!value) return 0;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const toDateValue = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toTimeValue = (value: string | null | undefined): string => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const toApiDateTime = (date: Date, time: string): string => {
  const [hoursRaw, minutesRaw] = time.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);

  const composed = new Date(date);
  composed.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);

  return composed.toISOString();
};

const formatDateLabel = (value: string): string => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatTimeLabel = (value: string): string => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function SportAttendanceSection({
  employeeGuid,
  brandColor,
}: SportAttendanceSectionProps) {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGuid, setEditingGuid] = useState<string | null>(null);
  const [draft, setDraft] = useState<SportAttendanceDraft>(getDefaultDraft());
  const [error, setError] = useState("");
  const [toDelete, setToDelete] = useState<SportAttendanceRecord | null>(null);

  const { data, isLoading, isError } = useSettingsDirectoryQuery({
    slug: SPORT_ATTENDANCE_SLUG,
    params: {
      with_relations: true,
      data: encodeJsonToUrlParam({
        limit: 100,
        offset: 0,
        user_base_id: employeeGuid,
      }),
    },
    querySettings: {
      enabled: Boolean(employeeGuid),
    },
  });

  const createMutation = useCreateSettingsDirectoryItem(SPORT_ATTENDANCE_SLUG);
  const updateMutation = useUpdateSettingsDirectoryItem(SPORT_ATTENDANCE_SLUG);
  const deleteMutation = useDeleteSettingsDirectoryItem(SPORT_ATTENDANCE_SLUG);
  const uploadMutation = useUploadFile({ folder: "Media" });

  const isSaving =
    createMutation.isLoading ||
    updateMutation.isLoading ||
    deleteMutation.isLoading ||
    uploadMutation.isLoading;

  const records = useMemo<SportAttendanceRecord[]>(() => {
    const rows = ((data?.response || []) as SportAttendanceItem[]).map((item) => ({
      guid: item.guid,
      time: typeof item.time === "string" ? item.time : "",
      video: typeof item.video === "string" ? item.video : "",
    }));

    return rows.sort((left, right) => toTimestamp(right.time) - toTimestamp(left.time));
  }, [data?.response]);

  const closeModal = () => {
    if (isSaving) return;

    setIsModalOpen(false);
    setEditingGuid(null);
    setDraft(getDefaultDraft());
    setError("");
  };

  const openCreate = () => {
    setEditingGuid(null);
    setDraft(getDefaultDraft());
    setError("");
    setIsModalOpen(true);
  };

  const openEdit = (record: SportAttendanceRecord) => {
    setEditingGuid(record.guid);
    setDraft({
      date: toDateValue(record.time),
      time: toTimeValue(record.time),
      video: record.video,
    });
    setError("");
    setIsModalOpen(true);
  };

  const handleVideoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";

    if (!selectedFile) return;

    try {
      const uploadedUrl = await uploadMutation.mutateAsync(selectedFile);
      setDraft((prev) => ({ ...prev, video: uploadedUrl }));
      toast.success(t("employees.sport_attendance.video_uploaded"));
    } catch (uploadError) {
      console.error("Sport attendance video upload error:", uploadError);
      toast.error(t("employees.sport_attendance.video_upload_failed"));
    }
  };

  const handleSave = async () => {
    if (!draft.date) {
      setError(t("employees.sport_attendance.date_required"));
      return;
    }

    if (!draft.time) {
      setError(t("employees.sport_attendance.time_required"));
      return;
    }

    if (!draft.video.trim()) {
      setError(t("employees.sport_attendance.video_required"));
      return;
    }

    const payload = {
      user_base_id: employeeGuid,
      companies_id: companyStore.company?.guid || COMPANY_ID,
      time: toApiDateTime(draft.date, draft.time),
      video: draft.video.trim(),
    };

    try {
      if (editingGuid) {
        await updateMutation.mutateAsync({
          guid: editingGuid,
          data: payload,
        });
      } else {
        await createMutation.mutateAsync(payload);
      }

      closeModal();
    } catch (saveError) {
      console.error("Sport attendance save error:", saveError);
      setError(t("employees.sport_attendance.save_failed"));
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;

    try {
      await deleteMutation.mutateAsync(toDelete.guid);
      setToDelete(null);
    } catch (deleteError) {
      console.error("Sport attendance delete error:", deleteError);
      setError(t("employees.sport_attendance.delete_failed"));
    }
  };

  const handleOpenVideo = (videoUrl: string) => {
    if (!videoUrl) {
      toast.error(t("employees.sport_attendance.no_video"));
      return;
    }

    window.open(videoUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4.5">
          <div className="flex items-center gap-2">
            <span style={{ color: brandColor }}>
              <Clock3 className="h-4 w-4" />
            </span>
            <h3 className="m-0 text-[15px] font-bold text-slate-900">
              {t("employees.sport_attendance.title")}
            </h3>
          </div>

          <button
            type="button"
            onClick={openCreate}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-[12px] font-semibold transition-colors hover:bg-slate-50"
            style={{ color: brandColor }}
          >
            <Plus className="h-3.5 w-3.5" />
            {t("common.add")}
          </button>
        </div>

        <div className="px-6 py-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div
                className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200"
                style={{ borderTopColor: brandColor }}
              />
            </div>
          ) : isError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 text-[13px] text-rose-600">
              {t("employees.sport_attendance.load_failed")}
            </div>
          ) : records.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center">
              <p className="m-0 text-[13px] text-slate-500">
                {t("employees.sport_attendance.empty")}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-2 text-[12px] font-semibold text-slate-500">{t("employees.sport_attendance.col_date")}</th>
                    <th className="py-2 text-[12px] font-semibold text-slate-500">{t("employees.sport_attendance.col_time")}</th>
                    <th className="py-2 text-[12px] font-semibold text-slate-500">{t("employees.sport_attendance.col_video")}</th>
                    <th className="py-2 text-right text-[12px] font-semibold text-slate-500">
                      {t("employees.sport_attendance.col_actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.guid} className="border-b border-slate-100">
                      <td className="py-3 text-[13px] text-slate-800">
                        {formatDateLabel(record.time)}
                      </td>
                      <td className="py-3 text-[13px] font-semibold text-slate-900">
                        {formatTimeLabel(record.time)}
                      </td>
                      <td className="py-3 text-[13px] text-slate-700">
                        {record.video ? (
                          <button
                            type="button"
                            onClick={() => handleOpenVideo(record.video)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-700 transition hover:bg-slate-50"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            {t("employees.sport_attendance.open_video")}
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(record)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
                            title={t("common.edit")}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setToDelete(record)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-500 transition-colors hover:bg-rose-50"
                            title={t("common.delete")}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        className="max-w-xl w-full p-0 overflow-visible"
      >
        <div className="border-b border-slate-200 px-6 py-5">
          <h4 className="m-0 text-[22px] font-bold text-slate-900">
            {editingGuid ? t("employees.sport_attendance.edit_modal_title") : t("employees.sport_attendance.add_modal_title")}
          </h4>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                {t("employees.sport_attendance.col_date")}
              </label>
              <DatePicker
                selected={draft.date}
                onChange={(date) =>
                  setDraft((prev) => ({
                    ...prev,
                    date,
                  }))
                }
                dateFormat="dd.MM.yyyy"
                placeholderText={t("employees.detail.dismissal_date_placeholder")}
                showMonthDropdown
                showYearDropdown
                dropdownMode="select"
                wrapperClassName="w-full"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-slate-300"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                {t("employees.sport_attendance.col_time")}
              </label>
              <TimeInput
                value={draft.time}
                onChange={(next) =>
                  setDraft((prev) => ({
                    ...prev,
                    time: next,
                  }))
                }
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-slate-300"
              />
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <label className="block text-[13px] font-medium text-slate-700">
                {t("employees.sport_attendance.col_video")}
              </label>
              {draft.video ? (
                <button
                  type="button"
                  onClick={() => handleOpenVideo(draft.video)}
                  className="text-[12px] font-medium text-slate-500 transition hover:text-slate-700"
                >
                  {t("employees.sport_attendance.open_current_video")}
                </button>
              ) : null}
            </div>

            <label
              className={`flex min-h-[120px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center transition ${
                uploadMutation.isLoading
                  ? "cursor-default opacity-70"
                  : "cursor-pointer hover:border-slate-400 hover:bg-slate-100"
              }`}
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-500">
                <Upload className="h-4 w-4" style={{ color: brandColor }} />
              </span>
              <span className="mt-3 text-[13px] font-semibold text-slate-800">
                {uploadMutation.isLoading ? t("employees.sport_attendance.uploading") : draft.video ? t("employees.sport_attendance.replace_video") : t("employees.sport_attendance.upload_video")}
              </span>
              <span className="mt-1 text-[12px] text-slate-500">
                {t("employees.sport_attendance.video_formats_hint")}
              </span>
              <input
                type="file"
                accept="video/*"
                className="hidden"
                disabled={uploadMutation.isLoading}
                onChange={(event) => void handleVideoUpload(event)}
              />
            </label>

            {draft.video ? (
              <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
                {draft.video}
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-600">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={closeModal}
            disabled={isSaving}
            className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="h-9 rounded-lg border border-transparent px-4 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: brandColor }}
          >
            {isSaving ? t("common.saving") : t("common.save")}
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(toDelete)}
        onClose={() => !isSaving && setToDelete(null)}
        className="max-w-md w-full p-6"
        showCloseButton={false}
      >
        <h4 className="m-0 text-[18px] font-bold text-slate-900">
          {t("employees.sport_attendance.delete_modal_title")}
        </h4>
        <p className="mb-6 mt-2 text-[13px] text-slate-500">
          {t("employees.sport_attendance.delete_modal_description")}
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setToDelete(null)}
            disabled={isSaving}
            className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isSaving}
            className="h-9 rounded-lg border border-rose-200 bg-rose-50 px-4 text-[13px] font-semibold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? t("employees.sport_attendance.deleting") : t("common.delete")}
          </button>
        </div>
      </Modal>
    </>
  );
}
