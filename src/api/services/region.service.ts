import { useMutation, useQuery, useQueryClient } from "react-query";
import httpRequest from "../httpRequest";

export const COMPANY_ID = "0de6b2b6-0777-4184-a620-aca70c294111";

/**
 * Регион — место со своими часами, календарём праздников и языком
 * (ADR-0006). Висит на филиале, не на сотруднике: региона у `user_base` нет
 * и быть не должно, он выводится через `locations_id`.
 *
 * Пришёл на место `divisions`, но новой таблицей: слаг таблицы в ucode
 * неизменяем, подробности — в `migrations/2026_09_21_regions.sql`.
 */
export interface Region {
  guid: string;
  title: string;
  companies_id: string;
  /** IANA-имя, одно. Не массив — в этом и была ошибка `locations.timezone`. */
  timezone: string | null;
  languages_id: string | null;
  languages_id_data?: { guid?: string; title?: string; slug?: string } | null;
  holiday_policies_id: string | null;
  holiday_policies_id_data?: { guid?: string; title?: string } | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface RegionUpsertPayload {
  title: string;
  timezone: string;
  languages_id: string | null;
  holiday_policies_id: string | null;
  companies_id?: string;
}

export interface RegionListResponse {
  count: number;
  response: Region[];
}

export interface RegionListParams {
  limit?: number;
  offset?: number;
  search?: string;
}

const regionService = {
  getList: async (params?: RegionListParams): Promise<RegionListResponse> => {
    const res = await httpRequest.get("/v2/items/regions", { params });

    return {
      count: Number(res?.count || 0),
      response: Array.isArray(res?.response) ? (res.response as Region[]) : [],
    };
  },

  create: (data: RegionUpsertPayload) =>
    httpRequest.post("/v2/items/regions", {
      data: {
        companies_id: COMPANY_ID,
        ...data,
      },
    }),

  update: (guid: string, data: Partial<Region>) =>
    httpRequest.put(`/v2/items/regions/${guid}`, { data }),

  delete: async (guid: string) => {
    try {
      return await httpRequest.delete("/v2/items/regions", {
        data: { ids: [guid] },
      });
    } catch {
      return httpRequest.delete(`/v2/items/regions/${guid}`);
    }
  },
};

export const useRegionsQuery = ({
  params,
  querySettings = {},
}: {
  params?: RegionListParams;
  querySettings?: Record<string, unknown>;
}) => {
  return useQuery({
    queryKey: ["REGIONS", params],
    queryFn: () => regionService.getList(params),
    ...querySettings,
  });
};

export const useCreateRegion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RegionUpsertPayload) => regionService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["REGIONS"]);
    },
  });
};

export const useUpdateRegion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ guid, data }: { guid: string; data: Partial<Region> }) =>
      regionService.update(guid, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["REGIONS"]);
    },
  });
};

export const useDeleteRegion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (guid: string) => regionService.delete(guid),
    onSuccess: () => {
      queryClient.invalidateQueries(["REGIONS"]);
    },
  });
};

export default regionService;
