import { useMutation, useQuery, useQueryClient } from "react-query";
import httpRequest from "../httpRequest";

export const COMPANY_ID = "0de6b2b6-0777-4184-a620-aca70c294111";

export interface Department {
  guid: string;
  title: string;
  companies_id: string;
  departments_id: string | null;
  created_at: string;
  updated_at: string;
  employees_count?: number;
  employee_count?: number;
  employees?: unknown[];
  [key: string]: unknown;
}

export interface DepartmentListResponse {
  count: number;
  response: Department[];
}

export interface DepartmentListParams {
  limit?: number;
  offset?: number;
  search?: string;
}

const departmentService = {
  getList: async (
    params?: DepartmentListParams
  ): Promise<DepartmentListResponse> => {
    const res = await httpRequest.get("/v2/items/departments", { params });

    return {
      count: Number(res?.count || 0),
      response: Array.isArray(res?.response)
        ? (res.response as Department[])
        : [],
    };
  },

  create: (data: { title: string; departments_id?: string | null; companies_id?: string }) =>
    httpRequest.post("/v2/items/departments", {
      data: {
        companies_id: COMPANY_ID,
        ...data,
      },
    }),

  update: (
    guid: string,
    data: { title: string; departments_id?: string | null }
  ) => httpRequest.put(`/v2/items/departments/${guid}`, { data }),

  delete: async (guid: string) => {
    try {
      return await httpRequest.delete("/v2/items/departments", {
        data: { ids: [guid] },
      });
    } catch {
      return httpRequest.delete(`/v2/items/departments/${guid}`);
    }
  },
};

export const useDepartmentsSettingsQuery = ({
  params,
  querySettings = {},
}: {
  params?: DepartmentListParams;
  querySettings?: any;
}) => {
  return useQuery({
    queryKey: ["DEPARTMENTS_SETTINGS", params],
    queryFn: () => departmentService.getList(params),
    ...querySettings,
  });
};

export const useCreateDepartment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { title: string; departments_id?: string | null; companies_id?: string }) =>
      departmentService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["DEPARTMENTS_SETTINGS"]);
      queryClient.invalidateQueries(["departments"]);
    },
  });
};

export const useUpdateDepartment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      guid,
      data,
    }: {
      guid: string;
      data: { title: string; departments_id?: string | null };
    }) => departmentService.update(guid, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["DEPARTMENTS_SETTINGS"]);
      queryClient.invalidateQueries(["departments"]);
    },
  });
};

export const useDeleteDepartment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (guid: string) => departmentService.delete(guid),
    onSuccess: () => {
      queryClient.invalidateQueries(["DEPARTMENTS_SETTINGS"]);
      queryClient.invalidateQueries(["departments"]);
    },
  });
};

export default departmentService;
