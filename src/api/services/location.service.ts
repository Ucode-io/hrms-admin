import { useMutation, useQuery, useQueryClient } from "react-query";
import httpRequest from "../httpRequest";

export const COMPANY_ID = "0de6b2b6-0777-4184-a620-aca70c294111";

/**
 * Филиал. Таблица называется `locations` и будет называться так дальше —
 * слаг в ucode неизменяем (`migrations/2026_09_21_regions.sql`), — но в
 * интерфейсе это Branch: физическое место, где сотрудник отмечается.
 *
 * Собственного у него только точка на карте и радиус. Часы, календарь
 * праздников и язык дал регион (ADR-0006), поэтому `timezone`,
 * `holiday_policies_id` и `countries_id` здесь больше не читаются и не
 * пишутся — колонки остались в схеме мёртвыми.
 */
export interface Location {
  guid: string;
  title: string;
  address: string;
  companies_id: string;
  regions_id: string | null;
  regions_id_data?: {
    guid?: string;
    title?: string;
    timezone?: string | null;
    [key: string]: unknown;
  } | null;
  /** Поле типа MAP в ucode — строка «широта,долгота» либо "" (см. parseCoords). */
  coordinates?: string;
  /** Радиус офиса в метрах; пусто — берётся DEFAULT_OFFICE_RADIUS_M. */
  radius?: number | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface LocationUpsertPayload {
  title: string;
  address: string;
  regions_id: string;
  coordinates?: string;
  radius?: number | null;
  companies_id?: string;
}

export interface LocationListResponse {
  count: number;
  response: Location[];
}

export interface LocationListParams {
  limit?: number;
  offset?: number;
  search?: string;
}

const locationService = {
  getList: async (
    params?: LocationListParams
  ): Promise<LocationListResponse> => {
    const res = await httpRequest.get("/v2/items/locations", { params });

    return {
      count: Number(res?.count || 0),
      response: Array.isArray(res?.response)
        ? (res.response as Location[])
        : [],
    };
  },

  create: (data: LocationUpsertPayload) =>
    httpRequest.post("/v2/items/locations", {
      data: {
        companies_id: COMPANY_ID,
        ...data,
      },
    }),

  update: (
    guid: string,
    data: Partial<Location>
  ) => httpRequest.put(`/v2/items/locations/${guid}`, { data }),

  delete: async (guid: string) => {
    try {
      return await httpRequest.delete("/v2/items/locations", {
        data: { ids: [guid] },
      });
    } catch {
      return httpRequest.delete(`/v2/items/locations/${guid}`);
    }
  },
};

export const useLocationsQuery = ({
  params,
  querySettings = {},
}: {
  params?: LocationListParams;
  querySettings?: Record<string, unknown>;
}) => {
  return useQuery({
    queryKey: ["LOCATIONS", params],
    queryFn: () => locationService.getList(params),
    ...querySettings,
  });
};

export const useCreateLocation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: LocationUpsertPayload) => locationService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["LOCATIONS"]);
    },
  });
};

export const useUpdateLocation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      guid,
      data,
    }: {
      guid: string;
      data: Partial<Location>;
    }) => locationService.update(guid, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["LOCATIONS"]);
    },
  });
};

export const useDeleteLocation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (guid: string) => locationService.delete(guid),
    onSuccess: () => {
      queryClient.invalidateQueries(["LOCATIONS"]);
    },
  });
};

export default locationService;
