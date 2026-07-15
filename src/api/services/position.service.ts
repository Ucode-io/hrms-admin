import { useMutation, useQuery, useQueryClient } from "react-query";
import httpRequest from "../httpRequest";
import encodeJsonToUrlParam from "../../utils/encodeJsonToUrlParam";

export const COMPANY_ID = "0de6b2b6-0777-4184-a620-aca70c294111";

export interface Position {
  guid: string;
  title: string;
  companies_id: string;
  positions_id?: string | null;
  experience_level_groups_id?: string | null;
  experience_level_groups_id_data?: {
    guid?: string;
    title?: string;
    [key: string]: unknown;
  } | null;
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
  all?: boolean;
}

const positionService = {
  getList: async (params?: PositionListParams): Promise<PositionListResponse> => {
    const { all = false, ...requestParams } = params || {};
    const buildRequestParams = (payload: Record<string, unknown>) => {
      const cleanPayload = Object.fromEntries(
        Object.entries(payload).filter(([, value]) => value !== undefined)
      );

      if (Object.keys(cleanPayload).length === 0) {
        return undefined;
      }

      return {
        data: encodeJsonToUrlParam(cleanPayload),
      };
    };

    if (!all) {
      const res = await httpRequest.get("/v2/items/positions", {
        params: buildRequestParams(requestParams),
      });

      return {
        count: Number(res?.count || 0),
        response: Array.isArray(res?.response) ? (res.response as Position[]) : [],
      };
    }

    const limit =
      typeof requestParams.limit === "number" && requestParams.limit > 0
        ? requestParams.limit
        : 200;
    const initialOffset =
      typeof requestParams.offset === "number" && requestParams.offset >= 0
        ? requestParams.offset
        : 0;
    const maxRequests = 200;
    let offset = initialOffset;
    let totalCount: number | null = null;
    const response: Position[] = [];

    for (let requestIndex = 0; requestIndex < maxRequests; requestIndex += 1) {
      const res = await httpRequest.get("/v2/items/positions", {
        params: buildRequestParams({
          ...requestParams,
          limit,
          offset,
        }),
      });

      const chunk = Array.isArray(res?.response) ? (res.response as Position[]) : [];
      const chunkCount = Number(res?.count);
      if (Number.isFinite(chunkCount) && chunkCount >= 0) {
        totalCount = chunkCount;
      }

      if (chunk.length === 0) {
        break;
      }

      response.push(...chunk);
      offset += chunk.length;

      if (totalCount !== null && offset - initialOffset >= totalCount) {
        break;
      }
    }

    return {
      count: totalCount ?? response.length,
      response,
    };
  },

  create: (data: {
    title: string;
    positions_id?: string | null;
    experience_level_groups_id?: string | null;
    companies_id?: string;
  }) =>
    httpRequest.post("/v2/items/positions", {
      data: {
        companies_id: COMPANY_ID,
        ...data,
      },
    }),

  update: (guid: string, data: Partial<Position>) =>
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
  querySettings?: Record<string, unknown>;
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
    mutationFn: (data: {
      title: string;
      positions_id?: string | null;
      experience_level_groups_id?: string | null;
      companies_id?: string;
    }) => positionService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["POSITIONS"]);
    },
  });
};

export const useUpdatePosition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ guid, data }: { guid: string; data: Partial<Position> }) =>
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
