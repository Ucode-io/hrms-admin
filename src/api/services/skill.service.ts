import { useMutation, useQuery, useQueryClient } from "react-query";
import httpRequest from "../httpRequest";

export const COMPANY_ID = "0de6b2b6-0777-4184-a620-aca70c294111";

export interface Skill {
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

export interface SkillListResponse {
  count: number;
  response: Skill[];
}

export interface SkillListParams {
  limit?: number;
  offset?: number;
  search?: string;
}

const skillService = {
  getList: async (
    params?: SkillListParams
  ): Promise<SkillListResponse> => {
    const res = await httpRequest.get("/v2/items/skills", { params });

    return {
      count: Number(res?.count || 0),
      response: Array.isArray(res?.response)
        ? (res.response as Skill[])
        : [],
    };
  },

  create: (data: { title: string; companies_id?: string }) =>
    httpRequest.post("/v2/items/skills", {
      data: {
        companies_id: COMPANY_ID,
        ...data,
      },
    }),

  update: (guid: string, data: Partial<Skill>) =>
    httpRequest.put(`/v2/items/skills/${guid}`, { data }),

  delete: async (guid: string) => {
    try {
      return await httpRequest.delete("/v2/items/skills", {
        data: { ids: [guid] },
      });
    } catch {
      return httpRequest.delete(`/v2/items/skills/${guid}`);
    }
  },
};

export const useSkillsQuery = ({
  params,
  querySettings = {},
}: {
  params?: SkillListParams;
  querySettings?: any;
}) => {
  return useQuery({
    queryKey: ["SKILLS", params],
    queryFn: () => skillService.getList(params),
    ...querySettings,
  });
};

export const useCreateSkill = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { title: string; companies_id?: string }) =>
      skillService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["SKILLS"]);
    },
  });
};

export const useUpdateSkill = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ guid, data }: { guid: string; data: Partial<Skill> }) =>
      skillService.update(guid, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["SKILLS"]);
    },
  });
};

export const useDeleteSkill = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (guid: string) => skillService.delete(guid),
    onSuccess: () => {
      queryClient.invalidateQueries(["SKILLS"]);
    },
  });
};

export default skillService;
