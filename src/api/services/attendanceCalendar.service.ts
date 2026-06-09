import axios from "axios";
import { useQuery } from "react-query";
import authStore from "../../store/auth.store";
import { injectCompaniesIdIntoInvokeFunctionRequest } from "../httpRequest";
import { handleUnauthorizedError } from "../unauthorizedHandler";

const REPORTS_BASE_URL = "https://api.admin.u-code.io";
const REPORTS_FUNCTION_PATH =
  "/v2/invoke_function/udevs-hrms-reports?project-id=9a462573-ce11-4288-928a-a6ba754b6998";
const METHOD = "get_calendar_attendance";

export type CalendarAttendanceParams = {
  employeeIds: string[];
  dateFrom: string;
  dateTo: string;
};

export type CalendarAttendanceRow = {
  guid: string;
  user_base_id: string;
  date: string;
  check_in_time?: string | null;
  check_out_time?: string | null;
  delay_time?: string | null;
  action_status?: string[] | string | null;
  status?: string[] | string | null;
  source_type?: string[] | string | null;
  absences_id?: string | null;
  created_at?: string | null;
};

type AttendanceListResponse = {
  count: number;
  response: CalendarAttendanceRow[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const reportsRequest = axios.create({
  baseURL: REPORTS_BASE_URL,
  timeout: 100_000,
  headers: { "Content-Type": "application/json" },
});

reportsRequest.interceptors.request.use((config) => {
  const token = authStore.token ?? localStorage.getItem("auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return injectCompaniesIdIntoInvokeFunctionRequest(config);
});

reportsRequest.interceptors.response.use(
  (response) => response,
  (error) => {
    handleUnauthorizedError(error);
    return Promise.reject(error);
  }
);

const normalizeListResult = (result: Record<string, unknown>): AttendanceListResponse => {
  const response = Array.isArray(result.response)
    ? (result.response as CalendarAttendanceRow[])
    : [];
  const safeCount = Number(result.count || 0);
  return {
    count: Number.isFinite(safeCount) && safeCount > 0 ? safeCount : response.length,
    response,
  };
};

// The invoke_function response nests the gateway result under a few possible
// envelopes ({ data: { data: { method, result } } }, etc.). Walk down until we
// find the node carrying our method's result and pull out its `response` array.
const findCalendarResult = (raw: unknown, depth = 0): AttendanceListResponse | null => {
  if (depth > 6 || !isRecord(raw)) return null;

  const result = isRecord(raw.result) ? raw.result : null;
  if (raw.method === METHOD && result) {
    return normalizeListResult(result);
  }

  if (result && Array.isArray((result as Record<string, unknown>).response)) {
    return normalizeListResult(result);
  }

  if (Array.isArray((raw as Record<string, unknown>).response)) {
    return normalizeListResult(raw);
  }

  return findCalendarResult(raw.data, depth + 1);
};

const fetchCalendarAttendance = async (
  params: CalendarAttendanceParams
): Promise<AttendanceListResponse> => {
  const employeeIds = Array.from(
    new Set(params.employeeIds.map((id) => id.trim()).filter(Boolean))
  );

  if (employeeIds.length === 0 || !params.dateFrom || !params.dateTo) {
    return { count: 0, response: [] };
  }

  const res = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
    data: {
      method: METHOD,
      data: {
        employee_ids: employeeIds,
        date_from: params.dateFrom,
        date_to: params.dateTo,
      },
    },
  });

  return findCalendarResult(res.data) || { count: 0, response: [] };
};

export const useCalendarAttendanceQuery = ({
  params,
  querySettings = {},
}: {
  params: CalendarAttendanceParams;
  querySettings?: Record<string, unknown>;
}) => {
  const normalizedEmployeeIds = Array.from(
    new Set((params.employeeIds || []).map((id) => id.trim()).filter(Boolean))
  ).sort();

  return useQuery({
    queryKey: [
      "calendar-attendance",
      normalizedEmployeeIds,
      params.dateFrom,
      params.dateTo,
    ],
    queryFn: () =>
      fetchCalendarAttendance({
        employeeIds: normalizedEmployeeIds,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
      }),
    enabled:
      normalizedEmployeeIds.length > 0 &&
      Boolean(params.dateFrom) &&
      Boolean(params.dateTo),
    ...querySettings,
  });
};
