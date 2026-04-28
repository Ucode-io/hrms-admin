import { useMutation, useQuery, useQueryClient } from "react-query";
import axios from "axios";
import authStore from "../../store/auth.store";

const BASE_URL = "https://api.admin.u-code.io";
const PROJECT_ID = "84f1983d-5095-490e-ba9c-d2618b164c99";
const SLUG = "employee_compensations";

const instance = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

instance.interceptors.request.use((config) => {
  const token = authStore.token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface EmployeeCompensation {
  guid: string;
  user_base_id?: string | null;
  user_base_id_data?: {
    guid?: string;
    first_name?: string;
    second_name?: string;
    [key: string]: unknown;
  } | null;
  date: string | null;
  amount: number | string | null;
  description: string | null;
  companies_id?: string;
  compensation_types_id?: string | null;
  compensation_types_id_data?: {
    guid?: string;
    title?: string;
    [key: string]: unknown;
  } | null;
  operation_type?: string[] | string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface EmployeeCompensationListResponse {
  count: number;
  response: EmployeeCompensation[];
}

export const useEmployeeCompensationsQuery = ({
  userBaseId,
  limit = 100,
  offset = 0,
  enabled = true,
}: {
  userBaseId?: string;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}) => {
  return useQuery(
    ["employee-compensations", userBaseId || "all", limit, offset],
    async (): Promise<EmployeeCompensationListResponse> => {
      const dataObj: Record<string, unknown> = {
        limit,
        offset,
        ...(userBaseId ? { user_base_id: userBaseId } : {}),
      };

      const res = await instance.get(`/v2/items/${SLUG}`, {
        params: {
          "project-id": PROJECT_ID,
          with_relations: true,
          data: JSON.stringify(dataObj),
        },
      });

      const payload = res.data?.data?.data;
      return {
        count: Number(payload?.count ?? 0),
        response: Array.isArray(payload?.response)
          ? (payload.response as EmployeeCompensation[])
          : [],
      };
    },
    { enabled: enabled && (userBaseId ? Boolean(userBaseId) : true) }
  );
};

export const useEmployeeSalaryCompensationsQuery = ({
  limit = 100,
  offset = 0,
  search,
  dateFrom,
  dateTo,
  userBaseId,
  operationType,
  compensationTypeId,
  enabled = true,
}: {
  limit?: number;
  offset?: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  userBaseId?: string;
  operationType?: "income" | "deduction";
  compensationTypeId?: string;
  enabled?: boolean;
}) => {
  return useQuery(
    [
      "employee-compensations",
      "salary",
      limit,
      offset,
      search || "",
      dateFrom || "",
      dateTo || "",
      userBaseId || "",
      operationType || "",
      compensationTypeId || "",
    ],
    async (): Promise<EmployeeCompensationListResponse> => {
      const dataObj: Record<string, unknown> = {
        limit,
        offset,
      };
      if (search && search.trim()) {
        dataObj.search = search.trim();
      }
      if (dateFrom && dateTo) {
        dataObj.date = {
          $gte: dateFrom,
          $lte: dateTo,
        };
      }
      if (userBaseId && userBaseId.trim()) {
        dataObj.user_base_id = userBaseId.trim();
      }
      if (operationType) {
        dataObj.operation_type = [operationType];
      }
      if (compensationTypeId && compensationTypeId.trim()) {
        dataObj.compensation_types_id = compensationTypeId.trim();
      }

      const res = await instance.get(`/v2/items/${SLUG}`, {
        params: {
          "project-id": PROJECT_ID,
          with_relations: true,
          data: JSON.stringify(dataObj),
        },
      });

      const payload = res.data?.data?.data;
      return {
        count: Number(payload?.count ?? 0),
        response: Array.isArray(payload?.response)
          ? (payload.response as EmployeeCompensation[])
          : [],
      };
    },
    {
      enabled,
      keepPreviousData: true,
    }
  );
};

export const useCreateEmployeeCompensation = (userBaseId: string) => {
  const queryClient = useQueryClient();

  return useMutation(
    async (data: Partial<EmployeeCompensation>) => {
      const res = await instance.post(
        `/v2/items/${SLUG}`,
        { data },
        {
          params: { "project-id": PROJECT_ID },
        }
      );
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["employee-compensations", userBaseId]);
        queryClient.invalidateQueries("employee-compensations");
      },
    }
  );
};

export const useUpdateEmployeeCompensation = (userBaseId: string) => {
  const queryClient = useQueryClient();

  return useMutation(
    async (data: Partial<EmployeeCompensation> & { guid: string }) => {
      const res = await instance.put(
        `/v2/items/${SLUG}`,
        { data },
        {
          params: { "project-id": PROJECT_ID },
        }
      );
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["employee-compensations", userBaseId]);
        queryClient.invalidateQueries("employee-compensations");
      },
    }
  );
};

export const useDeleteEmployeeCompensation = (userBaseId: string) => {
  const queryClient = useQueryClient();

  return useMutation(
    async (guid: string) => {
      const res = await instance.delete(`/v2/items/${SLUG}`, {
        params: { "project-id": PROJECT_ID },
        data: { ids: [guid] },
      });
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["employee-compensations", userBaseId]);
        queryClient.invalidateQueries("employee-compensations");
      },
    }
  );
};
