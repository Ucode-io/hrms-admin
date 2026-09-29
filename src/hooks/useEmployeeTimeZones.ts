import { useMemo } from "react";
import { useQuery } from "react-query";
import hickvisionService from "../api/services/hickvision.service";
import {
  clockOfMinutes,
  formatClock,
  minutesOfClock,
  toViewerClock,
  wallToInstant,
  zoneOn,
  type ViewerClock,
  type ZoneInterval,
} from "../utils/wallClock";

/**
 * Пояс для сортировки строк без пояса: последнее звено серверной цепочки.
 * Читать их как UTC значило бы ставить ташкентские 06:00 после 09:00.
 */
const SORT_FALLBACK_ZONE = "Asia/Tashkent";

export type EmployeeZones = {
  /** loading — в ячейках скелетон; error — пояс неизвестен (ADR-0014, п. 6–7). */
  status: "loading" | "ready" | "error";
  /** Пояс сотрудника на дату; null — неизвестен. */
  zoneOf: (userBaseId: string, date: string) => ZoneInterval | null;
  /** Время строки у смотрящего; null — нет времени или пояс неизвестен. */
  viewerClock: (userBaseId: string, date: string, time: string | null | undefined) => ViewerClock | null;
  /** «10:00 +1» у смотрящего, а при неизвестном поясе — как в базе. */
  text: (userBaseId: string, date: string, time: string | null | undefined) => string;
  /** Ключ сортировки: момент UTC, а без пояса — местная строка в Asia/Tashkent. */
  sortKey: (userBaseId: string, date: string, time: string | null | undefined) => number;
};

/**
 * Пояса сотрудников на диапазон дат — один запрос на экран.
 *
 * Пустой список — «готово»: пересчитывать нечего. Предыдущие данные при смене
 * ключа по умолчанию не держим: показать «09:00», а через секунду «10:00» —
 * значит дать прочитать неверную цифру (ADR-0014, п. 6).
 *
 * `keepPrevious` — для экранов, где пояс даёт только серую строку, а главное
 * время от него не зависит (табель, `sourceTimeZone`): старый ответ там
 * неполон, но не неверен, и при подгрузке страницы строки не мигают.
 */
export function useEmployeeTimeZones(
  ids: Array<string | null | undefined>,
  dateFrom: string,
  dateTo: string,
  { keepPrevious = false }: { keepPrevious?: boolean } = {}
): EmployeeZones {
  const key = useMemo(
    () => [...new Set(ids.filter((id): id is string => Boolean(id)))].sort(),
    // Строка, а не массив: вызывающие собирают ids заново на каждый рендер.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ids.join(",")]
  );
  const enabled = key.length > 0 && Boolean(dateFrom) && Boolean(dateTo);

  const query = useQuery(
    ["resolve_time_zones", key.join(","), dateFrom, dateTo],
    () => hickvisionService.resolveTimeZones({ user_base_ids: key, date_from: dateFrom, date_to: dateTo }),
    { enabled, staleTime: 10 * 60 * 1000, retry: 1, keepPreviousData: keepPrevious }
  );

  return useMemo(() => {
    const status: EmployeeZones["status"] = !enabled
      ? "ready"
      : query.isError
        ? "error"
        : query.data
          ? "ready"
          : "loading";
    const zoneOf = (userBaseId: string, date: string) => zoneOn(query.data?.[userBaseId], date.slice(0, 10));
    const viewerClock = (userBaseId: string, date: string, time: string | null | undefined) => {
      const zone = zoneOf(userBaseId, date);
      return zone ? toViewerClock(date.slice(0, 10), time, zone.timezone) : null;
    };
    const local = (time: string | null | undefined) => {
      const minutes = minutesOfClock(time);
      return minutes === null ? "" : clockOfMinutes(minutes);
    };

    return {
      status,
      zoneOf,
      viewerClock,
      text: (userBaseId, date, time) => {
        const clock = viewerClock(userBaseId, date, time);
        return clock ? formatClock(clock) : local(time);
      },
      sortKey: (userBaseId, date, time) => {
        const clock = viewerClock(userBaseId, date, time);
        if (clock) return clock.instant;
        const instant = wallToInstant(date.slice(0, 10), minutesOfClock(time) ?? 0, SORT_FALLBACK_ZONE);
        return Number.isNaN(instant) ? 0 : instant;
      },
    };
  }, [enabled, query.isError, query.data]);
}
