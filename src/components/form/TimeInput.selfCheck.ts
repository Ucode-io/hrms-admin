/**
 * Самопроверка разбора набранного времени.
 *
 * Поле принимает три записи одного и того же («9», «930», «9:30»), и ошибка
 * тут не выглядит поломкой: «25:00» молча запишется в смену и всплывёт
 * месяцем позже в табеле. Проверяем именно разбор — остальное в компоненте
 * это разметка.
 *
 * Фреймворка нет намеренно — в проекте его нет вообще. Запуск:
 *   npx tsx src/components/form/TimeInput.selfCheck.ts
 */

import assert from "node:assert/strict";
import { normalizeTimeInput } from "./TimeInput";

// Одни часы — это начало часа, а не «девять минут».
assert.equal(normalizeTimeInput("9"), "09:00");
assert.equal(normalizeTimeInput("09"), "09:00");
assert.equal(normalizeTimeInput("18"), "18:00");

// Без двоеточия набирают чаще, чем с ним: последние две цифры — минуты.
assert.equal(normalizeTimeInput("930"), "09:30");
assert.equal(normalizeTimeInput("1830"), "18:30");
assert.equal(normalizeTimeInput("0000"), "00:00");

// С двоеточием и с любым другим разделителем.
assert.equal(normalizeTimeInput("9:30"), "09:30");
assert.equal(normalizeTimeInput("18:05"), "18:05");
assert.equal(normalizeTimeInput("18.05"), "18:05");
assert.equal(normalizeTimeInput(" 18:05 "), "18:05");

// Полночь в конце — не 24:00: такого времени суток не существует, а смена
// «до 24:00» должна записаться как переход через полночь, то есть 00:00.
assert.equal(normalizeTimeInput("24:00"), "");
assert.equal(normalizeTimeInput("2500"), "");
assert.equal(normalizeTimeInput("1870"), "");

// Мусор — это «не время», а не половина времени: поле откатится к прежнему.
assert.equal(normalizeTimeInput(""), "");
assert.equal(normalizeTimeInput("—"), "");
assert.equal(normalizeTimeInput("123456"), "");

console.log("TimeInput self-check: ok");
