/**
 * Самопроверка выводимых величин смены и плана сохранения.
 *
 * Проверять здесь стоит ровно одно: то, что раньше хранилось полем, а теперь
 * вычисляется. Пока `type` лежал в базе, ошибка в нём была видна глазом в
 * форме; теперь «ночная» и «удалённо» — результат кода, и сломаться они могут
 * молча, оставшись правдоподобными на вид. Той же природы и `plan.ts`: набор
 * строк на запись зависит от шести осей сразу, и ошибка в нём выглядит не
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
  buildDeletePlan,
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
    series_id: null,
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
  date_from: "2026-04-20",
  date_to: "2026-04-20",
  start_time: "09:00",
  end_time: "18:00",
  hours_per_day: null,
  positions_id: null,
  locations_id: null,
  project: null,
  comment: null,
  ...patch,
});

/**
 * Период в `base` не задаётся отдельно: форма пишет в него ровно те границы,
 * которые сама и показывает. Разъехаться они могут только в тесте, и такой
 * тест проверял бы состояние, которого не бывает.
 *
 * `seriesId` по умолчанию совпадает с серией правимых строк: правка наследует
 * серию, а не минтит новую.
 */
const plan = (patch: Partial<PlanRequest>) => {
  const request: PlanRequest = {
    original: null,
    seriesId: "S",
    employeeIds: [],
    employeeMeta: {},
    headcount: 1,
    base: baseOf(),
    dateFrom: "2026-04-20",
    dateTo: "2026-04-20",
    weekdays: [],
    scope: "all",
    people: "all",
    conflicts: "skip",
    fillGaps: false,
    removal: "delete",
    existing: [],
    ...patch,
  };

  return buildSavePlan({
    ...request,
    base: { ...request.base, date_from: request.dateFrom, date_to: request.dateTo },
  });
};

const guids = (rows: { guid: string }[]) => rows.map((row) => row.guid);

/** Строка серии `S`. Серия опознаётся колонкой, а не совпадением полей. */
const row = (patch: Partial<Shift>): Shift => shift({ series_id: "S", ...patch });

/** Правимая смена вместе с периодом, которым её заводили. */
const seriesShift = (patch: Partial<Shift>): Shift =>
  row({ date_from: "2026-04-20", date_to: "2026-04-26", ...patch });

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
// Одно сохранение — одна серия: без этого пятеро разъедутся по пяти графикам.
assert.equal(
  twoPeople.creates.every((created) => created.series_id === "S"),
  true
);
// Филиал из карточки — только пока поле пустое; заполненное поле сильнее.
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
assert.deepEqual(guids(overwriting.updates), ["busy"]);
assert.equal(overwriting.skipped, 0);
// Перезапись переносит занятую строку в правимую серию: иначе поля говорят
// одно, `series_id` — другое.
assert.equal(overwriting.updates[0].series_id, "S");

const original = seriesShift({ guid: "orig", user_base_id: "a", date: "2026-04-20" });
const tuesday = row({ guid: "tue", user_base_id: "a", date: "2026-04-21" });
const editArgs = {
  original,
  employeeIds: ["a"],
  base: baseOf({ start_time: "10:00", end_time: "19:00" }),
  dateTo: "2026-04-26",
  existing: [original, tuesday],
};

// «Только этот день» игнорирует растянутый диапазон целиком.
const single = plan({ ...editArgs, scope: "single" as const });
assert.deepEqual(guids(single.updates), ["orig"]);
assert.equal(single.updates[0].start_time, "10:00");
assert.equal(single.creates.length, 0);

// Ряд уезжает целиком, а не патчем: апсерт перезаписывает строку полностью,
// поэтому поля, которых правка не касалась, обязаны доехать прежними.
assert.equal(single.updates[0].date, "2026-04-20");
assert.equal(single.updates[0].user_base_id, "a");

// «Полный период»: соседи по серии получают дифф.
const wholePeriod = plan(editArgs);
assert.deepEqual(guids(wholePeriod.updates), ["orig", "tue"]);
// Дата и исполнитель не разливаются: иначе серия схлопнулась бы в один день.
assert.equal(wholePeriod.updates[1].date, "2026-04-21");
assert.equal(wholePeriod.updates[1].user_base_id, "a");
assert.equal(wholePeriod.updates[1].start_time, "10:00");

// Дыры правка не заполняет: у «a» в серии уже есть строки, и пустые дни —
// записанное решение, а не отсутствие данных.
assert.equal(wholePeriod.creates.length, 0);
assert.equal(wholePeriod.gaps.length, 5);
// Заполнить можно — но только попросив.
assert.equal(plan({ ...editArgs, fillGaps: true }).creates.length, 5);

// «Следующие дни»: то, что левее правимой смены, остаётся нетронутым.
const wednesday = seriesShift({
  guid: "wed",
  user_base_id: "a",
  date: "2026-04-22",
  date_to: "2026-04-24",
});
const following = plan({
  ...editArgs,
  original: wednesday,
  scope: "following" as const,
  dateTo: "2026-04-24",
  existing: [original, tuesday, wednesday],
});
assert.deepEqual(guids(following.updates), ["wed"]);
assert.equal(following.gaps.length, 2);

// Растянули, ничего не меняя, — пустых записей не шлём: серия уже своя.
const twoDay = seriesShift({
  guid: "orig",
  user_base_id: "a",
  date: "2026-04-20",
  date_to: "2026-04-22",
});
const cloned = plan({
  original: twoDay,
  employeeIds: ["a"],
  dateTo: "2026-04-22",
  existing: [twoDay],
});
assert.equal(cloned.updates.length, 0);
assert.equal(cloned.gaps.length, 2);
assert.equal(plan({ original: twoDay, employeeIds: ["a"], dateTo: "2026-04-22", existing: [twoDay], fillGaps: true }).creates.length, 2);

// Схлопнутый диапазон в правке — перенос смены, а не новая серия. Период
// переезжает вместе с ней: у однодневной смены он и есть её день.
const oneDay = seriesShift({
  guid: "orig",
  user_base_id: "a",
  date: "2026-04-20",
  date_to: "2026-04-20",
});
const moved = plan({
  original: oneDay,
  employeeIds: ["a"],
  dateFrom: "2026-04-25",
  dateTo: "2026-04-25",
  existing: [oneDay],
});
assert.deepEqual(guids(moved.updates), ["orig"]);
assert.equal(moved.updates[0].date, "2026-04-25");
assert.equal(moved.updates[0].date_from, "2026-04-25");
assert.equal(moved.updates[0].date_to, "2026-04-25");
assert.equal(moved.creates.length, 0);

// Убрали человека из списка — его дни снимаются, а не достаются соседу.
const unassigned = plan({ original: oneDay, employeeIds: [], existing: [oneDay] });
assert.deepEqual(unassigned.deletes, ["orig"]);
assert.equal(unassigned.updates.length, 0);
assert.equal(unassigned.creates.length, 0);

// «Оставить»: дни остаются, строка выходит из графика. Отличить её от
// заведённой до серий после этого нельзя — цена принята.
const detached = plan({
  original: oneDay,
  employeeIds: [],
  removal: "detach" as const,
  existing: [oneDay],
});
assert.deepEqual(detached.deletes, []);
assert.equal(detached.updates[0].series_id, null);
assert.equal(detached.updates[0].date, "2026-04-20");

// Замена исполнителя — это снятие плюс назначение, а не переклейка строки:
// молча отдать день Иванова Петрову нельзя.
const swapArgs = {
  original: seriesShift({
    guid: "orig",
    user_base_id: "a",
    date: "2026-04-20",
    date_to: "2026-04-21",
  }),
  employeeIds: ["b"],
  employeeMeta: { b: { positionId: "qa", locationId: null } },
  dateTo: "2026-04-21",
  existing: [original, tuesday],
};
const swapped = plan(swapArgs);
assert.deepEqual(swapped.deletes, ["orig", "tue"]);
assert.deepEqual(
  swapped.creates.map((created) => `${created.user_base_id}|${created.date}`),
  ["b|2026-04-20", "b|2026-04-21"]
);

// Открытый слот — другое дело: там назначение и есть смысл жеста, строка
// закрывается человеком, а не заводится заново.
const openSlot = seriesShift({ guid: "slot", user_base_id: null, date: "2026-04-20", date_to: "2026-04-20" });
const assigned = plan({ original: openSlot, employeeIds: ["b"], existing: [openSlot] });
assert.deepEqual(guids(assigned.updates), ["slot"]);
assert.equal(assigned.updates[0].user_base_id, "b");
assert.deepEqual(assigned.deletes, []);

// Слот в смешанной серии: в списке стоят все её участники, и закрывает слот
// первый свободный, а не первый по порядку — иначе клик по открытой смене
// молча упёрся бы в `shift_employee_date_uniq`.
const mixedBusy = row({ guid: "busy-a", user_base_id: "a", date: "2026-04-20" });
const mixed = plan({
  original: openSlot,
  employeeIds: ["a", "b"],
  existing: [openSlot, mixedBusy],
});
assert.equal(
  mixed.updates.find((updated) => updated.guid === "slot")?.user_base_id,
  "b"
);
// Свободных нет — слот остаётся открытым, а не отбирает чужой день.
const stillOpen = plan({
  original: openSlot,
  employeeIds: ["a"],
  existing: [openSlot, mixedBusy],
});
assert.equal(
  stillOpen.updates.find((updated) => updated.guid === "slot")?.user_base_id ?? null,
  null
);

// Добавили напарника: у нового в серии ноль строк, и смены ему создаются —
// на весь период. У старого дыры остаются дырами.
const withPartner = plan({
  original: twoDay,
  employeeIds: ["a", "b"],
  employeeMeta: { b: { positionId: "qa", locationId: null } },
  dateTo: "2026-04-22",
  existing: [twoDay],
});
assert.deepEqual(
  withPartner.creates.map((created) => `${created.user_base_id}|${created.date}`),
  ["b|2026-04-20", "b|2026-04-21", "b|2026-04-22"]
);
assert.equal(withPartner.gaps.length, 2);

// ── Ось людей ────────────────────────────────────────────────────────────
// Серия на двоих: правка «всем» и «только этому» — разные намерения, и одной
// осью дат они не выражаются.
const teamMonday = seriesShift({
  guid: "a1",
  user_base_id: "a",
  date: "2026-04-20",
  date_to: "2026-04-21",
});
const team = [
  teamMonday,
  row({ guid: "a2", user_base_id: "a", date: "2026-04-21" }),
  row({ guid: "b1", user_base_id: "b", date: "2026-04-20" }),
  row({ guid: "b2", user_base_id: "b", date: "2026-04-21" }),
];
const teamArgs = {
  original: teamMonday,
  employeeIds: ["a", "b"],
  base: baseOf({ start_time: "10:00", end_time: "19:00" }),
  dateTo: "2026-04-21",
  existing: team,
};

assert.deepEqual(guids(plan(teamArgs).updates).sort(), ["a1", "a2", "b1", "b2"]);
// «Только этому»: дорожка правимой строки, соседи по серии не шелохнулись.
assert.deepEqual(
  guids(plan({ ...teamArgs, people: "single" as const }).updates).sort(),
  ["a1", "a2"]
);
// Добавленные в мультиселект под «только этому» игнорируются: «добавить
// человека только этому человеку» смысла не имеет.
assert.equal(
  plan({ ...teamArgs, employeeIds: ["a", "b", "c"], people: "single" as const }).creates.length,
  0
);
// Убрали «b» под «только этому» — снимать некого: дорожка чужая.
assert.deepEqual(plan({ ...teamArgs, employeeIds: ["a"], people: "single" as const }).deletes, []);
// Под «всем» — снимаются оба его дня.
assert.deepEqual(plan({ ...teamArgs, employeeIds: ["a"] }).deletes, ["b1", "b2"]);

// ── Удаление: те же две оси ──────────────────────────────────────────────
const deleteArgs = {
  original: teamMonday,
  existing: team,
  dateFrom: "2026-04-20",
  dateTo: "2026-04-21",
  weekdays: [] as number[],
};
// Дефолт — одна строка: кнопка не должна сносить больше, чем показано.
assert.deepEqual(
  buildDeletePlan({ ...deleteArgs, scope: "single", people: "single" }),
  ["a1"]
);
assert.deepEqual(
  buildDeletePlan({ ...deleteArgs, scope: "all", people: "single" }).sort(),
  ["a1", "a2"]
);
assert.deepEqual(
  buildDeletePlan({ ...deleteArgs, scope: "all", people: "all" }).sort(),
  ["a1", "a2", "b1", "b2"]
);

// ── Строки, заведённые до серий ──────────────────────────────────────────
// Соседей задним числом серия не усыновляет: правило «тот же человек»
// затянуло бы одного, оставив снаружи остальных.
const legacy = shift({
  guid: "old",
  user_base_id: "a",
  date: "2026-04-20",
  date_from: "2026-04-20",
  date_to: "2026-04-22",
  series_id: null,
});
const legacyNeighbour = shift({
  guid: "old2",
  user_base_id: "a",
  date: "2026-04-21",
  series_id: null,
});
const adopted = plan({
  original: legacy,
  seriesId: "NEW",
  employeeIds: ["a"],
  base: baseOf({ start_time: "10:00" }),
  dateTo: "2026-04-22",
  existing: [legacy, legacyNeighbour],
});
assert.deepEqual(guids(adopted.updates), ["old"]);
assert.equal(adopted.updates[0].series_id, "NEW");
// Сосед в серию не попал и потому читается как занятый день, а не как её часть.
assert.deepEqual(adopted.conflicts, [{ date: "2026-04-21", userBaseId: "a" }]);

// Серию правимая строка получает даже без единой правки полей: иначе она
// осталась бы вне графика, который сама же и открыла.
const justAdopted = plan({
  original: legacy,
  seriesId: "NEW",
  employeeIds: ["a"],
  dateTo: "2026-04-22",
  existing: [legacy],
});
assert.deepEqual(guids(justAdopted.updates), ["old"]);
assert.equal(justAdopted.updates[0].series_id, "NEW");

// Период уезжает в каждую строку одинаковым: по нему форма потом покажет,
// каким график заводили.
const monthly = plan({
  employeeIds: ["a"],
  dateFrom: "2026-04-01",
  dateTo: "2026-04-03",
});
assert.deepEqual(
  monthly.creates.map((created) => [created.date, created.date_from, created.date_to]),
  [
    ["2026-04-01", "2026-04-01", "2026-04-03"],
    ["2026-04-02", "2026-04-01", "2026-04-03"],
    ["2026-04-03", "2026-04-01", "2026-04-03"],
  ]
);

// Сдвинули границу периода — она разливается на всю серию: иначе одна серия,
// открытая с разных дней, показывала бы разные периоды.
const shortOriginal = seriesShift({
  guid: "orig2",
  user_base_id: "a",
  date: "2026-04-20",
  date_to: "2026-04-21",
});
const seriesRow = row({ guid: "tue2", user_base_id: "a", date: "2026-04-21" });
const stretched = plan({
  original: shortOriginal,
  employeeIds: ["a"],
  dateTo: "2026-04-22",
  existing: [shortOriginal, seriesRow],
});
assert.equal(stretched.updates[1].date_to, "2026-04-22");
// Сам день строки при этом неприкосновенен.
assert.equal(stretched.updates[1].date, "2026-04-21");

// Правило «кто работает в правимой строке» одно на форму и на план — форма
// по нему же проверяет, не занята ли новая клетка.
assert.equal(resolveAssignee(original, ["a"]), "a");
assert.equal(resolveAssignee(original, ["b", "a"]), "a");
// Исходного убрали — строка не достаётся первому из списка: это снятие.
assert.equal(resolveAssignee(original, ["b"]), null);
assert.equal(resolveAssignee(original, []), null);
assert.equal(resolveAssignee(null, ["b"]), null);
// У открытого слота назначение и есть смысл жеста.
assert.equal(resolveAssignee(openSlot, ["b"]), "b");
// Схлопнутый диапазон переносит смену, растянутый оставляет её на месте.
assert.equal(resolveEditedDate(original, "2026-04-25", "2026-04-25"), "2026-04-25");
assert.equal(resolveEditedDate(original, "2026-04-18", "2026-04-25"), "2026-04-20");

// Серия открытой смены узнаётся колонкой, а не совпадением должности: чужой
// слот с той же должностью остаётся чужим.
const openMonday = seriesShift({
  guid: "open1",
  user_base_id: null,
  date: "2026-04-20",
  date_to: "2026-04-22",
  positions_id: "dev",
});
const openTuesday = row({
  guid: "open2",
  user_base_id: null,
  date: "2026-04-21",
  positions_id: "dev",
});
const openOther = shift({
  guid: "open3",
  user_base_id: null,
  date: "2026-04-21",
  positions_id: "dev",
  series_id: null,
});
const openSeries = plan({
  original: openMonday,
  base: baseOf({ start_time: "10:00", end_time: "19:00", positions_id: "dev" }),
  dateTo: "2026-04-22",
  existing: [openMonday, openTuesday, openOther],
});
assert.deepEqual(guids(openSeries.updates), ["open1", "open2"]);
// Дыра в открытой серии — тоже дыра: чинится тем же условием, что у именной.
assert.equal(openSeries.creates.length, 0);
assert.equal(openSeries.gaps.length, 1);

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
