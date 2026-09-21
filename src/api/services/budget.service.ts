// Бюджет ФОТ — через шлюз udevs-hrms-reports.
//
// Мимо items API по той же причине, что и матрица грейдов: страница читает
// сразу пять источников (отделы, строки, суммы, сотрудники, должности) и сшивает
// их в одну таблицу, а правка ячейки — это upsert по тройке (строка, год,
// месяц), которую пришлось бы собирать на клиенте из чтения и записи.

import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { injectCompaniesIdIntoInvokeFunctionRequest } from "../httpRequest";
import authStore from "../../store/auth.store";
import { retryWithFreshToken } from "../unauthorizedHandler";
import type {
  BudgetMonth,
  BudgetRowStatus,
  BudgetSnapshot,
} from "../../modules/Budgeting/types";

const REPORTS_BASE_URL = "https://api.admin.u-code.io";
const REPORTS_FUNCTION_PATH =
  "/v2/invoke_function/udevs-hrms-reports?project-id=9a462573-ce11-4288-928a-a6ba754b6998";

const GET_METHOD = "budget_get";
const DEPARTMENT_CLEAR_METHOD = "budget_department_clear";
const ROW_SAVE_METHOD = "budget_row_save";
const ROW_DELETE_METHOD = "budget_row_delete";
const AMOUNT_SAVE_METHOD = "budget_amount_save";

export const BUDGET_QUERY_KEY = "budget";

/** Общий ключ правок: по нему считаются запросы в полёте. */
const BUDGET_MUTATION_KEY = "budget-mutation";

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
  retryWithFreshToken(reportsRequest)
);

/** Ответ invoke_function завёрнут в несколько конвертов — спускаемся до результата. */
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

const str = (value: unknown): string => (typeof value === "string" ? value : "");
const nullableStr = (value: unknown): string | null =>
  typeof value === "string" && value ? value : null;
const num = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const MONTH_COUNT = 12;

const emptyMonths = (): BudgetMonth[] =>
  Array.from({ length: MONTH_COUNT }, () => ({ plan: 0, fact: 0 }));

const mapMonths = (raw: unknown): BudgetMonth[] => {
  const months = emptyMonths();
  if (!Array.isArray(raw)) return months;

  raw.slice(0, MONTH_COUNT).forEach((item, index) => {
    if (!isRecord(item)) return;
    months[index] = { plan: num(item.plan), fact: num(item.fact) };
  });

  return months;
};

export const EMPTY_SNAPSHOT: BudgetSnapshot = {
  year: new Date().getFullYear(),
  years: [],
  departments: [],
  rows: [],
  amounts: [],
  positions: [],
};

const mapSnapshot = (raw: Record<string, unknown> | null): BudgetSnapshot => {
  if (!raw) return EMPTY_SNAPSHOT;

  const list = (value: unknown): Record<string, unknown>[] =>
    Array.isArray(value) ? value.filter(isRecord) : [];

  return {
    year: num(raw.year, EMPTY_SNAPSHOT.year),
    years: Array.isArray(raw.years) ? raw.years.map((item) => num(item)).filter(Boolean) : [],
    departments: list(raw.departments).map((item) => ({
      id: str(item.id),
      title: str(item.title),
    })),
    rows: list(raw.rows).map((item) => ({
      id: str(item.id),
      departmentId: nullableStr(item.departmentId),
      kind: item.kind === "employee" ? "employee" : "vacancy",
      employeeId: nullableStr(item.employeeId),
      name: str(item.name),
      positionId: nullableStr(item.positionId),
      status: (["working", "vacant", "leaving"] as const).includes(
        item.status as BudgetRowStatus
      )
        ? (item.status as BudgetRowStatus)
        : "vacant",
      taxPercent: num(item.taxPercent),
      bonusPercent: num(item.bonusPercent),
      sortOrder: num(item.sortOrder),
    })),
    amounts: list(raw.amounts).map((item) => ({
      rowId: str(item.rowId),
      year: num(item.year),
      months: mapMonths(item.months),
    })),
    positions: list(raw.positions).map((item) => ({
      id: str(item.id),
      title: str(item.title),
    })),
  };
};

/**
 * Ключ включает годы: годовой вид просит суммы за окно лет, остальные — за один
 * год, и это разные наборы данных, а не разные срезы одного.
 */
export const budgetQueryKey = (years: number[]) => [BUDGET_QUERY_KEY, years.join(",")];

export const useBudgetQuery = (year: number, years: number[]) =>
  useQuery(
    budgetQueryKey(years),
    () => invoke<Record<string, unknown>>(GET_METHOD, { year, years }).then(mapSnapshot),
    { keepPreviousData: true }
  );

/** Сущность, которую сервер ещё не подтвердил. */
export const isPendingId = (id: string): boolean => id.startsWith("tmp-");

let pendingCounter = 0;
export const nextPendingId = () => `tmp-${(pendingCounter += 1)}`;

/**
 * Правка применяется к кэшу сразу, а запрос уходит фоном.
 *
 * Бюджет заполняют подряд, ячейку за ячейкой: ждать ответ на каждую — значит
 * превратить заполнение в череду замираний. Ошибка откатывает состояние к
 * тому, что было до правки.
 */
const useBudgetMutation = <TVariables>(
  years: number[],
  toPayload: (variables: TVariables) => { method: string; data: Record<string, unknown> },
  optimistic?: (data: BudgetSnapshot, variables: TVariables) => BudgetSnapshot
) => {
  const queryClient = useQueryClient();
  const key = budgetQueryKey(years);

  return useMutation(
    (variables: TVariables) => {
      const { method, data } = toPayload(variables);
      return invoke(method, data);
    },
    {
      mutationKey: BUDGET_MUTATION_KEY,
      onMutate: async (variables: TVariables) => {
        if (!optimistic) return undefined;

        const previous = queryClient.getQueryData<BudgetSnapshot>(key);
        const patched = previous ? optimistic(previous, variables) : undefined;
        // Сначала рисуем, потом отменяем запросы: `cancelQueries` асинхронный, и
        // ожидание перед правкой задерживало бы её на кадр.
        if (patched) queryClient.setQueryData(key, patched);
        await queryClient.cancelQueries(key);
        if (patched) queryClient.setQueryData(key, patched);

        return { previous };
      },
      onError: (_error, _variables, context) => {
        const previous = (context as { previous?: BudgetSnapshot } | undefined)?.previous;
        if (previous) queryClient.setQueryData(key, previous);
      },
      onSettled: () => {
        // Перечитываем, только когда затихла последняя правка: иначе ответ на
        // предыдущую приносит состояние, в котором текущей ещё нет.
        if (queryClient.isMutating({ mutationKey: BUDGET_MUTATION_KEY }) <= 1) {
          queryClient.invalidateQueries([BUDGET_QUERY_KEY]);
        }
      },
    }
  );
};

/**
 * Убрать отдел из бюджета — то есть удалить его строки. Сам департамент живёт
 * в справочнике компании, и бюджет его не трогает.
 */
export const useClearBudgetDepartment = (years: number[]) =>
  useBudgetMutation<string>(
    years,
    (departmentId) => ({
      method: DEPARTMENT_CLEAR_METHOD,
      data: { department_id: departmentId },
    }),
    (data, departmentId) => {
      const removedRows = new Set(
        data.rows.filter((row) => row.departmentId === departmentId).map((row) => row.id)
      );

      return {
        ...data,
        rows: data.rows.filter((row) => row.departmentId !== departmentId),
        amounts: data.amounts.filter((amount) => !removedRows.has(amount.rowId)),
      };
    }
  );

export type RowDraft = {
  guid?: string;
  departmentId: string;
  kind: "employee" | "vacancy";
  employeeId?: string | null;
  title?: string;
  positionId?: string | null;
  status: BudgetRowStatus;
  taxPercent: number;
  bonusPercent: number;
  /** Имя для оптимистичной отрисовки: с сервера оно придёт из профиля. */
  displayName?: string;
  /**
   * Год новой строки-сотрудника: под него сервер проставляет оклад из записи о
   * работе. Для вакансии и правки существующей строки не нужен — там суммы
   * вводятся руками.
   */
  year?: number;
};

export const useSaveBudgetRow = (years: number[]) =>
  useBudgetMutation<RowDraft>(
    years,
    (draft) => ({
      method: ROW_SAVE_METHOD,
      data: {
        guid: draft.guid,
        department_id: draft.departmentId,
        kind: draft.kind,
        employee_id: draft.employeeId ?? null,
        title: draft.title ?? "",
        position_id: draft.positionId ?? null,
        status: draft.status,
        tax_percent: draft.taxPercent,
        bonus_percent: draft.bonusPercent,
        year: draft.year,
      },
    }),
    (data, draft) => {
      const patch = {
        departmentId: draft.departmentId,
        kind: draft.kind,
        employeeId: draft.employeeId ?? null,
        name: draft.displayName ?? draft.title ?? "",
        positionId: draft.positionId ?? null,
        status: draft.status,
        taxPercent: draft.taxPercent,
        bonusPercent: draft.bonusPercent,
      };

      return {
        ...data,
        rows: draft.guid
          ? data.rows.map((row) => (row.id === draft.guid ? { ...row, ...patch } : row))
          : [
              ...data.rows,
              {
                id: nextPendingId(),
                sortOrder: Math.max(-1, ...data.rows.map((row) => row.sortOrder)) + 1,
                ...patch,
              },
            ],
      };
    }
  );

export const useDeleteBudgetRow = (years: number[]) =>
  useBudgetMutation<string>(
    years,
    (guid) => ({ method: ROW_DELETE_METHOD, data: { guid } }),
    (data, guid) => ({
      ...data,
      rows: data.rows.filter((row) => row.id !== guid),
      amounts: data.amounts.filter((amount) => amount.rowId !== guid),
    })
  );

export type AmountDraft = {
  rowId: string;
  year: number;
  /** Индекс месяца 0..11 — наружу уходит 1..12, как ждёт сервер. */
  monthIndex: number;
  field: "plan" | "fact";
  value: number;
};

export const useSaveBudgetAmount = (years: number[]) =>
  useBudgetMutation<AmountDraft>(
    years,
    (draft) => ({
      method: AMOUNT_SAVE_METHOD,
      data: {
        row_id: draft.rowId,
        year: draft.year,
        month: draft.monthIndex + 1,
        [draft.field]: draft.value,
      },
    }),
    (data, draft) => {
      const existing = data.amounts.find(
        (amount) => amount.rowId === draft.rowId && amount.year === draft.year
      );

      const patchMonths = (months: BudgetMonth[]) =>
        months.map((month, index) =>
          index === draft.monthIndex ? { ...month, [draft.field]: draft.value } : month
        );

      return {
        ...data,
        amounts: existing
          ? data.amounts.map((amount) =>
              amount === existing ? { ...amount, months: patchMonths(amount.months) } : amount
            )
          : [
              ...data.amounts,
              { rowId: draft.rowId, year: draft.year, months: patchMonths(emptyMonths()) },
            ],
      };
    }
  );
