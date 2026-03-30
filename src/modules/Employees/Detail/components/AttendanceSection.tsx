import { useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Clock3, LogIn, LogOut, Pencil, Plus, Trash2 } from "lucide-react";
import { Modal } from "../../../../components/ui/modal";
import companyStore from "../../../../store/company.store";
import {
  COMPANY_ID,
  useCreateSettingsDirectoryItem,
  useDeleteSettingsDirectoryItem,
  useSettingsDirectoryQuery,
  useUpdateSettingsDirectoryItem,
} from "../../../../api/services/settingsDirectory.service";
import encodeJsonToUrlParam from "../../../../utils/encodeJsonToUrlParam";

type AttendanceSectionProps = {
  employeeGuid: string;
  brandColor: string;
};

type AttendanceActionType = "check_in" | "check_out";

type AttendanceItem = {
  guid: string;
  action_type?: AttendanceActionType[] | AttendanceActionType | null;
  time?: string | null;
  delay_time?: string | null;
  created_at?: string;
  companies_id?: string;
  companies_id_data?: {
    name?: string;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

type AttendanceRecord = {
  guid: string;
  actionType: AttendanceActionType;
  time: string;
  delayTime: string;
};

type AttendanceDraft = {
  actionType: AttendanceActionType;
  date: Date | null;
  time: string;
  delayTime: string;
};

const ATTENDANCE_SLUG = "attendance";

const ACTION_LABELS: Record<AttendanceActionType, string> = {
  check_in: "Приход",
  check_out: "Уход",
};

const ACTION_TAG_STYLES: Record<AttendanceActionType, string> = {
  check_in: "border-emerald-200 bg-emerald-50 text-emerald-700",
  check_out: "border-amber-200 bg-amber-50 text-amber-700",
};

const EMPTY_DRAFT: AttendanceDraft = {
  actionType: "check_in",
  date: null,
  time: "",
  delayTime: "00:10",
};

const resolveActionType = (value: AttendanceItem["action_type"]): AttendanceActionType => {
  if (Array.isArray(value)) {
    return value[0] === "check_out" ? "check_out" : "check_in";
  }

  return value === "check_out" ? "check_out" : "check_in";
};

const toTimestamp = (value: string | null | undefined): number => {
  if (!value) return 0;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
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

const getDefaultDraft = (): AttendanceDraft => {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  return {
    ...EMPTY_DRAFT,
    date: now,
    time: `${hours}:${minutes}`,
  };
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

const DELAY_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const normalizeDelayTime = (value: string | null | undefined): string => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (DELAY_TIME_PATTERN.test(trimmed)) {
      return trimmed;
    }
  }

  return "00:10";
};

export default function AttendanceSection({
  employeeGuid,
  brandColor,
}: AttendanceSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGuid, setEditingGuid] = useState<string | null>(null);
  const [draft, setDraft] = useState<AttendanceDraft>(getDefaultDraft());
  const [error, setError] = useState("");
  const [toDelete, setToDelete] = useState<AttendanceRecord | null>(null);

  const { data, isLoading, isError } = useSettingsDirectoryQuery({
    slug: ATTENDANCE_SLUG,
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

  const createMutation = useCreateSettingsDirectoryItem(ATTENDANCE_SLUG);
  const updateMutation = useUpdateSettingsDirectoryItem(ATTENDANCE_SLUG);
  const deleteMutation = useDeleteSettingsDirectoryItem(ATTENDANCE_SLUG);
  const isSaving =
    createMutation.isLoading || updateMutation.isLoading || deleteMutation.isLoading;

  const records = useMemo<AttendanceRecord[]>(() => {
    const rows = ((data?.response || []) as AttendanceItem[]).map((item) => {
      const actionType = resolveActionType(item.action_type);
      const time = typeof item.time === "string" ? item.time : "";
      const delayTime = normalizeDelayTime(item.delay_time);

      return {
        guid: item.guid,
        actionType,
        time,
        delayTime,
      };
    });

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

  const openEdit = (record: AttendanceRecord) => {
    setEditingGuid(record.guid);
    setDraft({
      actionType: record.actionType,
      date: toDateValue(record.time),
      time: toTimeValue(record.time),
      delayTime: normalizeDelayTime(record.delayTime),
    });
    setError("");
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!draft.date) {
      setError("Укажите дату.");
      return;
    }

    if (!draft.time) {
      setError("Укажите время.");
      return;
    }

    const payload = {
      action_type: [draft.actionType],
      user_base_id: employeeGuid,
      companies_id: companyStore.company?.guid || COMPANY_ID,
      time: toApiDateTime(draft.date, draft.time),
      ...(draft.actionType === "check_in"
        ? { delay_time: normalizeDelayTime(draft.delayTime) }
        : {}),
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
      console.error("Attendance save error:", saveError);
      setError("Не удалось сохранить запись. Попробуйте ещё раз.");
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;

    try {
      await deleteMutation.mutateAsync(toDelete.guid);
      setToDelete(null);
    } catch (deleteError) {
      console.error("Attendance delete error:", deleteError);
      setError("Не удалось удалить запись. Попробуйте ещё раз.");
    }
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
              Посещаемость
            </h3>
          </div>

          <button
            type="button"
            onClick={openCreate}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-[12px] font-semibold transition-colors hover:bg-slate-50"
            style={{ color: brandColor }}
          >
            <Plus className="h-3.5 w-3.5" />
            Добавить
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
              Не удалось загрузить записи по посещаемости.
            </div>
          ) : records.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center">
              <p className="m-0 text-[13px] text-slate-500">
                Записей по посещаемости пока нет
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-2 text-[12px] font-semibold text-slate-500">Дата</th>
                    <th className="py-2 text-[12px] font-semibold text-slate-500">Время</th>
                    <th className="py-2 text-[12px] font-semibold text-slate-500">Опоздание</th>
                    <th className="py-2 text-[12px] font-semibold text-slate-500">Тип действия</th>
                    <th className="py-2 text-right text-[12px] font-semibold text-slate-500">
                      Действия
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
                        {record.actionType === "check_in" ? record.delayTime : "—"}
                      </td>
                      <td className="py-3 text-[13px] text-slate-700">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[12px] font-semibold ${ACTION_TAG_STYLES[record.actionType]}`}
                        >
                          {ACTION_LABELS[record.actionType]}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(record)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
                            title="Изменить"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setToDelete(record)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-500 transition-colors hover:bg-rose-50"
                            title="Удалить"
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
            {editingGuid ? "Изменить посещаемость" : "Добавить посещаемость"}
          </h4>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
              Тип действия
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    actionType: "check_in",
                    delayTime: normalizeDelayTime(prev.delayTime),
                  }))
                }
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                  draft.actionType === "check_in"
                    ? "border-emerald-300 bg-emerald-50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/50"
                }`}
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    draft.actionType === "check_in"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <LogIn className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-[13px] font-semibold text-slate-900">
                    Приход
                  </span>
                  <span className="mt-0.5 block text-[12px] text-slate-500">
                    Отметка начала рабочего времени
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    actionType: "check_out",
                  }))
                }
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                  draft.actionType === "check_out"
                    ? "border-amber-300 bg-amber-50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-amber-200 hover:bg-amber-50/50"
                }`}
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    draft.actionType === "check_out"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <LogOut className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-[13px] font-semibold text-slate-900">
                    Уход
                  </span>
                  <span className="mt-0.5 block text-[12px] text-slate-500">
                    Отметка завершения рабочего времени
                  </span>
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                Дата
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
                placeholderText="дд.мм.гггг"
                showMonthDropdown
                showYearDropdown
                dropdownMode="select"
                wrapperClassName="w-full"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-slate-300"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                Время
              </label>
              <input
                type="time"
                step={60}
                value={draft.time}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    time: event.target.value,
                  }))
                }
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-slate-300"
              />
            </div>
          </div>

          {draft.actionType === "check_in" ? (
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                Время опоздания
              </label>
              <input
                type="time"
                step={60}
                value={draft.delayTime}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    delayTime: event.target.value,
                  }))
                }
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-slate-300 sm:max-w-[220px]"
              />
            </div>
          ) : null}

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
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="h-9 rounded-lg border border-transparent px-4 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: brandColor }}
          >
            {isSaving ? "Сохранение..." : "Сохранить"}
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
          Удалить запись посещаемости?
        </h4>
        <p className="mb-6 mt-2 text-[13px] text-slate-500">
          Запись будет удалена без возможности восстановления.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setToDelete(null)}
            disabled={isSaving}
            className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isSaving}
            className="h-9 rounded-lg border border-rose-200 bg-rose-50 px-4 text-[13px] font-semibold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Удаление..." : "Удалить"}
          </button>
        </div>
      </Modal>
    </>
  );
}
