// Табель (CONTEXT.md → Attendance Sheet): строка сотрудника за период — по
// ячейке на день и итоги. Без React и без i18n: правила прогоняет `selfCheck.ts`
// голым `npx tsx`.
//
// Источники — те же, что у «Календаря» на этой странице: одна слитая строка
// `get_calendar_attendance` на день, смены и Leave. Свой расчёт здесь только
// там, где его нет нигде: Worked Time, норма и переработка.

import { clockMinutes, shiftLengthMinutes, type ShiftLike } from "../../../utils/shiftWindow";
import { getAttendanceSourceKind } from "../../../utils/attendanceSourcePriority";

const DAY = 1440;
/** Переработка короче этого за день — не переработка (как в прототипе). */
export const OVERTIME_THRESHOLD_MINUTES = 15;

/** Строка дня из `get_calendar_attendance` — нужные табелю поля. */
export type SheetAttendance = {
  check_in_time?: string | null;
  check_out_time?: string | null;
  delay_time?: string | null;
  action_status?: string[] | string | null;
  status?: string[] | string | null;
  source_type?: string[] | string | null;
  absences_id?: string | null;
};

export type SheetLeave = {
  guid: string;
  title: string;
  icon: string;
  color: string;
  status: "pending" | "approved";
  dateFrom: string;
  dateTo: string;
};

export type CellKind =
  /** До приёма или после увольнения. */
  | "outside"
  /** Будущее: факта ещё нет. */
  | "future"
  /** Смена была, строки дня нет — табель прогул не угадывает. */
  | "empty"
  /** Day Off: смены нет. */
  | "day_off"
  | "worked"
  | "late"
  /** Сегодня, приход есть, ухода ещё нет. */
  | "at_work"
  /** Прошедший день без одной из отметок. */
  | "missing_mark"
  /** Absence — «Прогул». */
  | "absent"
  | "leave"
  /** Отметки без смены (Off-Schedule Day). */
  | "off_schedule";

export type PendingKind = "leave" | "mark";

export type SheetCell = {
  date: string;
  kind: CellKind;
  /** Засчитан ли день: «вне графика» и ждущие решения отметки — нет. */
  counted: boolean;
  /** Worked Time; null — неизвестно (нет одной из отметок). */
  workedMinutes: number | null;
  /** Длина смен дня; 0 — смены нет или день снят Leave. */
  planMinutes: number;
  lateMinutes: number;
  overtimeMinutes: number;
  checkIn: string;
  checkOut: string;
  /** Одобренный Leave дня. */
  leave: SheetLeave | null;
  /** Что ждёт решения: ячейка показывает засчитанное, точка — это. */
  pending: PendingKind[];
  /** Ждущий Leave — для подсказки. */
  pendingLeave: SheetLeave | null;
};

export type SheetTotals = {
  days: number;
  workedMinutes: number;
  planMinutes: number;
  lateMinutes: number;
  /** Баланс за период: max(0, Σ сверх смены − Σ недоработок), не сумма переработок дней. */
  overtimeMinutes: number;
  absences: number;
  offScheduleDays: number;
};

const lower = (value: unknown): string[] =>
  [value].flat().map((item) => String(item ?? "").trim().toLowerCase()).filter(Boolean);

/** «HH:MM» из «09:05», «09:05:00» или даты-времени. */
export const clockOf = (value: unknown): string => {
  const raw = String(value ?? "");
  const match = /(\d{1,2}):(\d{2})/.exec(raw);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : "";
};

/**
 * Worked Time: уход − приход, без вычетов. Уход раньше прихода — через
 * полночь: строка ночной смены лежит на дате её начала.
 */
export const workedMinutesOf = (checkIn: string, checkOut: string): number | null => {
  const start = clockMinutes(checkIn);
  const end = clockMinutes(checkOut);
  if (start == null || end == null) return null;
  return end >= start ? end - start : end + DAY - start;
};

/** Переработка дня: сверх смены, короче порога — ноль. */
export const overtimeOf = (worked: number | null, plan: number): number => {
  if (worked == null || plan <= 0) return 0;
  const over = worked - plan;
  return over >= OVERTIME_THRESHOLD_MINUTES ? over : 0;
};

export type RowInput = {
  dates: string[];
  today: string;
  /** `date_hire` / `dismissal_date` как «ГГГГ-ММ-ДД» или "". */
  hireDate: string;
  dismissalDate: string;
  /** Смены сотрудника по дате. */
  shiftsByDate: Map<string, ShiftLike[]>;
  attendanceByDate: Map<string, SheetAttendance>;
  /** Leave сотрудника (одобренные и ждущие), отклонённые уже отброшены. */
  leaves: SheetLeave[];
  /** Leave по guid — для строк, снятых одобренным отсутствием. */
  leaveById: Map<string, SheetLeave>;
};

const leaveOn = (leaves: SheetLeave[], date: string, status: SheetLeave["status"]) =>
  leaves.find((leave) => leave.status === status && leave.dateFrom <= date && leave.dateTo >= date) ?? null;

export const buildCell = (input: RowInput, date: string): SheetCell => {
  const shifts = input.shiftsByDate.get(date) ?? [];
  const shiftMinutes = shifts.reduce((sum, shift) => sum + shiftLengthMinutes(shift), 0);
  const row = input.attendanceByDate.get(date);
  const approvedLeave = leaveOn(input.leaves, date, "approved");
  const pendingLeave = leaveOn(input.leaves, date, "pending");

  const cell: SheetCell = {
    date,
    kind: "empty",
    counted: true,
    workedMinutes: null,
    planMinutes: shiftMinutes,
    lateMinutes: 0,
    overtimeMinutes: 0,
    checkIn: clockOf(row?.check_in_time),
    checkOut: clockOf(row?.check_out_time),
    leave: null,
    pending: pendingLeave ? ["leave"] : [],
    pendingLeave,
  };

  if ((input.hireDate && date < input.hireDate) || (input.dismissalDate && date > input.dismissalDate)) {
    return { ...cell, kind: "outside", planMinutes: 0, pending: [], pendingLeave: null };
  }

  const source = row ? getAttendanceSourceKind(row.source_type) : null;

  // Leave снимает день целиком — и из нормы тоже (CONTEXT.md → Leave).
  if (source === "absences" || (!row && approvedLeave)) {
    const leave = (row?.absences_id && input.leaveById.get(row.absences_id)) || approvedLeave;
    return { ...cell, kind: "leave", planMinutes: 0, leave: leave ?? null };
  }

  if (!row) {
    if (date > input.today) return { ...cell, kind: "future" };
    return { ...cell, kind: shifts.length ? "empty" : "day_off" };
  }

  const status = lower(row.status);
  const action = lower(row.action_status);
  // Отметка вне радиуса до согласования и неподтверждённая ручная не засчитаны
  // нигде (решения 29.09) — ячейка их показывает, итоги нет.
  const awaiting =
    (source === "integration" && status.includes("requested")) ||
    (source === "manual" && !status.some((value) => value === "accepted" || value === "approved"));
  if (awaiting) cell.pending = [...cell.pending, "mark"];

  if (source === "off_schedule") {
    return {
      ...cell,
      kind: "off_schedule",
      counted: false,
      planMinutes: 0,
      workedMinutes: workedMinutesOf(cell.checkIn, cell.checkOut),
    };
  }

  if (!cell.checkIn && !cell.checkOut) {
    if (action.includes("absent")) return { ...cell, kind: "absent", counted: !awaiting };
    return { ...cell, kind: date > input.today ? "future" : "empty" };
  }

  const delay = clockMinutes(clockOf(row.delay_time)) ?? 0;
  const worked = workedMinutesOf(cell.checkIn, cell.checkOut);
  const kind: CellKind =
    worked != null
      ? action.includes("late") || delay > 0
        ? "late"
        : "worked"
      : date === input.today && cell.checkIn && !cell.checkOut
        ? "at_work"
        : "missing_mark";

  return {
    ...cell,
    kind,
    counted: !awaiting,
    workedMinutes: worked,
    lateMinutes: delay,
    overtimeMinutes: overtimeOf(worked, shiftMinutes),
  };
};

const WORKED_KINDS: CellKind[] = ["worked", "late", "at_work", "missing_mark"];

export const totalsOf = (cells: SheetCell[], today: string): SheetTotals => {
  const totals: SheetTotals = {
    days: 0,
    workedMinutes: 0,
    planMinutes: 0,
    lateMinutes: 0,
    overtimeMinutes: 0,
    absences: 0,
    offScheduleDays: 0,
  };
  // Баланс часов: переработка дня (с порогом) плюс недоработка дней со сменой —
  // опоздание и ранний уход съедают переработку других дней.
  let balance = 0;
  for (const cell of cells) {
    // Норма — по сменам до сегодня включительно: сравнивается с уже отработанным.
    if (cell.date <= today) totals.planMinutes += cell.planMinutes;
    if (cell.kind === "off_schedule") {
      totals.offScheduleDays += 1;
      continue;
    }
    if (!cell.counted) continue;
    if (cell.kind === "absent") totals.absences += 1;
    if (!WORKED_KINDS.includes(cell.kind)) continue;
    totals.days += 1;
    totals.workedMinutes += cell.workedMinutes ?? 0;
    totals.lateMinutes += cell.lateMinutes;
    if (cell.workedMinutes == null) {
      // Ухода нет — часы неизвестны, но опоздание по приходу уже известно.
      balance -= cell.lateMinutes;
    } else if (cell.planMinutes > 0) {
      // Опоздание этого дня уже внутри Worked Time — второй раз не вычитаем.
      balance += cell.workedMinutes >= cell.planMinutes ? cell.overtimeMinutes : cell.workedMinutes - cell.planMinutes;
    }
  }
  totals.overtimeMinutes = Math.max(0, balance);
  return totals;
};

export const buildRow = (input: RowInput): { cells: SheetCell[]; totals: SheetTotals } => {
  const cells = input.dates.map((date) => buildCell(input, date));
  return { cells, totals: totalsOf(cells, input.today) };
};
