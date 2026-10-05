import { type ReactNode, useMemo, useState } from "react";
import { Camera, Clock3, LogIn, LogOut, Maximize2, Users } from "lucide-react";
import Spinner from "../../../components/ui/Spinner";
import { Modal } from "../../../components/ui/modal";
import { useSettingsDirectoryQuery } from "../../../api/services/settingsDirectory.service";
import { type Shift, useShiftsQuery } from "../../../api/services/shift.service";
import encodeJsonToUrlParam from "../../../utils/encodeJsonToUrlParam";
import { dayNumber } from "../../../utils/shiftWindow";
import { shiftDateOfMark } from "../../../utils/shiftAttribution";
import { formatDateRu, formatDuration, shiftDays } from "../../Timesheet/constants";
import LocationViewLink, { MarkReason } from "../../../components/map/LocationViewLink";
import { markDirection } from "../../../components/map/shared";
import { type Office, useOffices } from "../../../components/map/useOffices";
import { useTranslation, translate } from "../../../i18n";
import { useEmployeeTimeZones } from "../../../hooks/useEmployeeTimeZones";
import { WallTime } from "../../../components/common/WallTime";
import { clockOfMinutes } from "../../../utils/wallClock";

// День одного сотрудника: метрики, таймлайн отметок и фотоотчёт. Общий для
// «Посещаемости» (детальный вид) и модалки дня в табеле.

export type DataRow = Record<string, unknown>;

export type AccessEvent = {
  id: string;
  type: "in" | "out" | "event";
  label: string;
  time: string;
  /**
   * Сутки относительно даты смены: уход ночной смены в 06:00 — это +1. Время
   * выше — местные часы сотрудника, а не момент: сутки нужны, чтобы
   * упорядочить отметки смены и посчитать между ними.
   */
  dayOffset: number;
  /** Минуты от полуночи даты смены (с учётом `dayOffset`), местные часы. */
  minutes: number;
  image: string;
  camera: string;
  /** Поле MAP из attendance_records: «широта,долгота» либо "". */
  location: string;
  /** Причина отметки вне филиала либо "". */
  reason: string;
};

export const readString = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

export const firstString = (row: DataRow, fields: string[]): string => {
  for (const field of fields) {
    const value = readString(row[field]);
    if (value) return value;
  }
  return "";
};

export const relationOf = (row: DataRow): DataRow =>
  row.user_base_id_data && typeof row.user_base_id_data === "object"
    ? (row.user_base_id_data as DataRow)
    : {};

export const normalizeTime = (value: unknown): string => {
  const raw = readString(value);
  if (!raw) return "";
  const clock = raw.match(/(?:T|\s)(\d{2}:\d{2})(?::\d{2})?/);
  if (clock?.[1]) return clock[1];
  const short = raw.match(/^(\d{1,2}:\d{2})/);
  return short?.[1] ?? raw;
};

export const minutesFromClock = (value: string): number | null => {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};
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

/**
 * Отметки смены `anchor`. Строки приходят за `anchor ± 1` день: у ночной смены
 * приход лежит на одной календарной дате, уход — на следующей. Чьей смене
 * принадлежит отметка, решает зона смены (`shiftDateOfMark`), а не календарная
 * дата; иначе утренний уход попал бы на чужой день, а вечерний приход — на
 * вчерашний.
 */
const buildRawEvents = (rows: DataRow[], anchor: string, shifts: Shift[]): AccessEvent[] =>
  rows
    .flatMap((row, index) => {
      const time = normalizeTime(row.event_time || row.action_time);
      if (!time) return [];
      const markDate = readString(row.date).slice(0, 10) || anchor;
      if (shiftDateOfMark(shifts, markDate, time) !== anchor) return [];
      const dayOffset = (dayNumber(markDate) ?? 0) - (dayNumber(anchor) ?? 0);
      const type = markDirection(row.action);
      const rawLabel = Array.isArray(row.action) ? readString(row.action[0]) : readString(row.action);
      return [{
        id: readString(row.guid) || String(index),
        type,
        label: type === "in" ? translate("time_events.entry") : type === "out" ? translate("time_events.exit") : rawLabel || translate("time_events.event"),
        time,
        dayOffset,
        minutes: dayOffset * 24 * 60 + (minutesFromClock(time) ?? 0),
        image: resolvePicture(row.picture),
        camera: firstString(row, ["camera_name", "device_name", "terminal_name", "door_name", "location_name", "mac_address"]),
        location: readString(row.map),
        reason: readString(row.reason),
      } satisfies AccessEvent];
    })
    .sort((left, right) => left.minutes - right.minutes);

const buildSummaryEvents = (rows: DataRow[]): AccessEvent[] =>
  rows.flatMap((row, index) => {
    const result: AccessEvent[] = [];
    const checkIn = normalizeTime(row.check_in_time);
    const checkOut = normalizeTime(row.check_out_time);
    const inMinutes = minutesFromClock(checkIn);
    const outMinutes = minutesFromClock(checkOut);
    // Строка лежит на дате смены: уход раньше прихода — следующие сутки.
    const outOffset = inMinutes !== null && outMinutes !== null && outMinutes < inMinutes ? 1 : 0;
    if (checkIn) result.push({ id: `${index}-in`, type: "in", label: translate("time_events.entry"), time: checkIn, dayOffset: 0, minutes: inMinutes ?? 0, image: "", camera: "", location: "", reason: "" });
    if (checkOut) result.push({ id: `${index}-out`, type: "out", label: translate("time_events.exit"), time: checkOut, dayOffset: outOffset, minutes: outOffset * 24 * 60 + (outMinutes ?? 0), image: "", camera: "", location: "", reason: "" });
    return result;
  }).sort((left, right) => left.minutes - right.minutes);

export function EmptyState({ icon, title, hint }: { icon: "users" | "clock"; title: string; hint: string }) {
  const Icon = icon === "users" ? Users : Clock3;
  return <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center"><Icon size={30} className="mx-auto mb-3 text-slate-300" /><p className="text-sm font-medium text-slate-600">{title}</p><p className="mt-1 text-xs text-slate-400">{hint}</p></div>;
}

/**
 * Таймлайн строится по минутам смотрящего (ADR-0014, п. 5): он и есть вывод.
 * Ось может выйти за 0…24 ч, подписи делений берутся по модулю суток.
 */
function AccessTimeline({ events, toViewer }: { events: AccessEvent[]; toViewer: (event: AccessEvent) => { minutes: number; text: string } | null }) {
  const { t } = useTranslation();
  const timed = events
    .map((event) => {
      const viewer = toViewer(event);
      return viewer ? { event: { ...event, time: viewer.text }, minutes: viewer.minutes } : null;
    })
    .filter((item): item is { event: AccessEvent; minutes: number } => item !== null)
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
  const minMinutes = Math.min(...timed.map((item) => item.minutes));
  const maxMinutes = Math.max(...timed.map((item) => item.minutes));
  // Край суток держит ось, пока пересчёт не вывел отметки за него.
  const from = Math.max(minMinutes < 0 ? -Infinity : 0, Math.floor((minMinutes - 60) / 60) * 60);
  const to = Math.min(maxMinutes > 1440 ? Infinity : 1440, Math.ceil((maxMinutes + 60) / 60) * 60);
  const span = Math.max(60, to - from);
  const ticks: number[] = [];
  for (let tick = from; tick <= to; tick += Math.max(60, Math.ceil(span / 360) * 60)) ticks.push(tick);
  const clock = clockOfMinutes;
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

function EventCards({ events, office, display }: { events: AccessEvent[]; office?: Office; display: (time: string) => string }) {
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
              {event.image ? <button type="button" onClick={() => setPreview(event)} className="group relative block aspect-[16/9] w-full overflow-hidden bg-slate-100"><img src={event.image} alt={`${event.label} ${display(event.time)}`} className="h-full w-full object-cover transition group-hover:scale-[1.02]" onError={(e) => { e.currentTarget.parentElement?.classList.add("hidden"); }} /><span className="absolute right-2 top-2 rounded-lg bg-slate-900/65 p-1.5 text-white"><Maximize2 size={14} /></span></button> : null}
              <div className="flex items-center gap-3 p-4"><span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${event.type === "in" ? "bg-emerald-100 text-emerald-600" : event.type === "out" ? "bg-blue-100 text-blue-600" : "bg-amber-100 text-amber-600"}`}><Icon size={18} /></span><div><p className="text-sm font-semibold text-slate-800">{event.label} · {display(event.time)}</p>{event.camera ? <p className="mt-0.5 text-xs text-slate-400">{event.camera}</p> : null}{event.location ? <p className="mt-1 text-xs"><LocationViewLink value={event.location} office={office} /></p> : null}{event.reason ? <p className="mt-1 max-w-[260px]"><MarkReason reason={event.reason} /></p> : null}</div></div>
            </article>;
          })}
        </div>
      </section>
      <Modal isOpen={Boolean(preview)} onClose={() => setPreview(null)} className="max-w-4xl p-4">{preview?.image ? <img src={preview.image} alt={`${preview.label} ${display(preview.time)}`} className="max-h-[80vh] w-full rounded-2xl object-contain" /> : null}</Modal>
    </>
  );
}

/**
 * Отметки смены `date` сотрудника `employeeId`. Сырые события — из
 * `attendance_records` за ±1 день (у ночной смены уход лежит на следующей
 * дате, чьей смене он принадлежит — решают смены); нет сырых — приход и уход
 * из строки дня.
 */
export default function AttendanceDayDetail({
  employeeId,
  date,
  withManual = false,
}: {
  employeeId: string;
  date: string;
  /**
   * Учитывать и ручные строки HRMS. Табелю нужно: день только с ручной
   * отметкой там с часами, и пустой день здесь был бы противоречием.
   */
  withManual?: boolean;
}) {
  const { t } = useTranslation();
  const dayQuery = useSettingsDirectoryQuery({
    slug: "attendance",
    params: { with_relations: true, data: encodeJsonToUrlParam({ limit: 100, offset: 0, date: { $gte: date, $lte: date }, user_base_id: employeeId, source_type: withManual ? ["integration", "off_schedule", "manual"] : ["integration", "off_schedule"] }) },
    querySettings: { enabled: Boolean(employeeId), keepPreviousData: true },
  });
  const dayRows = useMemo(() => (dayQuery.data?.response ?? []) as DataRow[], [dayQuery.data?.response]);

  // Фильтр по человеку, а не по `hikvision_id`: отметки «пришёл/ушёл» из webapp
  // лежат в той же таблице, но терминала у них нет и поле пустое — по нему они
  // просто выпадали из ленты. `user_base_id` есть у обоих источников.
  const recordsQuery = useSettingsDirectoryQuery({
    slug: "attendance_records",
    params: { with_relations: true, data: encodeJsonToUrlParam({ limit: 200, offset: 0, date: { $gte: shiftDays(date, -1), $lte: shiftDays(date, 1) }, user_base_id: employeeId }) },
    querySettings: { enabled: Boolean(employeeId), keepPreviousData: true },
  });
  const dayShiftsQuery = useShiftsQuery({ from: shiftDays(date, -1), to: shiftDays(date, 1) }, Boolean(employeeId));
  const employeeShifts = useMemo(
    () => (dayShiftsQuery.data?.response ?? []).filter((shift) => shift.user_base_id === employeeId),
    [dayShiftsQuery.data?.response, employeeId],
  );
  const events = useMemo(() => {
    const rawEvents = buildRawEvents((recordsQuery.data?.response ?? []) as DataRow[], date, employeeShifts);
    return rawEvents.length ? rawEvents : buildSummaryEvents(dayRows);
  }, [recordsQuery.data?.response, dayRows, date, employeeShifts]);

  const offices = useOffices();
  // Экран всегда про одного сотрудника, поэтому филиал один на все карточки.
  // Берём его из развёрнутой связи любой отметки — отдельный запрос не нужен.
  const office = useMemo(() => {
    for (const row of [...((recordsQuery.data?.response ?? []) as DataRow[]), ...dayRows]) {
      const officeId = readString(relationOf(row).locations_id);
      if (officeId) return offices.get(officeId);
    }
    return undefined;
  }, [recordsQuery.data?.response, dayRows, offices]);

  const firstEvent = events[0];
  const lastEvent = events[events.length - 1];
  // По минутам смены, а не по часам суток: уход ночной смены в 06:00 — это +1.
  const duration = firstEvent && lastEvent ? Math.max(0, lastEvent.minutes - firstEvent.minutes) * 60 : 0;
  // Только записанное опоздание. Своего запасного расчёта здесь нет: он был бы
  // вычитанием чужих 09:00 из чужого прихода (CONTEXT.md, Lateness), а
  // единственный верный ответ уже посчитан по графику при записи строки.
  // Нет `delay_time` — показываем «—», а не выдуманное число.
  const lateMinutes = minutesFromClock(dayRows.map((row) => normalizeTime(row.delay_time)).find(Boolean) ?? "");
  const zones = useEmployeeTimeZones([employeeId], date, date);
  // Без смен отметки разошлись бы по календарным датам, а через секунду
  // переехали бы по сменам — поэтому ждём и их.
  const loading = dayQuery.isLoading || recordsQuery.isLoading || dayShiftsQuery.isLoading || zones.status === "loading";
  const displayTime = (time: string) => zones.text(employeeId, date, time) || time;
  // Сутки смены добавляются к пересчитанным минутам: уход в 06:00 ночной смены
  // стоит на оси правее прихода в 22:00, а не левее (ось может выходить за 24 ч).
  const toViewer = (event: AccessEvent) => {
    const viewer = zones.viewerClock(employeeId, date, event.time);
    if (viewer) return { minutes: viewer.minutes + event.dayOffset * 24 * 60, text: displayTime(event.time) };
    return { minutes: event.minutes, text: event.time };
  };

  if (loading) return <div className="flex min-h-[240px] items-center justify-center"><Spinner /></div>;
  if (dayQuery.isError || recordsQuery.isError) return <EmptyState icon="clock" title={t("time_events.marks_load_error")} hint={t("time_events.marks_load_error_hint")} />;
  if (events.length === 0) return <EmptyState icon="clock" title={t("time_events.no_marks_on_date", { date: formatDateRu(date) })} hint={t("time_events.no_fake_data")} />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label={t("time_events.first_check_in")} value={<WallTime zones={zones} userBaseId={employeeId} date={date} time={firstEvent?.time} />} />
        <Metric label={t("time_events.last_check_out")} value={<WallTime zones={zones} userBaseId={employeeId} date={date} time={lastEvent?.time} />} />
        <Metric label={t("time_events.between_first_last")} value={formatDuration(duration)} />
        <Metric label={t("absence_calendar.attendance.late")} value={formatMinuteOffset(lateMinutes)} />
      </div>
      <AccessTimeline events={events} toViewer={toViewer} />
      <EventCards events={events} office={office} display={displayTime} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3"><div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div><div className="mt-1 text-lg font-bold text-slate-800">{value}</div></div>;
}
