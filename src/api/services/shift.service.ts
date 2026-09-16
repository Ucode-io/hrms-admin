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
  user_base_id: string | null;
  start_time: string | null;
  end_time: string | null;
  hours_per_day: number | null;
  positions_id: string | null;
  locations_id: string | null;
  project: string | null;
  comment: string | null;
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
 * Правка — это всегда одна запись, поэтому `guid` и пачка взаимоисключающи.
 */
export const useSaveShifts = () => {
  const queryClient = useQueryClient();

  return useMutation(
    async ({ guid, rows }: { guid?: string | null; rows: ShiftInput[] }) => {
      if (guid) {
        if (!rows[0]) return null;
        return shiftService.update(guid, rows[0]);
      }
      // Пачка небольшая (максимум длина видимого периода), поэтому шлём
      // параллельно: последовательный цикл на 31 запрос заметен глазом.
      return Promise.all(rows.map((row) => shiftService.create(row)));
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
