/** Ступень роста: стаж и потолок оклада. Оба поля необязательны — колонку
 *  заводят пустой и заполняют по месту. */
export type MatrixColumn = {
  id: string;
  sortOrder: number;
  minMonths: number | null;
  maxSalary: number | null;
};

/** Ячейка на пересечении строки и колонки. Что в ней заполнено, задаёт тип
 *  строки: у отдела — только `text`, у должности — уровень либо должность. */
export type MatrixCell = {
  id: string;
  rowId: string;
  columnId: string;
  experienceLevelId: string | null;
  positionId: string | null;
  text: string;
};

export type MatrixRowType = "department" | "position";

export type MatrixRow = {
  id: string;
  type: MatrixRowType;
  /** У строки должности — её отдел-родитель. */
  departmentId: string | null;
  positionId: string | null;
  sortOrder: number;
  /** Название из справочника: своих названий матрица не хранит. */
  title: string;
  cells: MatrixCell[];
};

export type MatrixRef = { id: string; title: string };

export type MatrixLevel = MatrixRef & {
  groupId: string | null;
  /** Выведен из матрицы: стаж задаёт колонка, в ячейках которой стоит уровень. */
  minMonths: number | null;
};

export type GradeMatrixResult = {
  /** false, пока таблицы матрицы не заведены в u-code. */
  isConfigured: boolean;
  columns: MatrixColumn[];
  /** Плоский список в порядке отрисовки: отдел, сразу за ним его должности. */
  rows: MatrixRow[];
  departments: MatrixRef[];
  positions: MatrixRef[];
  levels: MatrixLevel[];
};

export type ColumnDraft = {
  guid?: string;
  minMonths: number | null;
  maxSalary: number | null;
};

export type RowDraft = {
  guid?: string;
  rowType: MatrixRowType;
  departmentId: string;
  positionId?: string | null;
};

export type CellDraft = {
  rowId: string;
  columnId: string;
  experienceLevelId?: string | null;
  positionId?: string | null;
  text?: string;
};

export type ReorderDraft = {
  target: "columns" | "rows";
  ids: string[];
};
