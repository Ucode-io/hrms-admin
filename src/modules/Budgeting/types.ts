// Доменные типы модуля «Бюджетирование».
//
// Бюджет — это план фонда оплаты труда на год: отделы, внутри них строки
// (сотрудник или вакансия), у каждой строки — 12 месяцев с планом и фактом.

export type BudgetMonth = {
  plan: number;
  fact: number;
};

/** Состояние строки в бюджете, а не кадровый статус сотрудника. */
export type BudgetRowStatus = "working" | "vacant" | "leaving";

export type BudgetRow = {
  id: string;
  /** Отдел бюджета, к которому строка привязана. */
  departmentId?: string | null;
  /**
   * `employee` — строка привязана к сотруднику из базы, `vacancy` — свободная
   * строка с произвольным названием под план найма.
   */
  kind: "employee" | "vacancy";
  /** Заполнен только у `kind: "employee"`. */
  employeeId: string | null;
  name: string;
  /**
   * Должность из справочника. У строки сотрудника она берётся из его профиля и
   * здесь не редактируется, у вакансии — выбирается: планируют не «кого-то», а
   * конкретную роль, и по ней бюджет потом сходится с вакансиями рекрутинга.
   */
  positionId: string | null;
  status: BudgetRowStatus;
  /**
   * Налог и бонус — справочные: на суммы в ячейках не влияют, их вводят
   * готовыми. Поля нужны, чтобы не держать эти проценты в голове при планировании.
   */
  taxPercent: number;
  bonusPercent: number;
  /** Ровно 12 элементов, индекс — месяц года. Собирается из `BudgetSnapshot`. */
  months: BudgetMonth[];
  sortOrder?: number;
};

export type BudgetDepartment = {
  id: string;
  name: string;
  rows: BudgetRow[];
  sortOrder?: number;
};

/**
 * Сотрудник, выбранный в строку бюджета. Приходит из выпадашки, которая грузит
 * людей постранично тем же запросом, что и страница «Сотрудники».
 */
export type BudgetEmployeeOption = {
  id: string;
  name: string;
  /** Должность профиля; в строке она всё равно читается сервером из `user_base`. */
  positionId: string | null;
};

/** Должность из справочника HRMS. */
export type BudgetPosition = {
  id: string;
  title: string;
};

/**
 * Ответ `budget_get`. Структура бюджета сквозная по годам, суммы — по годам:
 * поэтому строки лежат плоско, а суммы отдельным списком, и годовой вид
 * сопоставляет одну и ту же строку в разных годах по её id.
 */
export type BudgetSnapshot = {
  year: number;
  years: number[];
  /** Справочник отделов компании: бюджет группируется по нему, своего списка нет. */
  departments: { id: string; title: string }[];
  rows: {
    id: string;
    departmentId: string | null;
    kind: "employee" | "vacancy";
    employeeId: string | null;
    name: string;
    positionId: string | null;
    status: BudgetRowStatus;
    taxPercent: number;
    bonusPercent: number;
    sortOrder: number;
  }[];
  amounts: { rowId: string; year: number; months: BudgetMonth[] }[];
  positions: BudgetPosition[];
};
