import { useMutation, useQuery, useQueryClient } from "react-query";
import axios from "axios";
import authStore from "../../store/auth.store";
import { retryWithFreshToken } from "../unauthorizedHandler";
import { injectCompaniesIdIntoItemsRequest } from "../httpRequest";

const BASE_URL = "https://api.admin.u-code.io";
const PROJECT_ID = "84f1983d-5095-490e-ba9c-d2618b164c99";
const SLUG = "employee_works";

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
  return injectCompaniesIdIntoItemsRequest(config);
});

instance.interceptors.response.use(
  (response) => response,
  retryWithFreshToken(instance)
);

export interface EmployeeWork {
  guid: string;
  user_base_id: string;
  employment_types_id?: string | null;
  employment_types_id_data?: {
    guid?: string;
    title?: string;
    [key: string]: unknown;
  } | null;
  positions_id?: string | null;
  positions_id_data?: {
    guid?: string;
    title?: string;
    [key: string]: unknown;
  } | null;
  experience_levels_id?: string | null;
  experience_levels_id_data?: {
    guid?: string;
    title?: string;
    [key: string]: unknown;
  } | null;
  departments_id?: string | null;
  departments_id_data?: {
    guid?: string;
    title?: string;
    [key: string]: unknown;
  } | null;
  locations_id?: string | null;
  locations_id_data?: {
    guid?: string;
    title?: string;
    [key: string]: unknown;
  } | null;
  employee_work_reason_id?: string | null;
  employee_work_reason_id_data?: {
    guid?: string;
    title?: string;
    [key: string]: unknown;
  } | null;
  work_schedule_id?: string | null;
  /**
   * Значения динамических полей (справочник «Динамические поля», таблица
   * employee_works). Поле типа JSON в u-code, поэтому ездит строкой.
   */
  custom_data?: string | Record<string, unknown> | null;
  work_schedule_id_data?: {
    guid?: string;
    title?: string;
    [key: string]: unknown;
  } | null;
  salary?: number | string | null;
  date_from?: string | null;
  date_to?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface EmployeeWorkListResponse {
  count: number;
  response: EmployeeWork[];
}

const employeeWorkService = {
  getList: async ({
    userBaseId,
    limit = 100,
    offset = 0,
  }: {
    userBaseId: string;
    limit?: number;
    offset?: number;
  }): Promise<EmployeeWorkListResponse> => {
    const dataObj: Record<string, unknown> = {
      limit,
      offset,
      user_base_id: userBaseId,
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
        ? (payload.response as EmployeeWork[])
        : [],
    };
  },

  create: async (data: Partial<EmployeeWork>) => {
    const res = await instance.post(
      `/v2/items/${SLUG}`,
      { data },
      {
        params: {
          "project-id": PROJECT_ID,
        },
      }
    );
    return res.data?.data?.data;
  },

  update: async (guid: string, data: Partial<EmployeeWork>) => {
    try {
      const res = await instance.put(
        `/v2/items/${SLUG}/${guid}`,
        { data: { ...data, guid } },
        {
          params: {
            "project-id": PROJECT_ID,
          },
        }
      );
      return res.data?.data?.data;
    } catch {
      const res = await instance.put(
        `/v2/items/${SLUG}`,
        { data: { ids: [guid], ...data, guid } },
        {
          params: {
            "project-id": PROJECT_ID,
          },
        }
      );
      return res.data?.data?.data;
    }
  },

  delete: async (guid: string) => {
    try {
      return await instance.delete(`/v2/items/${SLUG}`, {
        data: { ids: [guid] },
        params: {
          "project-id": PROJECT_ID,
        },
      });
    } catch {
      return instance.delete(`/v2/items/${SLUG}/${guid}`, {
        params: {
          "project-id": PROJECT_ID,
        },
      });
    }
  },
};

export const useEmployeeWorksQuery = ({
  userBaseId,
  limit = 100,
  offset = 0,
}: {
  userBaseId: string;
  limit?: number;
  offset?: number;
}) => {
  return useQuery(
    ["employee-works", userBaseId, limit, offset],
    () => employeeWorkService.getList({ userBaseId, limit, offset }),
    { enabled: !!userBaseId }
  );
};

export const useCreateEmployeeWork = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<EmployeeWork>) => employeeWorkService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["employee-works"]);
    },
  });
};

export const useUpdateEmployeeWork = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      guid,
      data,
    }: {
      guid: string;
      data: Partial<EmployeeWork>;
    }) => employeeWorkService.update(guid, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["employee-works"]);
    },
  });
};

export const useDeleteEmployeeWork = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (guid: string) => employeeWorkService.delete(guid),
    onSuccess: () => {
      queryClient.invalidateQueries(["employee-works"]);
    },
  });
};

export default employeeWorkService;
