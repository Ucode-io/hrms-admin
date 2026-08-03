import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { Clock } from "lucide-react";
import {
  BAR_SCALE_SECONDS,
  SOURCE_META,
  SOURCE_ORDER,
  formatDayHeader,
  formatDuration,
  fromIsoDate,
  isToday,
  isWeekend,
} from "../constants";
import { EmployeeAvatar } from "../components/badges";
import type { TimelineDay, TimelineRow, TimelineScale } from "../types";

interface TimelineViewProps {
  dates: string[];
  rows: TimelineRow[];
  scale: TimelineScale;
  /** Всего сотрудников под фильтрами — для подписи «показано N из M». */
  total: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}

/**
 * Полоса дня: сегменты источников слева направо, поверх — метка плана.
 *
 * Шкала общая для всех ячеек (BAR_SCALE_SECONDS), а не «по максимуму строки»:
 * иначе 2 часа у одного сотрудника выглядели бы как 10 у другого. Всё, что
 * выше потолка, упирается в край — это видно по подписи.
 */
function DayBar({ day, compact }: { day: TimelineDay; compact: boolean }) {
  const planPercent = Math.min(100, (day.planSeconds / BAR_SCALE_SECONDS) * 100);

  let offset = 0;
  const segments = SOURCE_ORDER.map((source) => {
    const seconds = day.bySource?.[source] ?? 0;
    if (seconds <= 0) return null;
    const width = Math.min(100 - offset, (seconds / BAR_SCALE_SECONDS) * 100);
    const left = offset;
    offset += width;
    return { source, left, width };
  }).filter(Boolean) as { source: keyof typeof SOURCE_META; left: number; width: number }[];

  return (
    <div className="flex flex-col gap-1">
      {/* Внешний контейнер без overflow-hidden: метка плана выступает за
          пределы полосы. Внутри полосы, вровень с сегментами, она сливалась с
          заливкой и была почти не видна. */}
      <div className="relative w-full">
        <div
          className={`relative w-full overflow-hidden rounded bg-gray-200 dark:bg-white/15 ${
            compact ? "h-5" : "h-2"
          }`}
        >
          {segments.map((segment) => (
            <span
              key={segment.source}
              className="absolute inset-y-0 rounded"
              style={{
                left: `${segment.left}%`,
                width: `${segment.width}%`,
                backgroundColor: SOURCE_META[segment.source].bar,
              }}
            />
          ))}
        </div>
        {day.planSeconds > 0 && (
          <span
            className="absolute -bottom-[3px] -top-[3px] w-[3px] rounded-full bg-slate-800 ring-1 ring-white dark:bg-white dark:ring-gray-900"
            style={{ left: `${planPercent}%`, transform: "translateX(-50%)" }}
          />
        )}
      </div>
      {!compact && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {day.totalSeconds > 0 ? formatDuration(day.totalSeconds) : ""}
        </span>
      )}
    </div>
  );
}

/** Подсказка ячейки: факт, план и причина пустого дня. */
const cellTitle = (day: TimelineDay): string => {
  const parts = [
    `${formatDayHeader(day.date)}`,
    `Факт: ${day.totalSeconds > 0 ? formatDuration(day.totalSeconds) : "0"}`,
    `План: ${day.planSeconds > 0 ? formatDuration(day.planSeconds) : "выходной"}`,
  ];
  if (day.breakSeconds > 0) parts.push(`Перерывы: ${formatDuration(day.breakSeconds)}`);
  if (day.firstStart && day.lastEnd) parts.push(`${day.firstStart} – ${day.lastEnd}`);
  if (day.absence) parts.push(day.absence);
  if (day.holiday) parts.push(day.holiday);
  return parts.join(" · ");
};

export default function TimelineView({
  dates,
  rows,
  scale,
  total,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: TimelineViewProps) {
  const navigate = useNavigate();
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Подгрузка по появлению маркера в зоне видимости. `rootMargin` заряжает
  // следующую страницу заранее, чтобы прокрутка не упиралась в пустоту.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
      },
      { rootMargin: "300px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore, rows.length]);
  const compact = scale === "month";
  const showTimes = scale === "day";

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center dark:border-gray-800 dark:bg-white/[0.03]">
        <Clock size={28} className="mx-auto mb-3 text-gray-300" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Нет сотрудников, подключённых к Time Doctor
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Сопоставьте сотрудников в «Настройки → Интеграции → Time Doctor»
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="max-w-full overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead className="border-b border-gray-100 dark:border-gray-800">
            <tr>
              <th className="sticky left-0 z-10 bg-white px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                Сотрудник
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">
                Факт / План
              </th>
              {showTimes && (
                <>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Начало
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Окончание
                  </th>
                </>
              )}
              {dates.map((date) => (
                <th
                  key={date}
                  className={`whitespace-nowrap py-3 text-left text-xs font-semibold ${
                    compact ? "px-1.5 text-center" : "px-3"
                  } ${
                    isWeekend(date)
                      ? "text-rose-500"
                      : "text-gray-500 dark:text-gray-400"
                  } ${isToday(date) ? "bg-brand-50/40 dark:bg-brand-500/10" : ""}`}
                >
                  {compact ? fromIsoDate(date).getDate() : formatDayHeader(date)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((row) => (
              <tr key={row.employeeId} className="group">
                <td className="sticky left-0 z-10 bg-white px-5 py-2.5 group-hover:bg-gray-50 dark:bg-gray-900 dark:group-hover:bg-white/[0.03]">
                  <div className="flex items-center gap-2.5">
                    <EmployeeAvatar
                      name={row.name}
                      photo={row.photo}
                      seed={row.employeeId}
                      size={32}
                    />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-semibold text-gray-800 dark:text-white/90">
                        {row.name}
                      </span>
                      <span className="truncate text-xs text-gray-400">
                        {row.department || row.position || "—"}
                      </span>
                    </div>
                  </div>
                </td>

                <td className="whitespace-nowrap px-4 py-2.5">
                  <span className="text-sm font-semibold text-gray-800 dark:text-white/90">
                    {formatDuration(row.totalSeconds)}
                  </span>
                  <span className="block text-xs text-gray-400">
                    План: {row.planSeconds > 0 ? formatDuration(row.planSeconds) : "—"}
                  </span>
                </td>

                {showTimes && (
                  <>
                    <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">
                      {row.days[0]?.firstStart || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">
                      {row.days[0]?.lastEnd || "—"}
                    </td>
                  </>
                )}

                {row.days.map((day) => (
                  <td
                    key={day.date}
                    title={cellTitle(day)}
                    onClick={() => navigate(`/timesheet/${row.employeeId}/${day.date}`)}
                    className={`cursor-pointer py-2.5 align-middle transition hover:bg-gray-50 dark:hover:bg-white/[0.06] ${
                      compact ? "px-1.5" : "min-w-[120px] px-3"
                    } ${day.isDayOff ? "bg-gray-50/70 dark:bg-white/[0.02]" : ""} ${
                      isToday(day.date) ? "bg-brand-50/40 dark:bg-brand-500/10" : ""
                    }`}
                  >
                    {/* Отсутствие важнее пустой полосы: без подписи согласованный
                        отпуск выглядел бы как прогул. */}
                    {day.absence && day.totalSeconds === 0 ? (
                      <span
                        className="block truncate rounded bg-amber-100 px-1.5 py-0.5 text-center text-[11px] font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                        title={day.absence}
                      >
                        {compact ? "О" : day.absence}
                      </span>
                    ) : (
                      <DayBar day={day} compact={compact} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Маркер подгрузки живёт под таблицей, а не внутри её горизонтального
          скролла — иначе он никогда не попал бы в зону видимости. */}
      <div
        ref={sentinelRef}
        className="border-t border-gray-100 px-5 py-3 text-center text-xs text-gray-400 dark:border-gray-800"
      >
        {isLoadingMore
          ? "Загружаем ещё…"
          : hasMore
            ? `Показано ${rows.length} из ${total}`
            : `Все сотрудники: ${rows.length}`}
      </div>
    </div>
  );
}
