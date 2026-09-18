import { useMutation, useQuery, useQueryClient } from "react-query";
import httpRequest from "../httpRequest";

export const COMPANY_ID = "0de6b2b6-0777-4184-a620-aca70c294111";

export interface Country {
  guid: string;
  slug: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Location {
  guid: string;
  title: string;
  address: string;
  companies_id: string;
  countries_id: string | null;
  countries_id_data?: Country | null;
  holiday_policies_id?: string | null;
  holiday_policies_id_data?: {
    guid?: string;
    title?: string;
    [key: string]: unknown;
  } | null;
  timezone?: string[];
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
  countries_id: string | null;
  holiday_policies_id?: string | null;
  timezone: string[];
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

export interface CountryListResponse {
  count: number;
  response: Country[];
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

  getCountries: async (): Promise<CountryListResponse> => {
    const res = await httpRequest.get("/v2/items/countries", {
      params: { limit: 1000 },
    });

    return {
      count: Number(res?.count || 0),
      response: Array.isArray(res?.response)
        ? (res.response as Country[])
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

export const useCountriesQuery = ({
  querySettings = {},
}: {
  querySettings?: Record<string, unknown>;
} = {}) => {
  return useQuery({
    queryKey: ["COUNTRIES"],
    queryFn: () => locationService.getCountries(),
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
