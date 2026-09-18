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
import httpRequest from "../httpRequest";

const SLUG = "shift";

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
   * сохранения. Хранится денормализованно, потому что серии как сущности нет
   * (см. CONTEXT.md → Shift) — а вопрос «частью какого периода была эта
   * смена» задаёт каждый, кто открыл её на правку.
   *
   * Пусто у строк, заведённых до появления полей, и у автозаполнения
   * по графику: там период — это сам день.
   */
  date_from: string | null;
  date_to: string | null;
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
  user_base_id: string | null;
  start_time: string | null;
  end_time: string | null;
  hours_per_day: number | null;
  positions_id: string | null;
  locations_id: string | null;
  project: string | null;
  comment: string | null;
};

/** Итог сохранения пачки: сколько строк реально доехало до базы. */
export type SaveResult = {
  updated: number;
  created: number;
  failed: number;
  /** Причина первого отказа словами. Пусто — отказов не было. */
  reason: string;
};

/**
 * Почему запрос не доехал.
 *
 * Голое «не удалось 3» несут в поддержку как есть, и дальше начинается
 * расследование с нуля: конфликт дат, истёкший токен и упавший шлюз
 * выглядят в тосте одинаково. Причина берётся у первого отказа — в пачке
 * они почти всегда однотипны, а весь список уходит в консоль.
 */
const failureReason = (results: PromiseSettledResult<unknown>[]): string => {
  const rejected = results.filter((item) => item.status === "rejected");
  if (rejected.length === 0) return "";

  console.error("Смены: часть запросов не прошла", rejected.map((item) => item.reason));

  const error = rejected[0].reason as {
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

  const res = await httpRequest.get(`/v2/items/${SLUG}`, {
    params: {
      with_relations: true,
      data: JSON.stringify({
        limit: LIST_LIMIT,
        offset: 0,
        date: { $gte: range.from, $lte: range.to },
      }),
    },
  });

  const payload = res as unknown as { count?: unknown; response?: unknown };
  return {
    count: Number(payload?.count ?? 0),
    response: Array.isArray(payload?.response) ? (payload.response as Shift[]) : [],
  };
};

const shiftService = {
  create: (data: ShiftInput) => httpRequest.post(`/v2/items/${SLUG}`, { data }),

  // Две формы эндпоинта у ucode расходятся между инсталляциями, поэтому здесь
  // тот же fallback, что в employeeWork.service — не изобретаем третий способ.
  update: async (guid: string, data: Partial<ShiftInput>) => {
    try {
      return await httpRequest.put(`/v2/items/${SLUG}/${guid}`, {
        data: { ...data, guid },
      });
    } catch {
      return httpRequest.put(`/v2/items/${SLUG}`, {
        data: { ids: [guid], ...data, guid },
      });
    }
  },

  remove: async (guid: string) => {
    try {
      return await httpRequest.delete(`/v2/items/${SLUG}`, { data: { ids: [guid] } });
    } catch {
      return httpRequest.delete(`/v2/items/${SLUG}/${guid}`);
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
 * Сохранение набора смен: повтор по дням недели раскрывается в N независимых
 * записей ещё на фронте, серии как сущности нет (см. CONTEXT.md → Shift).
 *
 * Правка тоже приходит пачкой: она может задеть соседние дни серии и завести
 * недостающие. Что именно попадёт в пачку, решает `Shifts/plan.ts`.
 *
 * Транзакции у `/v2/items` нет, поэтому упавшие запросы не откатываются: их
 * число возвращается наверх и попадает в тост. Молчаливый «успех» на половине
 * записей был бы хуже честной цифры — грид всё равно перечитается и покажет
 * фактическое состояние.
 */
export const useSaveShifts = () => {
  const queryClient = useQueryClient();

  return useMutation(
    async ({
      updates = [],
      creates = [],
    }: {
      updates?: { guid: string; patch: Partial<ShiftInput> }[];
      creates?: ShiftInput[];
    }): Promise<SaveResult> => {
      // Пачка небольшая (максимум длина видимого периода на число выбранных
      // людей), поэтому шлём параллельно: последовательный цикл на 31 запрос
      // заметен глазом.
      const results = await Promise.allSettled([
        ...updates.map((item) => shiftService.update(item.guid, item.patch)),
        ...creates.map((row) => shiftService.create(row)),
      ]);

      const succeeded = (from: number, to: number) =>
        results.slice(from, to).filter((item) => item.status === "fulfilled").length;

      const updated = succeeded(0, updates.length);
      const created = succeeded(updates.length, results.length);

      return {
        updated,
        created,
        failed: results.length - updated - created,
        reason: failureReason(results),
      };
    },
    {
      onSuccess: () => {
        void queryClient.invalidateQueries(SHIFTS_QUERY_KEY);
      },
    }
  );
};

export const useDeleteShift = () => {
  const queryClient = useQueryClient();

  return useMutation((guid: string) => shiftService.remove(guid), {
    onSuccess: () => {
      void queryClient.invalidateQueries(SHIFTS_QUERY_KEY);
    },
  });
};
