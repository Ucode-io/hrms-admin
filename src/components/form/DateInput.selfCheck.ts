/**
 * Самопроверка разбора набранной даты.
 *
 * Поле принимает одну и ту же дату несколькими записями («21.09.2026»,
 * «21092026», «21/09/26»), и ошибка тут не выглядит поломкой: «31.02»
 * молча уехала бы на 3 марта, а гарантия — на месяц вперёд. Проверяем
 * именно разбор и показ, остальное в компоненте это разметка.
 *
 * Фреймворка нет намеренно — в проекте его нет вообще. Запуск:
 *   npx tsx src/components/form/DateInput.selfCheck.ts
 */

import assert from "node:assert/strict";
import { normalizeDateInput, formatDateValue } from "./DateInput";

// Разделитель любой или его нет вовсе.
assert.equal(normalizeDateInput("21.09.2026"), "2026-09-21");
assert.equal(normalizeDateInput("21092026"), "2026-09-21");
assert.equal(normalizeDateInput("21/09/2026"), "2026-09-21");
assert.equal(normalizeDateInput(" 21-09-2026 "), "2026-09-21");
assert.equal(normalizeDateInput("01.01.2000"), "2000-01-01");

// Двузначный год — текущий век.
assert.equal(normalizeDateInput("21.09.26"), "2026-09-21");
assert.equal(normalizeDateInput("210926"), "2026-09-21");

// Несуществующих дат нет: `Date` их молча переносит вперёд, поле — не должно.
assert.equal(normalizeDateInput("31.02.2026"), "");
assert.equal(normalizeDateInput("29.02.2025"), "");
assert.equal(normalizeDateInput("32.01.2026"), "");
assert.equal(normalizeDateInput("21.13.2026"), "");
assert.equal(normalizeDateInput("00.09.2026"), "");

// Високосный год существует — и его нельзя отбросить заодно с «31.02».
assert.equal(normalizeDateInput("29.02.2024"), "2024-02-29");

// Мусор и недобранное — это «не дата», поле откатится к прежнему значению.
assert.equal(normalizeDateInput(""), "");
assert.equal(normalizeDateInput("2109"), "");
assert.equal(normalizeDateInput("2109202"), "");
assert.equal(normalizeDateInput("—"), "");

// Показ: ISO со склада → то, что видит человек, и ничего кроме ISO.
assert.equal(formatDateValue("2026-09-21"), "21.09.2026");
assert.equal(formatDateValue(""), "");
assert.equal(formatDateValue("2026-09-21T00:00:00Z"), "");

// Туда и обратно: набранное показывается ровно как набранное.
assert.equal(formatDateValue(normalizeDateInput("21092026")), "21.09.2026");

console.log("DateInput self-check: ok");
