import { useMutation, useQuery, useQueryClient } from "react-query";
import httpRequest from "../httpRequest";

export const COMPANY_ID = "0de6b2b6-0777-4184-a620-aca70c294111";

export interface EmploymentType {
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

export interface EmploymentTypeListResponse {
  count: number;
  response: EmploymentType[];
}

export interface EmploymentTypeListParams {
  limit?: number;
  offset?: number;
  search?: string;
}

const employmentTypeService = {
  getList: async (
    params?: EmploymentTypeListParams
  ): Promise<EmploymentTypeListResponse> => {
    const res = await httpRequest.get("/v2/items/employment_types", { params });

    return {
      count: Number(res?.count || 0),
      response: Array.isArray(res?.response)
        ? (res.response as EmploymentType[])
        : [],
    };
  },

  create: (data: { title: string; companies_id?: string }) =>
    httpRequest.post("/v2/items/employment_types", {
      data: {
        companies_id: COMPANY_ID,
        ...data,
      },
    }),

  update: (guid: string, data: Partial<EmploymentType>) =>
    httpRequest.put(`/v2/items/employment_types/${guid}`, { data }),

  delete: async (guid: string) => {
    try {
      return await httpRequest.delete("/v2/items/employment_types", {
        data: { ids: [guid] },
      });
    } catch {
      return httpRequest.delete(`/v2/items/employment_types/${guid}`);
    }
  },
};

export const useEmploymentTypesQuery = ({
  params,
  querySettings = {},
}: {
  params?: EmploymentTypeListParams;
  querySettings?: any;
}) => {
  return useQuery({
    queryKey: ["EMPLOYMENT_TYPES", params],
    queryFn: () => employmentTypeService.getList(params),
    ...querySettings,
  });
};

export const useCreateEmploymentType = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { title: string; companies_id?: string }) =>
      employmentTypeService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["EMPLOYMENT_TYPES"]);
    },
  });
};

export const useUpdateEmploymentType = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ guid, data }: { guid: string; data: Partial<EmploymentType> }) =>
      employmentTypeService.update(guid, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["EMPLOYMENT_TYPES"]);
    },
  });
};

export const useDeleteEmploymentType = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (guid: string) => employmentTypeService.delete(guid),
    onSuccess: () => {
      queryClient.invalidateQueries(["EMPLOYMENT_TYPES"]);
    },
  });
};

export default employmentTypeService;
