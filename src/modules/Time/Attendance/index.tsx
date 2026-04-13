import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import PageMeta from "../../../components/common/PageMeta";
import { useSettingsDirectoryQuery } from "../../../api/services/settingsDirectory.service";
import encodeJsonToUrlParam from "../../../utils/encodeJsonToUrlParam";

type AttendanceItem = {
  guid: string;
  date?: string | null;
  check_in_time?: string | null;
  check_out_time?: string | null;
  delay_time?: string | null;
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

type AttendanceRecord = {
  guid: string;
  date: string;
  checkInTime: string;
  checkOutTime: string;
  delayTime: string;
  createdAt: string;
  employeeGuid: string;
  employeeName: string;
};

const ATTENDANCE_SLUG = "attendance";
const PAGE_SIZE = 20;

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DELAY_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const normalizeDelayTime = (value: string | null | undefined): string => {
  if (typeof value === "string" && DELAY_TIME_PATTERN.test(value.trim())) {
    return value.trim();
  }
  return "";
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

const getDelayTag = (
  checkInTime: string,
  delayTime: string
): { label: string; className: string } => {
  const hasCheckIn = Boolean(normalizeTime(checkInTime));
  if (!hasCheckIn) {
    return {
      label: "—",
      className: "border-slate-200 bg-slate-100 text-slate-500",
    };
  }

  if (hasDelayValue(delayTime)) {
    return {
      label: delayTime,
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }

  return {
    label: "Без опоздания",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
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

export default function TimeAttendancePage() {
  const [page, setPage] = useState(1);
  const [dateFilter, setDateFilter] = useState(() => toIsoDate(new Date()));
  const dateRangeFilter = useMemo(() => toUtcDayRangeFilter(dateFilter), [dateFilter]);

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

  return (
    <>
      <PageMeta title="Посещаемость | HRMS" description="Таблица посещаемости сотрудников" />

      <div className="space-y-4">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-6 py-4">
            <Link
              to="/dashboard"
              className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-slate-700"
            >
              <ArrowLeft size={14} />
              Назад
            </Link>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-slate-500" />
                  <h1 className="m-0 text-[20px] font-semibold text-slate-900">Посещаемость</h1>
                </div>
                <p className="mt-1 text-[12px] text-slate-500">
                  Таблица событий прихода и ухода по всем сотрудникам
                </p>
              </div>

              <div className="inline-flex shrink-0 items-center rounded-lg border border-gray-200 bg-white p-1">
                <button
                  type="button"
                  onClick={() => shiftDateFilter(-1)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition hover:bg-gray-100"
                  aria-label="Предыдущий день"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="px-2 text-sm font-semibold text-gray-700">{dateFilterLabel}</span>
                <button
                  type="button"
                  onClick={() => shiftDateFilter(1)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition hover:bg-gray-100"
                  aria-label="Следующий день"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>

          <div className="px-6 py-5">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />
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
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="py-2 text-[12px] font-semibold text-slate-500">Сотрудник</th>
                        <th className="py-2 text-[12px] font-semibold text-slate-500">Дата</th>
                        <th className="py-2 text-[12px] font-semibold text-slate-500">Приход</th>
                        <th className="py-2 text-[12px] font-semibold text-slate-500">Уход</th>
                        <th className="py-2 text-[12px] font-semibold text-slate-500">Опоздание</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map((record) => {
                        const delayTag = getDelayTag(record.checkInTime, record.delayTime);

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
                            <td className="py-3 text-[13px] text-slate-700">
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-[12px] font-semibold ${delayTag.className}`}
                              >
                                {delayTag.label}
                              </span>
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
    </>
  );
}
