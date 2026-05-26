import { useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Check, Clock3, Pencil, Plus, Trash2 } from "lucide-react";
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
import { dedupeAttendanceByPriority } from "../../../../utils/attendanceSourcePriority";

type AttendanceSectionProps = {
  employeeGuid: string;
  brandColor: string;
};

type AttendanceItem = {
  guid: string;
  date?: string | null;
  check_in_time?: string | null;
  check_out_time?: string | null;
  delay_time?: string | null;
  status?: string[] | string | null;
  action_status?: string[] | string | null;
  created_at?: string | null;
  companies_id?: string;
  companies_id_data?: {
    name?: string;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

type AttendanceWorkflowStatus = "accepted" | "rejected" | "requested" | "unknown";
type AttendanceActionStatus = "present" | "late" | "absent" | "unknown";

type AttendanceRecord = {
  guid: string;
  date: string;
  checkInTime: string;
  checkOutTime: string;
  delayTime: string;
  requestStatus: AttendanceWorkflowStatus;
  actionStatus: AttendanceActionStatus;
  createdAt: string;
};

type AttendanceDraft = {
  date: Date | null;
  checkInTime: string;
  checkOutTime: string;
};

const ATTENDANCE_SLUG = "attendance";
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DELAY_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const WORK_DAY_START_MINUTES = 9 * 60;

const normalizeTimeValue = (value: string | null | undefined): string => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (TIME_PATTERN.test(trimmed)) {
      return trimmed;
    }
  }

  return "";
};

const normalizeDelayTime = (value: string | null | undefined): string => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (DELAY_TIME_PATTERN.test(trimmed)) {
      return trimmed;
    }
  }

  return "";
};

const normalizeDelayTimeForPayload = (value: string | null | undefined): string => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (DELAY_TIME_PATTERN.test(trimmed)) {
      return trimmed;
    }
  }

  return "00:00";
};

const parseTimeToMinutes = (value: string): number | null => {
  const normalized = normalizeTimeValue(value);
  if (!normalized) return null;
  const [hours, minutes] = normalized.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

const toDelayString = (minutes: number): string => {
  const safe = Math.max(0, Math.floor(minutes));
  const hh = String(Math.floor(safe / 60)).padStart(2, "0");
  const mm = String(safe % 60).padStart(2, "0");
  return `${hh}:${mm}`;
};

const computeDelayTimeFromCheckIn = (checkInTime: string): string => {
  const checkInMinutes = parseTimeToMinutes(checkInTime);
  if (checkInMinutes == null) return "00:00";
  const diff = Math.max(0, checkInMinutes - WORK_DAY_START_MINUTES);
  return toDelayString(diff);
};

const formatDateLabel = (value: string): string => {
  if (!value) return "—";
  const match = DATE_PATTERN.exec(value.trim());
  if (match) {
    return `${match[3]}.${match[2]}.${match[1]}`;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatTimeLabel = (value: string): string => normalizeTimeValue(value) || "—";

const hasDelayValue = (value: string): boolean => DELAY_TIME_PATTERN.test(value) && value !== "00:00";

const normalizeAttendanceWorkflowStatus = (value: unknown): AttendanceWorkflowStatus => {
  const normalized = Array.isArray(value)
    ? String(value[0] || "").trim().toLowerCase()
    : String(value || "").trim().toLowerCase();

  if (normalized === "accepted") return "accepted";
  if (normalized === "rejected") return "rejected";
  if (normalized === "requested") return "requested";
  return "unknown";
};

const normalizeAttendanceActionStatus = (value: unknown): AttendanceActionStatus => {
  const normalized = Array.isArray(value)
    ? String(value[0] || "").trim().toLowerCase()
    : String(value || "").trim().toLowerCase();

  if (normalized === "present") return "present";
  if (normalized === "late") return "late";
  if (normalized === "absent") return "absent";
  return "unknown";
};

const resolveActionStatusFromTime = (
  checkInTime: string
): Exclude<AttendanceActionStatus, "unknown"> => {
  const normalizedCheckIn = normalizeTimeValue(checkInTime);
  if (!normalizedCheckIn) return "absent";
  return hasDelayValue(computeDelayTimeFromCheckIn(normalizedCheckIn)) ? "late" : "present";
};

const getActionStatusTag = (
  status: AttendanceActionStatus
): { label: string; className: string } => {
  if (status === "absent") {
    return {
      label: "Отсутствует",
      className: "border-slate-200 bg-slate-100 text-slate-500",
    };
  }

  if (status === "late") {
    return {
      label: hasDelayValue(delayTime) ? delayTime : "Опоздание",
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }

  if (status === "present") {
    return {
      label: "Присутствует",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  return {
    label: "—",
    className: "border-slate-200 bg-slate-100 text-slate-500",
  };
};

const getWorkflowStatusTag = (
  status: AttendanceWorkflowStatus
): { label: string; className: string } => {
  if (status === "accepted") {
    return {
      label: "Подтверждено",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  if (status === "requested") {
    return {
      label: "Запрошено",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  if (status === "rejected") {
    return {
      label: "Отклонено",
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }

  return {
    label: "—",
    className: "border-slate-200 bg-slate-100 text-slate-500",
  };
};

const toDateValue = (value: string | null | undefined): Date | null => {
  if (!value) return null;

  const match = DATE_PATTERN.exec(value.trim());
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toApiDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toTimestamp = (value: string | null | undefined): number => {
  if (!value) return 0;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const toSortTimestamp = (record: AttendanceRecord): number => {
  const dateMatch = DATE_PATTERN.exec(record.date.trim());
  const time = normalizeTimeValue(record.checkInTime) || normalizeTimeValue(record.checkOutTime) || "00:00";
  const [hours, minutes] = time.split(":").map(Number);

  if (dateMatch) {
    const year = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const day = Number(dateMatch[3]);

    return Date.UTC(
      year,
      month - 1,
      day,
      Number.isFinite(hours) ? hours : 0,
      Number.isFinite(minutes) ? minutes : 0
    );
  }

  return toTimestamp(record.createdAt);
};

const getDefaultDraft = (): AttendanceDraft => {
  const now = new Date();
  const timeNow = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  return {
    date: now,
    checkInTime: timeNow,
    checkOutTime: "",
  };
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
    const rawRows = (data?.response || []) as AttendanceItem[];
    const rowsWithUser = rawRows.map((item) => ({
      ...item,
      user_base_id:
        typeof item.user_base_id === "string" ? item.user_base_id : employeeGuid,
    }));
    const deduped = dedupeAttendanceByPriority(rowsWithUser);
    const rows = deduped.map((item) => ({
      guid: item.guid,
      date: typeof item.date === "string" ? item.date : "",
      checkInTime: normalizeTimeValue(item.check_in_time),
      checkOutTime: normalizeTimeValue(item.check_out_time),
      delayTime: normalizeDelayTime(item.delay_time),
      requestStatus: normalizeAttendanceWorkflowStatus(item.status),
      actionStatus: normalizeAttendanceActionStatus(item.action_status),
      createdAt: typeof item.created_at === "string" ? item.created_at : "",
    }));

    return rows.sort((left, right) => toSortTimestamp(right) - toSortTimestamp(left));
  }, [data?.response, employeeGuid]);

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
      date: toDateValue(record.date || record.createdAt),
      checkInTime: normalizeTimeValue(record.checkInTime),
      checkOutTime: normalizeTimeValue(record.checkOutTime),
    });
    setError("");
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!draft.date) {
      setError("Укажите дату.");
      return;
    }

    const checkInTime = normalizeTimeValue(draft.checkInTime);
    const checkOutTime = normalizeTimeValue(draft.checkOutTime);
    const delayTime = computeDelayTimeFromCheckIn(checkInTime);
    const actionStatus = resolveActionStatusFromTime(checkInTime);

    if (!checkInTime && !checkOutTime) {
      setError("Укажите хотя бы одно время: приход или уход.");
      return;
    }

    const payload = {
      user_base_id: employeeGuid,
      companies_id: companyStore.company?.guid || COMPANY_ID,
      date: toApiDate(draft.date),
      ...(checkInTime ? { check_in_time: checkInTime } : {}),
      ...(checkOutTime ? { check_out_time: checkOutTime } : {}),
      delay_time: normalizeDelayTimeForPayload(delayTime),
      status: ["accepted"],
      action_status: [actionStatus],
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

  const handleConfirmRequested = async (record: AttendanceRecord) => {
    try {
      await updateMutation.mutateAsync({
        guid: record.guid,
        data: {
          user_base_id: employeeGuid,
          companies_id: companyStore.company?.guid || COMPANY_ID,
          date: record.date,
          ...(record.checkInTime ? { check_in_time: record.checkInTime } : {}),
          ...(record.checkOutTime ? { check_out_time: record.checkOutTime } : {}),
          delay_time: normalizeDelayTimeForPayload(record.delayTime),
          status: ["accepted"],
          action_status: [record.actionStatus === "unknown" ? resolveActionStatusFromTime(record.checkInTime) : record.actionStatus],
        },
      });
    } catch (confirmError) {
      console.error("Attendance confirm error:", confirmError);
      setError("Не удалось подтвердить запись. Попробуйте ещё раз.");
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
                    <th className="py-2 text-[12px] font-semibold text-slate-500">Приход</th>
                    <th className="py-2 text-[12px] font-semibold text-slate-500">Уход</th>
                    <th className="py-2 text-[12px] font-semibold text-slate-500">Статус действия</th>
                    <th className="py-2 text-[12px] font-semibold text-slate-500">Статус заявки</th>
                    <th className="py-2 text-right text-[12px] font-semibold text-slate-500">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => {
                    const actionTag = getActionStatusTag(record.actionStatus);
                    const requestTag = getWorkflowStatusTag(record.requestStatus);

                    return (
                      <tr key={record.guid} className="border-b border-slate-100">
                        <td className="py-3 text-[13px] text-slate-800">
                          {formatDateLabel(record.date)}
                        </td>
                        <td className="py-3 text-[13px] font-semibold text-slate-900">
                          {formatTimeLabel(record.checkInTime)}
                        </td>
                        <td className="py-3 text-[13px] font-semibold text-slate-900">
                          {formatTimeLabel(record.checkOutTime)}
                        </td>
                        <td className="py-3 text-[13px] text-slate-700">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[12px] font-semibold ${actionTag.className}`}
                          >
                            {actionTag.label}
                          </span>
                        </td>
                        <td className="py-3 text-[13px] text-slate-700">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[12px] font-semibold ${requestTag.className}`}
                          >
                            {requestTag.label}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex justify-end gap-2">
                            {record.requestStatus === "requested" ? (
                              <button
                                type="button"
                                onClick={() => {
                                  void handleConfirmRequested(record);
                                }}
                                className="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-[12px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                                title="Подтвердить"
                              >
                                <Check className="h-3.5 w-3.5" />
                                Подтвердить
                              </button>
                            ) : null}
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
                    );
                  })}
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
          <div className="grid grid-cols-1 gap-4">
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
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                Время прихода
              </label>
              <input
                type="time"
                step={60}
                value={draft.checkInTime}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    checkInTime: event.target.value,
                  }))
                }
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-slate-300"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                Время ухода
              </label>
              <input
                type="time"
                step={60}
                value={draft.checkOutTime}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    checkOutTime: event.target.value,
                  }))
                }
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-slate-300"
              />
            </div>
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
