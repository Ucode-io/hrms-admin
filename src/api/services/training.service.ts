import { useMutation, useQuery, useQueryClient } from "react-query";
import httpRequest from "../httpRequest";
import { COMPANY_ID } from "./survey.service";

export type TrainingStatus = "draft" | "active" | "archived";

export interface Training {
  guid: string;
  title: string;
  companies_id: string;
  description?: string | null;
  status?: TrainingStatus | string | string[] | null;
  starts_at?: string | null;
  ends_at?: string | null;
  /** Trainer (who runs the training) → user_base.guid. */
  user_base_id?: string | null;
  location?: string | null;
  homework_required?: boolean | null;
  homework_deadline?: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface TrainingListResponse {
  count: number;
  response: Training[];
}

export interface TrainingListParams {
  limit?: number;
  offset?: number;
  search?: string;
}

export interface TrainingUpsertPayload {
  title: string;
  description?: string | null;
  status?: string[] | null;
  starts_at?: string | null;
  ends_at?: string | null;
  /** Trainer (who runs the training) → user_base.guid. */
  user_base_id?: string | null;
  location?: string | null;
  homework_required?: boolean;
  homework_deadline?: string | null;
  companies_id?: string;
}

const trainingService = {
  getList: async (params?: TrainingListParams): Promise<TrainingListResponse> => {
    const res = await httpRequest.get("/v2/items/trainings", { params });

    return {
      count: Number(res?.count || 0),
      response: Array.isArray(res?.response) ? (res.response as Training[]) : [],
    };
  },

  getOne: async (guid: string): Promise<Training | null> => {
    const res = await httpRequest.get(`/v2/items/trainings/${guid}`);
    const obj = (res && typeof res === "object") ? (res as Record<string, unknown>) : {};
    const direct = obj.response && typeof obj.response === "object" && !Array.isArray(obj.response)
      ? (obj.response as Training)
      : null;

    if (direct?.guid) return direct;
    if (typeof obj.guid === "string" && obj.guid) return obj as unknown as Training;
    return null;
  },

  create: (data: TrainingUpsertPayload) =>
    httpRequest.post("/v2/items/trainings", {
      data: {
        companies_id: COMPANY_ID,
        status: ["draft"],
        ...data,
      },
    }),

  update: (guid: string, data: Partial<Training>) =>
    httpRequest.put(`/v2/items/trainings/${guid}`, { data }),

  delete: async (guid: string) => {
    try {
      return await httpRequest.delete("/v2/items/trainings", {
        data: { ids: [guid] },
      });
    } catch {
      return httpRequest.delete(`/v2/items/trainings/${guid}`);
    }
  },
};

export const useTrainingsQuery = ({
  params,
  querySettings = {},
}: {
  params?: TrainingListParams;
  querySettings?: any;
}) => {
  return useQuery({
    queryKey: ["TRAININGS", params],
    queryFn: () => trainingService.getList(params),
    ...querySettings,
  });
};

export const useTrainingQuery = (guid: string, querySettings: any = {}) => {
  return useQuery({
    queryKey: ["TRAININGS", "one", guid],
    queryFn: () => trainingService.getOne(guid),
    enabled: Boolean(guid),
    ...querySettings,
  });
};

export const useCreateTraining = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: TrainingUpsertPayload) => trainingService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["TRAININGS"]);
    },
  });
};

export const useUpdateTraining = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ guid, data }: { guid: string; data: Partial<Training> }) =>
      trainingService.update(guid, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["TRAININGS"]);
    },
  });
};

export const useDeleteTraining = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (guid: string) => trainingService.delete(guid),
    onSuccess: () => {
      queryClient.invalidateQueries(["TRAININGS"]);
      queryClient.invalidateQueries(["TRAINING_EMPLOYEES"]);
      queryClient.invalidateQueries(["TRAINING_RESULTS"]);
    },
  });
};

export default trainingService;
