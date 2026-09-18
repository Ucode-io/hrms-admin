import { useMutation, useQuery, useQueryClient } from "react-query";
import httpRequest from "../httpRequest";

export const COMPANY_ID = "0de6b2b6-0777-4184-a620-aca70c294111";

const HOLIDAY_POLICIES_SLUG = "holiday_policies";
const HOLIDAY_POLICY_DAYS_SLUG = "holiday_policy_days";

export interface HolidayPolicy {
  guid: string;
  title: string;
  companies_id: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface HolidayPolicyDay {
  guid: string;
  holiday_policies_id: string;
  title: string;
  date: string;
  is_working_holiday?: boolean;
  is_weekend_transfer?: boolean;
  is_workday_transfer?: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface ListResponse<T> {
  count: number;
  response: T[];
}

export interface HolidayPolicyListParams {
  limit?: number;
  offset?: number;
  search?: string;
  [key: string]: unknown;
}

const normalizeListResponse = <T>(res: unknown): ListResponse<T> => {
  const obj = (res && typeof res === "object")
    ? (res as Record<string, unknown>)
    : {};

  return {
    count: Number(obj.count || 0),
    response: Array.isArray(obj.response) ? (obj.response as T[]) : [],
  };
};

const holidayPolicyService = {
  getPolicies: async (
    params?: HolidayPolicyListParams
  ): Promise<ListResponse<HolidayPolicy>> => {
    const res = await httpRequest.get(`/v2/items/${HOLIDAY_POLICIES_SLUG}`, { params });
    return normalizeListResponse<HolidayPolicy>(res);
  },

  getPolicyByGuid: async (guid: string): Promise<HolidayPolicy | null> => {
    const res = await httpRequest.get(`/v2/items/${HOLIDAY_POLICIES_SLUG}/${guid}`);

    if (res && typeof res === "object" && "response" in (res as Record<string, unknown>)) {
      const response = (res as Record<string, unknown>).response;
      if (response && typeof response === "object") {
        return response as HolidayPolicy;
      }
    }

    if (res && typeof res === "object" && "guid" in (res as Record<string, unknown>)) {
      return res as HolidayPolicy;
    }

    return null;
  },

  createPolicy: (data: { title: string; companies_id?: string }) =>
    httpRequest.post(`/v2/items/${HOLIDAY_POLICIES_SLUG}`, {
      data: {
        companies_id: COMPANY_ID,
        ...data,
      },
    }),

  updatePolicy: (guid: string, data: Partial<HolidayPolicy>) =>
    httpRequest.put(`/v2/items/${HOLIDAY_POLICIES_SLUG}/${guid}`, { data }),

  deletePolicy: async (guid: string) => {
    try {
      return await httpRequest.delete(`/v2/items/${HOLIDAY_POLICIES_SLUG}`, {
        data: { ids: [guid] },
      });
    } catch {
      return httpRequest.delete(`/v2/items/${HOLIDAY_POLICIES_SLUG}/${guid}`);
    }
  },

  getPolicyLocationCount: async (policyGuid: string): Promise<number> => {
    const res = await httpRequest.get("/v2/items/locations", {
      params: {
        limit: 1,
        offset: 0,
        holiday_policies_id: policyGuid,
      },
    });
    return Number((res as Record<string, unknown>)?.count || 0);
  },

  /** Без `holiday_policies_id` отдаёт праздники всех политик компании. */
  getPolicyDays: async (params: {
    holiday_policies_id?: string;
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<ListResponse<HolidayPolicyDay>> => {
    const res = await httpRequest.get(`/v2/items/${HOLIDAY_POLICY_DAYS_SLUG}`, {
      params: {
        limit: 1000,
        offset: 0,
        ...params,
      },
    });
    return normalizeListResponse<HolidayPolicyDay>(res);
  },

  createPolicyDay: (data: {
    holiday_policies_id: string;
    title: string;
    date: string;
    is_working_holiday: boolean;
    is_weekend_transfer: boolean;
    is_workday_transfer: boolean;
    companies_id?: string;
  }) =>
    httpRequest.post(`/v2/items/${HOLIDAY_POLICY_DAYS_SLUG}`, {
      data: {
        companies_id: COMPANY_ID,
        ...data,
      },
    }),

  updatePolicyDay: (guid: string, data: Partial<HolidayPolicyDay>) =>
    httpRequest.put(`/v2/items/${HOLIDAY_POLICY_DAYS_SLUG}/${guid}`, { data }),

  deletePolicyDay: async (guid: string) => {
    try {
      return await httpRequest.delete(`/v2/items/${HOLIDAY_POLICY_DAYS_SLUG}`, {
        data: { ids: [guid] },
      });
    } catch {
      return httpRequest.delete(`/v2/items/${HOLIDAY_POLICY_DAYS_SLUG}/${guid}`);
    }
  },
};

export const useHolidayPoliciesQuery = ({
  params,
  querySettings = {},
}: {
  params?: HolidayPolicyListParams;
  querySettings?: Record<string, unknown>;
}) => {
  return useQuery({
    queryKey: ["HOLIDAY_POLICIES", params],
    queryFn: () => holidayPolicyService.getPolicies(params),
    ...querySettings,
  });
};

export const useHolidayPolicyQuery = ({
  guid,
  querySettings = {},
}: {
  guid: string;
  querySettings?: Record<string, unknown>;
}) => {
  return useQuery({
    queryKey: ["HOLIDAY_POLICY", guid],
    queryFn: () => holidayPolicyService.getPolicyByGuid(guid),
    enabled: Boolean(guid),
    ...querySettings,
  });
};

export const useHolidayPolicyLocationCountsQuery = ({
  policyIds,
  querySettings = {},
}: {
  policyIds: string[];
  querySettings?: Record<string, unknown>;
}) => {
  return useQuery({
    queryKey: ["HOLIDAY_POLICY_LOCATION_COUNTS", policyIds],
    queryFn: async () => {
      const pairs = await Promise.all(
        policyIds.map(async (policyId) => {
          const count = await holidayPolicyService.getPolicyLocationCount(policyId);
          return [policyId, count] as const;
        })
      );

      return Object.fromEntries(pairs) as Record<string, number>;
    },
    enabled: policyIds.length > 0,
    ...querySettings,
  });
};

export const useHolidayPolicyDaysQuery = ({
  policyGuid,
  querySettings = {},
}: {
  policyGuid: string;
  querySettings?: Record<string, unknown>;
}) => {
  return useQuery({
    queryKey: ["HOLIDAY_POLICY_DAYS", policyGuid],
    queryFn: () => holidayPolicyService.getPolicyDays({ holiday_policies_id: policyGuid }),
    enabled: Boolean(policyGuid),
    ...querySettings,
  });
};

/**
 * Все праздничные дни компании.
 *
 * Колонка грида одна на всех, поэтому и политика тут не выбирается: календарь
 * производственный, а не персональный. Дни за все годы приходят одним запросом
 * и кэшируются — их сотни, не тысячи.
 */
export const useHolidayDaysQuery = (querySettings: Record<string, unknown> = {}) => {
  return useQuery({
    queryKey: ["HOLIDAY_POLICY_DAYS", "all"],
    queryFn: () => holidayPolicyService.getPolicyDays({}),
    ...querySettings,
  });
};

export const useCreateHolidayPolicy = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { title: string; companies_id?: string }) =>
      holidayPolicyService.createPolicy(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["HOLIDAY_POLICIES"]);
    },
  });
};

export const useUpdateHolidayPolicy = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ guid, data }: { guid: string; data: Partial<HolidayPolicy> }) =>
      holidayPolicyService.updatePolicy(guid, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(["HOLIDAY_POLICIES"]);
      queryClient.invalidateQueries(["HOLIDAY_POLICY", variables.guid]);
    },
  });
};

export const useDeleteHolidayPolicy = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (guid: string) => holidayPolicyService.deletePolicy(guid),
    onSuccess: () => {
      queryClient.invalidateQueries(["HOLIDAY_POLICIES"]);
    },
  });
};

export const useCreateHolidayPolicyDay = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      holiday_policies_id: string;
      title: string;
      date: string;
      is_working_holiday: boolean;
      is_weekend_transfer: boolean;
      is_workday_transfer: boolean;
      companies_id?: string;
    }) => holidayPolicyService.createPolicyDay(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(["HOLIDAY_POLICY_DAYS", variables.holiday_policies_id]);
    },
  });
};

export const useUpdateHolidayPolicyDay = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: {
      guid: string;
      policyGuid: string;
      data: Partial<HolidayPolicyDay>;
    }) => holidayPolicyService.updatePolicyDay(variables.guid, variables.data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(["HOLIDAY_POLICY_DAYS", variables.policyGuid]);
    },
  });
};

export const useDeleteHolidayPolicyDay = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: { guid: string; policyGuid: string }) =>
      holidayPolicyService.deletePolicyDay(variables.guid),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(["HOLIDAY_POLICY_DAYS", variables.policyGuid]);
    },
  });
};

export default holidayPolicyService;
