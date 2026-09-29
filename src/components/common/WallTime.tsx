import type { EmployeeZones } from "../../hooks/useEmployeeTimeZones";
import { useTranslation } from "../../i18n";
import {
  clockOfMinutes,
  dayShiftLabel,
  formatClock,
  minutesOfClock,
  rebaseClock,
  toViewerClock,
  zoneLabel,
  type ViewerClock,
  type ZoneInterval,
} from "../../utils/wallClock";

type Shown =
  | { kind: "loading" }
  /** hint — подписать «пояс неизвестен» (ADR-0014, п. 7). */
  | { kind: "unknown"; local: string; hint: boolean }
  | { kind: "ok"; main: ViewerClock; grey: string | null; label: string };

/**
 * Одно время строки: у смотрящего и, серой строкой, у сотрудника.
 *
 * Обычно строка — настенные часы сотрудника (ADR-0005). `sourceTimeZone`
 * задан, когда строка в чужом поясе: табель отдаёт UTC, сдвинутый на
 * фиксированные +5 ч. Тогда момент известен и без пояса сотрудника, и тот
 * нужен только для серой строки.
 *
 * `atDate` — дата самого времени, когда она не совпадает с датой строки
 * (конец записи табеля за полночь). Метки «+1»/«−1» остаются от даты строки.
 */
const present = (
  zones: EmployeeZones,
  userBaseId: string,
  date: string,
  time: string,
  sourceTimeZone?: string,
  atDate?: string
): Shown => {
  const day = date.slice(0, 10);
  const zone = zones.zoneOf(userBaseId, day);

  if (sourceTimeZone) {
    const at = atDate?.slice(0, 10) || day;
    const toRow = (clock: ViewerClock | null) => (clock ? rebaseClock(clock, at, day) : null);
    const main = toRow(toViewerClock(at, time, sourceTimeZone));
    if (!main) return { kind: "unknown", local: time, hint: false };
    const employee = zone ? toRow(toViewerClock(at, time, sourceTimeZone, zone.timezone)) : null;
    const differs = employee !== null && employee.minutes !== main.minutes;
    return {
      kind: "ok",
      main,
      grey: differs ? formatClock(employee) : null,
      label: zone ? zoneLabel(zone, main.instant) : "",
    };
  }

  if (zones.status === "loading") return { kind: "loading" };
  const main = zone ? toViewerClock(day, time, zone.timezone) : null;
  // Пояса нет — отказ метода, сотрудник не найден или зона незнакома
  // браузеру. Время как в базе и с подписью: без неё «09:00» бакинца читается
  // как своё. Без сотрудника (открытая смена) пояса и не ждали — без подписи.
  if (!zone || !main) return { kind: "unknown", local: time, hint: Boolean(userBaseId) };
  return { kind: "ok", main, grey: main.diff !== 0 ? time : null, label: zoneLabel(zone, main.instant) };
};

/**
 * Время сотрудника в поясе смотрящего (ADR-0014).
 *
 * Сверху — пересчитанное время с «+1»/«−1», если пересчёт перенёс его через
 * полночь; под ним серой строкой — местное («09:00 Baku»), но только когда
 * смещения на дату строки разные. Пока пояса грузятся — скелетон, без пояса —
 * время как в базе и «пояс неизвестен».
 */
export function WallTime({
  zones,
  userBaseId,
  date,
  time,
  sourceTimeZone,
  atDate,
  empty = "—",
}: {
  zones: EmployeeZones;
  userBaseId: string;
  date: string;
  time: string | null | undefined;
  sourceTimeZone?: string;
  /** Дата самого времени, если она другая, чем у строки. Только с `sourceTimeZone`. */
  atDate?: string | null;
  empty?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const minutes = minutesOfClock(time);
  if (minutes === null) return <>{empty}</>;
  const shown = present(zones, userBaseId, date, clockOfMinutes(minutes), sourceTimeZone, atDate ?? undefined);

  if (shown.kind === "loading") {
    return <span className="inline-block h-4 w-10 animate-pulse rounded bg-slate-200 align-middle" aria-busy="true" />;
  }
  if (shown.kind === "unknown") {
    if (!shown.hint) return <>{shown.local}</>;
    return (
      <span className="inline-flex flex-col leading-tight">
        <span>{shown.local}</span>
        <span className="text-[11px] font-normal text-slate-400">{t("wall_clock.zone_unknown")}</span>
      </span>
    );
  }

  const shift = dayShiftLabel(shown.main.dayShift);
  return (
    <span className="inline-flex flex-col leading-tight">
      <span>
        {shown.main.time}
        {shift ? <sup className="ml-0.5 text-[10px] font-semibold text-slate-500">{shift}</sup> : null}
      </span>
      {shown.grey ? (
        <span className="text-[11px] font-normal text-slate-400">
          {shown.grey} {shown.label}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Интервал «с–по» в поясе смотрящего — для смен и графика. Конец ночной смены
 * считается на дату строки, как и уход с неё: метка «+1» — только от пересчёта.
 */
export function WallRange({
  zones,
  userBaseId,
  date,
  start,
  end,
  sourceTimeZone,
}: {
  zones: EmployeeZones;
  userBaseId: string;
  date: string;
  start: string | null | undefined;
  end: string | null | undefined;
  sourceTimeZone?: string;
}) {
  const { t } = useTranslation();
  const startMinutes = minutesOfClock(start);
  const endMinutes = minutesOfClock(end);
  if (startMinutes === null || endMinutes === null) return null;
  const from = present(zones, userBaseId, date, clockOfMinutes(startMinutes), sourceTimeZone);
  const to = present(zones, userBaseId, date, clockOfMinutes(endMinutes), sourceTimeZone);

  if (from.kind === "loading" || to.kind === "loading") {
    return <span className="inline-block h-3.5 w-16 animate-pulse rounded bg-slate-200 align-middle" aria-busy="true" />;
  }
  if (from.kind === "unknown" || to.kind === "unknown") {
    const local = `${clockOfMinutes(startMinutes)}–${clockOfMinutes(endMinutes)}`;
    if (!(from.kind === "unknown" && from.hint) && !(to.kind === "unknown" && to.hint)) return <>{local}</>;
    return (
      <span className="inline-flex flex-col leading-tight">
        <span>{local}</span>
        <span className="text-[10px] font-normal opacity-70">{t("wall_clock.zone_unknown")}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col leading-tight">
      <span>{formatClock(from.main)}–{formatClock(to.main)}</span>
      {from.grey && to.grey ? (
        <span className="text-[10px] font-normal opacity-70">
          {from.grey}–{to.grey} {from.label}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Подсказка под полем ввода: «= 10:00 у вас» (ADR-0014, п. 2). Ввод идёт по
 * месту сотрудника; для нескольких поясов — строка на каждый, где время у
 * смотрящего другое.
 */
export function ViewerTimeHint({
  date,
  time,
  zones,
  status,
}: {
  date: string;
  time: string | null | undefined;
  zones: ZoneInterval[];
  status: EmployeeZones["status"];
}) {
  const { t } = useTranslation();
  // Пока пояс грузится, считать не от чего: подсказка от запасного пояса
  // показала бы неверное «у вас» и через секунду сменилась бы (ADR-0014, п. 6).
  if (minutesOfClock(time) === null || !date || status === "loading") return null;
  // Пустой список при ответе метода — сотрудника нет в ответе или браузер не
  // знает его зону: это тот же «пояс неизвестен», что и отказ (ADR-0014, п. 7).
  // Без выбранного сотрудника подсказку не рендерят сами формы.
  if (status === "error" || zones.length === 0) {
    return <p className="mt-1 text-[11px] text-slate-400">{t("wall_clock.zone_unknown")}</p>;
  }

  const lines = zones.flatMap((zone) => {
    const clock = toViewerClock(date.slice(0, 10), time, zone.timezone);
    if (!clock || clock.diff === 0) return [];
    return [
      zones.length > 1
        ? t("wall_clock.at_viewer_zone", { zone: zoneLabel(zone, clock.instant), time: formatClock(clock) })
        : t("wall_clock.at_viewer", { time: formatClock(clock) }),
    ];
  });
  if (lines.length === 0) return null;

  return (
    <div className="mt-1 space-y-0.5 text-[11px] text-slate-400">
      {[...new Set(lines)].map((line) => (
        <p key={line} className="m-0">{line}</p>
      ))}
    </div>
  );
}
