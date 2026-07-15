// Training ↔ employee assignment, materials and homework review API.
//
// Goes through the udevs-hrms-reports training_* cloud functions (PG-direct,
// transactional) instead of the ucode items API — assignment and materials
// sets are replaced in ONE request each. Mirrors surveyEmployee.service.ts.

import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { injectCompaniesIdIntoInvokeFunctionRequest } from "../httpRequest";
import authStore from "../../store/auth.store";
import { handleUnauthorizedError } from "../unauthorizedHandler";

const REPORTS_BASE_URL = "https://api.admin.u-code.io";
const REPORTS_FUNCTION_PATH =
  "/v2/invoke_function/udevs-hrms-reports?project-id=9a462573-ce11-4288-928a-a6ba754b6998";

const LIST_EMPLOYEES_METHOD = "training_list_employees";
const ASSIGN_METHOD = "training_assign_employees";
const LIST_MATERIALS_METHOD = "training_list_materials";
const SAVE_MATERIALS_METHOD = "training_save_materials";
const RESULTS_METHOD = "training_results";
const REVIEW_METHOD = "training_review_submission";

export type TrainingMaterialType = "file" | "link" | "video";
export type TrainingSubmissionStatus = "submitted" | "accepted" | "rejected";

export interface TrainingEmployee {
  user_base_id: string;
  full_name: string;
}

export interface TrainingEmployeesResult {
  count: number;
  response: TrainingEmployee[];
}

export interface TrainingMaterial {
  guid?: string;
  title: string;
  material_type: TrainingMaterialType;
  url: string;
  file_name?: string | null;
  file_size?: number | null;
  sort_order?: number;
}

export interface TrainingSubmission {
  guid: string;
  file_url: string;
  file_name: string;
  file_size: number | null;
  comment: string;
  status: TrainingSubmissionStatus;
  review_comment: string;
  submitted_at: string | null;
  reviewed_at: string | null;
}

export interface TrainingResultEmployee {
  user_base_id: string;
  full_name: string;
  submission: TrainingSubmission | null;
}

export interface TrainingResults {
  trainings_id: string;
  location: string;
  trainer_user_base_id: string;
  trainer_name: string;
  assigned_count: number;
  submitted_count: number;
  accepted_count: number;
  rejected_count: number;
  employees: TrainingResultEmployee[];
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
  (error) => {
    handleUnauthorizedError(error);
    return Promise.reject(error);
  }
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

const mapSubmission = (raw: unknown): TrainingSubmission | null => {
  if (!isRecord(raw) || !raw.guid) return null;
  const status = String(raw.status || "submitted");
  return {
    guid: String(raw.guid),
    file_url: typeof raw.file_url === "string" ? raw.file_url : "",
    file_name: typeof raw.file_name === "string" ? raw.file_name : "",
    file_size: typeof raw.file_size === "number" ? raw.file_size : null,
    comment: typeof raw.comment === "string" ? raw.comment : "",
    status: (["submitted", "accepted", "rejected"].includes(status)
      ? status
      : "submitted") as TrainingSubmissionStatus,
    review_comment: typeof raw.review_comment === "string" ? raw.review_comment : "",
    submitted_at: typeof raw.submitted_at === "string" ? raw.submitted_at : null,
    reviewed_at: typeof raw.reviewed_at === "string" ? raw.reviewed_at : null,
  };
};

const trainingGatewayService = {
  getEmployeesByTraining: async (trainingGuid: string): Promise<TrainingEmployeesResult> => {
    const result = await invoke(LIST_EMPLOYEES_METHOD, { trainings_id: trainingGuid });
    const rawEmployees =
      result && Array.isArray(result.employees) ? result.employees : [];

    const response: TrainingEmployee[] = rawEmployees.filter(isRecord).map((row) => ({
      user_base_id: String(row.user_base_id ?? ""),
      full_name: typeof row.full_name === "string" ? row.full_name : String(row.user_base_id ?? ""),
    }));

    return { count: response.length, response };
  },

  syncEmployees: ({
    trainingGuid,
    employeeIds,
  }: {
    trainingGuid: string;
    employeeIds: string[];
  }) => {
    const userBaseIds = Array.from(
      new Set(employeeIds.map((id) => id.trim()).filter(Boolean))
    );

    return invoke(ASSIGN_METHOD, {
      trainings_id: trainingGuid,
      user_base_ids: userBaseIds,
    });
  },

  getMaterials: async (trainingGuid: string): Promise<TrainingMaterial[]> => {
    const result = await invoke(LIST_MATERIALS_METHOD, { trainings_id: trainingGuid });
    const rawMaterials =
      result && Array.isArray(result.materials) ? result.materials : [];

    return rawMaterials.filter(isRecord).map((row, index) => ({
      guid: typeof row.guid === "string" ? row.guid : undefined,
      title: typeof row.title === "string" ? row.title : "",
      material_type: (["file", "link", "video"].includes(String(row.material_type))
        ? String(row.material_type)
        : "file") as TrainingMaterialType,
      url: typeof row.url === "string" ? row.url : "",
      file_name: typeof row.file_name === "string" ? row.file_name : null,
      file_size: typeof row.file_size === "number" ? row.file_size : null,
      sort_order: typeof row.sort_order === "number" ? row.sort_order : index,
    }));
  },

  saveMaterials: ({
    trainingGuid,
    materials,
  }: {
    trainingGuid: string;
    materials: TrainingMaterial[];
  }) =>
    invoke(SAVE_MATERIALS_METHOD, {
      trainings_id: trainingGuid,
      materials: materials.map((material, index) => ({
        title: material.title,
        material_type: material.material_type,
        url: material.url,
        file_name: material.file_name || null,
        file_size: material.file_size ?? null,
        sort_order: index,
      })),
    }),

  getResults: async (trainingGuid: string): Promise<TrainingResults> => {
    const result = await invoke(RESULTS_METHOD, { trainings_id: trainingGuid });

    const employees = (result && Array.isArray(result.employees) ? result.employees : [])
      .filter(isRecord)
      .map((row) => ({
        user_base_id: String(row.user_base_id ?? ""),
        full_name: typeof row.full_name === "string" ? row.full_name : "",
        submission: mapSubmission(row.submission),
      }));

    return {
      trainings_id: String(result?.trainings_id ?? trainingGuid),
      location: typeof result?.location === "string" ? result.location : "",
      trainer_user_base_id:
        typeof result?.trainer_user_base_id === "string" ? result.trainer_user_base_id : "",
      trainer_name: typeof result?.trainer_name === "string" ? result.trainer_name : "",
      assigned_count: Number(result?.assigned_count ?? employees.length),
      submitted_count: Number(result?.submitted_count ?? 0),
      accepted_count: Number(result?.accepted_count ?? 0),
      rejected_count: Number(result?.rejected_count ?? 0),
      employees,
    };
  },

  reviewSubmission: ({
    trainingGuid,
    userBaseId,
    status,
    reviewComment,
  }: {
    trainingGuid: string;
    userBaseId: string;
    status: TrainingSubmissionStatus;
    reviewComment?: string;
  }) =>
    invoke(REVIEW_METHOD, {
      trainings_id: trainingGuid,
      user_base_id: userBaseId,
      status,
      review_comment: reviewComment || null,
    }),
};

export const useTrainingEmployeesQuery = (trainingGuid: string, querySettings: any = {}) => {
  return useQuery({
    queryKey: ["TRAINING_EMPLOYEES", trainingGuid],
    queryFn: () => trainingGatewayService.getEmployeesByTraining(trainingGuid),
    enabled: Boolean(trainingGuid),
    ...querySettings,
  });
};

export const useTrainingMaterialsQuery = (trainingGuid: string, querySettings: any = {}) => {
  return useQuery({
    queryKey: ["TRAINING_MATERIALS", trainingGuid],
    queryFn: () => trainingGatewayService.getMaterials(trainingGuid),
    enabled: Boolean(trainingGuid),
    ...querySettings,
  });
};

export const useTrainingResultsQuery = (trainingGuid: string, querySettings: any = {}) => {
  return useQuery({
    queryKey: ["TRAINING_RESULTS", trainingGuid],
    queryFn: () => trainingGatewayService.getResults(trainingGuid),
    enabled: Boolean(trainingGuid),
    ...querySettings,
  });
};

export const useSyncTrainingEmployees = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { trainingGuid: string; employeeIds: string[] }) =>
      trainingGatewayService.syncEmployees(params),
    onSuccess: () => {
      queryClient.invalidateQueries(["TRAINING_EMPLOYEES"]);
      queryClient.invalidateQueries(["TRAINING_RESULTS"]);
      queryClient.invalidateQueries(["TRAININGS"]);
    },
  });
};

export const useSaveTrainingMaterials = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { trainingGuid: string; materials: TrainingMaterial[] }) =>
      trainingGatewayService.saveMaterials(params),
    onSuccess: () => {
      queryClient.invalidateQueries(["TRAINING_MATERIALS"]);
    },
  });
};

export const useReviewTrainingSubmission = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      trainingGuid: string;
      userBaseId: string;
      status: TrainingSubmissionStatus;
      reviewComment?: string;
    }) => trainingGatewayService.reviewSubmission(params),
    onSuccess: () => {
      queryClient.invalidateQueries(["TRAINING_RESULTS"]);
    },
  });
};

export default trainingGatewayService;
