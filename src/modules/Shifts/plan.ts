// Что именно уедет в базу при сохранении формы смены.
//
// Вынесено из формы отдельным модулем и без единого обращения к React: набор
// строк зависит сразу от шести осей — режим (создание/правка), область дат,
// область людей, уже существующие смены, политика конфликтов и судьба снятых.
// Проверять такое кликами в браузере дороже, чем одним прогоном `selfCheck.ts`.
//
// Серия — сущность (см. CONTEXT.md → Shift Series, ADR-0003): её опознаёт
// колонка `series_id`, а состав читается из строк — это те, у кого есть хотя бы
// одна строка с этим `series_id`. Отдельного списка участников нет нигде, и
// заводить его нельзя: он был бы вторым определением того же множества.

import { datesInRange, fromIsoDate, normalizeTime } from "./constants";
import type { Shift, ShiftInput, ShiftRow } from "../../api/services/shift.service";

/**
 * Строка из выборки — в вид, пригодный для апсерта.
 *
 * Выборка приезжает с `with_relations: true`, то есть с `*_id_data`,
 * `created_at` и `updated_at`. Отправлять их обратно нельзя, и собирать ряд
 * спредом от ответа тоже: цена ошибки описана над `UPSERT_FIELDS` — лишнее
 * поле ucode молча выбросит, недостающее уронит весь запрос. Поэтому список
 * здесь явный и повторяет `ShiftInput` поле в поле.
 *
 * Живёт тут, а не в сервисе: `shift.service` тянет за собой http-клиент и
 * стор, а `plan.ts` должен прогоняться `selfCheck`-ом без браузера.
 */
export const toShiftRow = (shift: Shift): ShiftRow => ({
  guid: shift.guid,
  date: shift.date,
  date_from: shift.date_from ?? null,
  date_to: shift.date_to ?? null,
  series_id: shift.series_id ?? null,
  user_base_id: shift.user_base_id ?? null,
  start_time: shift.start_time ?? null,
  end_time: shift.end_time ?? null,
  hours_per_day: shift.hours_per_day ?? null,
  positions_id: shift.positions_id ?? null,
  locations_id: shift.locations_id ?? null,
  project: shift.project ?? null,
  comment: shift.comment ?? null,
});

/** Область действия правки по оси дней. */
export type SaveScope = "all" | "following" | "single";

/**
 * Область действия правки по оси людей.
 *
 * Оси независимы: «всем с понедельника работать с 10:00» и «Иванову весь март
 * с 10:00» — разные намерения, и одной осью их не выразить (ADR-0004).
 */
export type PeopleScope = "all" | "single";

/** Что делать с днями, где у выбранного человека смена уже стоит. */
export type ConflictPolicy = "skip" | "overwrite";

/**
 * Что значит «убрать человека из мультиселекта».
 *
 * `delete` — снять ему смены в границах выбранной области дат.
 * `detach` — оставить дни, но вывести из графика (`series_id → null`).
 * Системе эти два намерения неразличимы, поэтому спрашиваются явно.
 */
export type RemovalPolicy = "delete" | "detach";

/** Должность и филиал из карточки сотрудника — ими заполняются новые строки. */
export type EmployeeMeta = { positionId: string | null; locationId: string | null };

/** Поля смены без даты, исполнителя и серии: их планировщик расставляет сам. */
export type ShiftBase = Omit<ShiftInput, "date" | "user_base_id" | "series_id">;

export type SavePlan = {
  /**
   * Существующие строки целиком, с новыми значениями. Не патчи: пачка уезжает
   * одним `upsert-many`, а он перезаписывает ряд полностью (ADR-0004).
   */
  updates: ShiftRow[];
  creates: ShiftInput[];
  /** Снятые строки — отдельная мутация и отдельный запрос. */
  deletes: string[];
  /** Дни, где смена у человека уже стояла: пропущены или перезаписаны. */
  conflicts: { date: string; userBaseId: string }[];
  /** Из них оставлены нетронутыми — это число идёт в тост после сохранения. */
  skipped: number;
  /**
   * Пропущенные дни графика: участник серии есть, строки в этот день нет.
   *
   * Сама правка их не заполняет — дыра это записанное решение («сняли с этого
   * дня»), а смена часов его не отменяет. Заполнить их можно, попросив
   * (`fillGaps`).
   *
   * Пары, а не число: голое «11 пропущенных дней» нечитаемо и молчит о самом
   * важном — по каким дням недели и у кого. Серия на пятерых обычно ровная, и
   * дыра в ней это «у двоих нет воскресений», а не «одиннадцать».
   */
  gaps: { date: string; userBaseId: string | null }[];
  /** Даты, по которым прошлись — для подписи в попапе. */
  dates: string[];
};

export type PlanRequest = {
  /** Правимая смена; `null` — создание. */
  original: Shift | null;
  /**
   * `series_id`, который будет стоять у всей серии после сохранения.
   *
   * Минтит его форма, а не планировщик: план пересчитывается на каждый клик
   * радио, и свежий UUID на каждом пересчёте сделал бы цифры в попапе
   * несравнимыми. Создание и правка строки без серии получают новый, правка
   * серии — её собственный (серия не раскалывается редактированием).
   */
  seriesId: string;
  employeeIds: string[];
  employeeMeta: Record<string, EmployeeMeta>;
  /** Открытых слотов на дату. Работает только при пустом списке сотрудников. */
  headcount: number;
  base: ShiftBase;
  dateFrom: string;
  dateTo: string;
  weekdays: number[];
  scope: SaveScope;
  people: PeopleScope;
  conflicts: ConflictPolicy;
  /** Заполнять ли пропущенные дни участников серии. */
  fillGaps: boolean;
  removal: RemovalPolicy;
  /**
   * Смены, о которых форма знает: период формы плюс вся серия целиком —
   * включая её строки за пределами периода.
   */
  existing: Shift[];
};

/**
 * Поля, которые разливаются на соседей по серии.
 *
 * `date` и исполнителя здесь нет намеренно: перенос смены и смена человека
 * касаются одной строки. Разлив даты схлопнул бы всю серию в один день.
 *
 * А вот `date_from`/`date_to` разливаются: это не день строки, а границы
 * периода, и они обязаны быть одинаковыми у всей серии — иначе одна и та же
 * серия, открытая с разных дней, показала бы разные периоды.
 */
const PROPAGATED = [
  "date_from",
  "date_to",
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
  // Дата приезжает из ucode как `YYYY-MM-DD`, но у пустого периода это null,
  // а не пустая строка — сравнивать надо с тем же, что кладёт форма.
  date_from: textValue(shift.date_from),
  date_to: textValue(shift.date_to),
  start_time: timeValue(shift.start_time),
  end_time: timeValue(shift.end_time),
  hours_per_day: numberValue(shift.hours_per_day),
  positions_id: textValue(shift.positions_id),
  locations_id: textValue(shift.locations_id),
  project: textValue(shift.project),
  comment: textValue(shift.comment),
});

/**
 * Только изменённые поля.
 *
 * Ряд теперь уезжает целиком, но разливать на соседей всё подряд нельзя:
 * должность у каждого своя, из его карточки. Разливается ровно то, что
 * человек в форме изменил.
 */
export const diffBase = (before: ShiftBase, after: ShiftBase): Partial<ShiftInput> => {
  const patch: Record<string, unknown> = {};
  PROPAGATED.forEach((key) => {
    if (before[key] !== after[key]) patch[key] = after[key];
  });
  return patch as Partial<ShiftInput>;
};

/**
 * Строки серии правимой смены.
 *
 * Правило одно — совпадение `series_id`, и другого быть не должно: два
 * определения одного множества разъехались бы на первой индивидуальной правке.
 * У строки без серии (заведена до ADR-0003) соседей нет: усыновлять их задним
 * числом пришлось бы по правилу «тот же человек», а оно затянуло бы одного
 * Иванова, оставив снаружи четверых.
 */
export const seriesRowsOf = (original: Shift | null, existing: Shift[]): Shift[] => {
  if (!original) return [];
  if (!original.series_id) return [original];
  return existing.filter((row) => row.series_id === original.series_id);
};

/**
 * Состав серии — те, у кого есть хотя бы одна строка.
 *
 * Открытые строки в состав не входят: у них исполнителя нет. Серия при этом
 * вполне может быть смешанной — назначение человека на открытый слот пишет
 * `user_base_id` в существующую строку, `series_id` у неё остаётся.
 */
export const seriesMembers = (rows: Shift[]): string[] => [
  ...new Set(rows.map((row) => row.user_base_id).filter((id): id is string => Boolean(id))),
];

/**
 * Кто работает в правимой строке после сохранения.
 *
 * Исходный сотрудник остаётся исполнителем, пока он в списке. Убрали — строка
 * не достаётся первому попавшемуся из списка: после ADR-0004 «убрать» значит
 * снять смены, и молча отдать день Иванова Петрову нельзя.
 *
 * Открытый слот — другое дело: там назначение и есть смысл жеста. Но взять
 * первого из списка нельзя и тут: серия смешанная, и в списке стоят все её
 * участники, включая тех, кто в этот день уже работает. Слот закрывает первый
 * свободный — иначе клик по открытой смене молча упирался бы в
 * `shift_employee_date_uniq`.
 */
export const resolveAssignee = (
  original: Shift | null,
  employeeIds: string[],
  takenOnDate: Iterable<string> = []
): string | null => {
  if (!original) return null;
  const originalEmployee = original.user_base_id ?? null;
  if (originalEmployee) {
    return employeeIds.includes(originalEmployee) ? originalEmployee : null;
  }
  const taken = new Set(takenOnDate);
  return employeeIds.find((id) => !taken.has(id)) ?? null;
};

/** Кто уже занят в этот день — кроме самой правимой строки. */
export const takenOn = (existing: Shift[], date: string, exceptGuid?: string): string[] =>
  existing
    .filter(
      (row) => row.date === date && row.user_base_id && row.guid !== exceptGuid
    )
    .map((row) => row.user_base_id as string);

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

/** Дни, по которым пройдётся правка. Одна ось из двух — общая с удалением. */
export const planDates = (request: {
  original: Shift | null;
  dateFrom: string;
  dateTo: string;
  weekdays: number[];
  scope: SaveScope;
}): string[] => {
  const span = datesInRange(request.dateFrom, request.dateTo);
  const matching =
    request.weekdays.length === 0
      ? span
      : span.filter((iso) => request.weekdays.includes(fromIsoDate(iso).getDay()));

  if (!request.original) return matching;

  const anchor = request.original.date;
  if (request.scope === "single") return [anchor];
  if (request.scope === "following") return matching.filter((iso) => iso >= anchor);
  return matching;
};

/**
 * Строки, которых коснётся удаление, — те же две оси, что у правки.
 *
 * Дефолт сужен до одной строки: иначе верх и низ одного окна жили бы по разным
 * правилам — поле правит пятерых на месяц, кнопка молча сносит одного.
 */
export const buildDeletePlan = (request: {
  original: Shift;
  existing: Shift[];
  dateFrom: string;
  dateTo: string;
  weekdays: number[];
  scope: SaveScope;
  people: PeopleScope;
}): string[] => {
  const dates = new Set(planDates(request));
  const owner = request.original.user_base_id ?? null;

  const rows = seriesRowsOf(request.original, request.existing).filter((row) => {
    if (!dates.has(row.date)) return false;
    if (request.people === "all") return true;
    // «Только этот»: своя дорожка правимой строки. У открытой смены дорожки
    // нет — есть она сама.
    return owner ? row.user_base_id === owner : row.guid === request.original.guid;
  });

  return [...new Set([request.original.guid, ...rows.map((row) => row.guid)])];
};

export const buildSavePlan = (request: PlanRequest): SavePlan => {
  const { original, employeeMeta, base, existing, seriesId } = request;

  const plan: SavePlan = {
    updates: [],
    creates: [],
    deletes: [],
    conflicts: [],
    skipped: 0,
    gaps: [],
    dates: [],
  };

  const dates = planDates(request);
  plan.dates = dates;

  const originalEmployee = original?.user_base_id ?? null;
  const editedDate = resolveEditedDate(original, request.dateFrom, request.dateTo);
  const assignee = resolveAssignee(
    original,
    request.employeeIds,
    takenOn(existing, editedDate, original?.guid)
  );

  // «Только этот» сужает обе стороны сразу: и состав, который правится, и
  // список, из которого заводятся новые строки. Добавленные в мультиселект при
  // этом намеренно игнорируются — «добавить человека только этому человеку»
  // смысла не имеет.
  const onlyOriginal = Boolean(original) && request.people === "single";
  const employeeIds = onlyOriginal
    ? assignee
      ? [assignee]
      : []
    : request.employeeIds;

  const allSeriesRows = seriesRowsOf(original, existing);
  const seriesRows = allSeriesRows.filter((row) => {
    if (!onlyOriginal) return true;
    return originalEmployee
      ? row.user_base_id === originalEmployee
      : row.guid === original?.guid;
  });

  const seriesByDate = new Map<string, Shift[]>();
  seriesRows.forEach((row) => {
    seriesByDate.set(row.date, [...(seriesByDate.get(row.date) ?? []), row]);
  });
  const seriesAt = (date: string): Shift[] => seriesByDate.get(date) ?? [];

  // Состав считаем по всей серии, а не по суженной: «новый человек или старый
  // с дыркой» — вопрос о графике целиком.
  const memberIds = new Set(seriesMembers(allSeriesRows));

  // Кого убрали: был в серии (в её видимой части), в списке больше нет.
  const removed = new Set(
    seriesMembers(seriesRows).filter((id) => !employeeIds.includes(id))
  );

  const byEmployeeDate = new Map<string, Shift>();
  existing.forEach((shift) => {
    if (shift.user_base_id) byEmployeeDate.set(`${shift.user_base_id}|${shift.date}`, shift);
  });

  const fieldsFor = (employeeId: string | null): ShiftBase => {
    const meta = employeeId ? employeeMeta[employeeId] : undefined;
    return {
      ...base,
      // Должность у новой строки — своя у каждого человека; поле в форме
      // служит запасным вариантом, когда карточка выбранного не загружена.
      positions_id: meta ? meta.positionId : base.positions_id,
      // Филиал наоборот: поле сильнее карточки — «в субботу все на складе».
      locations_id: base.locations_id ?? meta?.locationId ?? null,
    };
  };

  const rowFor = (employeeId: string | null, date: string): ShiftInput => ({
    ...fieldsFor(employeeId),
    date,
    user_base_id: employeeId,
    series_id: seriesId,
  });

  // Строки, судьба которых уже решена: второй раз их трогать нельзя, и
  // конфликтом они тоже не считаются.
  const touched = new Set<string>();

  const seriesPatch = original ? diffBase(shiftToBase(original), base) : {};
  const hasSeriesPatch = Object.keys(seriesPatch).length > 0;

  /** Снятый человек: либо его дни исчезают, либо строка выходит из графика. */
  const drop = (row: Shift) => {
    touched.add(row.guid);
    if (request.removal === "detach") {
      // Отцепленная строка неотличима от заведённой до серий — цена принята
      // (ADR-0004): иначе сказать «он больше не в графике, но эти дни
      // работает» нечем.
      plan.updates.push({ ...toShiftRow(row), series_id: null });
    } else {
      plan.deletes.push(row.guid);
    }
  };

  if (original) {
    if (originalEmployee && removed.has(originalEmployee)) {
      drop(original);
    } else {
      touched.add(original.guid);
      const next: ShiftRow = {
        ...toShiftRow(original),
        ...seriesPatch,
        series_id: seriesId,
        date: editedDate || original.date,
        user_base_id: assignee,
      };
      const changed =
        hasSeriesPatch ||
        next.date !== original.date ||
        next.user_base_id !== originalEmployee ||
        next.series_id !== (original.series_id ?? null);
      if (changed) plan.updates.push(next);
    }
  }

  dates.forEach((date) => {
    seriesAt(date).forEach((row) => {
      if (touched.has(row.guid)) return;
      // Помечаем даже при пустом диффе: сосед по серии — не конфликт, и
      // создавать поверх него вторую смену нельзя.
      touched.add(row.guid);
      if (row.user_base_id && removed.has(row.user_base_id)) {
        drop(row);
        return;
      }
      if (hasSeriesPatch || (row.series_id ?? null) !== seriesId) {
        plan.updates.push({ ...toShiftRow(row), ...seriesPatch, series_id: seriesId });
      }
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
          // Перезапись переносит строку в правимую серию: иначе поля говорят
          // одно, `series_id` — другое, и два графика по очереди разливаются
          // по одной строке. Цена: соседний график тихо теряет день.
          plan.updates.push({
            ...toShiftRow(found),
            ...fieldsFor(employeeId),
            date,
            user_base_id: employeeId,
            series_id: seriesId,
          });
        } else {
          plan.skipped += 1;
        }
        return;
      }

      // Участник серии без строки в этот день — это дыра, а не недостающая
      // запись: её оставили осознанно. У нового человека строк в серии ноль,
      // и ему смены создаются.
      if (original && !request.fillGaps && memberIds.has(employeeId)) {
        plan.gaps.push({ date, userBaseId: employeeId });
        return;
      }

      plan.creates.push(rowFor(employeeId, date));
    });

    if (employeeIds.length > 0) return;

    if (original) {
      // Правка открытой серии. Тот же вопрос про дыры и тот же ответ: день без
      // слота заполняется только по просьбе. Управление количеством в правке
      // не открываем — см. решение по открытым сменам.
      if (seriesAt(date).length > 0 || date === editedDate) return;
      if (request.fillGaps) plan.creates.push(rowFor(null, date));
      else plan.gaps.push({ date, userBaseId: null });
      return;
    }

    for (let index = 0; index < Math.max(1, request.headcount); index += 1) {
      plan.creates.push(rowFor(null, date));
    }
  });

  return plan;
};
