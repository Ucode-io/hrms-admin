/**
 * Самопроверка перевода табеля между его UTC+5 и часами сотрудника (ADR-0014).
 *   npx tsx src/modules/Timesheet/selfCheck.ts
 */
import assert from "node:assert/strict";
import { employeeToSource, entryEndDate, sourceToEmployee } from "./constants";

// Табель показывает 10:00 по UTC+5 — у бакинца это 09:00.
assert.deepEqual(sourceToEmployee("2026-09-28", "10:00", "Asia/Baku"), { date: "2026-09-28", time: "09:00" });
// 00:30 по UTC+5 у бакинца — ещё вчера.
assert.deepEqual(sourceToEmployee("2026-09-28", "00:30", "Asia/Baku"), { date: "2026-09-27", time: "23:30" });
// Пояс неизвестен — как есть.
assert.equal(sourceToEmployee("2026-09-28", "10:00", null).time, "10:00");

// Бакинские 09:00–18:00 уходят в reports как 10:00–19:00.
assert.deepEqual(employeeToSource("2026-09-28", "09:00", "18:00", "Asia/Baku"), { work_date: "2026-09-28", start_time: "10:00", end_time: "19:00" });
// Бакинские 23:10–23:40 — это 00:10–00:40 следующего дня табеля.
assert.deepEqual(employeeToSource("2026-09-28", "23:10", "23:40", "Asia/Baku"), { work_date: "2026-09-29", start_time: "00:10", end_time: "00:40" });
// Бакинские 22:30–23:30 рвутся полночью табеля — такое reports не примет.
assert.equal(employeeToSource("2026-09-28", "22:30", "23:30", "Asia/Baku"), null);

// Конец ровно в полночь табеля — 23:59 того же дня табеля: бакинские
// 18:00–23:00 и 22:00–23:00 теперь сохраняются.
assert.deepEqual(employeeToSource("2026-09-28", "18:00", "23:00", "Asia/Baku"), { work_date: "2026-09-28", start_time: "19:00", end_time: "23:59" });
assert.deepEqual(employeeToSource("2026-09-28", "22:00", "23:00", "Asia/Baku"), { work_date: "2026-09-28", start_time: "23:00", end_time: "23:59" });
// Шанхай (UTC+8): 02:00–03:00 — это 23:00–00:00 предыдущего дня табеля.
assert.deepEqual(employeeToSource("2026-09-28", "02:00", "03:00", "Asia/Shanghai"), { work_date: "2026-09-27", start_time: "23:00", end_time: "23:59" });
// Минута до полуночи табеля в пустой интервал не превращается.
assert.equal(employeeToSource("2026-09-28", "22:59", "23:00", "Asia/Baku"), null);
// Точка (начало = конец) переводится: по ней DayPage ставит черновик среди записей.
assert.deepEqual(employeeToSource("2026-09-28", "09:00", "09:00", "Asia/Baku"), { work_date: "2026-09-28", start_time: "10:00", end_time: "10:00" });
// Пояс неизвестен — как есть, по часам табеля.
assert.deepEqual(employeeToSource("2026-09-28", "09:00", "18:00", null), { work_date: "2026-09-28", start_time: "09:00", end_time: "18:00" });

// Конец Time Doctor за полночь пересчитывается на свою дату (rebaseClock —
// в wallClock.selfCheck).
assert.equal(entryEndDate({ date: "2026-09-28", end: "2026-09-29T00:40:00" }), "2026-09-29");
assert.equal(entryEndDate({ date: "2026-09-28", end: null }), "2026-09-28");

console.log("Timesheet selfCheck: ok");
