import axios from "axios";
import { useQuery } from "react-query";
import authStore from "../../store/auth.store";
import { injectCompaniesIdIntoInvokeFunctionRequest } from "../httpRequest";
import { handleUnauthorizedError } from "../unauthorizedHandler";

const REPORTS_BASE_URL = "https://api.admin.u-code.io";
const REPORTS_FUNCTION_PATH =
  "/v2/invoke_function/udevs-hrms-reports?project-id=9a462573-ce11-4288-928a-a6ba754b6998";
const METHOD = "get_employee_absence_summary";

export type EmployeeAbsenceStatus = "pending" | "approved" | "rejected";

export type EmployeeAbsencePeriodSlug = "week" | "month" | "year";

export interface EmployeeAbsencePolicy {
  guid: string;
  title: string;
  icon: string | null;
  color: string | null;
  period: EmployeeAbsencePeriodSlug;
  limit: number;
  cycle: { from: string; to: string };
  used_days: number;
  pending_days: number;
  available: number;
}

export interface EmployeeAbsencePolicyRef {
  guid: string;
  title: string;
  icon: string | null;
  color: string | null;
  period: EmployeeAbsencePeriodSlug;
}

export interface EmployeeAbsenceRequest {
  guid: string;
  absence_policies_id: string | null;
  policy: EmployeeAbsencePolicyRef | null;
  date_from: string | null;
  date_to: string | null;
  requested_days: number;
  status: EmployeeAbsenceStatus;
  note: string | null;
  attachments: string | null;
  requested_breakdown: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reject_reason: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface EmployeeAbsenceSummary {
  as_of_date: string;
  user_base_id: string;
  policies: EmployeeAbsencePolicy[];
  requests: EmployeeAbsenceRequest[];
  history: {
    year: number;
    from: string;
    to: string;
    total_used_days: number;
    approved: EmployeeAbsenceRequest[];
  };
}

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

const findInvokeResult = (raw: unknown, depth = 0): EmployeeAbsenceSummary | null => {
  if (depth > 6 || !isRecord(raw)) return null;

  if (raw.method === METHOD && isRecord(raw.result)) {
    return raw.result as unknown as EmployeeAbsenceSummary;
  }

  if (isRecord(raw.result) && Array.isArray((raw.result as Record<string, unknown>).policies)) {
    return raw.result as unknown as EmployeeAbsenceSummary;
  }

  if (Array.isArray((raw as Record<string, unknown>).policies)) {
    return raw as unknown as EmployeeAbsenceSummary;
  }

  return findInvokeResult(raw.data, depth + 1);
};

const unwrap = (raw: unknown): EmployeeAbsenceSummary => {
  const found = findInvokeResult(raw);
  if (found) return found;
  throw new Error("Unexpected response format for get_employee_absence_summary");
};

export interface FetchEmployeeAbsenceSummaryParams {
  userBaseId: string;
  asOfDate?: string;
  historyYear?: number;
}

export async function fetchEmployeeAbsenceSummary({
  userBaseId,
  asOfDate,
  historyYear,
}: FetchEmployeeAbsenceSummaryParams): Promise<EmployeeAbsenceSummary> {
  const requestData: Record<string, unknown> = { user_base_id: userBaseId };
  if (asOfDate) requestData.as_of_date = asOfDate;
  if (typeof historyYear === "number") requestData.history_year = historyYear;

  const response = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
    data: {
      method: METHOD,
      data: requestData,
    },
  });

  return unwrap(response.data);
}

export const useEmployeeAbsenceSummaryQuery = ({
  userBaseId,
  asOfDate,
  historyYear,
  querySettings = {},
}: FetchEmployeeAbsenceSummaryParams & {
  querySettings?: Record<string, unknown>;
}) => {
  const settings = querySettings as Record<string, unknown> & { enabled?: boolean };
  const { enabled: externalEnabled, ...rest } = settings;
  const enabled =
    typeof externalEnabled === "boolean"
      ? Boolean(userBaseId) && externalEnabled
      : Boolean(userBaseId);

  return useQuery({
    queryKey: ["employee-absence-summary", userBaseId, asOfDate, historyYear],
    queryFn: () =>
      fetchEmployeeAbsenceSummary({ userBaseId, asOfDate, historyYear }),
    enabled,
    ...rest,
  });
};
