import { useMutation, useQuery, useQueryClient } from "react-query";
import httpRequest from "../httpRequest";

export const COMPANY_ID = "0de6b2b6-0777-4184-a620-aca70c294111";

export interface Department {
  guid: string;
  title: string;
  companies_id: string;
  departments_id: string | null;
  user_base_id?: string | null;
  user_base_id_data?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  employees_count?: number;
  employee_count?: number;
  employees?: unknown[];
  experience_level_titles?: string[];
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

interface DepartmentAggregationRow {
  guid?: string;
  title?: string;
  companies_id?: string;
  departments_id?: string | null;
  user_base_id?: string | null;
  created_at?: string;
  updated_at?: string;
  leader_first_name?: string | null;
  leader_second_name?: string | null;
  leader_middle_name?: string | null;
  leader_email?: string | null;
  leader_phone?: string | null;
  experience_level_title?: string | null;
}

const normalizeAggregationRows = (res: unknown): DepartmentAggregationRow[] => {
  const obj = (res && typeof res === "object") ? (res as Record<string, unknown>) : {};
  const directDataArray = Array.isArray(obj.data) ? obj.data : null;
  const rawResponse = Array.isArray(obj.response)
    ? obj.response
    : directDataArray || [];

  return Array.isArray(rawResponse) ? (rawResponse as DepartmentAggregationRow[]) : [];
};

const mapAggregationRowsToDepartments = (rows: DepartmentAggregationRow[]): Department[] => {
  const byGuid = new Map<string, Department>();

  for (const row of rows) {
    const guid = typeof row.guid === "string" ? row.guid : "";
    if (!guid) continue;

    if (!byGuid.has(guid)) {
      const user_base_id_data =
        row.leader_first_name ||
        row.leader_second_name ||
        row.leader_middle_name ||
        row.leader_email ||
        row.leader_phone
          ? {
              first_name: row.leader_first_name || null,
              second_name: row.leader_second_name || null,
              middle_name: row.leader_middle_name || null,
              email: row.leader_email || null,
              phone: row.leader_phone || null,
            }
          : null;

      byGuid.set(guid, {
        guid,
        title: String(row.title || ""),
        companies_id: String(row.companies_id || ""),
        departments_id:
          typeof row.departments_id === "string" && row.departments_id ? row.departments_id : null,
        user_base_id:
          typeof row.user_base_id === "string" && row.user_base_id ? row.user_base_id : null,
        user_base_id_data,
        created_at: String(row.created_at || ""),
        updated_at: String(row.updated_at || ""),
        experience_level_titles: [],
      });
    }

    const department = byGuid.get(guid);
    if (!department) continue;

    const levelTitle = String(row.experience_level_title || "").trim();
    if (levelTitle && !department.experience_level_titles?.includes(levelTitle)) {
      department.experience_level_titles = [
        ...(department.experience_level_titles || []),
        levelTitle,
      ];
    }
  }

  return Array.from(byGuid.values()).sort((a, b) =>
    String(a.title || "").localeCompare(String(b.title || ""), "ru")
  );
};

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

  getSettingsAggregationList: async (
    params?: DepartmentListParams
  ): Promise<DepartmentListResponse> => {
    const limit = Math.min(Math.max(params?.limit || 200, 1), 200);
    const maxRequests = 100;
    let offset = Number(params?.offset || 0);
    const rows: DepartmentAggregationRow[] = [];

    for (let requestIndex = 0; requestIndex < maxRequests; requestIndex += 1) {
      const res = await httpRequest.post("/v2/items/departments/aggregation", {
        data: {
          operation: "SELECT",
          table:
            "departments d LEFT JOIN user_base ub ON ub.guid = d.user_base_id LEFT JOIN department_experience_levels del ON del.departments_id = d.guid LEFT JOIN experience_levels el ON el.guid = del.experience_levels_id",
          columns: [
            "d.guid AS guid",
            "d.title AS title",
            "d.companies_id AS companies_id",
            "d.departments_id AS departments_id",
            "d.user_base_id AS user_base_id",
            "d.created_at AS created_at",
            "d.updated_at AS updated_at",
            "ub.first_name AS leader_first_name",
            "ub.second_name AS leader_second_name",
            "ub.middle_name AS leader_middle_name",
            "ub.email AS leader_email",
            "ub.phone AS leader_phone",
            "el.title AS experience_level_title",
          ],
          order_by: ["d.title ASC", "el.title ASC", "d.created_at DESC"],
          limit,
          offset,
        },
        is_cached: false,
      });

      const chunk = normalizeAggregationRows(res);
      if (chunk.length === 0) {
        break;
      }

      rows.push(...chunk);
      offset += chunk.length;

      if (chunk.length < limit) {
        break;
      }
    }

    const response = mapAggregationRowsToDepartments(rows);

    return {
      count: response.length,
      response,
    };
  },

  create: (data: { title: string; departments_id?: string | null; user_base_id?: string | null; companies_id?: string }) =>
    httpRequest.post("/v2/items/departments", {
      data: {
        companies_id: COMPANY_ID,
        ...data,
      },
    }),

  update: (
    guid: string,
    data: Partial<Department>
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
  querySettings?: Record<string, unknown>;
}) => {
  return useQuery({
    queryKey: ["DEPARTMENTS_SETTINGS", params],
    queryFn: () => departmentService.getList(params),
    ...querySettings,
  });
};

export const useDepartmentsSettingsAggregationQuery = ({
  params,
  querySettings = {},
}: {
  params?: DepartmentListParams;
  querySettings?: Record<string, unknown>;
}) => {
  return useQuery({
    queryKey: ["DEPARTMENTS_SETTINGS", "aggregation", params],
    queryFn: () => departmentService.getSettingsAggregationList(params),
    ...querySettings,
  });
};

export const useCreateDepartment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { title: string; departments_id?: string | null; user_base_id?: string | null; companies_id?: string }) =>
      departmentService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["DEPARTMENTS_SETTINGS"]);
      queryClient.invalidateQueries(["DEPARTMENTS_SETTINGS", "aggregation"]);
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
      data: Partial<Department>;
    }) => departmentService.update(guid, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["DEPARTMENTS_SETTINGS"]);
      queryClient.invalidateQueries(["DEPARTMENTS_SETTINGS", "aggregation"]);
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
      queryClient.invalidateQueries(["DEPARTMENTS_SETTINGS", "aggregation"]);
      queryClient.invalidateQueries(["departments"]);
    },
  });
};

export default departmentService;
