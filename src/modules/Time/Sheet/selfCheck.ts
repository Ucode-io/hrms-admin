/**
 * Самопроверка правил табеля (CONTEXT.md → Attendance Sheet, Worked Time, Overtime).
 *   npx tsx src/modules/Time/Sheet/selfCheck.ts
 */
import assert from "node:assert/strict";
import { buildRow, workedMinutesOf, type RowInput, type SheetAttendance, type SheetLeave } from "./sheet";

const day = (shift: { start_time?: string; end_time?: string; hours_per_day?: number }) => [shift];

const input = (patch: Partial<RowInput>): RowInput => ({
  dates: [],
  today: "2026-10-05",
  hireDate: "",
  dismissalDate: "",
  shiftsByDate: new Map(),
  attendanceByDate: new Map(),
  leaves: [],
  leaveById: new Map(),
  ...patch,
});

const cellOf = (date: string, patch: Partial<RowInput>) =>
  buildRow(input({ dates: [date], ...patch })).cells[0];

const mark = (row: SheetAttendance) => new Map([["2026-10-01", row]]);

// Worked Time: через полночь +24 ч, без ухода — неизвестно.
assert.equal(workedMinutesOf("22:00", "06:10"), 490);
assert.equal(workedMinutesOf("09:00", ""), null);

// Обычный день: 9 ч при смене 09:00–18:00, переработки нет.
{
  const cell = cellOf("2026-10-01", {
    shiftsByDate: new Map([["2026-10-01", day({ start_time: "09:00", end_time: "18:00" })]]),
    attendanceByDate: mark({ check_in_time: "09:00", check_out_time: "18:00", action_status: ["present"], source_type: ["integration"], status: ["accepted"] }),
  });
  assert.equal(cell.kind, "worked");
  assert.equal(cell.workedMinutes, 540);
  assert.equal(cell.planMinutes, 540);
  assert.equal(cell.overtimeMinutes, 0);
}

// Пришёл на 10 минут раньше — ниже порога; опоздал и задержался; задержался на 40.
{
  const shifts = new Map([["2026-10-01", day({ start_time: "09:00", end_time: "18:00" })]]);
  const early = cellOf("2026-10-01", { shiftsByDate: shifts, attendanceByDate: mark({ check_in_time: "08:50", check_out_time: "18:00", action_status: ["present"], source_type: ["integration"] }) });
  assert.equal(early.overtimeMinutes, 0);
  const late = cellOf("2026-10-01", { shiftsByDate: shifts, attendanceByDate: mark({ check_in_time: "09:20", check_out_time: "18:40", delay_time: "00:20", action_status: ["late"], source_type: ["integration"] }) });
  assert.equal(late.kind, "late");
  assert.equal(late.lateMinutes, 20);
  // По смене не обрезаем: 09:20–18:40 — 9 ч 20 м при смене 9 ч.
  assert.equal(late.overtimeMinutes, 20);
  const stayed = cellOf("2026-10-01", { shiftsByDate: shifts, attendanceByDate: mark({ check_in_time: "09:00", check_out_time: "18:40", action_status: ["present"], source_type: ["integration"] }) });
  assert.equal(stayed.overtimeMinutes, 40);
}

// Ночная смена 22:00–06:00: план 8 ч, отработано 8 ч 10 м — ниже порога.
{
  const cell = cellOf("2026-10-01", {
    shiftsByDate: new Map([["2026-10-01", day({ start_time: "22:00", end_time: "06:00" })]]),
    attendanceByDate: mark({ check_in_time: "22:00", check_out_time: "06:10", action_status: ["present"], source_type: ["integration"] }),
  });
  assert.equal(cell.planMinutes, 480);
  assert.equal(cell.workedMinutes, 490);
  assert.equal(cell.overtimeMinutes, 0);
}

// Смена «8 часов в день» — норма 480.
assert.equal(cellOf("2026-10-01", { shiftsByDate: new Map([["2026-10-01", day({ hours_per_day: 8 })]]) }).planMinutes, 480);

// Нет ухода: прошлый день — Missing Mark, сегодня — «на работе». Оба — явка без часов.
{
  const row = { check_in_time: "09:00", action_status: ["present"], source_type: ["integration"] };
  const past = buildRow(input({ dates: ["2026-10-01"], attendanceByDate: mark(row) }));
  assert.equal(past.cells[0].kind, "missing_mark");
  assert.equal(past.totals.days, 1);
  assert.equal(past.totals.workedMinutes, 0);
  const today = cellOf("2026-10-05", { attendanceByDate: new Map([["2026-10-05", row]]) });
  assert.equal(today.kind, "at_work");
}

// Вне графика: часы видны, в итоги не входят, считаются отдельно.
{
  const row = buildRow(input({
    dates: ["2026-10-01"],
    attendanceByDate: mark({ check_in_time: "10:00", check_out_time: "14:00", action_status: ["present"], source_type: ["off_schedule"] }),
  }));
  assert.equal(row.cells[0].kind, "off_schedule");
  assert.equal(row.cells[0].workedMinutes, 240);
  assert.deepEqual([row.totals.days, row.totals.workedMinutes, row.totals.offScheduleDays], [0, 0, 1]);
}

// Прогул; ждущий отпуск на тот же день — точка, а не отпуск.
{
  const pending: SheetLeave = { guid: "l1", title: "Отпуск", icon: "", color: "", status: "pending", dateFrom: "2026-10-01", dateTo: "2026-10-03" };
  const row = buildRow(input({
    dates: ["2026-10-01"],
    shiftsByDate: new Map([["2026-10-01", day({ start_time: "09:00", end_time: "18:00" })]]),
    attendanceByDate: mark({ action_status: ["absent"], source_type: ["integration"] }),
    leaves: [pending],
  }));
  assert.equal(row.cells[0].kind, "absent");
  assert.deepEqual(row.cells[0].pending, ["leave"]);
  assert.equal(row.totals.absences, 1);
  assert.equal(row.totals.planMinutes, 540);
}

// Одобренный Leave снимает день из нормы; в будущем тоже виден.
{
  const leave: SheetLeave = { guid: "l2", title: "Больничный", icon: "", color: "", status: "approved", dateFrom: "2026-10-06", dateTo: "2026-10-06" };
  const shifts = new Map([
    ["2026-10-06", day({ start_time: "09:00", end_time: "18:00" })],
    ["2026-10-07", day({ start_time: "09:00", end_time: "18:00" })],
  ]);
  const row = buildRow(input({ dates: ["2026-10-06", "2026-10-07"], shiftsByDate: shifts, leaves: [leave] }));
  assert.equal(row.cells[0].kind, "leave");
  assert.equal(row.cells[0].leave?.title, "Больничный");
  assert.equal(row.cells[1].kind, "future");
  assert.equal(row.totals.planMinutes, 540);
}

// Отметка вне радиуса до согласования: видна, не засчитана, точка «mark».
{
  const row = buildRow(input({
    dates: ["2026-10-01"],
    attendanceByDate: mark({ check_in_time: "09:00", check_out_time: "18:00", action_status: ["present"], source_type: ["integration"], status: ["requested"] }),
  }));
  assert.equal(row.cells[0].counted, false);
  assert.deepEqual(row.cells[0].pending, ["mark"]);
  assert.equal(row.totals.days, 0);
}

// Дни до приёма и после увольнения пусты и в норму не идут; без смены — «В».
{
  const shifts = new Map([["2026-10-01", day({ start_time: "09:00", end_time: "18:00" })]]);
  const row = buildRow(input({ dates: ["2026-10-01", "2026-10-02"], hireDate: "2026-10-02", shiftsByDate: shifts }));
  assert.equal(row.cells[0].kind, "outside");
  assert.equal(row.cells[1].kind, "day_off");
  assert.equal(row.totals.planMinutes, 0);
  const fired = buildRow(input({ dates: ["2026-10-01"], dismissalDate: "2026-09-30", shiftsByDate: shifts }));
  assert.equal(fired.cells[0].kind, "outside");
}

console.log("Attendance sheet self-check: ok");
