// Самопроверка сумм биллинга:
//
//   node --experimental-strip-types src/modules/Settings/Billing/format.check.ts
//
// Ломается на том, что попадает в печатный счёт: разряды, род тысяч, склонения.

import assert from "node:assert/strict";
import { formatDate, formatRate, groupDigits, uzsInWords } from "./format.ts";

const sp = (s: string) => s.replace(/ /g, " ");

assert.equal(sp(groupDigits(1558896)), "1 558 896");
assert.equal(sp(groupDigits(-141718)), "-141 718");
assert.equal(groupDigits(999), "999");
assert.equal(formatDate("2026-10-22"), "22.10.2026");
assert.equal(sp(formatRate(11809.82)), "11 809,82");

assert.equal(
  uzsInWords(1558896),
  "Один миллион пятьсот пятьдесят восемь тысяч восемьсот девяносто шесть сумов"
);
assert.equal(uzsInWords(0), "Ноль сумов");
assert.equal(uzsInWords(1), "Один сум");
assert.equal(uzsInWords(2), "Два сума");
assert.equal(uzsInWords(11), "Одиннадцать сумов");
assert.equal(uzsInWords(21001), "Двадцать одна тысяча один сум");
assert.equal(uzsInWords(2000000), "Два миллиона сумов");
assert.equal(uzsInWords(12_412_000), "Двенадцать миллионов четыреста двенадцать тысяч сумов");
assert.equal(uzsInWords(1_000_000_000), "Один миллиард сумов");

console.log("format.check: ok");
