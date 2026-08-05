// Табель времени — чтение интеграции Time Doctor через шлюз udevs-hrms-reports.
//
// Методы `timesheet_*` только читают: worklog'и пересоздаёт синхронизация Time
// Doctor, поэтому редактировать их из HRMS нечего. Слой соответственно без
// мутаций — одни query-хуки.
//
// Время приходит с сервера уже в локальном поясе компании строкой без Z
// («2026-06-15T09:05:00»). Оборачивать его в Date на клиенте нельзя: браузер
// в другом поясе сдвинет часы ещё раз. Поэтому часы и минуты берутся срезом
// строки, а Date используется только для календарных дат (без времени).

import axios from "axios";
import { useInfiniteQuery, useQuery } from "react-query";
import { injectCompaniesIdIntoInvokeFunctionRequest } from "../httpRequest";
import authStore from "../../store/auth.store";
import { handleUnauthorizedError } from "../unauthorizedHandler";
import type {
  TimesheetDayResult,
  TimesheetFilters,
  TimesheetListResult,
  TimesheetTimelineResult,
} from "../../modules/Timesheet/types";

const REPORTS_BASE_URL = "https://api.admin.u-code.io";
const REPORTS_FUNCTION_PATH =
  "/v2/invoke_function/udevs-hrms-reports?project-id=9a462573-ce11-4288-928a-a6ba754b6998";

const LIST_METHOD = "timesheet_list";
const TIMELINE_METHOD = "timesheet_timeline";
const DAY_METHOD = "timesheet_day";

export const TIMESHEET_QUERY_KEY = "timesheet";

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
  data: Record<string, unknown>
): Promise<T | null> => {
  const res = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
    data: { method, data },
  });
  return findGatewayResult(res.data, method) as T | null;
};

/** Фильтры → payload метода. Пустые значения не отправляем вовсе. */
const buildPayload = (
  range: { from: string; to: string },
  filters: TimesheetFilters
): Record<string, unknown> => {
  const payload: Record<string, unknown> = {
    date_from: range.from,
    date_to: range.to,
  };
  if (filters.search) payload.search = filters.search;
  if (filters.employeeId) payload.employee_ids = [filters.employeeId];
  if (filters.departmentId) payload.department_id = filters.departmentId;
  if (filters.projectId) payload.project_id = filters.projectId;
  if (filters.taskId) payload.task_id = filters.taskId;
  if (filters.source) payload.source = filters.source;
  return payload;
};

/**
 * Разовая выборка списка — для экспорта.
 *
 * Экспорт не может опираться на кэш таблицы: она отдаётся страницами, а в файл
 * нужен весь период целиком. Хука здесь нет намеренно — запрос делается по
 * нажатию кнопки и в кэше оседать не должен.
 */
export const fetchTimesheetList = (
  range: { from: string; to: string },
  filters: TimesheetFilters,
  limit: number
) => invoke<TimesheetListResult>(LIST_METHOD, { ...buildPayload(range, filters), limit });

export const useTimesheetListQuery = (
  range: { from: string; to: string },
  filters: TimesheetFilters,
  page: { limit: number; offset: number },
  enabled = true
) =>
  useQuery(
    [TIMESHEET_QUERY_KEY, "list", range, filters, page],
    () =>
      invoke<TimesheetListResult>(LIST_METHOD, {
        ...buildPayload(range, filters),
        limit: page.limit,
        offset: page.offset,
      }),
    { enabled: enabled && Boolean(range.from && range.to), keepPreviousData: true }
  );

/** Сколько строк тянем за раз — примерно экран таймлайна. */
export const TIMELINE_PAGE_SIZE = 25;

/**
 * Таймлайн грузится страницами по мере прокрутки: сотрудников в компании
 * больше сотни, а строка — это ещё и 31 ячейка в режиме месяца, поэтому весь
 * штат разом отдавать незачем.
 *
 * Итоги и справочники приходят с каждой страницей одинаковыми (сервер считает
 * их по всей компании), так что шапка берёт их из первой страницы и не скачет
 * при подгрузке.
 */
export const useTimesheetTimelineQuery = (
  range: { from: string; to: string },
  filters: TimesheetFilters,
  enabled = true
) =>
  useInfiniteQuery(
    [TIMESHEET_QUERY_KEY, "timeline", range, filters],
    ({ pageParam = 0 }) =>
      invoke<TimesheetTimelineResult>(TIMELINE_METHOD, {
        ...buildPayload(range, filters),
        limit: TIMELINE_PAGE_SIZE,
        offset: pageParam,
      }),
    {
      enabled: enabled && Boolean(range.from && range.to),
      // Без keepPreviousData: в react-query 3 его поведение с
      // useInfiniteQuery не определено, а выигрыш здесь мелкий — при смене
      // периода страница и так показывает спиннер.
      getNextPageParam: (lastPage) => {
        if (!lastPage) return undefined;
        const next = lastPage.offset + lastPage.limit;
        return next < lastPage.total ? next : undefined;
      },
    }
  );

/**
 * День сотрудника.
 *
 * `keepPreviousData` держит страницу собранной при переходе на соседний день:
 * сам сотрудник не меняется, поэтому шапка остаётся на месте, а блоки дня
 * подменяются скелетоном — вместо того чтобы всей странице схлопываться в
 * спиннер. Признак подмены — `isPreviousData`.
 */
export const useTimesheetDayQuery = (employeeId: string, date: string) =>
  useQuery(
    [TIMESHEET_QUERY_KEY, "day", employeeId, date],
    () => invoke<TimesheetDayResult>(DAY_METHOD, { employee_id: employeeId, date }),
    { enabled: Boolean(employeeId && date), keepPreviousData: true }
  );
