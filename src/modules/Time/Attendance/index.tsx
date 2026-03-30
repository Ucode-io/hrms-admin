import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, Clock3, Search } from "lucide-react";
import PageMeta from "../../../components/common/PageMeta";
import { useSettingsDirectoryQuery } from "../../../api/services/settingsDirectory.service";
import encodeJsonToUrlParam from "../../../utils/encodeJsonToUrlParam";

type AttendanceActionType = "check_in" | "check_out";

type AttendanceItem = {
  guid: string;
  action_type?: AttendanceActionType[] | AttendanceActionType | null;
  time?: string | null;
  delay_time?: string | null;
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
  actionType: AttendanceActionType;
  time: string;
  delayTime: string;
  employeeGuid: string;
  employeeName: string;
};

const ATTENDANCE_SLUG = "attendance";
const PAGE_SIZE = 20;

const ACTION_LABELS: Record<AttendanceActionType, string> = {
  check_in: "Приход",
  check_out: "Уход",
};

const ACTION_TAG_STYLES: Record<AttendanceActionType, string> = {
  check_in: "border-emerald-200 bg-emerald-50 text-emerald-700",
  check_out: "border-amber-200 bg-amber-50 text-amber-700",
};

const DELAY_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const resolveActionType = (value: AttendanceItem["action_type"]): AttendanceActionType => {
  if (Array.isArray(value)) {
    return value[0] === "check_out" ? "check_out" : "check_in";
  }

  return value === "check_out" ? "check_out" : "check_in";
};

const normalizeDelayTime = (value: string | null | undefined): string => {
  if (typeof value === "string" && DELAY_TIME_PATTERN.test(value.trim())) {
    return value.trim();
  }
  return "00:10";
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
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useSettingsDirectoryQuery({
    slug: ATTENDANCE_SLUG,
    params: {
      with_relations: true,
      data: encodeJsonToUrlParam({
        limit: 500,
        offset: 0,
      }),
    },
  });

  const records = useMemo<AttendanceRecord[]>(() => {
    const rows = ((data?.response || []) as AttendanceItem[]).map((item) => {
      const actionType = resolveActionType(item.action_type);
      const time = typeof item.time === "string" ? item.time : "";
      const delayTime = normalizeDelayTime(item.delay_time);
      const employeeInfo = getEmployeeInfo(item);

      return {
        guid: item.guid,
        actionType,
        time,
        delayTime,
        employeeGuid: employeeInfo.employeeGuid,
        employeeName: employeeInfo.employeeName,
      };
    });

    return rows.sort((left, right) => toTimestamp(right.time) - toTimestamp(left.time));
  }, [data?.response]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return records;

    return records.filter((item) => item.employeeName.toLowerCase().includes(query));
  }, [records, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [search]);

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
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-slate-500" />
              <h1 className="m-0 text-[20px] font-semibold text-slate-900">Посещаемость</h1>
            </div>
            <p className="mt-1 text-[12px] text-slate-500">
              Таблица событий прихода и ухода по всем сотрудникам
            </p>
          </div>

          <div className="border-b border-slate-100 px-6 py-3">
            <label className="relative block w-full md:max-w-sm">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Поиск по сотруднику..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-slate-300"
              />
            </label>
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
                        <th className="py-2 text-[12px] font-semibold text-slate-500">Время</th>
                        <th className="py-2 text-[12px] font-semibold text-slate-500">Опоздание</th>
                        <th className="py-2 text-[12px] font-semibold text-slate-500">Тип действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map((record) => (
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
                          <td className="py-3 text-[13px] text-slate-800">{formatDateLabel(record.time)}</td>
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
                        </tr>
                      ))}
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
