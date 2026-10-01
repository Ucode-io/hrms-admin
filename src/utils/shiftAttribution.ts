// Какой смене принадлежит отметка — для экранов, которые раскладывают сырые
// отметки (`attendance_records`) по дням. Правило — как у бэкенда (`shiftWindow`):
// у отметки календарная дата одна, а смена, которой она принадлежит, может быть
// вчерашней (уход ночной смены в 06:00).

import type { Shift } from "../api/services/shift.service";
import { currentShift } from "./shiftWindow";

/** Смены по сотруднику. Открытые (без человека) отбрасываются. */
export const shiftsByEmployeeOf = (shifts: Shift[]): Map<string, Shift[]> => {
  const byEmployee = new Map<string, Shift[]>();
  for (const shift of shifts) {
    if (!shift.user_base_id) continue;
    const list = byEmployee.get(shift.user_base_id);
    if (list) list.push(shift);
    else byEmployee.set(shift.user_base_id, [shift]);
  }
  return byEmployee;
};

/** «HH:MM» из времени отметки — строка базы бывает и `06:05:00`, и датой-временем. */
export const clockOfMark = (row: Record<string, unknown>): string => {
  const raw = String(row.event_time || row.action_time || "");
  return /(\d{1,2}:\d{2})/.exec(raw)?.[1] ?? "";
};

/**
 * Дата смены, которой принадлежит отметка. Вне всех смен (или без времени) —
 * её календарная дата: там лежит запись «вне графика».
 */
export const shiftDateOfMark = (
  shifts: Shift[] | undefined,
  markDate: string,
  time: string
): string =>
  (shifts && time ? currentShift(shifts, markDate, time)?.date?.slice(0, 10) : undefined) ?? markDate;
