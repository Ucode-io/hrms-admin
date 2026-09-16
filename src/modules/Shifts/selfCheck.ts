/**
 * Самопроверка выводимых величин смены.
 *
 * Проверять здесь стоит ровно одно: то, что раньше хранилось полем, а теперь
 * вычисляется. Пока `type` лежал в базе, ошибка в нём была видна глазом в
 * форме; теперь «ночная» и «удалённо» — результат кода, и сломаться они могут
 * молча, оставшись правдоподобными на вид.
 *
 * Фреймворка нет намеренно — в проекте его нет вообще. Запуск:
 *   npx tsx src/modules/Shifts/selfCheck.ts
 */

import assert from "node:assert/strict";
import {
  crossesMidnight,
  datesInRange,
  formatShiftTime,
  hasFixedTime,
  shiftKind,
  shiftMinutes,
  normalizeTime,
} from "./constants";
import type { Shift } from "../../api/services/shift.service";

const shift = (patch: Partial<Shift>): Shift =>
  ({
    guid: "x",
    companies_id: "c",
    date: "2026-04-20",
    user_base_id: "u",
    start_time: "09:00",
    end_time: "18:00",
    hours_per_day: null,
    positions_id: null,
    locations_id: null,
    project: null,
    comment: null,
    ...patch,
  }) as Shift;

// ── Вид смены ────────────────────────────────────────────────────────────
assert.equal(shiftKind(shift({})), "day");

// Переход через полночь — это и есть ночная смена.
assert.equal(shiftKind(shift({ start_time: "21:00", end_time: "06:00" })), "night");

// Удалёнка — признак места, а не времени.
assert.equal(
  shiftKind(shift({ locations_id_data: { title: "Удалённо" } })),
  "remote"
);

// Ночь старше удалёнки: дежурство из дома важнее прочесть как ночное —
// иначе фильтр «Ночные» потеряет ровно те смены, ради которых он заведён.
assert.equal(
  shiftKind(
    shift({ start_time: "22:00", end_time: "07:00", locations_id_data: { title: "Удалённо" } })
  ),
  "night"
);

// ── Длительность ─────────────────────────────────────────────────────────
assert.equal(shiftMinutes(shift({})), 9 * 60);
// 21:00 → 06:00 это девять часов, а не минус пятнадцать.
assert.equal(shiftMinutes(shift({ start_time: "21:00", end_time: "06:00" })), 9 * 60);
// Без времени длительности нет — ноль, а не NaN.
assert.equal(shiftMinutes(shift({ start_time: null, end_time: null })), 0);

assert.equal(crossesMidnight(shift({})), false);
assert.equal(crossesMidnight(shift({ start_time: "21:00", end_time: "06:00" })), true);

// ── Смена, заданная длительностью ────────────────────────────────────────
const byHours = shift({ start_time: null, end_time: null, hours_per_day: 8 });

// Длительность есть, места на сутках нет — на этом держится таймлайн.
assert.equal(shiftMinutes(byHours), 8 * 60);
assert.equal(hasFixedTime(byHours), false);
assert.equal(hasFixedTime(shift({})), true);
assert.equal(formatShiftTime(byHours), "8ч/день");

// Ночной такая смена быть не может: без времени сравнивать с полуночью нечего.
assert.equal(crossesMidnight(byHours), false);
assert.equal(shiftKind(byHours), "day");

// Часы не должны перебивать заданное время: если вдруг записались оба поля,
// правда — время суток, иначе смена молча перестала бы быть ночной.
assert.equal(shiftMinutes(shift({ start_time: "21:00", end_time: "06:00" })), 9 * 60);
assert.equal(formatShiftTime(shift({ hours_per_day: 8 })), "09:00–18:00");

// Мусор в поле — это «часов не задано», а не NaN в интерфейсе.
assert.equal(formatShiftTime(shift({ start_time: null, end_time: null, hours_per_day: 0 })), "");
assert.equal(shiftMinutes(shift({ start_time: null, end_time: null, hours_per_day: null })), 0);

// ── Время из ucode ───────────────────────────────────────────────────────
assert.equal(normalizeTime("09:00:00"), "09:00");
assert.equal(normalizeTime("9:5"), "");
assert.equal(normalizeTime(null), "");
assert.equal(normalizeTime("25:00"), "");

// ── Раскрытие диапазона ──────────────────────────────────────────────────
assert.deepEqual(datesInRange("2026-04-20", "2026-04-20"), ["2026-04-20"]);
assert.equal(datesInRange("2026-04-01", "2026-04-30").length, 30);
// Переход через месяц не теряет и не удваивает дни.
assert.deepEqual(datesInRange("2026-04-29", "2026-05-02"), [
  "2026-04-29",
  "2026-04-30",
  "2026-05-01",
  "2026-05-02",
]);
// Перевёрнутый диапазон не должен зацикливать форму.
assert.deepEqual(datesInRange("2026-04-10", "2026-04-01"), []);

console.log("Shifts self-check: ok");
