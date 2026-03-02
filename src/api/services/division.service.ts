import { useMutation, useQuery, useQueryClient } from "react-query";
import httpRequest from "../httpRequest";

export const COMPANY_ID = "0de6b2b6-0777-4184-a620-aca70c294111";

export interface Division {
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

export interface DivisionListResponse {
  count: number;
  response: Division[];
}

export interface DivisionListParams {
  limit?: number;
  offset?: number;
  search?: string;
}

const divisionService = {
  getList: async (
    params?: DivisionListParams
  ): Promise<DivisionListResponse> => {
    const res = await httpRequest.get("/v2/items/divisions", { params });

    return {
      count: Number(res?.count || 0),
      response: Array.isArray(res?.response)
        ? (res.response as Division[])
        : [],
    };
  },

  create: (data: { title: string; companies_id?: string }) =>
    httpRequest.post("/v2/items/divisions", {
      data: {
        companies_id: COMPANY_ID,
        ...data,
      },
    }),

  update: (guid: string, data: Partial<Division>) =>
    httpRequest.put(`/v2/items/divisions/${guid}`, { data }),

  delete: async (guid: string) => {
    try {
      return await httpRequest.delete("/v2/items/divisions", {
        data: { ids: [guid] },
      });
    } catch {
      return httpRequest.delete(`/v2/items/divisions/${guid}`);
    }
  },
};

export const useDivisionsQuery = ({
  params,
  querySettings = {},
}: {
  params?: DivisionListParams;
  querySettings?: any;
}) => {
  return useQuery({
    queryKey: ["DIVISIONS", params],
    queryFn: () => divisionService.getList(params),
    ...querySettings,
  });
};

export const useCreateDivision = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { title: string; companies_id?: string }) =>
      divisionService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["DIVISIONS"]);
    },
  });
};

export const useUpdateDivision = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ guid, data }: { guid: string; data: Partial<Division> }) =>
      divisionService.update(guid, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["DIVISIONS"]);
    },
  });
};

export const useDeleteDivision = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (guid: string) => divisionService.delete(guid),
    onSuccess: () => {
      queryClient.invalidateQueries(["DIVISIONS"]);
    },
  });
};

export default divisionService;
