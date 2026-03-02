import { useMutation, useQuery, useQueryClient } from "react-query";
import httpRequest from "../httpRequest";

export const COMPANY_ID = "0de6b2b6-0777-4184-a620-aca70c294111";

export interface ExperienceLevel {
  guid: string;
  title: string;
  companies_id: string;
  created_at: string;
  updated_at: string;
  employees_count?: number;
  employee_count?: number;
  employees?: unknown[];
  [key: string]: unknown;
}

export interface ExperienceLevelListResponse {
  count: number;
  response: ExperienceLevel[];
}

export interface ExperienceLevelListParams {
  limit?: number;
  offset?: number;
  search?: string;
}

const experienceLevelService = {
  getList: async (
    params?: ExperienceLevelListParams
  ): Promise<ExperienceLevelListResponse> => {
    const res = await httpRequest.get("/v2/items/experience_levels", { params });

    return {
      count: Number(res?.count || 0),
      response: Array.isArray(res?.response)
        ? (res.response as ExperienceLevel[])
        : [],
    };
  },

  create: (data: { title: string; companies_id?: string }) =>
    httpRequest.post("/v2/items/experience_levels", {
      data: {
        companies_id: COMPANY_ID,
        ...data,
      },
    }),

  update: (guid: string, data: { title: string }) =>
    httpRequest.put(`/v2/items/experience_levels/${guid}`, { data }),

  delete: async (guid: string) => {
    try {
      return await httpRequest.delete("/v2/items/experience_levels", {
        data: { ids: [guid] },
      });
    } catch {
      return httpRequest.delete(`/v2/items/experience_levels/${guid}`);
    }
  },
};

export const useExperienceLevelsQuery = ({
  params,
  querySettings = {},
}: {
  params?: ExperienceLevelListParams;
  querySettings?: any;
}) => {
  return useQuery({
    queryKey: ["EXPERIENCE_LEVELS", params],
    queryFn: () => experienceLevelService.getList(params),
    ...querySettings,
  });
};

export const useCreateExperienceLevel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { title: string; companies_id?: string }) =>
      experienceLevelService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["EXPERIENCE_LEVELS"]);
    },
  });
};

export const useUpdateExperienceLevel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ guid, data }: { guid: string; data: { title: string } }) =>
      experienceLevelService.update(guid, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["EXPERIENCE_LEVELS"]);
    },
  });
};

export const useDeleteExperienceLevel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (guid: string) => experienceLevelService.delete(guid),
    onSuccess: () => {
      queryClient.invalidateQueries(["EXPERIENCE_LEVELS"]);
    },
  });
};

export default experienceLevelService;
