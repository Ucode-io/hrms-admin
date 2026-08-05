import { useMemo } from "react";
import { SOURCE_META, SOURCE_ORDER, formatDuration, fromIsoDate } from "../constants";
import type { TimesheetEntry, TimesheetSource } from "../types";

/**
 * Заливка трекера тёмная, у остальных источников — светлая. Белая подпись на
 * светлой заливке не читалась, поэтому цвет текста выбираем по источнику.
 */
const labelColor = (source: TimesheetSource): string =>
  source === "tracker" ? "#ffffff" : "#1e293b";

const pad = (value: number) => String(value).padStart(2, "0");

/** Минуты от полуночи → «09:06». Значения за полночь сворачиваются в сутки. */
const clock = (minutes: number): string => {
  const normalized = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(normalized / 60))}:${pad(normalized % 60)}`;
};

/**
 * «2026-08-03T09:06:00» → минуты от полуночи опорного дня.
 *
 * Смена Time Doctor может заканчиваться уже за полночь, поэтому результат
 * намеренно не ограничен сутками: конец следующего дня даёт значение > 1440 и
 * рисуется правее, а не заворачивается в начало шкалы.
 */
const toMinutes = (value: string | null, baseDate: string): number | null => {
  if (!value) return null;
  const [datePart, timePart] = value.split("T");
  if (!timePart) return null;
  const [hours = 0, minutes = 0, seconds = 0] = timePart.split(":").map(Number);
  const dayShift = Math.round(
    (fromIsoDate(datePart).getTime() - fromIsoDate(baseDate).getTime()) / 86_400_000
  );
  return dayShift * 1440 + hours * 60 + minutes + seconds / 60;
};

/** Запасной разбор для старых записей без полной даты — только «HH:MM». */
const clockToMinutes = (value: string): number | null => {
  const match = /^(\d{1,2}):(\d{2})/.exec(value || "");
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

type Segment = {
  entry: TimesheetEntry;
  from: number;
  to: number;
};

const MIN_SPAN_MINUTES = 6 * 60;

/** Промежуток без записей: по клику по нему заводится ручное время. */
export type TimelineGap = { startTime: string; endTime: string };

export default function DayTimeline({
  date,
  entries,
  hoveredEntryId = null,
  onHoverEntry,
  onGapClick,
  draftRange = null,
}: {
  date: string;
  entries: TimesheetEntry[];
  /** Общая с таблицей записей подсветка: наведение работает в обе стороны. */
  hoveredEntryId?: string | null;
  onHoverEntry?: (entryId: string | null) => void;
  /** Клик по пустому месту дорожки — открывает строку ввода в таблице. */
  onGapClick?: (gap: TimelineGap) => void;
  /**
   * Открытый черновик — рисуется отдельным блоком и едет за полями формы:
   * видно, куда именно встанет запись, пока правишь начало и окончание.
   */
  draftRange?: TimelineGap | null;
}) {
  // Черновик участвует в расчёте шкалы наравне с записями: иначе, сдвинув
  // начало за её край, пользователь терял бы блок из виду ровно в тот момент,
  // когда смотрит, куда он встанет.
  const draftBounds = useMemo(() => {
    if (!draftRange) return null;
    const from = clockToMinutes(draftRange.startTime);
    const to = clockToMinutes(draftRange.endTime);
    if (from === null || to === null) return null;
    return { from, to: Math.max(to, from + 1) };
  }, [draftRange]);

  const { segments, skipped, axisFrom, axisTo, ticks, sources } = useMemo(() => {
    const built: Segment[] = [];
    let skippedCount = 0;

    entries.forEach((entry) => {
      const from = toMinutes(entry.start, date) ?? clockToMinutes(entry.startTime);
      if (from === null) {
        skippedCount += 1;
        return;
      }
      let to = toMinutes(entry.end, date) ?? clockToMinutes(entry.endTime);
      // Длительность надёжнее конца: у записей за полночь конец без даты
      // оказывался бы левее начала.
      if (to === null || to <= from) to = from + entry.durationSeconds / 60;
      built.push({ entry, from, to: Math.max(to, from + 1) });
    });

    if (built.length === 0 && !draftBounds) {
      return {
        segments: built,
        skipped: skippedCount,
        axisFrom: 9 * 60,
        axisTo: 18 * 60,
        ticks: [] as number[],
        sources: [] as TimesheetSource[],
      };
    }

    const bounds = [
      ...built.map((segment) => ({ from: segment.from, to: segment.to })),
      ...(draftBounds ? [draftBounds] : []),
    ];
    const minFrom = Math.min(...bounds.map((item) => item.from));
    const maxTo = Math.max(...bounds.map((item) => item.to));

    let start = Math.max(0, Math.floor(minFrom / 60) * 60 - 30);
    let end = Math.ceil(maxTo / 60) * 60 + 30;
    if (end - start < MIN_SPAN_MINUTES) end = start + MIN_SPAN_MINUTES;

    // Подписи ставим по целым часам, а шаг подбираем под ширину: на суточной
    // шкале часовые метки сливаются в сплошную строку.
    const span = end - start;
    const step = span <= 8 * 60 ? 60 : span <= 15 * 60 ? 120 : 180;
    const tickList: number[] = [];
    for (
      let tick = Math.ceil(start / step) * step;
      tick <= end;
      tick += step
    ) {
      tickList.push(tick);
    }
    if (tickList.length > 0) {
      start = Math.min(start, tickList[0]);
      end = Math.max(end, tickList[tickList.length - 1]);
    }

    const present = SOURCE_ORDER.filter((source) =>
      built.some(({ entry }) => entry.source === source)
    );

    return {
      segments: built,
      skipped: skippedCount,
      axisFrom: start,
      axisTo: end,
      ticks: tickList,
      sources: present,
    };
  }, [entries, date, draftBounds]);

  const span = Math.max(1, axisTo - axisFrom);
  const percent = (minutes: number) => ((minutes - axisFrom) / span) * 100;

  /**
   * Промежутки без записей — то самое «пустое место», по которому кликают,
   * чтобы завести время. Считаются слиянием занятых отрезков: записи трекера
   * часто перекрываются (перерыв внутри сессии), и наивная разность соседних
   * границ дала бы отрицательные окна.
   *
   * Всё, что за полночь, отсекаем: запись табеля принадлежит одному дню, и
   * форма всё равно не приняла бы интервал через сутки.
   */
  const gaps = useMemo(() => {
    const dayEnd = 24 * 60 - 1;
    const busy = segments
      .map(({ from, to }) => ({ from: Math.max(0, from), to: Math.min(to, dayEnd) }))
      .filter((item) => item.to > item.from)
      .sort((left, right) => left.from - right.from);

    const merged: { from: number; to: number }[] = [];
    for (const item of busy) {
      const last = merged[merged.length - 1];
      if (last && item.from <= last.to) last.to = Math.max(last.to, item.to);
      else merged.push({ ...item });
    }

    const windowFrom = Math.max(0, axisFrom);
    const windowTo = Math.min(axisTo, dayEnd);
    const result: { from: number; to: number }[] = [];
    let cursor = windowFrom;

    for (const item of merged) {
      if (item.from > cursor) result.push({ from: cursor, to: Math.min(item.from, windowTo) });
      cursor = Math.max(cursor, item.to);
    }
    if (cursor < windowTo) result.push({ from: cursor, to: windowTo });

    // Окна тоньше пяти минут кликом не поймать, а мусорных полосок дают много.
    return result.filter((item) => item.to - item.from >= 5);
  }, [segments, axisFrom, axisTo]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-white/90">Таймлайн дня</h2>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {sources.map((source) => {
            const meta = SOURCE_META[source] ?? SOURCE_META.other;
            return (
              <span
                key={source}
                className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"
              >
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: meta.bar }}
                />
                {meta.short}
              </span>
            );
          })}
        </div>
      </div>

      {segments.length === 0 && !onGapClick ? (
        <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Нет записей со временем за этот день
        </p>
      ) : (
        <>
          {segments.length === 0 && (
            // Пустой день всё равно рисуем дорожкой: по ней и заводят время,
            // когда трекер не работал вовсе.
            <p className="mb-2 text-xs text-gray-400">
              Записей со временем нет — кликните по дорожке, чтобы добавить время
            </p>
          )}
          {/* Шкала часов */}
          <div className="relative h-5 select-none">
            {ticks.map((tick) => (
              <span
                key={tick}
                className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-[11px] text-gray-400"
                style={{ left: `${percent(tick)}%` }}
              >
                {clock(tick)}
              </span>
            ))}
          </div>

          {/* Дорожка дня: сетка часов + сегменты записей */}
          <div className="relative h-14 w-full overflow-hidden rounded-xl border border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-white/[0.04]">
            {ticks.map((tick) => (
              <span
                key={tick}
                className="absolute inset-y-0 w-px bg-gray-200/80 dark:bg-white/10"
                style={{ left: `${percent(tick)}%` }}
              />
            ))}

            {/* Пустые окна кликабельны: это основной способ завести ручное
                время — как в Time Doctor, где по промежутку открывается
                строка ввода. Рисуются под сегментами, чтобы не перехватывать
                наведение на записи. */}
            {onGapClick &&
              gaps.map((gap) => {
                const left = percent(gap.from);
                const width = Math.max(0.4, percent(gap.to) - left);
                const startTime = clock(gap.from);
                const endTime = clock(gap.to);

                return (
                  <button
                    key={`gap-${gap.from}-${gap.to}`}
                    type="button"
                    onClick={() => onGapClick({ startTime, endTime })}
                    title={`Добавить время ${startTime} – ${endTime}`}
                    className="group absolute inset-y-2 flex items-center justify-center rounded-md border border-dashed border-transparent transition hover:border-brand-300 hover:bg-brand-50/60"
                    style={{ left: `${left}%`, width: `${width}%` }}
                  >
                    <span className="text-[11px] font-semibold text-brand-500 opacity-0 transition group-hover:opacity-100">
                      {width > 6 ? "+ добавить" : "+"}
                    </span>
                  </button>
                );
              })}

            {segments.map(({ entry, from, to }) => {
              const meta = SOURCE_META[entry.source] ?? SOURCE_META.other;
              const left = percent(from);
              const width = Math.max(0.4, percent(to) - left);
              const isBreak = entry.source === "break";
              const label = entry.projectName || entry.taskName || meta.short;
              const isHovered = hoveredEntryId === entry.id;
              const isDimmed = Boolean(hoveredEntryId) && !isHovered;
              return (
                <span
                  key={entry.id}
                  onMouseEnter={() => onHoverEntry?.(entry.id)}
                  onMouseLeave={() => onHoverEntry?.(null)}
                  className={`absolute flex items-center overflow-hidden rounded-md px-1.5 transition-opacity ${
                    isBreak ? "inset-y-4" : "inset-y-2"
                  }`}
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    backgroundColor: meta.bar,
                    opacity: isDimmed ? 0.35 : 1,
                    // Рамка внутренняя: дорожка обрезает всё, что вылезает за
                    // её края, и обычный ring у крайних сегментов пропал бы.
                    boxShadow: isHovered ? "inset 0 0 0 2px rgba(15, 23, 42, 0.85)" : undefined,
                  }}
                  title={`${clock(from)} – ${clock(to)} · ${formatDuration(
                    entry.durationSeconds
                  )} · ${meta.label}${entry.projectName ? ` · ${entry.projectName}` : ""}${
                    entry.taskName ? ` · ${entry.taskName}` : ""
                  }`}
                >
                  {width > 7 && (
                    <span
                      className="truncate text-[11px] font-medium"
                      style={{ color: labelColor(entry.source) }}
                    >
                      {label}
                    </span>
                  )}
                </span>
              );
            })}

            {/* Черновик поверх всего и пунктиром: он ещё не запись, но видно,
                куда встанет и какой ширины будет. Двигается вместе с полями
                «начало»/«окончание» в строке ввода. */}
            {draftBounds && (
              <span
                className="pointer-events-none absolute inset-y-1 flex items-center justify-center rounded-md border-2 border-dashed"
                style={{
                  left: `${percent(draftBounds.from)}%`,
                  width: `${Math.max(0.6, percent(draftBounds.to) - percent(draftBounds.from))}%`,
                  borderColor: SOURCE_META.hrms_manual.color,
                  backgroundColor: `${SOURCE_META.hrms_manual.bar}80`,
                }}
              >
                <span
                  className="truncate px-1 text-[11px] font-semibold"
                  style={{ color: SOURCE_META.hrms_manual.color }}
                >
                  {percent(draftBounds.to) - percent(draftBounds.from) > 12
                    ? `Новая запись · ${formatDuration(
                        Math.max(0, draftBounds.to - draftBounds.from) * 60
                      )}`
                    : ""}
                </span>
              </span>
            )}
          </div>

          {skipped > 0 && (
            <p className="mt-3 text-xs text-gray-400">
              {skipped} записей без времени начала — на таймлайне не показаны
            </p>
          )}
        </>
      )}
    </div>
  );
}
