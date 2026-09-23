// Форматирование сумм биллинга. Без импортов, чтобы format.check.ts шёл голым node.

const NBSP = " ";

/** 1558896 → «1 558 896» (неразрывные пробелы по три разряда). */
export const groupDigits = (value: number): string =>
  Math.trunc(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);

export const formatUzs = (value: number): string => `${groupDigits(value)}${NBSP}сум`;

export const formatUsd = (value: number): string => `$${value.toFixed(2)}`;

/** «2026-10-22» → «22.10.2026». Дата уже ташкентская, Date не нужен. */
export const formatDate = (value: string | null | undefined): string => {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  return d && m && y ? `${d}.${m}.${y}` : value;
};

const ONES_M = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const ONES_F = ["", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const TEENS = [
  "десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать",
  "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать",
];
const TENS = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
const HUNDREDS = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

/** Форма слова по числу: [1, 2–4, 5–20]. */
const plural = (n: number, forms: [string, string, string]): string => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
};

const triadWords = (n: number, feminine: boolean): string[] => {
  const words = [HUNDREDS[Math.floor(n / 100)]];
  const rest = n % 100;
  if (rest >= 10 && rest < 20) words.push(TEENS[rest - 10]);
  else words.push(TENS[Math.floor(rest / 10)], (feminine ? ONES_F : ONES_M)[rest % 10]);
  return words.filter(Boolean);
};

const SCALES: { forms: [string, string, string]; feminine: boolean }[] = [
  { forms: ["", "", ""], feminine: false },
  { forms: ["тысяча", "тысячи", "тысяч"], feminine: true },
  { forms: ["миллион", "миллиона", "миллионов"], feminine: false },
  { forms: ["миллиард", "миллиарда", "миллиардов"], feminine: false },
];

/**
 * Сумма прописью для печатного счёта: 1558896 → «Один миллион пятьсот пятьдесят
 * восемь тысяч восемьсот девяносто шесть сумов». Суммы в сумах целые.
 * ponytail: до 999 миллиардов — счёт больше не выставляется.
 */
export const uzsInWords = (value: number): string => {
  const total = Math.trunc(Math.abs(value));
  const words: string[] = [];
  let rest = total;
  for (let scale = 0; rest > 0 && scale < SCALES.length; scale += 1) {
    const triad = rest % 1000;
    if (triad > 0) {
      const { forms, feminine } = SCALES[scale];
      const unit = scale > 0 ? [plural(triad, forms)] : [];
      words.unshift(...triadWords(triad, feminine), ...unit);
    }
    rest = Math.floor(rest / 1000);
  }
  const text = [total === 0 ? "ноль" : words.join(" "), plural(total, ["сум", "сума", "сумов"])].join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** Курс с копейками: 11809.82 → «11 809,82». */
export const formatRate = (value: number): string => {
  const [int, frac] = value.toFixed(2).split(".");
  return `${groupDigits(Number(int))},${frac}`;
};
