// Что именно уедет в базу при сохранении формы смены.
//
// Вынесено из формы отдельным модулем и без единого обращения к React: набор
// строк зависит сразу от четырёх осей — режим (создание/правка), область
// действия, уже существующие смены и политика конфликтов. Проверять такое
// кликами в браузере дороже, чем одним прогоном `selfCheck.ts`.
//
// Серии как сущности в базе нет (см. CONTEXT.md → Shift): «серия» здесь —
// это диапазон дат, который человек сам задал в форме, плюс правило, по
// которому в этом диапазоне узнаются соседи правимой смены.

import { datesInRange, fromIsoDate, normalizeTime } from "./constants";
import type { Shift, ShiftInput } from "../../api/services/shift.service";

/** Область действия правки. */
export type SaveScope = "all" | "following" | "single";

/** Что делать с днями, где у выбранного человека смена уже стоит. */
export type ConflictPolicy = "skip" | "overwrite";

/** Должность и локация из карточки сотрудника — ими заполняются новые строки. */
export type EmployeeMeta = { positionId: string | null; locationId: string | null };

/** Поля смены без даты и исполнителя: их планировщик расставляет сам. */
export type ShiftBase = Omit<ShiftInput, "date" | "user_base_id">;

export type PlanUpdate = { guid: string; patch: Partial<ShiftInput> };

export type SavePlan = {
  updates: PlanUpdate[];
  creates: ShiftInput[];
  /** Дни, где смена у человека уже стояла: пропущены или перезаписаны. */
  conflicts: { date: string; userBaseId: string }[];
  /** Из них оставлены нетронутыми — это число идёт в тост после сохранения. */
  skipped: number;
  /** Даты, по которым прошлись — для подписи в попапе. */
  dates: string[];
};

export type PlanRequest = {
  /** Правимая смена; `null` — создание. */
  original: Shift | null;
  employeeIds: string[];
  employeeMeta: Record<string, EmployeeMeta>;
  /** Открытых слотов на дату. Работает только при пустом списке сотрудников. */
  headcount: number;
  base: ShiftBase;
  dateFrom: string;
  dateTo: string;
  weekdays: number[];
  scope: SaveScope;
  conflicts: ConflictPolicy;
  /** Смены за `dateFrom…dateTo` — все, включая чужие и открытые. */
  existing: Shift[];
};

/**
 * Поля, которые разливаются на соседей по серии.
 *
 * Даты и исполнителя здесь нет намеренно: перенос смены и смена человека
 * касаются одной строки. Разлив даты схлопнул бы всю серию в один день и
 * упёрся бы в `shift_employee_date_uniq`.
 */
const PROPAGATED = [
  "start_time",
  "end_time",
  "hours_per_day",
  "positions_id",
  "locations_id",
  "project",
  "comment",
] as const;

const timeValue = (value: unknown): string | null =>
  normalizeTime(typeof value === "string" ? value : null) || null;

const numberValue = (value: unknown): number | null => {
  const raw = Number(value);
  return Number.isFinite(raw) && raw > 0 ? raw : null;
};

const textValue = (value: unknown): string | null => {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw || null;
};

/**
 * Смена в том же виде, в каком её задаёт форма.
 *
 * Без этого дифф сравнивал бы `"09:00:00"` из ucode с `"09:00"` из поля и
 * считал изменившимся то, чего никто не трогал.
 */
export const shiftToBase = (shift: Shift): ShiftBase => ({
  start_time: timeValue(shift.start_time),
  end_time: timeValue(shift.end_time),
  hours_per_day: numberValue(shift.hours_per_day),
  positions_id: textValue(shift.positions_id),
  locations_id: textValue(shift.locations_id),
  project: textValue(shift.project),
  comment: textValue(shift.comment),
});

/** Только изменённые поля: PUT в ucode частичный, остального он не трогает. */
export const diffBase = (before: ShiftBase, after: ShiftBase): Partial<ShiftInput> => {
  const patch: Record<string, unknown> = {};
  PROPAGATED.forEach((key) => {
    if (before[key] !== after[key]) patch[key] = after[key];
  });
  return patch as Partial<ShiftInput>;
};

/**
 * Кто работает в правимой строке после сохранения. Исходный сотрудник остаётся
 * исполнителем, пока он в списке; убрали — смена снова открывается, поставили
 * другого — это замена в одной строке, не во всей серии.
 */
export const resolveAssignee = (
  original: Shift | null,
  employeeIds: string[]
): string | null => {
  if (!original) return null;
  const originalEmployee = original.user_base_id ?? null;
  if (originalEmployee && employeeIds.includes(originalEmployee)) return originalEmployee;
  return employeeIds[0] ?? null;
};

/**
 * Дата правимой строки после сохранения: схлопнутый диапазон переносит смену,
 * растянутый оставляет её на месте и задаёт края серии.
 */
export const resolveEditedDate = (
  original: Shift | null,
  dateFrom: string,
  dateTo: string
): string => {
  if (!original) return "";
  return dateFrom === dateTo ? dateFrom : original.date;
};

export const buildSavePlan = (request: PlanRequest): SavePlan => {
  const { original, employeeIds, employeeMeta, base, existing } = request;

  const plan: SavePlan = { updates: [], creates: [], conflicts: [], skipped: 0, dates: [] };

  const span = datesInRange(request.dateFrom, request.dateTo);
  const matching =
    request.weekdays.length === 0
      ? span
      : span.filter((iso) => request.weekdays.includes(fromIsoDate(iso).getDay()));

  const anchor = original?.date ?? "";
  const dates = !original
    ? matching
    : request.scope === "single"
      ? [anchor]
      : request.scope === "following"
        ? matching.filter((iso) => iso >= anchor)
        : matching;

  plan.dates = dates;

  const editedDate = resolveEditedDate(original, request.dateFrom, request.dateTo);

  const byEmployeeDate = new Map<string, Shift>();
  const openByDate = new Map<string, Shift[]>();
  existing.forEach((shift) => {
    if (shift.user_base_id) {
      byEmployeeDate.set(`${shift.user_base_id}|${shift.date}`, shift);
      return;
    }
    openByDate.set(shift.date, [...(openByDate.get(shift.date) ?? []), shift]);
  });

  const originalEmployee = original?.user_base_id ?? null;

  /**
   * Соседи правимой смены в этот день.
   *
   * У назначенной смены сосед один — тот же человек в тот же день (уникальный
   * индекс другого и не даст). У открытой соседей может быть сколько угодно, и
   * узнаются они по должности: у открытой смены должность — единственное, чем
   * описан нужный человек.
   */
  const seriesAt = (date: string): Shift[] => {
    if (!original) return [];
    if (originalEmployee) {
      const found = byEmployeeDate.get(`${originalEmployee}|${date}`);
      return found ? [found] : [];
    }
    return (openByDate.get(date) ?? []).filter(
      (shift) => (shift.positions_id ?? null) === (original.positions_id ?? null)
    );
  };

  const assignee = resolveAssignee(original, employeeIds);

  const fieldsFor = (employeeId: string | null): ShiftBase => {
    const meta = employeeId ? employeeMeta[employeeId] : undefined;
    return {
      ...base,
      // Должность у новой строки — своя у каждого человека; поле в форме при
      // выбранных сотрудниках погашено и служит только запасным вариантом,
      // когда карточка выбранного не загружена.
      positions_id: meta ? meta.positionId : base.positions_id,
      // Локация наоборот: поле сильнее карточки — «в субботу все на складе».
      locations_id: base.locations_id ?? meta?.locationId ?? null,
    };
  };

  const rowFor = (employeeId: string | null, date: string): ShiftInput => ({
    ...fieldsFor(employeeId),
    date,
    user_base_id: employeeId,
  });

  // Строки, судьба которых уже решена: второй раз их трогать нельзя, и
  // конфликтом они тоже не считаются.
  const touched = new Set<string>();

  const seriesPatch = original ? diffBase(shiftToBase(original), base) : {};

  if (original) {
    const patch: Partial<ShiftInput> = { ...seriesPatch };
    if (editedDate !== original.date) patch.date = editedDate;
    if (assignee !== originalEmployee) patch.user_base_id = assignee;
    if (Object.keys(patch).length > 0) plan.updates.push({ guid: original.guid, patch });
    touched.add(original.guid);
  }

  const hasSeriesPatch = Object.keys(seriesPatch).length > 0;

  dates.forEach((date) => {
    seriesAt(date).forEach((row) => {
      if (touched.has(row.guid)) return;
      // Помечаем даже при пустом диффе: сосед по серии — не конфликт, и
      // создавать поверх него вторую смену нельзя.
      touched.add(row.guid);
      if (hasSeriesPatch) plan.updates.push({ guid: row.guid, patch: { ...seriesPatch } });
    });

    employeeIds.forEach((employeeId) => {
      // Правимую строку уже забрал себе её исполнитель — второй смены в этот
      // день ему не нужно.
      if (employeeId === assignee && date === editedDate) return;

      const found = byEmployeeDate.get(`${employeeId}|${date}`);
      if (found && touched.has(found.guid)) return;

      if (found) {
        plan.conflicts.push({ date, userBaseId: employeeId });
        touched.add(found.guid);
        if (request.conflicts === "overwrite") {
          // Перезапись — это «пусть день выглядит как в форме»: дата и человек
          // у найденной строки и так те же, менять в ней нечего.
          plan.updates.push({ guid: found.guid, patch: fieldsFor(employeeId) });
        } else {
          plan.skipped += 1;
        }
        return;
      }

      plan.creates.push(rowFor(employeeId, date));
    });

    if (employeeIds.length > 0) return;

    if (original) {
      // Правка открытой серии: в день без слота ставим ровно один. Управление
      // количеством в правке не открываем — см. решение по открытым сменам.
      if (seriesAt(date).length === 0 && date !== editedDate) {
        plan.creates.push(rowFor(null, date));
      }
      return;
    }

    for (let index = 0; index < Math.max(1, request.headcount); index += 1) {
      plan.creates.push(rowFor(null, date));
    }
  });

  return plan;
};
