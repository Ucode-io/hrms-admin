import { useMutation, useQuery, useQueryClient } from "react-query";
import httpRequest from "../httpRequest";

export const COMPANY_ID = "0de6b2b6-0777-4184-a620-aca70c294111";

export interface Position {
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

export interface PositionListResponse {
  count: number;
  response: Position[];
}

export interface PositionListParams {
  limit?: number;
  offset?: number;
  search?: string;
}

const positionService = {
  getList: async (params?: PositionListParams): Promise<PositionListResponse> => {
    const res = await httpRequest.get("/v2/items/positions", { params });

    return {
      count: Number(res?.count || 0),
      response: Array.isArray(res?.response) ? (res.response as Position[]) : [],
    };
  },

  create: (data: { title: string; companies_id?: string }) =>
    httpRequest.post("/v2/items/positions", {
      data: {
        companies_id: COMPANY_ID,
        ...data,
      },
    }),

  update: (guid: string, data: { title: string }) =>
    httpRequest.put(`/v2/items/positions/${guid}`, { data }),

  delete: async (guid: string) => {
    try {
      return await httpRequest.delete("/v2/items/positions", {
        data: { ids: [guid] },
      });
    } catch {
      return httpRequest.delete(`/v2/items/positions/${guid}`);
    }
  },
};

export const usePositionsQuery = ({
  params,
  querySettings = {},
}: {
  params?: PositionListParams;
  querySettings?: any;
}) => {
  return useQuery({
    queryKey: ["POSITIONS", params],
    queryFn: () => positionService.getList(params),
    ...querySettings,
  });
};

export const useCreatePosition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { title: string; companies_id?: string }) =>
      positionService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["POSITIONS"]);
    },
  });
};

export const useUpdatePosition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ guid, data }: { guid: string; data: { title: string } }) =>
      positionService.update(guid, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["POSITIONS"]);
    },
  });
};

export const useDeletePosition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (guid: string) => positionService.delete(guid),
    onSuccess: () => {
      queryClient.invalidateQueries(["POSITIONS"]);
    },
  });
};

export default positionService;
