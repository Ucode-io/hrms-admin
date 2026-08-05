// Раскладка и счёт бюджета.
//
// Ширины ячеек — в одном месте: шапка и строки рисуются разными компонентами,
// и разъехавшиеся колонки ломают всю таблицу.

import type {
  BudgetDepartment,
  BudgetMonth,
  BudgetPosition,
  BudgetRow,
  BudgetRowStatus,
} from "./types";

/**
 * Какие колонки месяца показаны. По умолчанию виден только план: в бюджете его
 * заполняют и перечитывают, а факт и отклонения смотрят по закрытым месяцам —
 * ради них не стоит держать таблицу вчетверо шире.
 */
export type VisibleColumns = {
  fact: boolean;
  diff: boolean;
  percent: boolean;
};

export const DEFAULT_COLUMNS: VisibleColumns = { fact: false, diff: false, percent: false };

/**
 * Выбор колонок переживает перезагрузку: это настройка рабочего места, а не
 * состояние экрана. Тот, кто сверяет план с фактом, включает их один раз и
 * ждёт увидеть ту же таблицу завтра.
 */
const COLUMNS_STORAGE_KEY = "budgeting.columns.v1";

export const readStoredColumns = (): VisibleColumns => {
  try {
    const raw = localStorage.getItem(COLUMNS_STORAGE_KEY);
    if (!raw) return DEFAULT_COLUMNS;

    const parsed = JSON.parse(raw) as Partial<VisibleColumns> | null;
    if (!parsed || typeof parsed !== "object") return DEFAULT_COLUMNS;

    // Читаем по одному ключу, а не спредом: в хранилище может лежать что угодно
    // от прошлых версий, и лишний ключ разъехался бы с шириной таблицы.
    return {
      fact: Boolean(parsed.fact),
      diff: Boolean(parsed.diff),
      percent: Boolean(parsed.percent),
    };
  } catch {
    return DEFAULT_COLUMNS;
  }
};

export const writeStoredColumns = (columns: VisibleColumns): void => {
  try {
    localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(columns));
  } catch {
    // Приватный режим или переполненное хранилище: настройка не переживёт
    // перезагрузку, но работать это не мешает.
  }
};

export const COLUMN_LABELS: { key: keyof VisibleColumns; label: string }[] = [
  { key: "fact", label: "Факт" },
  { key: "diff", label: "Разница" },
  { key: "percent", label: "Отклонение %" },
];

/**
 * Ширина группы периода: сумма видимых колонок **плюс пиксель разделителя**.
 *
 * У групп в строках ширина складывается из ячеек, а `border-l` добавляется
 * сверху — то есть каждая группа на 1px шире своей суммы. В шапке ширина
 * задаётся жёстко, и без этой единицы шапка уезжала от строк на пиксель за
 * период: к декабрю — уже на дюжину.
 */
export const groupWidthPx = (columns: VisibleColumns): number =>
  1 + 104 + (columns.fact ? 104 : 0) + (columns.diff ? 92 : 0) + (columns.percent ? 92 : 0);

export const MONTHS_SHORT = [
  "Янв",
  "Фев",
  "Мар",
  "Апр",
  "Май",
  "Июн",
  "Июл",
  "Авг",
  "Сен",
  "Окт",
  "Ноя",
  "Дек",
];

export const MONTH_COUNT = 12;

/**
 * Масштаб таблицы. Данные всегда лежат помесячно — вид только группирует их:
 * квартал и год суммируют свои месяцы.
 */
export type PeriodView = "month" | "quarter" | "year";

export const PERIOD_VIEWS: { key: PeriodView; label: string }[] = [
  { key: "month", label: "По месяцам" },
  { key: "quarter", label: "По кварталам" },
  { key: "year", label: "По годам" },
];

export type BudgetPeriod = {
  key: string;
  label: string;
  /**
   * Индексы месяцев внутри `year`. `null` — период это целый год: в годовом
   * виде колонки — это разные годы, а не части одного.
   */
  months: number[] | null;
  year: number;
};

const QUARTER_LABELS = ["I кв.", "II кв.", "III кв.", "IV кв."];

export const periodsOf = (view: PeriodView, year: number, years: number[]): BudgetPeriod[] => {
  // Годовой вид сравнивает годы между собой — колонка на каждый год, а не одна
  // колонка «итог выбранного года»: она уже есть справа в остальных видах.
  if (view === "year") {
    return years.map((item) => ({
      key: `y${item}`,
      label: String(item),
      months: null,
      year: item,
    }));
  }

  if (view === "quarter") {
    return QUARTER_LABELS.map((label, index) => ({
      key: `q${index}`,
      label,
      months: [index * 3, index * 3 + 1, index * 3 + 2],
      year,
    }));
  }

  return MONTHS_SHORT.map((label, index) => ({
    key: `m${index}`,
    label: `${label} ${String(year).slice(2)}`,
    months: [index],
    year,
  }));
};

/** Период, на который приходится «сейчас» — его колонка подсвечена. */
export const currentPeriodIndex = (periods: BudgetPeriod[]): number | null => {
  const now = new Date();
  const index = periods.findIndex((period) =>
    period.months === null
      ? period.year === now.getFullYear()
      : period.year === now.getFullYear() && period.months.includes(now.getMonth())
  );
  return index < 0 ? null : index;
};

/** Все 12 месяцев — годовой период берёт строку целиком. */
export const ALL_MONTHS = [...Array(MONTH_COUNT).keys()];

/** Первая колонка «прилипает»: без названия строки цифры справа не читаются. */
export const TITLE_CELL = "w-[268px] min-w-[268px] max-w-[268px]";
/**
 * Липкая первая колонка. Граница справа обязательна: без неё непонятно, где
 * колонка кончается и начинается прокручиваемая часть. Фон у всех её ячеек
 * должен быть непрозрачным — сквозь полупрозрачный просвечивают цифры,
 * уезжающие под неё.
 */
export const STICKY_TITLE_CLASS = "sticky left-0 z-20 border-r border-slate-200";
/** Статусу нужно больше места: «Увольняется» не влезает в общую мета-ширину. */
export const STATUS_CELL = "w-[116px] min-w-[116px]";
/** Налог и бонус — короткие числа: широкая колонка тут только съедала бы место. */
export const META_CELL = "w-[68px] min-w-[68px]";
export const MONEY_CELL = "w-[104px] min-w-[104px]";
export const DIFF_CELL = "w-[92px] min-w-[92px]";

export const STATUS_META: Record<BudgetRowStatus, { label: string; className: string }> = {
  working: { label: "Работает", className: "bg-success-50 text-success-600" },
  vacant: { label: "Вакансия", className: "bg-gray-100 text-gray-500" },
  leaving: { label: "Увольняется", className: "bg-warning-50 text-warning-600" },
};

export const STATUS_ORDER: BudgetRowStatus[] = ["working", "vacant", "leaving"];

/** Сумма в сумах: разряды пробелами, без копеек. Ноль — прочерк. */
export const formatMoney = (value: number): string =>
  value ? new Intl.NumberFormat("ru-RU").format(Math.round(value)) : "—";

/** Та же сумма, но нулём, а не прочерком — для итогов, где «—» читается как «нет данных». */
export const formatTotal = (value: number): string =>
  new Intl.NumberFormat("ru-RU").format(Math.round(value));

export const formatPercent = (value: number): string =>
  `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;

/** Строка поля → сумма. Пробелы и разделители из вставленного значения игнорируются. */
export const parseMoney = (value: string): number => {
  const digits = value.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
};

export const parsePercent = (value: string): number => {
  const parsed = Number(value.replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Цвет разницы: перерасход — красный, экономия — зелёная.
 *
 * Знак считается от плана: факт больше плана значит «потратили больше», и это
 * тревожно даже когда цифра растёт.
 */
export const diffClassName = (diff: number): string =>
  diff > 0 ? "text-error-500" : diff < 0 ? "text-success-600" : "text-gray-400";

export const emptyMonths = (): BudgetMonth[] =>
  Array.from({ length: MONTH_COUNT }, () => ({ plan: 0, fact: 0 }));

export const rowPlanTotal = (row: BudgetRow): number =>
  row.months.reduce((sum, month) => sum + month.plan, 0);

export const rowFactTotal = (row: BudgetRow): number =>
  row.months.reduce((sum, month) => sum + month.fact, 0);

/** Сумма выбранных месяцев строки — из неё собираются квартал и год. */
export const sumMonths = (months: BudgetMonth[], indexes: number[]): BudgetMonth =>
  indexes.reduce(
    (sum, index) => ({
      plan: sum.plan + (months[index]?.plan ?? 0),
      fact: sum.fact + (months[index]?.fact ?? 0),
    }),
    { plan: 0, fact: 0 }
  );

export const departmentPeriod = (
  department: BudgetDepartment,
  indexes: number[]
): BudgetMonth =>
  department.rows.reduce(
    (sum, row) => {
      const period = sumMonths(row.months, indexes);
      return { plan: sum.plan + period.plan, fact: sum.fact + period.fact };
    },
    { plan: 0, fact: 0 }
  );

export const totalsPeriod = (
  departments: BudgetDepartment[],
  indexes: number[]
): BudgetMonth =>
  departments.reduce(
    (sum, department) => {
      const period = departmentPeriod(department, indexes);
      return { plan: sum.plan + period.plan, fact: sum.fact + period.fact };
    },
    { plan: 0, fact: 0 }
  );

export const departmentYear = (department: BudgetDepartment): BudgetMonth =>
  department.rows.reduce(
    (sum, row) => ({
      plan: sum.plan + rowPlanTotal(row),
      fact: sum.fact + rowFactTotal(row),
    }),
    { plan: 0, fact: 0 }
  );

export const totalsYear = (departments: BudgetDepartment[]): BudgetMonth =>
  departments.reduce(
    (sum, department) => {
      const year = departmentYear(department);
      return { plan: sum.plan + year.plan, fact: sum.fact + year.fact };
    },
    { plan: 0, fact: 0 }
  );

/** Разница и её доля от плана. Плана нет, а факт есть — считаем это 100%. */
export const diffOf = (month: BudgetMonth): { diff: number; percent: number } => {
  const diff = month.fact - month.plan;
  const percent = month.plan ? (diff / month.plan) * 100 : diff ? 100 : 0;
  return { diff, percent };
};

/** Инициалы для аватара строки: у вакансии их нет, поэтому там прочерк. */
export const initialsOf = (name: string): string =>
  name
    .replace(/[()«»]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "—";

/** Название должности по id — строки хранят ссылку на справочник, а не текст. */
export const positionTitle = (
  positions: BudgetPosition[],
  positionId: string | null
): string => positions.find((position) => position.id === positionId)?.title ?? "";

/** Поиск идёт по отделу, имени и должности — по тому, что видно в первой колонке. */
export const matchesSearch = (
  row: BudgetRow,
  positions: BudgetPosition[],
  needle: string
): boolean =>
  row.name.toLowerCase().includes(needle) ||
  positionTitle(positions, row.positionId).toLowerCase().includes(needle);
