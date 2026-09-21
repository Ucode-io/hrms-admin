// Ручное время табеля — единственный пишущий слой модуля /timesheet.
//
// Записи Time Doctor править нельзя (ресинк пересоздаёт worklog'и), поэтому
// ручное время живёт в своей таблице и приходит в табель отдельным источником
// `hrms_manual`. Мутации инвалидируют кэш табеля целиком: одна запись меняет и
// список, и таймлайн, и страницу дня.

import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { injectCompaniesIdIntoInvokeFunctionRequest } from "../httpRequest";
import authStore from "../../store/auth.store";
import { retryWithFreshToken } from "../unauthorizedHandler";
import { TIMESHEET_QUERY_KEY } from "./timesheet.service";
import type { ManualTimeStatus, TimesheetEntry } from "../../modules/Timesheet/types";

const REPORTS_BASE_URL = "https://api.admin.u-code.io";
const REPORTS_FUNCTION_PATH =
  "/v2/invoke_function/udevs-hrms-reports?project-id=9a462573-ce11-4288-928a-a6ba754b6998";

const LIST_METHOD = "manual_time_list";
const SAVE_METHOD = "manual_time_save";
const REVIEW_METHOD = "manual_time_review";
const DELETE_METHOD = "manual_time_delete";

export const MANUAL_TIME_QUERY_KEY = "manual-time";

export type ManualTimeEntry = TimesheetEntry & {
  isManual: true;
  status: ManualTimeStatus;
  departmentId?: string | null;
};

export type ManualTimeListResult = {
  entries: ManualTimeEntry[];
  counts: { total: number; pending: number; approved: number; rejected: number };
  limit: number;
  offset: number;
};

export type ManualTimeSavePayload = {
  guid?: string;
  user_base_id: string;
  work_date: string;
  /** `HH:MM` — локальные часы; в UTC переводит сервер. */
  start_time?: string;
  end_time?: string;
  duration_minutes?: number;
  project_id?: string;
  project_name?: string;
  task_id?: string;
  task_name?: string;
  reason: string;
  created_by?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const request = axios.create({
  baseURL: REPORTS_BASE_URL,
  timeout: 100_000,
  headers: { "Content-Type": "application/json" },
});

request.interceptors.request.use((config) => {
  const token = authStore.token ?? localStorage.getItem("auth_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return injectCompaniesIdIntoInvokeFunctionRequest(config);
});

request.interceptors.response.use(
  (response) => response,
  retryWithFreshToken(request)
);

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

const invoke = async <T>(method: string, data: Record<string, unknown>): Promise<T | null> => {
  const res = await request.post(REPORTS_FUNCTION_PATH, { data: { method, data } });
  return findGatewayResult(res.data, method) as T | null;
};

export const useManualTimeListQuery = (
  params: {
    status?: ManualTimeStatus | ManualTimeStatus[];
    employee_ids?: string[];
    department_id?: string;
    date_from?: string;
    date_to?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {},
  enabled = true
) =>
  useQuery(
    [MANUAL_TIME_QUERY_KEY, "list", params],
    () => invoke<ManualTimeListResult>(LIST_METHOD, { ...params }),
    { enabled, keepPreviousData: true }
  );

/** Инвалидация после любой мутации: табель и очередь ручного времени. */
const useManualTimeInvalidation = () => {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries([TIMESHEET_QUERY_KEY]);
    void queryClient.invalidateQueries([MANUAL_TIME_QUERY_KEY]);
  };
};

export const useSaveManualTime = () => {
  const invalidate = useManualTimeInvalidation();
  return useMutation({
    mutationFn: (payload: ManualTimeSavePayload) =>
      invoke<{ entry: ManualTimeEntry | null }>(SAVE_METHOD, { ...payload }),
    onSuccess: invalidate,
  });
};

export const useReviewManualTime = () => {
  const invalidate = useManualTimeInvalidation();
  return useMutation({
    mutationFn: (payload: {
      guid: string;
      status: Extract<ManualTimeStatus, "approved" | "rejected">;
      reviewed_by?: string;
      comment?: string;
    }) => invoke<{ entry: ManualTimeEntry | null }>(REVIEW_METHOD, { ...payload }),
    onSuccess: invalidate,
  });
};

export const useDeleteManualTime = () => {
  const invalidate = useManualTimeInvalidation();
  return useMutation({
    mutationFn: (guid: string) => invoke<{ deleted: boolean }>(DELETE_METHOD, { guid }),
    onSuccess: invalidate,
  });
};
