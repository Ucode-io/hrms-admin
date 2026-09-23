import { type ReactNode, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import {
  ArrowLeft,
  Ban,
  Camera,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LogIn,
  LogOut,
  Maximize2,
  Search,
  Users,
} from "lucide-react";
import PageMeta from "../../../components/common/PageMeta";
import Spinner from "../../../components/ui/Spinner";
import { Modal } from "../../../components/ui/modal";
import { useSettingsDirectoryQuery } from "../../../api/services/settingsDirectory.service";
import encodeJsonToUrlParam from "../../../utils/encodeJsonToUrlParam";
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
import LocationViewLink, { DistanceBadge, MarkReason } from "../../../components/map/LocationViewLink";
import { type DayMarkGeo, markDirection, markGeoByDay } from "../../../components/map/shared";
import { type Office, useOffices } from "../../../components/map/useOffices";
import { useTranslation, translate } from "../../../i18n";

type DataRow = Record<string, unknown>;

type AccessEvent = {
  id: string;
  type: "in" | "out" | "event";
  label: string;
  time: string;
  image: string;
  camera: string;
  /** Поле MAP из attendance_records: «широта,долгота» либо "". */
  location: string;
  /** Причина отметки вне филиала либо "". */
  reason: string;
};

type AttendanceDay = {
  date: string;
  checkIn: string;
  checkOut: string;
  seconds: number;
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

const readString = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const firstString = (row: DataRow, fields: string[]): string => {
  for (const field of fields) {
    const value = readString(row[field]);
    if (value) return value;
  }
  return "";
};

const relationOf = (row: DataRow): DataRow =>
  row.user_base_id_data && typeof row.user_base_id_data === "object"
    ? (row.user_base_id_data as DataRow)
    : {};

const normalizeTime = (value: unknown): string => {
  const raw = readString(value);
  if (!raw) return "";
  const clock = raw.match(/(?:T|\s)(\d{2}:\d{2})(?::\d{2})?/);
  if (clock?.[1]) return clock[1];
  const short = raw.match(/^(\d{1,2}:\d{2})/);
  return short?.[1] ?? raw;
};

const minutesFromClock = (value: string): number | null => {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

const secondsBetween = (from: string, to: string): number => {
  const start = minutesFromClock(from);
  const end = minutesFromClock(to);
  if (start === null || end === null || end <= start) return 0;
  return (end - start) * 60;
};

const WORK_DAY_PLAN_MINUTES = 8 * 60;
const WORK_DAY_SCALE_MINUTES = 12 * 60;

const formatMinuteOffset = (minutes: number | null): string => {
  if (minutes === null) return "—";
  if (minutes <= 0) return translate("time_events.zero_minutes");
  return formatDuration(minutes * 60);
};

const resolvePicture = (value: unknown): string => {
  const picture = readString(value);
  if (!picture) return "";
  if (/^(data:image\/|https?:\/\/|blob:|\/)/i.test(picture)) return picture;
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(picture) && picture.length > 120) {
    return `data:image/jpeg;base64,${picture}`;
  }
  return picture;
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
    const day: AttendanceDay = {
      date,
      checkIn: nextIn,
      checkOut: nextOut,
      seconds: secondsBetween(nextIn, nextOut),
    };
    current.days = [...current.days.filter((item) => item.date !== date), day].sort((a, b) => a.date.localeCompare(b.date));
    current.totalSeconds = current.days.reduce((sum, item) => sum + item.seconds, 0);
    if (!current.hikvisionId) current.hikvisionId = readString(relation.hikvision_id);
    grouped.set(id, current);
  });

  return [...grouped.values()].filter((item) => item.name).sort((a, b) => a.name.localeCompare(b.name));
};

const buildRawEvents = (rows: DataRow[]): AccessEvent[] =>
  rows
    .flatMap((row, index) => {
      const time = normalizeTime(row.event_time || row.action_time);
      if (!time) return [];
      const type = markDirection(row.action);
      const rawLabel = Array.isArray(row.action) ? readString(row.action[0]) : readString(row.action);
      return [{
        id: readString(row.guid) || String(index),
        type,
        label: type === "in" ? translate("time_events.entry") : type === "out" ? translate("time_events.exit") : rawLabel || translate("time_events.event"),
        time,
        image: resolvePicture(row.picture),
        camera: firstString(row, ["camera_name", "device_name", "terminal_name", "door_name", "location_name", "mac_address"]),
        location: readString(row.map),
        reason: readString(row.reason),
      } satisfies AccessEvent];
    })
    .sort((left, right) => left.time.localeCompare(right.time));

const buildSummaryEvents = (rows: DataRow[]): AccessEvent[] =>
  rows.flatMap((row, index) => {
    const result: AccessEvent[] = [];
    const checkIn = normalizeTime(row.check_in_time);
    const checkOut = normalizeTime(row.check_out_time);
    if (checkIn) result.push({ id: `${index}-in`, type: "in", label: translate("time_events.entry"), time: checkIn, image: "", camera: "", location: "", reason: "" });
    if (checkOut) result.push({ id: `${index}-out`, type: "out", label: translate("time_events.exit"), time: checkOut, image: "", camera: "", location: "", reason: "" });
    return result;
  }).sort((left, right) => left.time.localeCompare(right.time));

function AttendanceDayCell({ day, geo, office }: { day?: AttendanceDay; geo?: DayMarkGeo; office?: Office }) {
  const { t } = useTranslation();
  if (!day) return <span className="text-sm text-slate-300">—</span>;
  const workedMinutes = Math.max(0, Math.round(day.seconds / 60));
  const progress = Math.min(100, (workedMinutes / WORK_DAY_SCALE_MINUTES) * 100);
  const planPosition = (WORK_DAY_PLAN_MINUTES / WORK_DAY_SCALE_MINUTES) * 100;
  return (
    <div className="min-w-[142px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-700">
        <span className="inline-flex items-center gap-1.5">
          {day.checkIn ? <><LogIn size={14} className="shrink-0 text-slate-500" />{day.checkIn}</> : <MissingEventIcon type="in" />}
        </span>
        <span className="inline-flex items-center gap-1.5">
          {day.checkOut ? <><LogOut size={14} className="shrink-0 text-slate-500" />{day.checkOut}</> : <MissingEventIcon type="out" />}
        </span>
      </div>
      {geo ? (
        <div className="mt-1 flex items-center justify-between gap-1">
          {geo.in ? <DistanceBadge value={geo.in} office={office} /> : <span />}
          {geo.out ? <DistanceBadge value={geo.out} office={office} /> : null}
        </div>
      ) : null}
      <div className="mt-1.5 flex items-center gap-2">
        <div className="relative h-1 flex-1 rounded-full bg-slate-200" title={t("time_events.worked_vs_plan", { minutes: workedMinutes, plan: 480 })}>
          <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
          <span className="absolute top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-900" style={{ left: `${planPosition}%` }} aria-label={t("time_events.plan_8h")} />
        </div>
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
  offices,
}: {
  geoByDay: Map<string, DayMarkGeo>;
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
                      <AttendanceDayCell day={day} geo={geoByDay.get(`${employee.id}|${date}`)} office={offices.get(employee.officeId)} />
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

function EmptyState({ icon, title, hint }: { icon: "users" | "clock"; title: string; hint: string }) {
  const Icon = icon === "users" ? Users : Clock3;
  return <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center"><Icon size={30} className="mx-auto mb-3 text-slate-300" /><p className="text-sm font-medium text-slate-600">{title}</p><p className="mt-1 text-xs text-slate-400">{hint}</p></div>;
}

function AccessTimeline({ events }: { events: AccessEvent[] }) {
  const { t } = useTranslation();
  const timed = events
    .map((event) => ({ event, minutes: minutesFromClock(event.time) }))
    .filter((item): item is { event: AccessEvent; minutes: number } => item.minutes !== null)
    .sort((a, b) => a.minutes - b.minutes);
  if (timed.length === 0) return null;
  const firstEntry = timed.find((item) => item.event.type === "in");
  const lastAction = timed[timed.length - 1];

  let previousMinutes = -Infinity;
  let labelLane = 0;
  const positionedEvents = timed.map((item) => {
    labelLane = item.minutes - previousMinutes < 75 ? labelLane + 1 : 0;
    previousMinutes = item.minutes;
    return { ...item, lane: labelLane };
  });
  const maxLabelLane = Math.max(...positionedEvents.map((item) => item.lane));
  const from = Math.max(0, Math.floor((Math.min(...timed.map((item) => item.minutes)) - 60) / 60) * 60);
  const to = Math.min(1440, Math.ceil((Math.max(...timed.map((item) => item.minutes)) + 60) / 60) * 60);
  const span = Math.max(60, to - from);
  const ticks: number[] = [];
  for (let tick = from; tick <= to; tick += Math.max(60, Math.ceil(span / 360) * 60)) ticks.push(tick);
  const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:00`;
  const hasAttendanceSpan = Boolean(firstEntry && lastAction.minutes > firstEntry.minutes);
  const attendanceStart = firstEntry ? ((firstEntry.minutes - from) / span) * 100 : 0;
  const attendanceWidth = firstEntry ? ((lastAction.minutes - firstEntry.minutes) / span) * 100 : 0;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-semibold text-slate-800">{t("time_events.timeline_title")}</h2><p className="mt-0.5 text-xs text-slate-400">{t("time_events.timeline_hint")}</p></div><div className="flex gap-3 text-xs"><span className="flex items-center gap-1.5 text-slate-500"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />{t("time_events.entry")}</span><span className="flex items-center gap-1.5 text-slate-500"><span className="h-2.5 w-2.5 rounded-full bg-blue-600" />{t("time_events.exit")}</span></div></div>
      <div className="relative" style={{ height: `${136 + maxLabelLane * 24}px` }}>
        {ticks.map((tick) => <span key={tick} className="absolute top-0 -translate-x-1/2 text-[11px] text-slate-400" style={{ left: `${((tick - from) / span) * 100}%` }}>{clock(tick)}</span>)}

        <div className="absolute left-0 right-0 top-7 h-12 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
          {hasAttendanceSpan ? (
            <span
              className="absolute top-1/2 h-9 -translate-y-1/2 overflow-hidden rounded-lg bg-blue-600"
              style={{ left: `${attendanceStart}%`, width: `${attendanceWidth}%` }}
              title={t("time_events.from_to", { from: firstEntry?.event.time ?? "", to: lastAction.event.time })}
            >
              <span className="absolute inset-y-0 left-0 w-1 bg-emerald-500" />
              <span
                className={`absolute inset-y-0 right-0 w-1 ${lastAction.event.type === "in" ? "bg-emerald-500" : lastAction.event.type === "out" ? "bg-blue-700" : "bg-slate-500"}`}
              />
            </span>
          ) : null}
          {timed.map(({ event, minutes }) => {
            if (hasAttendanceSpan && (event.id === firstEntry?.event.id || event.id === lastAction.event.id)) return null;
            return (
              <span
                key={`marker-${event.id}`}
                className={`absolute top-1/2 h-9 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full ${event.type === "in" ? "bg-emerald-500" : event.type === "out" ? "bg-blue-700" : "bg-slate-500"}`}
                style={{ left: `${((minutes - from) / span) * 100}%` }}
                title={`${event.label} ${event.time}`}
              />
            );
          })}
        </div>

        {positionedEvents.map(({ event, minutes, lane: eventLane }) => (
          <span
            key={`connector-${event.id}`}
            aria-hidden="true"
            className="absolute top-[70px] border-l border-dashed border-slate-300"
            style={{
              left: `${((minutes - from) / span) * 100}%`,
              height: `${12 + eventLane * 24}px`,
            }}
          />
        ))}

        {positionedEvents.map(({ event, minutes, lane: eventLane }) => {
          const EventIcon = event.type === "in" ? LogIn : event.type === "out" ? LogOut : Camera;
          return (
            <span
              key={`label-${event.id}`}
              className={`absolute inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full border bg-white px-2 py-1 text-[10px] font-semibold shadow-sm ${
                event.type === "in"
                  ? "border-emerald-200 text-emerald-700"
                  : event.type === "out"
                    ? "border-blue-200 text-blue-700"
                    : "border-amber-200 text-amber-700"
              }`}
              style={{ left: `${((minutes - from) / span) * 100}%`, top: `${82 + eventLane * 24}px` }}
            >
              <EventIcon size={12} />
              {event.label} · {event.time}
            </span>
          );
        })}
      </div>
    </section>
  );
}

function EventCards({ events, office }: { events: AccessEvent[]; office?: Office }) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<AccessEvent | null>(null);
  if (events.length === 0) return null;
  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-sm font-semibold text-slate-800">{t("time_events.photo_report")}</h2><p className="mt-0.5 text-xs text-slate-400">{t("time_events.photo_report_hint")}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">{events.length}</span></div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => {
            const Icon = event.type === "in" ? LogIn : event.type === "out" ? LogOut : Camera;
            return <article key={event.id} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/40">
              {event.image ? <button type="button" onClick={() => setPreview(event)} className="group relative block aspect-[16/9] w-full overflow-hidden bg-slate-100"><img src={event.image} alt={`${event.label} ${event.time}`} className="h-full w-full object-cover transition group-hover:scale-[1.02]" onError={(e) => { e.currentTarget.parentElement?.classList.add("hidden"); }} /><span className="absolute right-2 top-2 rounded-lg bg-slate-900/65 p-1.5 text-white"><Maximize2 size={14} /></span></button> : null}
              <div className="flex items-center gap-3 p-4"><span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${event.type === "in" ? "bg-emerald-100 text-emerald-600" : event.type === "out" ? "bg-blue-100 text-blue-600" : "bg-amber-100 text-amber-600"}`}><Icon size={18} /></span><div><p className="text-sm font-semibold text-slate-800">{event.label} · {event.time}</p>{event.camera ? <p className="mt-0.5 text-xs text-slate-400">{event.camera}</p> : null}{event.location ? <p className="mt-1 text-xs"><LocationViewLink value={event.location} office={office} /></p> : null}{event.reason ? <p className="mt-1 max-w-[260px]"><MarkReason reason={event.reason} /></p> : null}</div></div>
            </article>;
          })}
        </div>
      </section>
      <Modal isOpen={Boolean(preview)} onClose={() => setPreview(null)} className="max-w-4xl p-4">{preview?.image ? <img src={preview.image} alt={`${preview.label} ${preview.time}`} className="max-h-[80vh] w-full rounded-2xl object-contain" /> : null}</Modal>
    </>
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

  const overviewQuery = useSettingsDirectoryQuery({
    slug: "attendance",
    params: { with_relations: true, data: encodeJsonToUrlParam({ limit: 1000, offset: 0, date: { $gte: range.from, $lte: range.to }, source_type: ["integration"] }) },
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
    params: { data: encodeJsonToUrlParam({ limit: 10000, offset: 0, date: { $gte: range.from, $lte: range.to } }) },
    querySettings: { enabled: !employeeId, keepPreviousData: true },
  });
  const geoByDay = useMemo(() => markGeoByDay((monthRecordsQuery.data?.response ?? []) as DataRow[]), [monthRecordsQuery.data?.response]);

  const dayQuery = useSettingsDirectoryQuery({
    slug: "attendance",
    params: { with_relations: true, data: encodeJsonToUrlParam({ limit: 100, offset: 0, date: { $gte: anchor, $lte: anchor }, user_base_id: employeeId, source_type: ["integration"] }) },
    querySettings: { enabled: Boolean(employeeId), keepPreviousData: true },
  });
  const dayRows = useMemo(() => (dayQuery.data?.response ?? []) as DataRow[], [dayQuery.data?.response]);
  const selectedEmployee = useMemo(() => groupAttendance(dayRows)[0] ?? null, [dayRows]);

  // Фильтр по человеку, а не по `hikvision_id`: отметки «пришёл/ушёл» из webapp
  // лежат в той же таблице, но терминала у них нет и поле пустое — по нему они
  // просто выпадали из ленты. `user_base_id` есть у обоих источников.
  const recordsQuery = useSettingsDirectoryQuery({
    slug: "attendance_records",
    params: { with_relations: true, data: encodeJsonToUrlParam({ limit: 200, offset: 0, date: { $gte: anchor, $lte: anchor }, user_base_id: employeeId }) },
    querySettings: { enabled: Boolean(employeeId), keepPreviousData: true },
  });
  const events = useMemo(() => {
    const raw = ((recordsQuery.data?.response ?? []) as DataRow[]).filter((row) => {
      const rowDate = readString(row.date).slice(0, 10);
      return !rowDate || rowDate === anchor;
    });
    const rawEvents = buildRawEvents(raw);
    return rawEvents.length ? rawEvents : buildSummaryEvents(dayRows);
  }, [recordsQuery.data?.response, dayRows, anchor]);

  const offices = useOffices();
  // Экран всегда про одного сотрудника, поэтому филиал один на все карточки.
  // Берём его из развёрнутой связи любой отметки — отдельный запрос не нужен.
  const office = useMemo(() => {
    for (const row of (recordsQuery.data?.response ?? []) as DataRow[]) {
      const relation = relationOf(row);
      const officeId = readString(relation.locations_id);
      if (officeId) return offices.get(officeId);
    }
    return selectedEmployee ? offices.get(selectedEmployee.officeId) : undefined;
  }, [recordsQuery.data?.response, offices, selectedEmployee]);

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
  const firstEvent = events[0];
  const lastEvent = events[events.length - 1];
  const duration = firstEvent && lastEvent ? secondsBetween(firstEvent.time, lastEvent.time) : 0;
  const storedDelay = dayRows.map((row) => normalizeTime(row.delay_time)).find(Boolean) ?? "";
  const storedDelayMinutes = minutesFromClock(storedDelay);
  // Только записанное опоздание. Своего запасного расчёта здесь нет: он был бы
  // вычитанием чужих 09:00 из чужого прихода (CONTEXT.md, Lateness), а
  // единственный верный ответ уже посчитан по графику при записи строки.
  // Нет `delay_time` — показываем «—», а не выдуманное число.
  const lateMinutes = storedDelayMinutes;
  const loadingDetail = dayQuery.isLoading || recordsQuery.isLoading;

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
              offices={offices}
            />
          </> : <>
            <div className="mb-4 flex flex-wrap items-center gap-3"><button type="button" onClick={() => patchParams({ employee: null })} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"><ArrowLeft size={15} />{t("time_events.back_to_employees")}</button>{selectedEmployee ? <div className="flex items-center gap-3"><EmployeeAvatar name={selectedEmployee.name} photo={selectedEmployee.photo} seed={selectedEmployee.id} size={42} /><div><h1 className="text-base font-bold text-slate-900">{selectedEmployee.name}</h1>{selectedEmployee.department ? <p className="text-xs text-slate-400">{selectedEmployee.department}</p> : null}</div></div> : null}<div className="ml-auto inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm"><button type="button" aria-label={t("time_events.prev_day")} onClick={() => patchParams({ date: shiftDays(anchor, -1) })} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50"><ChevronLeft size={16} /></button><span className="min-w-[145px] px-3 text-center text-xs font-semibold text-slate-700">{formatDateRu(anchor)}</span><button type="button" aria-label={t("time_events.next_day")} onClick={() => patchParams({ date: shiftDays(anchor, 1) })} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50"><ChevronRight size={16} /></button></div></div>
            {loadingDetail ? <div className="flex min-h-[360px] items-center justify-center"><Spinner /></div> : dayQuery.isError || recordsQuery.isError ? <EmptyState icon="clock" title={t("time_events.marks_load_error")} hint={t("time_events.marks_load_error_hint")} /> : events.length === 0 ? <EmptyState icon="clock" title={t("time_events.no_marks_on_date", { date: formatDateRu(anchor) })} hint={t("time_events.no_fake_data")} /> : <div className="space-y-4"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label={t("time_events.first_check_in")} value={firstEvent?.time || "—"} /><Metric label={t("time_events.last_check_out")} value={lastEvent?.time || "—"} /><Metric label={t("time_events.between_first_last")} value={formatDuration(duration)} /><Metric label={t("absence_calendar.attendance.late")} value={formatMinuteOffset(lateMinutes)} /></div><AccessTimeline events={events} /><EventCards events={events} office={office} /></div>}
          </>}
        </div>
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3"><div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div><div className="mt-1 text-lg font-bold text-slate-800">{value}</div></div>;
}

