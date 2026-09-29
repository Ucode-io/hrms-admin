/**
 * Самопроверка пересчёта настенных часов (ADR-0014). Запуск:
 *   npx tsx src/utils/wallClock.selfCheck.ts
 */
import assert from "node:assert/strict";
import { dayShiftLabel, formatClock, isKnownTimeZone, nowInZone, rebaseClock, toViewerClock, utcOffsetLabel, wallToInstant, zoneOn } from "./wallClock";

const TASHKENT = "Asia/Tashkent";
const BAKU = "Asia/Baku";

// Бакинские 09:00 — это ташкентские 10:00, строка остаётся той же даты.
const nine = toViewerClock("2026-09-28", "09:00", BAKU, TASHKENT);
assert.equal(nine?.time, "10:00");
assert.equal(nine?.dayShift, 0);
assert.equal(nine?.diff, 60);

// 23:30 в Баку → 00:30 +1 в Ташкенте, а минуты выходят за сутки (таймлайн).
const late = toViewerClock("2026-09-28", "23:30", BAKU, TASHKENT);
assert.equal(late?.time, "00:30");
assert.equal(late?.dayShift, 1);
assert.equal(late?.minutes, 1470);
assert.equal(dayShiftLabel(late!.dayShift), "+1");

// Обратно: ташкентские 00:30 у бакинца — 23:30 −1.
const early = toViewerClock("2026-09-28", "00:30", TASHKENT, BAKU);
assert.equal(early?.time, "23:30");
assert.equal(dayShiftLabel(early!.dayShift), "−1");

// Разные имена с одним временем — не разница: серой строки нет.
assert.equal(toViewerClock("2026-09-28", "09:00", "Asia/Samarkand", TASHKENT)?.diff, 0);

// Сортировка по моменту: бакинские 10:00 (= ташкентские 11:00) идут после
// ташкентских 09:30.
assert.ok(
  toViewerClock("2026-09-28", "10:00", BAKU, TASHKENT)!.instant >
    toViewerClock("2026-09-28", "09:30", TASHKENT, TASHKENT)!.instant,
);

// Переход на летнее время: 09:00 в Берлине 29.03.2026 — это 07:00 UTC (CEST).
assert.equal(new Date(wallToInstant("2026-03-29", 9 * 60, "Europe/Berlin")).toISOString(), "2026-03-29T07:00:00.000Z");

assert.equal(utcOffsetLabel(BAKU, Date.UTC(2026, 8, 28)), "UTC+4");
assert.equal(utcOffsetLabel("Asia/Kolkata", Date.UTC(2026, 8, 28)), "UTC+5:30");
assert.equal(toViewerClock("2026-09-28", "", BAKU), null);

const zones = [
  { from: "2026-09-01", to: "2026-09-02", timezone: TASHKENT, regions_id: null, region_title: null },
  { from: "2026-09-03", to: "2026-09-30", timezone: BAKU, regions_id: "r", region_title: "Baku" },
];
assert.equal(zoneOn(zones, "2026-09-03")?.timezone, BAKU);
assert.equal(zoneOn(zones, "2026-10-01"), null);

// 20:30 UTC — в Баку ещё 28-е, в Ташкенте уже 29-е.
assert.deepEqual(nowInZone(BAKU, Date.UTC(2026, 8, 28, 19, 30)), { date: "2026-09-28", time: "23:30" });
assert.deepEqual(nowInZone(TASHKENT, Date.UTC(2026, 8, 28, 19, 30)), { date: "2026-09-29", time: "00:30" });

// Имя, которого нет в ICU браузера, — неизвестная зона, а не падение.
assert.equal(isKnownTimeZone("Factory"), false);
assert.equal(isKnownTimeZone(BAKU), true);

assert.equal(isKnownTimeZone("Etc/Unknown"), false);
assert.equal(isKnownTimeZone(""), false);

assert.equal(formatClock(late!), "00:30 +1");
assert.equal(formatClock(nine!), "10:00");

// Конец записи 00:40 29.09 по UTC+5 у бакинца — 23:40 того же вечера 28.09,
// строки табеля за 28.09: метки суток нет.
const end = toViewerClock("2026-09-29", "00:40", "Etc/GMT-5", BAKU)!;
assert.equal(formatClock(end), "23:40 −1");
assert.equal(formatClock(rebaseClock(end, "2026-09-29", "2026-09-28")), "23:40");
assert.equal(rebaseClock(end, "2026-09-29", "2026-09-28").minutes, 23 * 60 + 40);

console.log("wallClock selfCheck: ok");
