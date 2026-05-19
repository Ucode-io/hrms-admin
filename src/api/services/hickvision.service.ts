import axios from "axios";
import authStore from "../../store/auth.store";
import { injectCompaniesIdIntoInvokeFunctionRequest } from "../httpRequest";
import { handleUnauthorizedError } from "../unauthorizedHandler";

const API_BASE_URL = "https://api.admin.u-code.io";
const HICKVISION_FUNCTION_PATH =
  "/v2/invoke_function/udevs-hrms-hickvision?project-id=9a462573-ce11-4288-928a-a6ba754b6998";
const SYNC_ATTENDANCE_METHOD = "sync_attendance_by_date_range";

type JsonRecord = Record<string, unknown>;

export type SyncAttendanceSummary = {
  total_events: number;
  inserted_integration: number;
  updated_integration: number;
  skipped_manual_accepted: number;
  skipped_attendance_exists: number;
};

export type SyncAttendanceByDateRangeResult = {
  mode: string;
  method: typeof SYNC_ATTENDANCE_METHOD;
  range: {
    companies_id: string;
    from_date: string;
    to_date: string;
  };
  summary: SyncAttendanceSummary;
  results: Array<Record<string, unknown>>;
};

export type SyncAttendanceByDateRangeInvokeResponse = {
  method: typeof SYNC_ATTENDANCE_METHOD;
  result: SyncAttendanceByDateRangeResult;
};

const hickvisionRequest = axios.create({
  baseURL: API_BASE_URL,
  timeout: 100_000,
  headers: {
    "Content-Type": "application/json",
  },
});

hickvisionRequest.interceptors.request.use((config) => {
  const token = authStore.token ?? localStorage.getItem("auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return injectCompaniesIdIntoInvokeFunctionRequest(config);
});

hickvisionRequest.interceptors.response.use(
  (response) => response,
  (error) => {
    handleUnauthorizedError(error);
    return Promise.reject(error);
  }
);

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null;

const extractGatewayPayload = (raw: unknown): unknown => {
  if (!isRecord(raw)) return null;

  if (typeof raw.server_error === "string" && raw.server_error.trim()) {
    throw new Error(raw.server_error);
  }

  if (isRecord(raw.data) && typeof raw.data.server_error === "string" && raw.data.server_error.trim()) {
    throw new Error(raw.data.server_error);
  }

  if (isRecord(raw.data) && isRecord(raw.data.data)) {
    return raw.data.data;
  }

  return raw.data;
};

const normalizeSyncAttendanceResponse = (
  value: unknown
): SyncAttendanceByDateRangeInvokeResponse => {
  if (
    !isRecord(value) ||
    value.method !== SYNC_ATTENDANCE_METHOD ||
    !isRecord(value.result)
  ) {
    throw new Error("Unexpected response format for sync_attendance_by_date_range");
  }

  return value as unknown as SyncAttendanceByDateRangeInvokeResponse;
};

const hickvisionService = {
  syncAttendanceByDateRange: async (requestData: {
    from_date: string;
    to_date: string;
    companies_id?: string;
  }): Promise<SyncAttendanceByDateRangeInvokeResponse> => {
    const response = await hickvisionRequest.post(HICKVISION_FUNCTION_PATH, {
      data: {
        method: SYNC_ATTENDANCE_METHOD,
        data: requestData,
      },
    });

    const payload = extractGatewayPayload(response.data);
    return normalizeSyncAttendanceResponse(payload);
  },
};

export default hickvisionService;
