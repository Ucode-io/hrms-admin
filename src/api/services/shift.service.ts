// Смены — экземпляры работы на конкретную дату (см. Shift в CONTEXT.md).
//
// Ходим в ucode напрямую через /v2/items: агрегаты грида («незакрытых слотов 3»,
// сводка по секции) считаются на фронте по уже загруженным строкам, поэтому
// сервер здесь нужен только как хранилище — своего метода в udevs-hrms-reports
// заводить не за чем.
//
// Клиент общий (`httpRequest`), а не свой инстанс: таблица заводится в том же
// проекте ucode, что и остальные данные панели, а companies_id, ключи и
// разворачивание ответа там уже сделаны интерцепторами.

import { useMutation, useQuery, useQueryClient } from "react-query";
import httpRequest, { getCompaniesId } from "../httpRequest";

const SLUG = "shift";

/**
 * Поля, которые уезжают в `upsert-many`. Список явный и полный, потому что
 * колонки в запросе общие для всех объектов, а значения берутся по наличию
 * ключа: объект без одного поля даёт `VALUES lists must all be the same
 * length` на весь запрос. Поэтому каждый ряд достраивается через `?? null`,
 * а не собирается спредом.
 *
 * Чего в списке нет: `created_at`/`updated_at` — они принадлежат ucode.
 * Неизвестное имя поля сервер молча выбрасывает из колонок (как и в фильтрах,
 * см. `fetchShifts`), то есть опечатка тут даёт не ошибку, а потерянное поле.
 */
const UPSERT_FIELDS = [
  "guid",
  "companies_id",
  "date",
  "date_from",
  "date_to",
  "series_id",
  "user_base_id",
  "start_time",
  "end_time",
  "hours_per_day",
  "positions_id",
  "locations_id",
  "project",
  "comment",
];

export const SHIFTS_QUERY_KEY = "SHIFTS";

type RelationData = { guid?: string; title?: string; [key: string]: unknown } | null;

export interface Shift {
  guid: string;
  companies_id: string;
  date: string;
  /** Пусто — открытая смена: слот есть, человека под ним ещё нет. */
  user_base_id: string | null;
  user_base_id_data?: {
    guid?: string;
    first_name?: string;
    second_name?: string;
    photo?: string | null;
    [key: string]: unknown;
  } | null;
  /**
   * Период, которым смену завели: одна и та же пара во всех строках одного
   * сохранения. Это запись о том, каким период заводили, а **не** способ
   * найти соседей по серии — для этого есть `series_id` (см. ADR-0003).
   *
   * Пусто у строк, заведённых до появления полей.
   */
  date_from: string | null;
  date_to: string | null;
  /**
   * Серия — [[Shift Series]] в CONTEXT.md: один график, заведённый одним
   * сохранением на нескольких человек и/или дней. Состав серии нигде не
   * хранится списком: это ровно те строки, у которых стоит этот `series_id`
   * (ADR-0003).
   *
   * Пусто у строк, заведённых до появления колонки: задним числом её не
   * проставляли — правило «тот же человек» затянуло бы одного из пятерых.
   */
  series_id: string | null;
  /** `HH:MM`; пусто у смены, заданной длительностью. */
  start_time: string | null;
  end_time: string | null;
  /**
   * Длительность без привязки к часам суток: «8 часов, время на усмотрение».
   * Взаимоисключающа с парой start/end — заполнено ровно одно из двух.
   */
  hours_per_day: number | null;
  positions_id: string | null;
  positions_id_data?: RelationData;
  locations_id: string | null;
  locations_id_data?: RelationData;
  project: string | null;
  comment: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/** Поля, которые пишет форма. `guid` появляется только при правке. */
export type ShiftInput = {
  date: string;
  date_from: string | null;
  date_to: string | null;
  series_id: string | null;
  user_base_id: string | null;
  start_time: string | null;
  end_time: string | null;
  hours_per_day: number | null;
  positions_id: string | null;
  locations_id: string | null;
  project: string | null;
  comment: string | null;
};

/**
 * Существующая строка, собранная целиком под апсерт.
 *
 * Собирает её `Shifts/plan.ts` (`toShiftRow`), а не этот модуль: выборка
 * приезжает с `with_relations: true`, то есть с `*_id_data`, `created_at` и
 * `updated_at`, и их надо вырезать до полей апсерта.
 */
export type ShiftRow = ShiftInput & { guid: string };

/**
 * Итог сохранения.
 *
 * Запись и удаление разнесены намеренно: это два разных запроса и два разных
 * последствия. Общего «не удалось 3» после ADR-0004 не хватает — «смены не
 * записались» и «снятые дни остались на месте» требуют разных действий.
 *
 * Раздельных «обновлено/создано» больше нет: и правки, и создания уезжают
 * одним `upsert-many`, а один стейтмент даёт один результат.
 */
export type SaveResult = {
  saved: number;
  failed: number;
  deleted: number;
  deleteFailed: number;
  /** Причина отказа записи словами. Пусто — записалось. */
  writeReason: string;
  /** Причина отказа удаления словами. Пусто — удалилось. */
  deleteReason: string;
};

/**
 * Почему запрос не доехал.
 *
 * Голое «не удалось 3» несут в поддержку как есть, и дальше начинается
 * расследование с нуля: конфликт дат, истёкший токен и упавший шлюз
 * выглядят в тосте одинаково. Причина берётся у первого отказа — в пачке
 * они почти всегда однотипны, а весь список уходит в консоль.
 */
const failureReason = (result: PromiseSettledResult<unknown> | undefined): string => {
  if (!result || result.status !== "rejected") return "";

  console.error("Смены: запрос не прошёл", result.reason);

  const error = result.reason as {
    response?: { status?: number; data?: { description?: string } };
    message?: string;
  };

  const status = error?.response?.status;
  // description — поле конверта ucode; при сетевом отказе ответа нет вовсе,
  // и остаётся сообщение axios.
  const text = error?.response?.data?.description || error?.message || "неизвестная ошибка";

  return status ? `${status}, ${text}` : text;
};

export interface ShiftListResponse {
  count: number;
  response: Shift[];
}

/**
 * Потолок выборки.
 *
 * Сузить запрос до видимой страницы сотрудников нельзя: у открытой смены
 * `user_base_id` пустой, и фильтр по списку сотрудников выкинул бы ровно те
 * строки, ради которых заведена строка «Открытые». Поэтому период тянется
 * целиком, а переполнение лимита страница показывает явно — молча обрезанный
 * месяц выглядел бы как «смен нет».
 */
const LIST_LIMIT = 4000;

const query = async (filter: Record<string, unknown>): Promise<ShiftListResponse> => {
  const res = await httpRequest.get(`/v2/items/${SLUG}`, {
    params: {
      with_relations: true,
      data: JSON.stringify({ limit: LIST_LIMIT, offset: 0, ...filter }),
    },
  });

  const payload = res as unknown as { count?: unknown; response?: unknown };
  return {
    count: Number(payload?.count ?? 0),
    response: Array.isArray(payload?.response) ? (payload.response as Shift[]) : [],
  };
};

/**
 * Смены периода — все, включая открытые.
 *
 * Диапазон, а не список дат: ucode умеет `$gte`/`$lte`
 * (`build_query.go:buildComparisonFilters`), и это одно условие вместо тридцати
 * одного значения в `= ANY(...)`. Заодно попадает в индекс `(companies_id, date)`
 * и не зависит от того, приведёт ли Postgres текстовый массив к `date[]`.
 *
 * Важно: неизвестное имя поля ucode молча выбрасывает из фильтра
 * (`buildFieldFilter` выходит по `!ok`), то есть опечатка здесь даёт не ошибку,
 * а тихо расширенную выборку. Поэтому имя поля тут одно и то же по всему коду.
 */
export const fetchShifts = async (range: {
  from: string;
  to: string;
}): Promise<ShiftListResponse> => {
  if (!range.from || !range.to) return { count: 0, response: [] };
  return query({ date: { $gte: range.from, $lte: range.to } });
};

/**
 * Состав серии — **без границ по дате**.
 *
 * Строки серии за пределами записанного периода заводятся обычным путём
 * (перенос смены, правка «следующие дни» с другим `date_to`), и сузить
 * выборку датами значило бы снова искать соседей парой `date_from`/`date_to`,
 * которой они быть перестали, — и молча терять людей, у которых дни есть
 * (ADR-0003).
 */
export const fetchSeries = async (seriesId: string | null): Promise<ShiftListResponse> => {
  if (!seriesId) return { count: 0, response: [] };
  return query({ series_id: seriesId });
};

const shiftService = {
  /**
   * Вся пачка — правки и создания вместе — одним запросом.
   *
   * `upsert-many` на Postgres собирает один
   * `INSERT ... VALUES (…),(…) ON CONFLICT (guid) DO UPDATE`
   * (`ucode_go_object_builder_service/storage/postgres/items.go`), то есть
   * ключ конфликта `guid` делает обновление и вставку одним стейтментом:
   * ряд с известным guid обновляется, ряд со свежим — вставляется. Отдельные
   * PUT'ы на правки после ADR-0004 стоили бы 155 проходов auth-middleware,
   * billing-check и записи в version history на «весь период, все».
   *
   * Цена: апсерт перезаписывает ряд **целиком**, поэтому ряды существующих
   * строк обязаны приезжать полными (`toShiftRow`), а параллельная правка
   * чужого поля будет затёрта.
   *
   * `guid` новой строки генерим сами: ответ на успехе пустой (`data: null`),
   * сервер ничего не возвращает.
   *
   * `companies_id` проставляем в каждый объект руками: интерцептор дописывает
   * его в конверт запроса, а не в элементы `objects`.
   *
   * Не `multiple-insert`: на Postgres шлюз отвечает `does not implemented`.
   */
  saveMany: (rows: (ShiftInput | ShiftRow)[]) => {
    const companiesId = getCompaniesId();

    return httpRequest.post(`/v2/items/${SLUG}/upsert-many`, {
      data: {
        field_slug: "guid",
        fields: UPSERT_FIELDS,
        // Каждое поле достраивается через `?? null`, а не спредом: объект без
        // одного ключа даёт `VALUES lists must all be the same length` на весь
        // запрос (см. `UPSERT_FIELDS`).
        objects: rows.map((row) => ({
          guid: "guid" in row && row.guid ? row.guid : crypto.randomUUID(),
          companies_id: companiesId,
          date: row.date,
          date_from: row.date_from ?? null,
          date_to: row.date_to ?? null,
          series_id: row.series_id ?? null,
          user_base_id: row.user_base_id ?? null,
          start_time: row.start_time ?? null,
          end_time: row.end_time ?? null,
          hours_per_day: row.hours_per_day ?? null,
          positions_id: row.positions_id ?? null,
          locations_id: row.locations_id ?? null,
          project: row.project ?? null,
          comment: row.comment ?? null,
        })),
      },
    });
  },

  /**
   * Удаление пачкой. Эндпоинт и так принимал `ids` массивом — расширение
   * сигнатуры, а не новый путь.
   *
   * Две формы эндпоинта у ucode расходятся между инсталляциями, поэтому здесь
   * тот же fallback, что в employeeWork.service — не изобретаем третий способ.
   * Запасной путь одиночный, поэтому пачку он проходит по одной строке.
   */
  removeMany: async (guids: string[]) => {
    try {
      return await httpRequest.delete(`/v2/items/${SLUG}`, { data: { ids: guids } });
    } catch {
      return Promise.all(
        guids.map((guid) => httpRequest.delete(`/v2/items/${SLUG}/${guid}`))
      );
    }
  },
};

export default shiftService;

export const useShiftsQuery = (range: { from: string; to: string }, enabled = true) =>
  useQuery([SHIFTS_QUERY_KEY, range.from, range.to], () => fetchShifts(range), {
    enabled: enabled && Boolean(range.from && range.to),
    keepPreviousData: true,
  });

/** Выборка упёрлась в потолок — часть смен периода не показана. */
export const isShiftListTruncated = (result: ShiftListResponse | undefined): boolean =>
  Boolean(result && result.count > result.response.length);

/**
 * Сохранение серии: правки, создания и снятия одним вызовом.
 *
 * Что именно попадёт в пачку, решает `Shifts/plan.ts` — правка серии может
 * задеть соседние дни, завести недостающие и снять людей, которых убрали из
 * списка.
 *
 * **Атомарной операция не становится.** Запись и удаление — разные мутации
 * ucode и разные запросы, транзакции у `/v2/items` нет. Частичный отказ
 * оставит серию, где часть дней снята, а часть правок не легла, — поэтому
 * причины отказов возвращаются раздельно и попадают в тост: молчаливый
 * «успех» на половине записей был бы хуже честной цифры.
 */
export const useSaveShifts = () => {
  const queryClient = useQueryClient();

  return useMutation(
    async ({
      rows = [],
      deletes = [],
    }: {
      rows?: (ShiftInput | ShiftRow)[];
      deletes?: string[];
    }): Promise<SaveResult> => {
      const [write, erase] = await Promise.allSettled([
        rows.length > 0 ? shiftService.saveMany(rows) : Promise.resolve(null),
        deletes.length > 0 ? shiftService.removeMany(deletes) : Promise.resolve(null),
      ]);

      // Каждая пачка неделима: один стейтмент на все ряды.
      const saved = write.status === "fulfilled" ? rows.length : 0;
      const deleted = erase.status === "fulfilled" ? deletes.length : 0;

      return {
        saved,
        failed: rows.length - saved,
        deleted,
        deleteFailed: deletes.length - deleted,
        writeReason: failureReason(write),
        deleteReason: failureReason(erase),
      };
    },
    {
      onSuccess: () => {
        void queryClient.invalidateQueries(SHIFTS_QUERY_KEY);
      },
    }
  );
};
