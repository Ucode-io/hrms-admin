import { useMutation, useQuery, useQueryClient } from "react-query";
import httpRequest from "../httpRequest";

export const COMPANY_ID = "0de6b2b6-0777-4184-a620-aca70c294111";

export interface ExperienceLevelGroup {
  guid: string;
  title: string;
  companies_id: string;
  created_at: string;
  updated_at: string;
  experience_levels_count?: number;
  [key: string]: unknown;
}

export interface ExperienceLevelGroupListResponse {
  count: number;
  response: ExperienceLevelGroup[];
}

export interface ExperienceLevelGroupListParams {
  limit?: number;
  offset?: number;
  search?: string;
}

const experienceLevelGroupService = {
  getList: async (
    params?: ExperienceLevelGroupListParams
  ): Promise<ExperienceLevelGroupListResponse> => {
    const res = await httpRequest.get("/v2/items/experience_level_groups", { params });

    return {
      count: Number(res?.count || 0),
      response: Array.isArray(res?.response)
        ? (res.response as ExperienceLevelGroup[])
        : [],
    };
  },

  create: (data: { title: string; companies_id?: string }) =>
    httpRequest.post("/v2/items/experience_level_groups", {
      data: {
        companies_id: COMPANY_ID,
        ...data,
      },
    }),

  update: (guid: string, data: Partial<ExperienceLevelGroup>) =>
    httpRequest.put(`/v2/items/experience_level_groups/${guid}`, { data }),

  delete: async (guid: string) => {
    try {
      return await httpRequest.delete("/v2/items/experience_level_groups", {
        data: { ids: [guid] },
      });
    } catch {
      return httpRequest.delete(`/v2/items/experience_level_groups/${guid}`);
    }
  },
};

export const useExperienceLevelGroupsQuery = ({
  params,
  querySettings = {},
}: {
  params?: ExperienceLevelGroupListParams;
  querySettings?: any;
}) => {
  return useQuery({
    queryKey: ["EXPERIENCE_LEVEL_GROUPS", params],
    queryFn: () => experienceLevelGroupService.getList(params),
    ...querySettings,
  });
};

export const useCreateExperienceLevelGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { title: string; companies_id?: string }) =>
      experienceLevelGroupService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["EXPERIENCE_LEVEL_GROUPS"]);
    },
  });
};

export const useUpdateExperienceLevelGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ guid, data }: { guid: string; data: Partial<ExperienceLevelGroup> }) =>
      experienceLevelGroupService.update(guid, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["EXPERIENCE_LEVEL_GROUPS"]);
    },
  });
};

export const useDeleteExperienceLevelGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (guid: string) => experienceLevelGroupService.delete(guid),
    onSuccess: () => {
      queryClient.invalidateQueries(["EXPERIENCE_LEVEL_GROUPS"]);
      queryClient.invalidateQueries(["EXPERIENCE_LEVELS"]);
    },
  });
};

export default experienceLevelGroupService;
