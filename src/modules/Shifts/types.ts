import type { Shift } from "../../api/services/shift.service";

export type ShiftsView = "table" | "timeline";

/** Масштаб сетки. День отдан таймлайну — там своя ось. */
export type ShiftsScale = "week" | "month";

/** По чему бьём грид на секции. */
export type GroupBy = "employee" | "position" | "location" | "project";

/**
 * Сотрудник как строка грида. Берётся из `user_base`, но должность и локация
 * здесь — только для подписи под именем: группировка и фильтры читают поля
 * самой смены, а не карточки (см. CONTEXT.md → Shift).
 */
export type ShiftEmployee = {
  id: string;
  name: string;
  photo: string | null;
  positionId: string | null;
  position: string;
  departmentId: string | null;
  department: string;
  locationId: string | null;
  location: string;
};

/** Одна ячейка грида: сотрудник × дата. */
export type ShiftCell = {
  shift: Shift | null;
};

export type ShiftsFilters = {
  search: string;
  positionId: string;
  locationId: string;
  /** Пусто — все; иначе одна из осей, на которые разложился тип смены. */
  kind: ShiftKind | "";
};

/**
 * Вид смены — не хранимое поле, а прочтение двух независимых осей: времени
 * суток и места. Ночь старше удалёнки, поэтому ночное дежурство из дома
 * читается как ночное.
 *
 * Выходного среди видов нет: «не работает» — это отсутствие смены, а не смена
 * особого вида. Пустая клетка и есть выходной.
 */
export type ShiftKind = "day" | "night" | "remote";

export type ShiftGroup = {
  key: string;
  label: string;
  employees: ShiftEmployee[];
  /** Открытые смены группы, разложенные по датам. Строка «Открытые». */
  openByDate: Map<string, Shift[]>;
};
