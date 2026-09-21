// Survey ↔ employee assignment API.
//
// Goes through the udevs-hrms-reports `survey_list_employees` /
// `survey_assign_employees` cloud functions (PG-direct, transactional) instead
// of the ucode items API: the assignment set is replaced in ONE request, not
// one insert/delete per employee. Mirrors role.service.ts.

import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { injectCompaniesIdIntoInvokeFunctionRequest } from "../httpRequest";
import authStore from "../../store/auth.store";
import { retryWithFreshToken } from "../unauthorizedHandler";

const REPORTS_BASE_URL = "https://api.admin.u-code.io";
const REPORTS_FUNCTION_PATH =
  "/v2/invoke_function/udevs-hrms-reports?project-id=9a462573-ce11-4288-928a-a6ba754b6998";

const LIST_METHOD = "survey_list_employees";
const ASSIGN_METHOD = "survey_assign_employees";
const RESULTS_METHOD = "survey_results";

export interface SurveyEmployee {
  user_base_id: string;
  full_name: string;
}

export interface SurveyEmployeesResult {
  count: number;
  response: SurveyEmployee[];
}

export interface SurveyResultEmployee {
  user_base_id: string;
  full_name: string;
  completed: boolean;
  completed_at: string | null;
}

export interface SurveyResultResponse {
  user_base_id: string;
  full_name: string;
  answers: Record<string, unknown>;
  completed_at: string | null;
}

export interface SurveyResults {
  surveys_id: string;
  assigned_count: number;
  completed_count: number;
  employees: SurveyResultEmployee[];
  responses: SurveyResultResponse[];
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
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return injectCompaniesIdIntoInvokeFunctionRequest(config);
});

reportsRequest.interceptors.response.use(
  (response) => response,
  retryWithFreshToken(reportsRequest)
);

// The invoke_function response nests the gateway result under a few envelopes;
// walk down until we find the node carrying our method's result.
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

const invoke = async (
  method: string,
  data: Record<string, unknown>
): Promise<Record<string, unknown> | null> => {
  const res = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
    data: { method, data },
  });
  return findGatewayResult(res.data, method);
};

const surveyEmployeeService = {
  getListBySurvey: async (surveyGuid: string): Promise<SurveyEmployeesResult> => {
    const result = await invoke(LIST_METHOD, { surveys_id: surveyGuid });
    const rawEmployees =
      result && Array.isArray(result.employees) ? result.employees : [];

    const response: SurveyEmployee[] = rawEmployees.filter(isRecord).map((row) => ({
      user_base_id: String(row.user_base_id ?? ""),
      full_name: typeof row.full_name === "string" ? row.full_name : String(row.user_base_id ?? ""),
    }));

    return { count: response.length, response };
  },

  getResults: async (surveyGuid: string): Promise<SurveyResults> => {
    const result = await invoke(RESULTS_METHOD, { surveys_id: surveyGuid });

    const employees = (result && Array.isArray(result.employees) ? result.employees : [])
      .filter(isRecord)
      .map((row) => ({
        user_base_id: String(row.user_base_id ?? ""),
        full_name: typeof row.full_name === "string" ? row.full_name : "",
        completed: Boolean(row.completed),
        completed_at: typeof row.completed_at === "string" ? row.completed_at : null,
      }));

    const responses = (result && Array.isArray(result.responses) ? result.responses : [])
      .filter(isRecord)
      .map((row) => ({
        user_base_id: String(row.user_base_id ?? ""),
        full_name: typeof row.full_name === "string" ? row.full_name : "",
        answers: isRecord(row.answers) ? row.answers : {},
        completed_at: typeof row.completed_at === "string" ? row.completed_at : null,
      }));

    return {
      surveys_id: String(result?.surveys_id ?? surveyGuid),
      assigned_count: Number(result?.assigned_count ?? employees.length),
      completed_count: Number(result?.completed_count ?? responses.length),
      employees,
      responses,
    };
  },

  syncBySurvey: ({
    surveyGuid,
    employeeIds,
  }: {
    surveyGuid: string;
    employeeIds: string[];
  }) => {
    const userBaseIds = Array.from(
      new Set(employeeIds.map((id) => id.trim()).filter(Boolean))
    );

    return invoke(ASSIGN_METHOD, {
      surveys_id: surveyGuid,
      user_base_ids: userBaseIds,
    });
  },
};

export const useSurveyEmployeesQuery = (surveyGuid: string, querySettings: any = {}) => {
  return useQuery({
    queryKey: ["SURVEY_EMPLOYEES", surveyGuid],
    queryFn: () => surveyEmployeeService.getListBySurvey(surveyGuid),
    enabled: Boolean(surveyGuid),
    ...querySettings,
  });
};

export const useSurveyResultsQuery = (surveyGuid: string, querySettings: any = {}) => {
  return useQuery({
    queryKey: ["SURVEY_RESULTS", surveyGuid],
    queryFn: () => surveyEmployeeService.getResults(surveyGuid),
    enabled: Boolean(surveyGuid),
    ...querySettings,
  });
};

export const useSyncSurveyEmployees = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      surveyGuid,
      employeeIds,
    }: {
      surveyGuid: string;
      employeeIds: string[];
    }) => surveyEmployeeService.syncBySurvey({ surveyGuid, employeeIds }),
    onSuccess: () => {
      queryClient.invalidateQueries(["SURVEY_EMPLOYEES"]);
      queryClient.invalidateQueries(["SURVEYS"]);
    },
  });
};

export default surveyEmployeeService;
