// Universal approvals API.
//
// Everything goes through the udevs-hrms-reports `approval_*` cloud functions
// (PG-direct, transactional, single round trip) — see APPROVALS_DB_SCHEMA.md.
// The data is normalized (approval_processes + approval_stages +
// approval_process_departments + approval_actions), so the items API (one row
// per call, no cross-table transaction) is not a fit here.
//
// The ledger is keyed by (entity_type, entity_id) so ANY module plugs in by
// passing its own entityType ("absence", "attendance", …).

import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "react-query";
import httpRequest, {
  injectCompaniesIdIntoInvokeFunctionRequest,
} from "../httpRequest";
import authStore from "../../store/auth.store";
import { retryWithFreshToken } from "../unauthorizedHandler";
import type {
  ApprovalProcess,
  ApprovalProcessType,
  ApprovalRef,
  ApprovalStage,
} from "../../modules/Settings/Approvals/mockData";
import type { RequestApprovalProgress } from "../../modules/Settings/Approvals/approvalRuntime";

const REPORTS_BASE_URL = "https://api.admin.u-code.io";
const REPORTS_FUNCTION_PATH =
  "/v2/invoke_function/udevs-hrms-reports?project-id=9a462573-ce11-4288-928a-a6ba754b6998";

const LIST_PROCESSES_METHOD = "approval_list_processes";
const SAVE_PROCESS_METHOD = "approval_save_process";
const DELETE_PROCESS_METHOD = "approval_delete_process";
const GET_PROGRESS_METHOD = "approval_get_progress";
const APPROVE_STAGE_METHOD = "approval_approve_stage";
const RESET_METHOD = "approval_reset";

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

// --- approval_processes (config) ------------------------------------------

const mapResultToProcess = (row: Record<string, unknown>): ApprovalProcess => ({
  id: String(row.id ?? ""),
  title: typeof row.title === "string" ? row.title : "",
  type: (typeof row.type === "string" && row.type
    ? row.type
    : "absence_approval") as ApprovalProcessType,
  description: typeof row.description === "string" ? row.description : "",
  departments: Array.isArray(row.departments)
    ? (row.departments as ApprovalRef[])
    : [],
  stages: Array.isArray(row.stages) ? (row.stages as ApprovalStage[]) : [],
});

const listProcesses = async (): Promise<ApprovalProcess[]> => {
  const result = await invoke(LIST_PROCESSES_METHOD, {});
  const processes =
    result && Array.isArray(result.processes) ? result.processes : [];
  return processes.filter(isRecord).map(mapResultToProcess);
};

const saveProcess = (id: string | undefined, process: Omit<ApprovalProcess, "id">) =>
  invoke(SAVE_PROCESS_METHOD, {
    ...(id ? { guid: id } : {}),
    title: process.title,
    type: process.type,
    description: process.description,
    department_ids: process.departments.map((dep) => dep.id),
    stages: process.stages.map((stage) => ({
      id: stage.id,
      title: stage.title,
      positionId: stage.positionId,
    })),
  });

const deleteProcess = (guid: string) =>
  invoke(DELETE_PROCESS_METHOD, { guid });

/** Pure: the process of the given type that covers a department (or undefined). */
export const findApprovalProcessFor = (
  processes: ApprovalProcess[],
  type: ApprovalProcessType,
  departmentId: string | null | undefined
): ApprovalProcess | undefined => {
  if (!departmentId) return undefined;
  return processes.find(
    (process) =>
      process.type === type &&
      process.stages.length > 0 &&
      process.departments.some((dep) => dep.id === departmentId)
  );
};

/**
 * Цепочка для строки посещаемости на согласовании. `integration` в статусе
 * `requested` появляется только от отметки вне радиуса филиала — остальные
 * отметки сервер сразу засчитывает; `manual` — ручная заявка на правку.
 */
export const attendanceApprovalType = (sourceType: string): ApprovalProcessType =>
  sourceType === "integration" ? "remote_mark_approval" : "attendance_change_approval";

// --- approval_actions ledger ----------------------------------------------

export type EntityApprovalsMap = Record<string, RequestApprovalProgress>;

const getProgress = async (
  entityType: string,
  entityIds: string[]
): Promise<EntityApprovalsMap> => {
  if (entityIds.length === 0) return {};
  const result = await invoke(GET_PROGRESS_METHOD, {
    entity_type: entityType,
    entity_ids: entityIds,
  });
  return result && isRecord(result.progress)
    ? (result.progress as EntityApprovalsMap)
    : {};
};

export interface ApproveStageInput {
  entityType: string;
  entityId: string;
  processId: string;
  stageId: string;
  comment?: string;
}

export interface ApproveStageResult {
  entityId: string;
  approvedCount: number;
  totalStages: number;
  isComplete: boolean;
  progress: RequestApprovalProgress;
}

const getCurrentUserBaseId = (): string =>
  (typeof authStore.user_data?.guid === "string" && authStore.user_data.guid) ||
  (typeof authStore.user?.guid === "string" && authStore.user.guid) ||
  "";

const approveStage = async (
  input: ApproveStageInput
): Promise<ApproveStageResult> => {
  const result =
    (await invoke(APPROVE_STAGE_METHOD, {
      entity_type: input.entityType,
      entity_id: input.entityId,
      approval_processes_id: input.processId,
      stage_id: input.stageId,
      user_base_id: getCurrentUserBaseId(),
      comment: input.comment ?? "",
    })) ?? {};
  return {
    entityId: String(result.entity_id ?? input.entityId),
    approvedCount: Number(result.approved_count ?? 0),
    totalStages: Number(result.total_stages ?? 0),
    isComplete: Boolean(result.is_complete),
    progress: isRecord(result.progress)
      ? (result.progress as RequestApprovalProgress)
      : { processId: input.processId, approvals: [] },
  };
};

const resetApproval = (entityType: string, entityId: string) =>
  invoke(RESET_METHOD, { entity_type: entityType, entity_id: entityId });

// --- current user's position (for stage-approval gating) ------------------

const fetchCurrentUserPositionId = async (guid: string): Promise<string> => {
  const res = await httpRequest.get(`/v2/items/user_base/${guid}`);
  const row =
    isRecord(res) && isRecord(res.response)
      ? res.response
      : isRecord(res) && typeof res.guid === "string"
      ? res
      : null;
  return row && typeof row.positions_id === "string" ? row.positions_id : "";
};

export const approvalService = {
  listProcesses,
  saveProcess,
  deleteProcess,
  getProgress,
  approveStage,
  resetApproval,
};

// --- React Query hooks -----------------------------------------------------

export const useApprovalProcessesQuery = (
  querySettings: Record<string, unknown> = {}
) =>
  useQuery({
    queryKey: ["approval-processes"],
    queryFn: listProcesses,
    staleTime: 60_000,
    ...querySettings,
  });

export const useApprovalProcessQuery = (guid?: string) =>
  useQuery({
    queryKey: ["approval-processes"],
    queryFn: listProcesses,
    enabled: Boolean(guid),
    staleTime: 60_000,
    select: (rows: ApprovalProcess[]) =>
      rows.find((process) => process.id === guid) ?? null,
  });

export const useSaveApprovalProcess = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      process,
    }: {
      id?: string;
      process: Omit<ApprovalProcess, "id">;
    }) => saveProcess(id, process),
    onSuccess: () => queryClient.invalidateQueries(["approval-processes"]),
  });
};

export const useDeleteApprovalProcess = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (guid: string) => deleteProcess(guid),
    onSuccess: () => queryClient.invalidateQueries(["approval-processes"]),
  });
};

export const useEntityApprovalsQuery = (
  entityType: string,
  entityIds: string[],
  querySettings: Record<string, unknown> = {}
) => {
  const ids = Array.from(new Set(entityIds.filter(Boolean))).sort();
  return useQuery({
    queryKey: ["entity-approvals", entityType, ids],
    queryFn: () => getProgress(entityType, ids),
    enabled: ids.length > 0,
    ...querySettings,
  });
};

export const useApproveStage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: approveStage,
    onSuccess: (_result, variables) =>
      queryClient.invalidateQueries(["entity-approvals", variables.entityType]),
  });
};

export const useResetApproval = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      entityType,
      entityId,
    }: {
      entityType: string;
      entityId: string;
    }) => resetApproval(entityType, entityId),
    onSuccess: (_result, variables) =>
      queryClient.invalidateQueries(["entity-approvals", variables.entityType]),
  });
};

/** Position id of the logged-in user — used to gate stage approvals. */
export const useCurrentUserPositionId = (): string | undefined => {
  const guid = getCurrentUserBaseId();
  const { data } = useQuery({
    queryKey: ["current-user-position", guid],
    queryFn: () => fetchCurrentUserPositionId(guid),
    enabled: Boolean(guid),
    staleTime: 5 * 60_000,
  });
  return data;
};
