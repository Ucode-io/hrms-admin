/**
 * Самопроверка выводимых величин смены и плана сохранения.
 *
 * Проверять здесь стоит ровно одно: то, что раньше хранилось полем, а теперь
 * вычисляется. Пока `type` лежал в базе, ошибка в нём была видна глазом в
 * форме; теперь «ночная» и «удалённо» — результат кода, и сломаться они могут
 * молча, оставшись правдоподобными на вид. Той же природы и `plan.ts`: набор
 * строк на запись зависит от четырёх осей сразу, и ошибка в нём выглядит не
 * как поломка, а как «почему-то поменялось больше, чем я хотел».
 *
 * Фреймворка нет намеренно — в проекте его нет вообще. Запуск:
 *   npx tsx src/modules/Shifts/selfCheck.ts
 */

import assert from "node:assert/strict";
import {
  crossesMidnight,
  datesInRange,
  formatShiftTime,
  fromIsoDate,
  hasFixedTime,
  shiftKind,
  shiftMinutes,
  normalizeTime,
} from "./constants";
import {
  buildSavePlan,
  resolveAssignee,
  resolveEditedDate,
  type PlanRequest,
  type ShiftBase,
} from "./plan";
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

// ── План сохранения ──────────────────────────────────────────────────────
const baseOf = (patch: Partial<ShiftBase> = {}): ShiftBase => ({
  start_time: "09:00",
  end_time: "18:00",
  hours_per_day: null,
  positions_id: null,
  locations_id: null,
  project: null,
  comment: null,
  ...patch,
});

const plan = (patch: Partial<PlanRequest>) =>
  buildSavePlan({
    original: null,
    employeeIds: [],
    employeeMeta: {},
    headcount: 1,
    base: baseOf(),
    dateFrom: "2026-04-20",
    dateTo: "2026-04-20",
    weekdays: [],
    scope: "all",
    conflicts: "skip",
    existing: [],
    ...patch,
  });

// Мультиселект: строка на человека и дату, должность — своя у каждого.
const twoPeople = plan({
  employeeIds: ["a", "b"],
  employeeMeta: {
    a: { positionId: "dev", locationId: null },
    b: { positionId: "qa", locationId: "office" },
  },
  dateTo: "2026-04-22",
});
assert.equal(twoPeople.creates.length, 6);
assert.equal(twoPeople.creates[0].positions_id, "dev");
assert.equal(twoPeople.creates[1].positions_id, "qa");
// Локация из карточки — только пока поле пустое; заполненное поле сильнее.
assert.equal(twoPeople.creates[1].locations_id, "office");
assert.equal(
  plan({
    employeeIds: ["b"],
    employeeMeta: { b: { positionId: "qa", locationId: "office" } },
    base: baseOf({ locations_id: "warehouse" }),
  }).creates[0].locations_id,
  "warehouse"
);

// Открытая смена: количество — это число строк, а не поле в записи.
const openSlots = plan({ headcount: 3, dateTo: "2026-04-21" });
assert.equal(openSlots.creates.length, 6);
assert.equal(openSlots.creates[0].user_base_id, null);

// Занятый день не создаёт вторую смену — иначе уникальный индекс отклонит.
const busyDay = shift({ guid: "busy", user_base_id: "a", date: "2026-04-21" });
const conflictArgs = {
  employeeIds: ["a"],
  dateTo: "2026-04-22",
  existing: [busyDay],
};
const skipping = plan(conflictArgs);
assert.equal(skipping.creates.length, 2);
assert.equal(skipping.conflicts.length, 1);
assert.equal(skipping.skipped, 1);

const overwriting = plan({ ...conflictArgs, conflicts: "overwrite" as const });
assert.equal(overwriting.creates.length, 2);
assert.deepEqual(
  overwriting.updates.map((item) => item.guid),
  ["busy"]
);
assert.equal(overwriting.skipped, 0);

const original = shift({ guid: "orig", user_base_id: "a", date: "2026-04-20" });
const tuesday = shift({ guid: "tue", user_base_id: "a", date: "2026-04-21" });
const editArgs = {
  original,
  employeeIds: ["a"],
  base: baseOf({ start_time: "10:00", end_time: "19:00" }),
  dateTo: "2026-04-26",
  existing: [original, tuesday],
};

// «Только этот день» игнорирует растянутый диапазон целиком.
const single = plan({ ...editArgs, scope: "single" as const });
assert.deepEqual(single.updates, [
  { guid: "orig", patch: { start_time: "10:00", end_time: "19:00" } },
]);
assert.equal(single.creates.length, 0);

// «Полный период»: соседи получают дифф, пустые дни — новые смены.
const wholePeriod = plan(editArgs);
assert.deepEqual(
  wholePeriod.updates.map((item) => item.guid),
  ["orig", "tue"]
);
assert.equal(wholePeriod.creates.length, 5);
// Дата и исполнитель не разливаются: иначе серия схлопнулась бы в один день.
assert.equal("date" in wholePeriod.updates[1].patch, false);
assert.equal("user_base_id" in wholePeriod.updates[1].patch, false);

// «Следующие дни»: то, что левее правимой смены, остаётся нетронутым.
const wednesday = shift({ guid: "wed", user_base_id: "a", date: "2026-04-22" });
const following = plan({
  ...editArgs,
  original: wednesday,
  scope: "following" as const,
  dateTo: "2026-04-24",
  existing: [original, tuesday, wednesday],
});
assert.deepEqual(
  following.updates.map((item) => item.guid),
  ["wed"]
);
assert.equal(following.creates.length, 2);

// Растянули, ничего не меняя — это «размножить смену»: пустых PUT не шлём.
const cloned = plan({
  original,
  employeeIds: ["a"],
  dateTo: "2026-04-22",
  existing: [original],
});
assert.equal(cloned.updates.length, 0);
assert.equal(cloned.creates.length, 2);

// Схлопнутый диапазон в правке — перенос смены, а не новая серия.
const moved = plan({
  original,
  employeeIds: ["a"],
  dateFrom: "2026-04-25",
  dateTo: "2026-04-25",
  existing: [original],
});
assert.deepEqual(moved.updates, [{ guid: "orig", patch: { date: "2026-04-25" } }]);
assert.equal(moved.creates.length, 0);

// Убрали человека из списка — смена открывается, а не удаляется.
const unassigned = plan({ original, employeeIds: [], existing: [original] });
assert.deepEqual(unassigned.updates, [{ guid: "orig", patch: { user_base_id: null } }]);
assert.equal(unassigned.creates.length, 0);

// Замена исполнителя бьёт одну строку: сосед по серии остаётся за прежним.
const swapped = plan({
  original,
  employeeIds: ["b"],
  employeeMeta: { b: { positionId: "qa", locationId: null } },
  base: baseOf({ comment: "перенос" }),
  dateTo: "2026-04-21",
  existing: [original, tuesday],
});
assert.equal(swapped.updates[0].patch.user_base_id, "b");
assert.equal("user_base_id" in swapped.updates[1].patch, false);

// Добавили напарника в правке: он получает смены на весь выбранный период, а
// правимый день остаётся за своим исполнителем — второй смены ему не заводим.
const withPartner = plan({
  original,
  employeeIds: ["a", "b"],
  employeeMeta: { b: { positionId: "qa", locationId: null } },
  dateTo: "2026-04-22",
  existing: [original],
});
assert.deepEqual(
  withPartner.creates.map((row) => `${row.user_base_id}|${row.date}`),
  ["b|2026-04-20", "a|2026-04-21", "b|2026-04-21", "a|2026-04-22", "b|2026-04-22"]
);

// Правило «кто работает в правимой строке» одно на форму и на план — форма
// по нему же проверяет, не занята ли новая клетка.
assert.equal(resolveAssignee(original, ["a"]), "a");
assert.equal(resolveAssignee(original, ["b", "a"]), "a");
assert.equal(resolveAssignee(original, ["b"]), "b");
assert.equal(resolveAssignee(original, []), null);
assert.equal(resolveAssignee(null, ["b"]), null);
// Схлопнутый диапазон переносит смену, растянутый оставляет её на месте.
assert.equal(resolveEditedDate(original, "2026-04-25", "2026-04-25"), "2026-04-25");
assert.equal(resolveEditedDate(original, "2026-04-18", "2026-04-25"), "2026-04-20");

// Серия открытой смены узнаётся по должности — чужой слот не трогаем.
const openMonday = shift({ guid: "open1", user_base_id: null, date: "2026-04-20", positions_id: "dev" });
const openTuesday = shift({ guid: "open2", user_base_id: null, date: "2026-04-21", positions_id: "dev" });
const openOther = shift({ guid: "open3", user_base_id: null, date: "2026-04-21", positions_id: "qa" });
const openSeries = plan({
  original: openMonday,
  base: baseOf({ start_time: "10:00", end_time: "19:00", positions_id: "dev" }),
  dateTo: "2026-04-22",
  existing: [openMonday, openTuesday, openOther],
});
assert.deepEqual(
  openSeries.updates.map((item) => item.guid),
  ["open1", "open2"]
);
assert.equal(openSeries.creates.length, 1);

// Чипы дней недели сужают набор и в правке тоже.
const weekdaysOnly = plan({
  original,
  employeeIds: ["a"],
  base: baseOf({ comment: "по будням" }),
  dateTo: "2026-04-26",
  weekdays: [1, 2, 3, 4, 5],
  existing: [original, tuesday],
});
assert.equal(
  weekdaysOnly.dates.every((iso) => ![0, 6].includes(fromIsoDate(iso).getDay())),
  true
);

console.log("Shifts self-check: ok");
