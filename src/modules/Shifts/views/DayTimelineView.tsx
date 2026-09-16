// Таймлайн одного дня: строки — сотрудники, ось — часы.
//
// Отвечает на вопрос, которого сетка не видит: в какие часы суток никого нет.
//
// Ось адаптивная, а не прибитая к 00:00–24:00. Ночная смена 21:00–06:00
// принадлежит дате начала и заканчивается на следующих сутках; на жёсткой шкале
// она развалилась бы на два обрубка по краям. Поэтому конец, не превышающий
// начало, переносится за 24:00, а ось растягивается до самой поздней смены —
// отрезок остаётся одним.

import {
  KIND_META,
  avatarColor,
  formatShiftTime,
  getInitials,
  normalizeTime,
  shiftKind,
  shiftMinutes,
  timeToMinutes,
} from "../constants";
import type { Shift } from "../../../api/services/shift.service";
import type { ShiftEmployee } from "../types";

interface DayTimelineViewProps {
  date: string;
  employees: ShiftEmployee[];
  /** `${employeeId}|${iso}` → смена. */
  shiftByCell: Map<string, Shift>;
  openShifts: Shift[];
  onShiftClick: (employeeId: string | null, date: string, shift: Shift | null) => void;
}

const DAY = 24 * 60;

type Span = { from: number; to: number };

/**
 * Границы смены в минутах от полуночи даты смены. Конец, не превышающий начало,
 * уезжает за сутки — это и есть переход через полночь.
 */
const spanOf = (shift: Shift): Span | null => {
  const start = timeToMinutes(shift.start_time);
  const end = timeToMinutes(shift.end_time);
  if (start == null || end == null) return null;
  return { from: start, to: end > start ? end : end + DAY };
};

const formatTick = (minutes: number): string => {
  const normalized = minutes % DAY;
  const label = `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(
    normalized % 60
  ).padStart(2, "0")}`;
  return minutes >= DAY ? `${label}⁺¹` : label;
};

export default function DayTimelineView({
  date,
  employees,
  shiftByCell,
  openShifts,
  onShiftClick,
}: DayTimelineViewProps) {
  const rows = employees.map((employee) => ({
    employee,
    shift: shiftByCell.get(`${employee.id}|${date}`) ?? null,
  }));

  const spans = [
    ...rows.map((row) => (row.shift ? spanOf(row.shift) : null)),
    ...openShifts.map(spanOf),
  ].filter(Boolean) as Span[];

  // Пустой день всё равно показываем шкалой рабочих суток, а не схлопнутой в
  // ноль: строка «никого нет» читается только на фоне обычного дня.
  const axisFrom = spans.length > 0 ? Math.min(...spans.map((span) => span.from), 0) : 0;
  const axisTo = spans.length > 0 ? Math.max(...spans.map((span) => span.to), DAY) : DAY;
  const axisSpan = Math.max(60, axisTo - axisFrom);

  const percent = (minutes: number) => ((minutes - axisFrom) / axisSpan) * 100;

  // Шаг тиков подбираем так, чтобы подписи не налезали: до 12 штук на шкалу.
  const tickStep = axisSpan > 12 * 60 ? 180 : 120;
  const ticks: number[] = [];
  for (
    let minute = Math.ceil(axisFrom / tickStep) * tickStep;
    minute <= axisTo;
    minute += tickStep
  ) {
    ticks.push(minute);
  }

  const renderBar = (shift: Shift | null, onClick: () => void, emptyHint: string) => {
    const span = shift ? spanOf(shift) : null;

    return (
      <div className="relative h-9 rounded-lg bg-gray-50 dark:bg-white/[0.03]">
        {ticks.map((minute) => (
          <span
            key={minute}
            className="absolute top-0 h-full w-px bg-gray-200/70 dark:bg-gray-700/50"
            style={{ left: `${percent(minute)}%` }}
          />
        ))}

        {!shift && (
          <button
            type="button"
            onClick={onClick}
            className="absolute inset-0 flex items-center justify-center rounded-lg text-[11px] text-gray-300 transition hover:bg-brand-50/60 hover:text-brand-400 dark:text-gray-600 dark:hover:bg-brand-500/10"
          >
            {emptyHint}
          </button>
        )}

        {/* Смена задана длительностью — ставить её на часовую ось не на что.
            Показываем полосой во всю ширину с подписью «8ч», чтобы человек не
            выглядел незапланированным, но и не врём про часы. */}
        {shift && !span && (
          <button
            type="button"
            onClick={onClick}
            title={`${shiftMinutes(shift) / 60}ч, время суток не задано${
              shift.comment ? ` · ${shift.comment}` : ""
            }`}
            className="absolute inset-x-0 top-1 flex h-7 items-center justify-center rounded-md border border-dashed text-[11px] font-semibold transition hover:brightness-95"
            style={{
              borderColor: KIND_META[shiftKind(shift)].color,
              backgroundColor: KIND_META[shiftKind(shift)].soft,
              color: KIND_META[shiftKind(shift)].color,
            }}
          >
            {formatShiftTime(shift) || "время не задано"}
          </button>
        )}

        {shift && span && (
          <button
            type="button"
            onClick={onClick}
            title={`${KIND_META[shiftKind(shift)].label} ${formatShiftTime(shift)}${
              shift.comment ? ` · ${shift.comment}` : ""
            }`}
            className="absolute top-1 flex h-7 items-center justify-center overflow-hidden rounded-md border px-2 text-[11px] font-semibold transition hover:brightness-95"
            style={{
              left: `${percent(span.from)}%`,
              width: `${Math.max(2, ((span.to - span.from) / axisSpan) * 100)}%`,
              borderColor: KIND_META[shiftKind(shift)].color,
              backgroundColor: KIND_META[shiftKind(shift)].soft,
              color: KIND_META[shiftKind(shift)].color,
            }}
          >
            <span className="truncate">
              {normalizeTime(shift.start_time)}–{normalizeTime(shift.end_time)}
            </span>
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
      {/* Шкала часов */}
      <div className="flex border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
        <div className="w-[220px] shrink-0 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Сотрудник
        </div>
        <div className="relative h-9 flex-1">
          {ticks.map((minute) => (
            <span
              key={minute}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] text-gray-400 dark:text-gray-500"
              style={{ left: `${percent(minute)}%` }}
            >
              {formatTick(minute)}
            </span>
          ))}
        </div>
      </div>

      {openShifts.length > 0 && (
        <div className="flex items-center gap-2 border-b border-gray-100 bg-amber-50/40 px-0 dark:border-gray-800 dark:bg-amber-500/[0.06]">
          <div className="flex w-[220px] shrink-0 items-center gap-2.5 px-3 py-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-amber-300 text-[11px] font-bold text-amber-500">
              {openShifts.length}
            </span>
            <span className="text-[13px] font-semibold text-gray-700 dark:text-white/90">
              Открытые
            </span>
          </div>
          {/* Каждый незакрытый слот — свой отрезок: они могут быть в разное
              время, и одна усреднённая полоса это скрыла бы. */}
          <div className="flex-1 space-y-1 py-1.5 pr-3">
            {openShifts.map((shift) => (
              <div key={shift.guid}>
                {renderBar(shift, () => onShiftClick(null, date, shift), "")}
              </div>
            ))}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-400 dark:text-gray-500">
          Нет сотрудников по заданным фильтрам
        </div>
      ) : (
        rows.map(({ employee, shift }) => (
          <div
            key={employee.id}
            className="flex items-center border-b border-gray-100 last:border-b-0 dark:border-gray-800"
          >
            <div className="flex w-[220px] shrink-0 items-center gap-2.5 px-3 py-2">
              {employee.photo ? (
                <img src={employee.photo} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white"
                  style={{ backgroundColor: avatarColor(employee.id) }}
                >
                  {getInitials(employee.name)}
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-gray-800 dark:text-white/90">
                  {employee.name}
                </span>
                <span className="block truncate text-[11px] text-gray-400 dark:text-gray-500">
                  {employee.position || "—"}
                </span>
              </span>
            </div>
            <div className="flex-1 py-1.5 pr-3">
              {renderBar(shift, () => onShiftClick(employee.id, date, shift), "Поставить смену")}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
