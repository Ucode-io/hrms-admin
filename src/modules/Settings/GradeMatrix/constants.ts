import type { MatrixCell, MatrixRow } from "./types";

/**
 * Раскладка матрицы. Ширины — в одном месте: шапка и строки рисуются разными
 * компонентами, и разъехавшиеся колонки ломают всю таблицу.
 *
 * Первая колонка «прилипает» при горизонтальной прокрутке — без названия строки
 * ячейки справа читать невозможно.
 */
export const TITLE_CELL = "w-64 min-w-[16rem] max-w-[16rem]";
export const DATA_CELL = "w-40 min-w-[10rem] max-w-[10rem]";
export const STICKY_TITLE = "sticky left-0 z-20";

/** Сумма в узбекских сумах: разряды пробелами, без копеек. */
export const formatMoney = (value: number | null): string =>
  value === null ? "" : new Intl.NumberFormat("ru-RU").format(Math.round(value));

/**
 * Месяцы → человеческий стаж: 0 → «с найма», 6 → «6 мес», 24 → «2 года».
 * Округлённые до года значения показываем годами — так в исходной таблице.
 */
export const formatTenure = (months: number | null): string => {
  if (months === null) return "—";
  if (months <= 0) return "с найма";
  if (months < 12) return `${months} мес`;
  if (months % 12 === 0) {
    const years = months / 12;
    const suffix = years === 1 ? "год" : years < 5 ? "года" : "лет";
    return `${years} ${suffix}`;
  }
  return `${Math.floor(months / 12)} г ${months % 12} мес`;
};

/**
 * Строка поля → число или null. Пустое поле — это «не задано», а не ноль:
 * колонку заводят пустой, и ноль в стаже означал бы «с найма».
 */
export const parseNumberInput = (value: string): number | null => {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return null;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
};

/** Ячейка строки в конкретной колонке (или null — пустое пересечение). */
export const cellAt = (row: MatrixRow, columnId: string): MatrixCell | null =>
  row.cells.find((cell) => cell.columnId === columnId) ?? null;

/** Отдел со своими должностями — матрица рисуется блоками, а не сплошным списком. */
export type MatrixGroup = { department: MatrixRow; positions: MatrixRow[] };

export const groupRows = (rows: MatrixRow[]): MatrixGroup[] => {
  const groups: MatrixGroup[] = [];
  for (const row of rows) {
    if (row.type === "department") groups.push({ department: row, positions: [] });
    else if (groups.length) groups[groups.length - 1].positions.push(row);
  }
  return groups;
};

/**
 * Фильтр по названию: отдел остаётся целиком, если совпал сам, иначе от него
 * остаются только подошедшие должности — найденная должность без заголовка
 * отдела повисла бы в воздухе.
 */
export const filterGroups = (groups: MatrixGroup[], search: string): MatrixGroup[] => {
  const query = search.trim().toLowerCase();
  if (!query) return groups;

  const matches = (row: MatrixRow) => row.title.toLowerCase().includes(query);

  return groups
    .map((group) =>
      matches(group.department)
        ? group
        : { ...group, positions: group.positions.filter(matches) }
    )
    .filter((group) => matches(group.department) || group.positions.length > 0);
};

/** Должности, уже занятые строками матрицы: повторно их предлагать нельзя. */
export const usedPositionIds = (rows: MatrixRow[]): Set<string> =>
  new Set(
    rows
      .filter((row) => row.type === "position" && row.positionId)
      .map((row) => row.positionId as string)
  );

export const usedDepartmentIds = (rows: MatrixRow[]): Set<string> =>
  new Set(
    rows
      .filter((row) => row.type === "department" && row.departmentId)
      .map((row) => row.departmentId as string)
  );
