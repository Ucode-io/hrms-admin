// Матрица грейдов — через шлюз udevs-hrms-reports.
//
// Идёт мимо items API по двум причинам: страница читает сразу шесть источников
// (колонки, строки, ячейки и три справочника — отделы, должности, уровни) и
// сшивает их в одну таблицу; и почти каждая правка затрагивает больше одной
// строки БД (удаление колонки гасит её ячейки, удаление отдела — вложенные
// должности), а items API такие операции пришлось бы собирать на клиенте.

import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { injectCompaniesIdIntoInvokeFunctionRequest } from "../httpRequest";
import authStore from "../../store/auth.store";
import { handleUnauthorizedError } from "../unauthorizedHandler";
import type {
  CellDraft,
  ColumnDraft,
  GradeMatrixResult,
  ReorderDraft,
  RowDraft,
} from "../../modules/Settings/GradeMatrix/types";

const REPORTS_BASE_URL = "https://api.admin.u-code.io";
const REPORTS_FUNCTION_PATH =
  "/v2/invoke_function/udevs-hrms-reports?project-id=9a462573-ce11-4288-928a-a6ba754b6998";

const GET_METHOD = "grade_matrix_get";
const COLUMN_SAVE_METHOD = "grade_matrix_column_save";
const COLUMN_DELETE_METHOD = "grade_matrix_column_delete";
const ROW_SAVE_METHOD = "grade_matrix_row_save";
const ROW_DELETE_METHOD = "grade_matrix_row_delete";
const CELL_SAVE_METHOD = "grade_matrix_cell_save";
const REORDER_METHOD = "grade_matrix_reorder";

export const GRADE_MATRIX_QUERY_KEY = ["grade-matrix"];

/** Общий ключ всех правок матрицы — по нему считаются запросы в полёте. */
const GRADE_MATRIX_MUTATION_KEY = "grade-matrix-mutation";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const reportsRequest = axios.create({
  baseURL: REPORTS_BASE_URL,
  timeout: 100_000,
  headers: { "Content-Type": "application/json" },
});

reportsRequest.interceptors.request.use((config) => {
  const token = authStore.token ?? localStorage.getItem("auth_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return injectCompaniesIdIntoInvokeFunctionRequest(config);
});

reportsRequest.interceptors.response.use(
  (response) => response,
  (error) => {
    handleUnauthorizedError(error);
    return Promise.reject(error);
  }
);

// Ответ invoke_function завёрнут в несколько конвертов — спускаемся до узла с
// результатом нашего метода. Ошибка валидации приходит как `server_error`.
const findGatewayResult = (
  raw: unknown,
  method: string,
  depth = 0
): Record<string, unknown> | null => {
  if (depth > 6 || !isRecord(raw)) return null;
  if (typeof raw.server_error === "string" && raw.server_error) {
    throw new Error(raw.server_error);
  }
  if (raw.method === method && isRecord(raw.result)) {
    return raw.result as Record<string, unknown>;
  }
  for (const key of ["data", "result", "response"]) {
    const found = findGatewayResult(raw[key], method, depth + 1);
    if (found) return found;
  }
  return null;
};

const invoke = async <T>(
  method: string,
  data: Record<string, unknown> = {}
): Promise<T | null> => {

  const res = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
    data: { method, data },
  });
  return findGatewayResult(res.data, method) as T | null;
};

export const useGradeMatrixQuery = (options?: { enabled?: boolean }) =>
  useQuery(GRADE_MATRIX_QUERY_KEY, () => invoke<GradeMatrixResult>(GET_METHOD), {
    keepPreviousData: true,
    enabled: options?.enabled ?? true,
  });

/** Временный id сущности, которую сервер ещё не подтвердил. */
export const isPendingId = (id: string): boolean => id.startsWith("tmp-");

let pendingCounter = 0;
const nextPendingId = () => `tmp-${(pendingCounter += 1)}`;

/**
 * Правка применяется к кэшу сразу, а запрос уходит фоном.
 *
 * Матрицу заполняют подряд, десятками ячеек: ждать ответ сервера на каждую —
 * значит превратить заполнение в череду замираний. Поэтому UI рисует результат
 * немедленно, а ошибка откатывает состояние к тому, что было до правки, и
 * показывает, что именно не сохранилось.
 *
 * Перечитываем матрицу после каждой правки всё равно: ответ содержит только
 * затронутую сущность (и настоящие guid'ы вместо временных), а на экране от
 * одной правки может измениться больше — удаление отдела уносит его должности.
 */
const useMatrixMutation = <TVariables>(
  toPayload: (variables: TVariables) => { method: string; data: Record<string, unknown> },
  optimistic?: (data: GradeMatrixResult, variables: TVariables) => GradeMatrixResult
) => {
  const qc = useQueryClient();

  return useMutation(
    (variables: TVariables) => {
      const { method, data } = toPayload(variables);
      return invoke(method, data);
    },
    {
      mutationKey: GRADE_MATRIX_MUTATION_KEY,
      onMutate: async (variables: TVariables) => {
        if (!optimistic) return undefined;

        const previous = qc.getQueryData<GradeMatrixResult>(GRADE_MATRIX_QUERY_KEY);
        const patched = previous ? optimistic(previous, variables) : undefined;
        // Сначала рисуем, потом отменяем запросы: `cancelQueries` асинхронный, и
        // ожидание перед правкой задерживало бы её на кадр-другой — ровно то
        // «подождите сервер», от которого оптимистичное обновление и избавляет.
        if (patched) qc.setQueryData(GRADE_MATRIX_QUERY_KEY, patched);
        await qc.cancelQueries(GRADE_MATRIX_QUERY_KEY);
        // Ответ уже летевшего запроса мог успеть записаться, пока мы его
        // отменяли, — возвращаем правку на место.
        if (patched) qc.setQueryData(GRADE_MATRIX_QUERY_KEY, patched);

        return { previous };
      },
      onError: (_error, _variables, context) => {
        const previous = (context as { previous?: GradeMatrixResult } | undefined)?.previous;
        if (previous) qc.setQueryData(GRADE_MATRIX_QUERY_KEY, previous);
      },
      onSettled: () => {
        // Перечитываем матрицу, только когда затихла последняя правка. Иначе
        // ответ на предыдущую приносит состояние, в котором текущей ещё нет, и
        // она пропадает с экрана до следующего обновления.
        if (qc.isMutating({ mutationKey: GRADE_MATRIX_MUTATION_KEY }) <= 1) {
          qc.invalidateQueries(GRADE_MATRIX_QUERY_KEY);
        }
      },
    }
  );
};

export const useSaveMatrixColumn = () =>
  useMatrixMutation<ColumnDraft>(
    (draft) => ({
      method: COLUMN_SAVE_METHOD,
      data: {
        guid: draft.guid,
        min_months: draft.minMonths,
        max_salary: draft.maxSalary,
      },
    }),
    (data, draft) => ({
      ...data,
      columns: draft.guid
        ? data.columns.map((column) =>
            column.id === draft.guid
              ? { ...column, minMonths: draft.minMonths, maxSalary: draft.maxSalary }
              : column
          )
        : [
            // Новая колонка встаёт слева — так же, как на сервере.
            {
              id: nextPendingId(),
              sortOrder: Math.min(0, ...data.columns.map((column) => column.sortOrder)) - 1,
              minMonths: draft.minMonths,
              maxSalary: draft.maxSalary,
            },
            ...data.columns,
          ],
    })
  );

export const useDeleteMatrixColumn = () =>
  useMatrixMutation<string>(
    (guid) => ({ method: COLUMN_DELETE_METHOD, data: { guid } }),
    (data, guid) => ({
      ...data,
      columns: data.columns.filter((column) => column.id !== guid),
      // Ячейки удалённой колонки уходят вместе с ней — иначе они всплыли бы в
      // соседней колонке, сдвинувшись на её место.
      rows: data.rows.map((row) => ({
        ...row,
        cells: row.cells.filter((cell) => cell.columnId !== guid),
      })),
    })
  );

export const useSaveMatrixRow = () =>
  useMatrixMutation<RowDraft>(
    (draft) => ({
      method: ROW_SAVE_METHOD,
      data: {
        guid: draft.guid,
        row_type: draft.rowType,
        departments_id: draft.departmentId,
        positions_id: draft.positionId ?? null,
      },
    }),
    (data, draft) => {
      if (draft.guid) return data;

      const title =
        draft.rowType === "department"
          ? data.departments.find((item) => item.id === draft.departmentId)?.title
          : data.positions.find((item) => item.id === draft.positionId)?.title;

      const row = {
        id: nextPendingId(),
        type: draft.rowType,
        departmentId: draft.departmentId,
        positionId: draft.positionId ?? null,
        sortOrder: data.rows.length,
        title: title ?? "…",
        cells: [],
      };

      if (draft.rowType === "department") return { ...data, rows: [...data.rows, row] };

      // Должность встаёт в конец своего отдела, а не в конец матрицы — иначе
      // она на секунду улетела бы под чужой заголовок.
      const rows = [...data.rows];
      let insertAt = rows.length;
      for (let index = 0; index < rows.length; index += 1) {
        if (rows[index].departmentId !== draft.departmentId) continue;
        insertAt = index + 1;
      }
      rows.splice(insertAt, 0, row);
      return { ...data, rows };
    }
  );

export const useDeleteMatrixRow = () =>
  useMatrixMutation<string>(
    (guid) => ({ method: ROW_DELETE_METHOD, data: { guid } }),
    (data, guid) => {
      const target = data.rows.find((row) => row.id === guid);
      if (!target) return data;
      // Отдел уходит вместе со своими должностями — так же, как на сервере.
      const doomed =
        target.type === "department"
          ? new Set(
              data.rows
                .filter((row) => row.departmentId === target.departmentId)
                .map((row) => row.id)
            )
          : new Set([guid]);
      return { ...data, rows: data.rows.filter((row) => !doomed.has(row.id)) };
    }
  );

export const useSaveMatrixCell = () =>
  useMatrixMutation<CellDraft>(
    (draft) => ({
      method: CELL_SAVE_METHOD,
      data: {
        row_id: draft.rowId,
        column_id: draft.columnId,
        experience_levels_id: draft.experienceLevelId ?? null,
        positions_id: draft.positionId ?? null,
        text: draft.text ?? "",
      },
    }),
    (data, draft) => ({
      ...data,
      rows: data.rows.map((row) => {
        if (row.id !== draft.rowId) return row;

        const isEmpty = !draft.experienceLevelId && !draft.positionId && !draft.text;
        const rest = row.cells.filter((cell) => cell.columnId !== draft.columnId);
        if (isEmpty) return { ...row, cells: rest };

        const existing = row.cells.find((cell) => cell.columnId === draft.columnId);
        return {
          ...row,
          cells: [
            ...rest,
            {
              id: existing?.id ?? nextPendingId(),
              rowId: draft.rowId,
              columnId: draft.columnId,
              experienceLevelId: draft.experienceLevelId ?? null,
              positionId: draft.positionId ?? null,
              text: draft.text ?? "",
            },
          ],
        };
      }),
    })
  );

export const useReorderMatrix = () =>
  useMatrixMutation<ReorderDraft>(
    (draft) => ({
      method: REORDER_METHOD,
      data: { target: draft.target, ids: draft.ids },
    }),
    (data, draft) => {
      if (draft.target === "columns") {
        const order = new Map(draft.ids.map((id, index) => [id, index]));
        return {
          ...data,
          columns: [...data.columns].sort(
            (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
          ),
        };
      }

      // Строки лежат плоским списком в порядке отрисовки, поэтому переставляем
      // их по местам переставляемой группы, не трогая остальные.
      const moving = new Set(draft.ids);
      const slots = data.rows
        .map((row, index) => (moving.has(row.id) ? index : -1))
        .filter((index) => index >= 0);
      const byId = new Map(data.rows.map((row) => [row.id, row]));
      const rows = [...data.rows];
      draft.ids.forEach((id, index) => {
        const row = byId.get(id);
        if (row && slots[index] !== undefined) rows[slots[index]] = row;
      });
      return { ...data, rows };
    }
  );
