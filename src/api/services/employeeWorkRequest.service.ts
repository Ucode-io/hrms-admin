// Заявки на изменение работы — согласование добавления и правки должности.
//
// `employee_works` пишется items API напрямую, и «статус» на самой строке
// сделать нельзя: по этой истории считаются оклад, график и департамент, её
// читают табель, зарплаты и отчёты — неутверждённая строка сразу стала бы
// действующей. Поэтому заявка живёт отдельно (шлюз udevs-hrms-reports) и
// применяется к `employee_works` на сервере, когда пройдены все этапы.

import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { injectCompaniesIdIntoInvokeFunctionRequest } from "../httpRequest";
import authStore from "../../store/auth.store";
import { retryWithFreshToken } from "../unauthorizedHandler";

const REPORTS_BASE_URL = "https://api.admin.u-code.io";
const REPORTS_FUNCTION_PATH =
  "/v2/invoke_function/udevs-hrms-reports?project-id=9a462573-ce11-4288-928a-a6ba754b6998";

const SAVE_METHOD = "employee_work_request_save";
const LIST_METHOD = "employee_work_request_list";
const REVIEW_METHOD = "employee_work_request_review";
const DELETE_METHOD = "employee_work_request_delete";

/** Тип процесса в /settings/approvals и entity_type в ledger'е `approval_*`. */
export const EMPLOYEE_WORK_PROCESS_TYPE = "employee_work_approval";
export const EMPLOYEE_WORK_ENTITY_TYPE = "employee_work_request";

export const EMPLOYEE_WORK_REQUESTS_QUERY_KEY = "employee-work-requests";

export type EmployeeWorkRequestAction = "create" | "update";
export type EmployeeWorkRequestStatus = "pending" | "approved" | "rejected";

/** Поля, которые заявка вправе менять — белый список тот же, что на сервере. */
export interface EmployeeWorkRequestPayload {
  positions_id?: string | null;
  experience_levels_id?: string | null;
  departments_id?: string | null;
  locations_id?: string | null;
  employment_types_id?: string | null;
  employee_work_reason_id?: string | null;
  work_schedule_id?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  salary?: number | null;
  custom_data?: string | null;
}

export interface EmployeeWorkRequest {
  guid: string;
  userBaseId: string;
  employeeWorksId: string | null;
  action: EmployeeWorkRequestAction;
  status: EmployeeWorkRequestStatus;
  payload: EmployeeWorkRequestPayload;
  reviewComment: string;
  createdBy: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string | null;
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

const listRequests = async (userBaseId: string): Promise<EmployeeWorkRequest[]> => {
  const result = await invoke(LIST_METHOD, { user_base_id: userBaseId });
  const rows = result && Array.isArray(result.requests) ? result.requests : [];
  return rows.filter(isRecord) as unknown as EmployeeWorkRequest[];
};

export const useEmployeeWorkRequestsQuery = (userBaseId: string, enabled = true) =>
  useQuery(
    [EMPLOYEE_WORK_REQUESTS_QUERY_KEY, userBaseId],
    () => listRequests(userBaseId),
    { enabled: enabled && Boolean(userBaseId) }
  );

export interface SaveEmployeeWorkRequestInput {
  userBaseId: string;
  action: EmployeeWorkRequestAction;
  employeeWorksId?: string | null;
  payload: EmployeeWorkRequestPayload;
}

export const useSaveEmployeeWorkRequest = () => {
  const queryClient = useQueryClient();

  return useMutation(
    (input: SaveEmployeeWorkRequestInput) =>
      invoke(SAVE_METHOD, {
        user_base_id: input.userBaseId,
        action: input.action,
        ...(input.employeeWorksId ? { employee_works_id: input.employeeWorksId } : {}),
        payload: input.payload,
        created_by: authStore.user?.guid ?? authStore.user_data?.guid ?? undefined,
      }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries([EMPLOYEE_WORK_REQUESTS_QUERY_KEY]);
      },
    }
  );
};

export const useReviewEmployeeWorkRequest = () => {
  const queryClient = useQueryClient();

  return useMutation(
    (input: { guid: string; status: "approved" | "rejected"; comment?: string }) =>
      invoke(REVIEW_METHOD, {
        guid: input.guid,
        status: input.status,
        comment: input.comment ?? "",
        reviewed_by: authStore.user?.guid ?? authStore.user_data?.guid ?? undefined,
      }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries([EMPLOYEE_WORK_REQUESTS_QUERY_KEY]);
        // Одобрение применяет заявку к employee_works — история устарела.
        queryClient.invalidateQueries(["employee-works"]);
      },
    }
  );
};

export const useDeleteEmployeeWorkRequest = () => {
  const queryClient = useQueryClient();

  return useMutation((guid: string) => invoke(DELETE_METHOD, { guid }), {
    onSuccess: () => {
      queryClient.invalidateQueries([EMPLOYEE_WORK_REQUESTS_QUERY_KEY]);
    },
  });
};
