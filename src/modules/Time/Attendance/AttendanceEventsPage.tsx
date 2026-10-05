import { type ReactNode, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { ArrowLeft, Ban, ChevronLeft, ChevronRight, LogIn, LogOut, Search } from "lucide-react";
import PageMeta from "../../../components/common/PageMeta";
import Spinner from "../../../components/ui/Spinner";
import { useSettingsDirectoryQuery } from "../../../api/services/settingsDirectory.service";
import { type Shift, useShiftsQuery } from "../../../api/services/shift.service";
import encodeJsonToUrlParam from "../../../utils/encodeJsonToUrlParam";
import { getAttendanceSourceKind } from "../../../utils/attendanceSourcePriority";
import { shiftLengthMinutes } from "../../../utils/shiftWindow";
import { clockOfMark, shiftDateOfMark, shiftsByEmployeeOf } from "../../../utils/shiftAttribution";
import { EmployeeAvatar } from "../../Timesheet/components/badges";
import {
  formatDateRu,
  formatDayHeader,
  formatDuration,
  formatRangeLabel,
  fromIsoDate,
  isToday,
  isWeekend,
  rangeForScale,
  shiftAnchor,
  shiftDays,
  toIsoDate,
} from "../../Timesheet/constants";
import { DistanceBadge } from "../../../components/map/LocationViewLink";
import { type DayMarkGeo, markGeoByDay } from "../../../components/map/shared";
import { type Office, useOffices } from "../../../components/map/useOffices";
import { useTranslation } from "../../../i18n";
import { useEmployeeTimeZones, type EmployeeZones } from "../../../hooks/useEmployeeTimeZones";
import { WallTime } from "../../../components/common/WallTime";
import AttendanceDayDetail, {
  type DataRow,
  EmptyState,
  firstString,
  minutesFromClock,
  normalizeTime,
  readString,
  relationOf,
} from "./AttendanceDayDetail";

type AttendanceDay = {
  date: string;
  checkIn: string;
  checkOut: string;
  seconds: number;
  /** Отметка без смены на этот день: день не отработан, плана нет. */
  offSchedule: boolean;
};

type AttendanceEmployee = {
  id: string;
  hikvisionId: string;
  name: string;
  photo: string;
  department: string;
  /** `user_base.locations_id` — филиал, с которым сверяется точка отметки. */
  officeId: string;
  days: AttendanceDay[];
  totalSeconds: number;
};

// Уход раньше прихода — это следующие сутки: строка ночной смены лежит на
// дате её начала, «пришёл 22:05, ушёл 06:10» — это 8 ч 05 мин, а не ноль.
const secondsBetween = (from: string, to: string): number => {
  const start = minutesFromClock(from);
  const end = minutesFromClock(to);
  if (start === null || end === null || end === start) return 0;
  return ((end > start ? end : end + 24 * 60) - start) * 60;
};

// Шкала полоски дня — не короче 12 ч; длинная смена растягивает её, чтобы метка
// плана не упиралась в край.
const WORK_DAY_SCALE_MINUTES = 12 * 60;

const scaleForPlan = (planMinutes: number | null): number =>
  planMinutes ? Math.max(WORK_DAY_SCALE_MINUTES, Math.ceil((planMinutes * 1.5) / 60) * 60) : WORK_DAY_SCALE_MINUTES;

/** План дня — сумма длин смен сотрудника на эту дату. */
const planByDayOf = (shifts: Shift[]): Map<string, number> => {
  const plan = new Map<string, number>();
  for (const shift of shifts) {
    if (!shift.user_base_id) continue;
    const key = `${shift.user_base_id}|${String(shift.date).slice(0, 10)}`;
    plan.set(key, (plan.get(key) ?? 0) + shiftLengthMinutes(shift));
  }
  return plan;
};


const employeeName = (row: DataRow): string => {
  const relation = relationOf(row);
  const fullName = firstString(relation, ["full_name", "name"]);
  if (fullName) return fullName;
  return [readString(relation.first_name), readString(relation.second_name)]
    .filter(Boolean)
    .join(" ");
};

const employeeDepartment = (row: DataRow): string => {
  const relation = relationOf(row);
  const direct = firstString(relation, ["department", "position"]);
  if (direct) return direct;
  const department = relation.department_id_data;
  return department && typeof department === "object"
    ? firstString(department as DataRow, ["title", "name"])
    : "";
};

const groupAttendance = (rows: DataRow[]): AttendanceEmployee[] => {
  const grouped = new Map<string, AttendanceEmployee>();

  rows.forEach((row) => {
    const relation = relationOf(row);
    const id = readString(row.user_base_id) || readString(relation.guid);
    const date = readString(row.date).slice(0, 10);
    const checkIn = normalizeTime(row.check_in_time);
    const checkOut = normalizeTime(row.check_out_time);
    if (!id || !date || (!checkIn && !checkOut)) return;

    const current = grouped.get(id) ?? {
      id,
      hikvisionId: readString(row.hikvision_id) || readString(relation.hikvision_id),
      name: employeeName(row),
      photo: firstString(relation, ["photo", "avatar", "picture"]),
      department: employeeDepartment(row),
      officeId: readString(relation.locations_id),
      days: [],
      totalSeconds: 0,
    };
    const existing = current.days.find((day) => day.date === date);
    const nextIn = existing?.checkIn && existing.checkIn < checkIn ? existing.checkIn : checkIn || existing?.checkIn || "";
    const nextOut = existing?.checkOut && existing.checkOut > checkOut ? existing.checkOut : checkOut || existing?.checkOut || "";
    const isOffSchedule = getAttendanceSourceKind(row.source_type) === "off_schedule";
    const day: AttendanceDay = {
      date,
      checkIn: nextIn,
      checkOut: nextOut,
      seconds: secondsBetween(nextIn, nextOut),
      // День «вне графика» только если так помечены все его строки: рядом с
      // записью по смене он уже не про отсутствие смены.
      offSchedule: existing ? existing.offSchedule && isOffSchedule : isOffSchedule,
    };
    current.days = [...current.days.filter((item) => item.date !== date), day].sort((a, b) => a.date.localeCompare(b.date));
    current.totalSeconds = current.days.reduce((sum, item) => sum + item.seconds, 0);
    if (!current.hikvisionId) current.hikvisionId = readString(relation.hikvision_id);
    grouped.set(id, current);
  });

  return [...grouped.values()].filter((item) => item.name).sort((a, b) => a.name.localeCompare(b.name));
};

function AttendanceDayCell({ day, geo, office, zones, employeeId, planMinutes }: { day?: AttendanceDay; geo?: DayMarkGeo; office?: Office; zones: EmployeeZones; employeeId: string; planMinutes: number | null }) {
  const { t } = useTranslation();
  if (!day) return <span className="text-sm text-slate-300">—</span>;
  const workedMinutes = Math.max(0, Math.round(day.seconds / 60));
  // План — длина смены этого дня, а не «8 часов для всех»; без смены (вне
  // графика) плана нет и метки нет.
  const plan = day.offSchedule ? null : planMinutes || null;
  const scale = scaleForPlan(plan);
  const progress = Math.min(100, (workedMinutes / scale) * 100);
  const planPosition = plan ? Math.min(100, (plan / scale) * 100) : null;
  const barTitle = plan ? t("time_events.worked_vs_plan", { minutes: workedMinutes, plan }) : undefined;
  return (
    <div className="min-w-[142px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-700">
        <span className="inline-flex items-center gap-1.5">
          {day.checkIn ? <><LogIn size={14} className="shrink-0 text-slate-500" /><WallTime zones={zones} userBaseId={employeeId} date={day.date} time={day.checkIn} /></> : <MissingEventIcon type="in" />}
        </span>
        <span className="inline-flex items-center gap-1.5">
          {day.checkOut ? <><LogOut size={14} className="shrink-0 text-slate-500" /><WallTime zones={zones} userBaseId={employeeId} date={day.date} time={day.checkOut} /></> : <MissingEventIcon type="out" />}
        </span>
      </div>
      {geo ? (
        <div className="mt-1 flex items-center justify-between gap-1">
          {geo.in ? <DistanceBadge value={geo.in} office={office} /> : <span />}
          {geo.out ? <DistanceBadge value={geo.out} office={office} /> : null}
        </div>
      ) : null}
      <div className="mt-1.5 flex items-center gap-2">
        {day.offSchedule ? (
          // Серая плашка вместо полоски: план не с чем сравнивать, а зелёная
          // шкала читалась бы как «отработано».
          <span className="inline-flex flex-1 items-center">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">{t("attendance.source.off_schedule")}</span>
          </span>
        ) : (
          <div className="relative h-1 flex-1 rounded-full bg-slate-200" title={barTitle}>
            <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
            {planPosition !== null ? (
              <span className="absolute top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-900" style={{ left: `${planPosition}%` }} aria-label={barTitle} />
            ) : null}
          </div>
        )}
        <span className="shrink-0 text-[10px] font-semibold text-slate-600">{formatDuration(day.seconds)}</span>
      </div>
    </div>
  );
}

function MissingEventIcon({ type }: { type: "in" | "out" }) {
  const { t } = useTranslation();
  const DirectionIcon = type === "in" ? LogIn : LogOut;
  return (
    <span className="relative inline-flex h-[18px] w-[18px] items-center justify-center" role="img" aria-label={type === "in" ? t("time_events.no_check_in") : t("time_events.no_check_out")}>
      <DirectionIcon size={12} strokeWidth={2} className="text-slate-400" />
      <Ban size={18} strokeWidth={1.75} className="absolute inset-0 text-slate-400" />
    </span>
  );
}

function EmployeesOverview({
  employees,
  dates,
  monthLabel,
  loading,
  error,
  onOpen,
  onShiftMonth,
  geoByDay,
  planByDay,
  offices,
  zones,
}: {
  zones: EmployeeZones;
  geoByDay: Map<string, DayMarkGeo>;
  /** Минуты смен по ключу «сотрудник|дата». */
  planByDay: Map<string, number>;
  offices: Map<string, Office>;
  employees: AttendanceEmployee[];
  dates: string[];
  monthLabel: string;
  loading: boolean;
  error: boolean;
  onOpen: (employee: AttendanceEmployee, date?: string) => void;
  onShiftMonth: (amount: number) => void;
}) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const today = toIsoDate(new Date());
    if (!dates.includes(today) || employees.length === 0) return;
    const frame = window.requestAnimationFrame(() => {
      const container = scrollRef.current;
      const header = container?.querySelector<HTMLElement>(`[data-attendance-date="${today}"]`);
      if (!container || !header) return;
      const stickyHeader = container.querySelector<HTMLElement>("thead th:first-child");
      const containerRect = container.getBoundingClientRect();
      const headerRect = header.getBoundingClientRect();
      const stickyWidth = stickyHeader?.getBoundingClientRect().width ?? 285;
      const visibleCenter = containerRect.left + stickyWidth + (containerRect.width - stickyWidth) / 2;
      const todayCenter = headerRect.left + headerRect.width / 2;
      container.scrollLeft = Math.max(0, container.scrollLeft + todayCenter - visibleCenter);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [dates, employees.length]);

  if (loading) return <div className="flex min-h-[360px] items-center justify-center"><Spinner /></div>;
  if (error) return <EmptyState icon="clock" title={t("time_events.load_error")} hint={t("time_events.load_error_hint")} />;
  if (employees.length === 0) return <EmptyState icon="users" title={t("time_events.empty_month")} hint={t("time_events.empty_month_hint")} />;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-end border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
        <div className="inline-flex h-[38px] items-center rounded-xl border border-slate-200 bg-white p-[3px]">
          <button type="button" aria-label={t("common.prev_month")} onClick={() => onShiftMonth(-1)} className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-lg text-slate-600 transition hover:border-slate-200 hover:bg-slate-50"><ChevronLeft size={16} /></button>
          <span className="min-w-[170px] px-3 text-center text-[13px] font-semibold text-slate-700">{monthLabel}</span>
          <button type="button" aria-label={t("common.next_month")} onClick={() => onShiftMonth(1)} className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-lg text-slate-600 transition hover:border-slate-200 hover:bg-slate-50"><ChevronRight size={16} /></button>
        </div>
      </div>
      <div ref={scrollRef} className="max-w-full overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead className="border-b border-slate-100 bg-slate-50/70">
            <tr>
              <th className="sticky left-0 z-10 min-w-[285px] bg-slate-50 px-5 py-2.5 text-left text-xs font-semibold text-slate-500">{t("absence_request.employee")}</th>
              {dates.map((date) => <th key={date} data-attendance-date={date} className={`min-w-[158px] px-3 py-2.5 text-left text-xs font-semibold ${isWeekend(date) ? "text-rose-500" : "text-slate-500"} ${isToday(date) ? "bg-blue-50/60" : ""}`}>{formatDayHeader(date)}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.map((employee) => (
              <tr
                key={employee.id}
                role="button"
                tabIndex={0}
                aria-label={t("time_events.open_employee_events", { name: employee.name })}
                onClick={() => onOpen(employee)}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onOpen(employee); }}
                className="group cursor-pointer outline-none transition hover:bg-blue-50/40 focus:bg-blue-50/60"
              >
                <td className="sticky left-0 z-10 bg-white px-5 py-2 group-hover:bg-[#f7fbff] group-focus:bg-[#f3f9ff]">
                  <div className="flex items-center gap-3">
                    <EmployeeAvatar name={employee.name} photo={employee.photo} seed={employee.id} size={34} />
                    <div className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{employee.name}</div>
                  </div>
                </td>
                {dates.map((date) => {
                  const day = employee.days.find((item) => item.date === date);
                  return (
                    <td
                      key={date}
                      onClick={(event) => {
                        if (!day) return;
                        event.stopPropagation();
                        onOpen(employee, date);
                      }}
                      className={`px-3 py-1.5 align-middle ${day ? "cursor-pointer hover:bg-blue-50/60" : ""} ${isToday(date) ? "bg-blue-50/30" : ""}`}
                    >
                      <AttendanceDayCell day={day} geo={geoByDay.get(`${employee.id}|${date}`)} office={offices.get(employee.officeId)} zones={zones} employeeId={employee.id} planMinutes={planByDay.get(`${employee.id}|${date}`) ?? null} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-400"><span>{t("time_events.only_with_marks")}</span><span className="font-semibold text-slate-500">{t("time_events.employees_count", { count: employees.length })}</span></div>
    </div>
  );
}

export default function AttendanceEventsPage({ leftSlot }: { leftSlot?: ReactNode } = {}) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const employeeId = searchParams.get("employee") ?? "";
  const rawDate = searchParams.get("date");
  const anchor = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : toIsoDate(new Date());
  const range = useMemo(() => rangeForScale("month", anchor), [anchor]);
  const dates = useMemo(() => {
    const daysInMonth = fromIsoDate(range.to).getDate();
    return Array.from({ length: daysInMonth }, (_, index) => shiftDays(range.from, index));
  }, [range.from, range.to]);
  const [search, setSearch] = useState("");

  // «Вне графика» — тоже отметка с турникета или из мини-аппа, только на день
  // без смены. Фильтр по MULTISELECT в ucode — пересечение (`&&`), поэтому оба
  // значения дают строки любого из двух видов.
  const overviewQuery = useSettingsDirectoryQuery({
    slug: "attendance",
    params: { with_relations: true, data: encodeJsonToUrlParam({ limit: 1000, offset: 0, date: { $gte: range.from, $lte: range.to }, source_type: ["integration", "off_schedule"] }) },
    querySettings: { enabled: !employeeId, keepPreviousData: true },
  });
  const allEmployees = useMemo(() => groupAttendance((overviewQuery.data?.response ?? []) as DataRow[]), [overviewQuery.data?.response]);
  const employees = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query ? allEmployees.filter((item) => `${item.name} ${item.department}`.toLocaleLowerCase().includes(query)) : allEmployees;
  }, [allEmployees, search]);

  // Точки прихода/ухода за месяц для сетки. ponytail: один запрос на весь
  // месяц с потолком 10000 строк — при большем штате резать по сотрудникам.
  const monthRecordsQuery = useSettingsDirectoryQuery({
    slug: "attendance_records",
    params: { data: encodeJsonToUrlParam({ limit: 10000, offset: 0, date: { $gte: shiftDays(range.from, -1), $lte: shiftDays(range.to, 1) } }) },
    querySettings: { enabled: !employeeId, keepPreviousData: true },
  });
  // Смены месяца ±1 день: у ночной смены последнего числа уход лежит в
  // следующем месяце, а отметку первого числа утром может забрать смена
  // прошлого месяца. Они нужны для плана дня и для привязки отметки к смене.
  const monthShiftsQuery = useShiftsQuery({ from: shiftDays(range.from, -1), to: shiftDays(range.to, 1) }, !employeeId);
  const monthShifts = useMemo(() => monthShiftsQuery.data?.response ?? [], [monthShiftsQuery.data?.response]);
  const planByDay = useMemo(() => planByDayOf(monthShifts), [monthShifts]);
  const monthShiftsByEmployee = useMemo(() => shiftsByEmployeeOf(monthShifts), [monthShifts]);
  // Расстояние до офиса — под датой смены, а не календарной датой отметки:
  // иначе утренний уход ночной смены подписался бы на чужой день.
  const geoByDay = useMemo(
    () => markGeoByDay(
      (monthRecordsQuery.data?.response ?? []) as DataRow[],
      (row, userId, date) => shiftDateOfMark(monthShiftsByEmployee.get(userId), date, clockOfMark(row)),
    ),
    [monthRecordsQuery.data?.response, monthShiftsByEmployee],
  );
  const overviewZones = useEmployeeTimeZones(allEmployees.map((item) => item.id), range.from, range.to);

  const dayQuery = useSettingsDirectoryQuery({
    slug: "attendance",
    params: { with_relations: true, data: encodeJsonToUrlParam({ limit: 100, offset: 0, date: { $gte: anchor, $lte: anchor }, user_base_id: employeeId, source_type: ["integration", "off_schedule"] }) },
    querySettings: { enabled: Boolean(employeeId), keepPreviousData: true },
  });
  const dayRows = useMemo(() => (dayQuery.data?.response ?? []) as DataRow[], [dayQuery.data?.response]);
  const selectedEmployee = useMemo(() => groupAttendance(dayRows)[0] ?? null, [dayRows]);
  const offices = useOffices();

  const patchParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => value === null ? next.delete(key) : next.set(key, value));
    setSearchParams(next, { replace: true });
  };
  const openEmployee = (employee: AttendanceEmployee, selectedDate?: string) => {
    const latestDay = employee.days[employee.days.length - 1];
    const date = selectedDate || latestDay?.date;
    if (date) patchParams({ employee: employee.id, date });
  };
  return (
    <>
      <PageMeta title={`${t("time_events.meta_title")} | HRMS`} description={t("time_events.meta_description")} />
      <div className="-mx-3 -mt-3 md:-mx-4 md:-mt-4">
        <div className="border border-t-0 border-slate-200 bg-white px-4 py-2 lg:px-6"><div className="flex w-full flex-wrap items-center gap-2">{leftSlot}{!employeeId ? <label className="relative ml-auto block w-full sm:w-[250px]"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("time_events.search_employee")} className="h-[38px] w-full rounded-[10px] border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-300" /></label> : null}</div></div>
        <div className="px-4 py-5 lg:px-6">
          {!employeeId ? <>
            <EmployeesOverview
              employees={employees}
              dates={dates}
              monthLabel={formatRangeLabel("month", range)}
              loading={overviewQuery.isLoading}
              error={overviewQuery.isError}
              onOpen={openEmployee}
              onShiftMonth={(amount) => patchParams({ date: shiftAnchor("month", anchor, amount) })}
              geoByDay={geoByDay}
              planByDay={planByDay}
              offices={offices}
              zones={overviewZones}
            />
          </> : <>
            <div className="mb-4 flex flex-wrap items-center gap-3"><button type="button" onClick={() => patchParams({ employee: null })} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"><ArrowLeft size={15} />{t("time_events.back_to_employees")}</button>{selectedEmployee ? <div className="flex items-center gap-3"><EmployeeAvatar name={selectedEmployee.name} photo={selectedEmployee.photo} seed={selectedEmployee.id} size={42} /><div><h1 className="text-base font-bold text-slate-900">{selectedEmployee.name}</h1>{selectedEmployee.department ? <p className="text-xs text-slate-400">{selectedEmployee.department}</p> : null}</div></div> : null}<div className="ml-auto inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm"><button type="button" aria-label={t("time_events.prev_day")} onClick={() => patchParams({ date: shiftDays(anchor, -1) })} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50"><ChevronLeft size={16} /></button><span className="min-w-[145px] px-3 text-center text-xs font-semibold text-slate-700">{formatDateRu(anchor)}</span><button type="button" aria-label={t("time_events.next_day")} onClick={() => patchParams({ date: shiftDays(anchor, 1) })} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50"><ChevronRight size={16} /></button></div></div>
            <AttendanceDayDetail employeeId={employeeId} date={anchor} />
          </>}
        </div>
      </div>
    </>
  );
}
