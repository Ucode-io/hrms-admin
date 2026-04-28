import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import type { StylesConfig } from "react-select";
import PageMeta from "../../../components/common/PageMeta";
import { Modal } from "../../../components/ui/modal";
import EmployeeInfiniteSelect from "../../../components/autocomplete/EmployeeInfiniteSelect";
import companyStore from "../../../store/company.store";
import {
  COMPANY_ID,
  useCreateSettingsDirectoryItem,
  useDeleteSettingsDirectoryItem,
  useSettingsDirectoryQuery,
  useUpdateSettingsDirectoryItem,
} from "../../../api/services/settingsDirectory.service";
import encodeJsonToUrlParam from "../../../utils/encodeJsonToUrlParam";

type AttendanceItem = {
  guid: string;
  date?: string | null;
  check_in_time?: string | null;
  check_out_time?: string | null;
  delay_time?: string | null;
  status?: string[] | string | null;
  created_at?: string | null;
  user_base_id?: string | null;
  user_base_id_data?: {
    guid?: string;
    first_name?: string;
    second_name?: string;
    name?: string;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

type AttendanceStatus = "present" | "late" | "absent" | "unknown";

type AttendanceRecord = {
  guid: string;
  date: string;
  checkInTime: string;
  checkOutTime: string;
  delayTime: string;
  status: AttendanceStatus;
  createdAt: string;
  employeeGuid: string;
  employeeName: string;
};

type AttendanceDraft = {
  employeeGuid: string;
  date: Date | null;
  checkInTime: string;
  checkOutTime: string;
  delayTime: string;
};

type SelectOption = {
  value: string;
  label: string;
};

const ATTENDANCE_SLUG = "attendance";
const PAGE_SIZE = 20;

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DELAY_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const getEmployeeSelectStyles = (): StylesConfig<SelectOption, false> => ({
  control: (base, state) => ({
    ...base,
    minHeight: "40px",
    borderColor: state.isFocused ? "#cbd5e1" : "#e2e8f0",
    borderRadius: "0.5rem",
    boxShadow: "none",
    "&:hover": {
      borderColor: "#cbd5e1",
    },
  }),
  valueContainer: (base) => ({ ...base, padding: "0 10px", fontSize: "13px" }),
  input: (base) => ({ ...base, margin: 0, padding: 0, fontSize: "13px" }),
  indicatorsContainer: (base) => ({ ...base, height: "38px" }),
  option: (base, state) => ({
    ...base,
    fontSize: "13px",
    cursor: "pointer",
    backgroundColor: state.isSelected ? "#e2e8f0" : state.isFocused ? "#f8fafc" : "white",
    color: "#111827",
    padding: "8px 10px",
  }),
  menu: (base) => ({
    ...base,
    zIndex: 100000,
    borderRadius: "0.5rem",
    border: "1px solid #e5e7eb",
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 100000,
  }),
  singleValue: (base) => ({ ...base, fontSize: "13px" }),
  placeholder: (base) => ({ ...base, fontSize: "13px", color: "#94a3b8" }),
});

const normalizeDelayTime = (value: string | null | undefined): string => {
  if (typeof value === "string" && DELAY_TIME_PATTERN.test(value.trim())) {
    return value.trim();
  }
  return "";
};

const normalizeDelayTimeForPayload = (value: string | null | undefined): string => {
  if (typeof value === "string" && DELAY_TIME_PATTERN.test(value.trim())) {
    return value.trim();
  }
  return "00:00";
};

const toTimestamp = (value: string | null | undefined): number => {
  if (!value) return 0;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const toIsoDate = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseIsoDate = (value: string): Date | null => {
  if (!ISO_DATE_PATTERN.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  return parsed;
};

const toDateValue = (value: string | null | undefined): Date | null => {
  if (!value) return null;

  if (ISO_DATE_PATTERN.test(value.trim())) {
    return parseIsoDate(value.trim());
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toUtcDayRangeFilter = (isoDate: string): { $gte: string; $lte: string } => {
  const baseDate = parseIsoDate(isoDate) || new Date();

  const start = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    0,
    0,
    0,
    0
  );
  const end = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    23,
    59,
    59,
    0
  );

  return {
    $gte: start.toISOString(),
    $lte: end.toISOString(),
  };
};

const normalizeDateKey = (value: string | null | undefined, fallback: string | null | undefined): string => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (ISO_DATE_PATTERN.test(trimmed)) {
      return trimmed;
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return toIsoDate(parsed);
    }
  }

  if (typeof fallback === "string" && fallback.trim()) {
    const parsed = new Date(fallback);
    if (!Number.isNaN(parsed.getTime())) {
      return toIsoDate(parsed);
    }
  }

  return "";
};

const normalizeTime = (value: string | null | undefined): string => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (TIME_PATTERN.test(trimmed)) {
      return trimmed;
    }
  }

  return "";
};

const toSortTimestamp = (item: AttendanceItem): number => {
  const dateValue = typeof item.date === "string" ? item.date.trim() : "";
  const timeValue = normalizeTime(item.check_in_time) || normalizeTime(item.check_out_time) || "00:00";
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  const [hours, minutes] = timeValue.split(":").map(Number);

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

  return toTimestamp(item.created_at);
};

const formatDateLabel = (value: string): string => {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (match) {
    return `${match[3]}.${match[2]}.${match[1]}`;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const formatTimeLabel = (value: string): string => {
  return normalizeTime(value) || "—";
};

const hasDelayValue = (value: string): boolean => DELAY_TIME_PATTERN.test(value) && value !== "00:00";

const normalizeAttendanceStatus = (value: unknown): AttendanceStatus => {
  const normalized = Array.isArray(value)
    ? String(value[0] || "").trim().toLowerCase()
    : String(value || "").trim().toLowerCase();

  if (normalized === "present") return "present";
  if (normalized === "late") return "late";
  if (normalized === "absent") return "absent";
  return "unknown";
};

const resolveStatusFromTime = (
  checkInTime: string,
  delayTime: string
): Exclude<AttendanceStatus, "unknown"> => {
  if (!checkInTime) return "absent";
  return hasDelayValue(delayTime) ? "late" : "present";
};

const getAttendanceTag = (
  checkInTime: string,
  delayTime: string,
  status: AttendanceStatus
): { label: string; className: string } => {
  if (status === "absent") {
    return {
      label: "Отсутствует",
      className: "border-slate-200 bg-slate-100 text-slate-500",
    };
  }

  if (status === "late") {
    return {
      label: "Опоздал",
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }

  if (status === "present") {
    return {
      label: "Присутствует",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  const hasCheckIn = Boolean(normalizeTime(checkInTime));
  if (!hasCheckIn) {
    return {
      label: "—",
      className: "border-slate-200 bg-slate-100 text-slate-500",
    };
  }

  if (hasDelayValue(delayTime)) {
    return {
      label: "Опоздал",
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }

  return {
    label: "Без опоздания",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
};

const getDelayLabel = (delayTime: string, status: AttendanceStatus): string => {
  if (status === "late" || hasDelayValue(delayTime)) {
    return hasDelayValue(delayTime) ? delayTime : "00:00";
  }
  return "—";
};

const getEmployeeInfo = (item: AttendanceItem): { employeeGuid: string; employeeName: string } => {
  const relation =
    item.user_base_id_data && typeof item.user_base_id_data === "object"
      ? item.user_base_id_data
      : null;

  const firstName = typeof relation?.first_name === "string" ? relation.first_name : "";
  const secondName = typeof relation?.second_name === "string" ? relation.second_name : "";
  const fullName = [secondName, firstName].filter(Boolean).join(" ").trim();

  const employeeName =
    fullName ||
    (typeof relation?.name === "string" ? relation.name : "") ||
    "—";

  const employeeGuid =
    (typeof item.user_base_id === "string" && item.user_base_id) ||
    (typeof relation?.guid === "string" ? relation.guid : "");

  return { employeeGuid, employeeName };
};

const getDefaultDraft = (dateFilter: string): AttendanceDraft => {
  const baseDate = parseIsoDate(dateFilter) || new Date();
  const now = new Date();
  const timeNow = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  return {
    employeeGuid: "",
    date: baseDate,
    checkInTime: timeNow,
    checkOutTime: "",
    delayTime: "00:00",
  };
};

export default function TimeAttendancePage() {
  const [page, setPage] = useState(1);
  const [dateFilter, setDateFilter] = useState(() => toIsoDate(new Date()));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGuid, setEditingGuid] = useState<string | null>(null);
  const [draft, setDraft] = useState<AttendanceDraft>(() => getDefaultDraft(toIsoDate(new Date())));
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [employeeFallbackLabel, setEmployeeFallbackLabel] = useState("");
  const [toDelete, setToDelete] = useState<AttendanceRecord | null>(null);

  const brandColor = companyStore.mainColor;
  const dateRangeFilter = useMemo(() => toUtcDayRangeFilter(dateFilter), [dateFilter]);
  const menuPortalTarget = typeof document !== "undefined" ? document.body : undefined;

  const { data, isLoading, isError, refetch } = useSettingsDirectoryQuery({
    slug: ATTENDANCE_SLUG,
    params: {
      with_relations: true,
      data: encodeJsonToUrlParam({
        limit: 500,
        offset: 0,
        date: dateRangeFilter,
      }),
    },
  });

  const createMutation = useCreateSettingsDirectoryItem(ATTENDANCE_SLUG);
  const updateMutation = useUpdateSettingsDirectoryItem(ATTENDANCE_SLUG);
  const deleteMutation = useDeleteSettingsDirectoryItem(ATTENDANCE_SLUG);
  const isSaving = createMutation.isLoading || updateMutation.isLoading || deleteMutation.isLoading;

  const records = useMemo<AttendanceRecord[]>(() => {
    const rows = ((data?.response || []) as AttendanceItem[]).map((item) => {
      const date = normalizeDateKey(item.date, item.created_at);
      const checkInTime = normalizeTime(item.check_in_time);
      const checkOutTime = normalizeTime(item.check_out_time);
      const delayTime = normalizeDelayTime(item.delay_time);
      const employeeInfo = getEmployeeInfo(item);

      return {
        guid: item.guid,
        date,
        checkInTime,
        checkOutTime,
        delayTime,
        status: normalizeAttendanceStatus(item.status),
        createdAt: typeof item.created_at === "string" ? item.created_at : "",
        employeeGuid: employeeInfo.employeeGuid,
        employeeName: employeeInfo.employeeName,
      };
    });

    return rows.sort((left, right) => {
      const rightItem: AttendanceItem = {
        date: right.date,
        check_in_time: right.checkInTime,
        check_out_time: right.checkOutTime,
        created_at: right.createdAt,
      };
      const leftItem: AttendanceItem = {
        date: left.date,
        check_in_time: left.checkInTime,
        check_out_time: left.checkOutTime,
        created_at: left.createdAt,
      };

      return toSortTimestamp(rightItem) - toSortTimestamp(leftItem);
    });
  }, [data?.response]);

  const filteredRecords = useMemo(
    () => records.filter((item) => item.date === dateFilter),
    [records, dateFilter]
  );

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [dateFilter]);

  const dateFilterLabel = useMemo(() => {
    return formatDateLabel(dateFilter);
  }, [dateFilter]);

  const shiftDateFilter = (days: number) => {
    setDateFilter((prev) => {
      const base = parseIsoDate(prev) || new Date();
      base.setDate(base.getDate() + days);
      return toIsoDate(base);
    });
  };

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pageStart = (page - 1) * PAGE_SIZE;
  const pageItems = filteredRecords.slice(pageStart, pageStart + PAGE_SIZE);

  const closeModal = () => {
    if (isSaving) return;

    setIsModalOpen(false);
    setEditingGuid(null);
    setDraft(getDefaultDraft(dateFilter));
    setEmployeeFallbackLabel("");
    setFormError("");
  };

  const openCreate = () => {
    setEditingGuid(null);
    setDraft(getDefaultDraft(dateFilter));
    setEmployeeFallbackLabel("");
    setFormError("");
    setIsModalOpen(true);
  };

  const openEdit = (record: AttendanceRecord) => {
    setEditingGuid(record.guid);
    setDraft({
      employeeGuid: record.employeeGuid,
      date: toDateValue(record.date || record.createdAt),
      checkInTime: normalizeTime(record.checkInTime),
      checkOutTime: normalizeTime(record.checkOutTime),
      delayTime: normalizeDelayTime(record.delayTime) || "00:00",
    });
    setEmployeeFallbackLabel(record.employeeName || "");
    setFormError("");
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    const employeeGuid = String(draft.employeeGuid || "").trim();
    if (!employeeGuid) {
      setFormError("Выберите сотрудника.");
      return;
    }

    if (!draft.date) {
      setFormError("Укажите дату.");
      return;
    }

    const checkInTime = normalizeTime(draft.checkInTime);
    const checkOutTime = normalizeTime(draft.checkOutTime);

    if (!checkInTime && !checkOutTime) {
      setFormError("Укажите хотя бы одно время: приход или уход.");
      return;
    }

    const payload = {
      user_base_id: employeeGuid,
      companies_id: companyStore.company?.guid || COMPANY_ID,
      date: toIsoDate(draft.date),
      ...(checkInTime ? { check_in_time: checkInTime } : {}),
      ...(checkOutTime ? { check_out_time: checkOutTime } : {}),
      ...(checkInTime ? { delay_time: normalizeDelayTimeForPayload(draft.delayTime) } : {}),
      status: [resolveStatusFromTime(checkInTime, draft.delayTime)],
    };

    try {
      setActionError("");
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
      setFormError("Не удалось сохранить запись. Попробуйте ещё раз.");
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;

    try {
      setActionError("");
      await deleteMutation.mutateAsync(toDelete.guid);
      setToDelete(null);
    } catch (deleteError) {
      console.error("Attendance delete error:", deleteError);
      setActionError("Не удалось удалить запись. Попробуйте ещё раз.");
    }
  };

  return (
    <>
      <PageMeta title="Посещаемость | HRMS" description="Таблица посещаемости сотрудников" />

      <div className="-mx-3 md:-mx-4 -mt-3 md:-mt-4">
        <div
          className="px-4 lg:px-6 py-2"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "10px",
            flexWrap: "wrap",
            backgroundColor: "#fff",
            border: "1px solid #e2e8f0",
            borderTop: "none",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "3px",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              backgroundColor: "#f8fafc",
              height: "38px",
            }}
          >
            <button
              type="button"
              onClick={() => shiftDateFilter(-1)}
              className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-transparent text-slate-600 transition hover:bg-white hover:border-slate-200"
              aria-label="Предыдущий день"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[150px] px-3 text-center text-[13px] font-semibold text-slate-700">
              {dateFilterLabel}
            </span>
            <button
              type="button"
              onClick={() => shiftDateFilter(1)}
              className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-transparent text-slate-600 transition hover:bg-white hover:border-slate-200"
              aria-label="Следующий день"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-[38px] items-center gap-1.5 rounded-[10px] border border-transparent px-4 text-[13px] font-semibold text-white transition hover:opacity-90"
            style={{ backgroundColor: brandColor }}
          >
            <Plus className="h-3.5 w-3.5" />
            Добавить
          </button>
        </div>

        <div className="px-4 lg:px-6 py-5">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="px-4 py-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200" style={{ borderTopColor: brandColor }} />
                </div>
              ) : isError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 text-[13px] text-rose-600">
                  Не удалось загрузить записи по посещаемости.
                  <button
                    type="button"
                    onClick={() => {
                      void refetch();
                    }}
                    className="ml-2 inline-flex h-8 items-center rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white transition hover:bg-rose-700"
                  >
                    Повторить
                  </button>
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center">
                  <p className="m-0 text-[13px] text-slate-500">Записей по посещаемости пока нет</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {actionError ? (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-600">
                      {actionError}
                    </div>
                  ) : null}

                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="py-2 text-[12px] font-semibold text-slate-500">Сотрудник</th>
                          <th className="py-2 text-[12px] font-semibold text-slate-500">Дата</th>
                          <th className="py-2 text-[12px] font-semibold text-slate-500">Приход</th>
                          <th className="py-2 text-[12px] font-semibold text-slate-500">Уход</th>
                          <th className="py-2 text-[12px] font-semibold text-slate-500">Опоздание</th>
                          <th className="py-2 text-[12px] font-semibold text-slate-500">Статус</th>
                          <th className="py-2 text-right text-[12px] font-semibold text-slate-500">Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageItems.map((record) => {
                          const attendanceTag = getAttendanceTag(
                            record.checkInTime,
                            record.delayTime,
                            record.status
                          );

                          return (
                            <tr key={record.guid} className="border-b border-slate-100">
                              <td className="py-3 text-[13px] text-slate-800">
                                {record.employeeGuid ? (
                                  <Link
                                    to={`/employees/${record.employeeGuid}`}
                                    className="font-medium text-slate-800 transition hover:text-brand-500"
                                  >
                                    {record.employeeName}
                                  </Link>
                                ) : (
                                  <span>{record.employeeName}</span>
                                )}
                              </td>
                              <td className="py-3 text-[13px] text-slate-800">{formatDateLabel(record.date)}</td>
                              <td className="py-3 text-[13px] font-semibold text-slate-900">
                                {formatTimeLabel(record.checkInTime)}
                              </td>
                              <td className="py-3 text-[13px] font-semibold text-slate-900">
                                {formatTimeLabel(record.checkOutTime)}
                              </td>
                              <td className="py-3 text-[13px] font-semibold text-slate-900">
                                {getDelayLabel(record.delayTime, record.status)}
                              </td>
                              <td className="py-3 text-[13px] text-slate-700">
                                <span
                                  className={`inline-flex rounded-full border px-2.5 py-1 text-[12px] font-semibold ${attendanceTag.className}`}
                                >
                                  {attendanceTag.label}
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
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {totalPages > 1 ? (
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <p className="text-[12px] text-slate-500">
                        Показано {pageStart + 1}-{Math.min(pageStart + PAGE_SIZE, filteredRecords.length)} из {filteredRecords.length}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                          disabled={page <= 1}
                          className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Назад
                        </button>
                        <span className="text-[12px] font-semibold text-slate-600">
                          {page} / {totalPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                          disabled={page >= totalPages}
                          className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Вперед
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </section>
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
              Сотрудник
            </label>
            <EmployeeInfiniteSelect
              value={draft.employeeGuid}
              onChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  employeeGuid: value,
                }))
              }
              fallbackLabel={employeeFallbackLabel}
              placeholder="Выберите сотрудника"
              styles={getEmployeeSelectStyles()}
              menuPortalTarget={menuPortalTarget}
              classNamePrefix="attendance-employee-select"
            />
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

          {formError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-600">
              {formError}
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
