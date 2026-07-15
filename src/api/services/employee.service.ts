import { useMutation, useQuery, useQueryClient } from "react-query";
import axios from "axios";
import authStore from "../../store/auth.store";
import { injectCompaniesIdIntoItemsRequest } from "../httpRequest";

const BASE_URL = "https://api.admin.u-code.io";
const PROJECT_ID = "84f1983d-5095-490e-ba9c-d2618b164c99";
const SLUG = "user_base";
export type EmployeeStatus = "active" | "dismissed";

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

export interface Employee {
  guid: string;
  first_name: string;
  second_name: string;      // Фамилия
  middle_name: string;       // Отчество
  birth_date: string | null;
  date_hire: string | null;
  dismissal_date?: string | null;
  phone: string;
  gender: string[];          // ["male_slug"] | ["female_slug"]
  email: string | null;
  personal_email: string | null;
  photo: string | null;
  login: string | null;
  hikvision_id?: string | null;
  status: string[];          // ["active"]
  language: string[];

  departments_id: string | null;
  departments_id_data: {
    guid: string;
    title: string;
    [key: string]: any;
  } | null;

  positions_id: string | null;
  positions_id_data: {
    guid: string;
    title: string;
    [key: string]: any;
  } | null;

  employment_types_id: string | null;
  employment_types_id_data: {
    guid: string;
    title: string;
    [key: string]: any;
  } | null;

  experience_levels_id: string | null;
  experience_levels_id_data: {
    guid: string;
    title: string;
    [key: string]: any;
  } | null;

  divisions_id: string | null;
  divisions_id_data: {
    guid: string;
    title: string;
    [key: string]: any;
  } | null;

  locations_id: string | null;
  locations_id_data: {
    guid: string;
    title: string;
    address?: string;
    [key: string]: any;
  } | null;

  role_id: string | null;
  role_id_data: {
    guid: string;
    name: string;
    [key: string]: any;
  } | null;

  // HRMS application-level access role (separate from the ucode role_id above).
  hrms_roles_id?: string | null;

  dismissal_types_id?: string | null;
  dismissial_types_id?: string | null;
  dismissal_types_id_data?: {
    guid?: string;
    title?: string;
    [key: string]: any;
  } | null;
  dismissial_types_id_data?: {
    guid?: string;
    title?: string;
    [key: string]: any;
  } | null;
  dismissal_reasons_id?: string | null;
  dismissial_reasons_id?: string | null;
  dismissal_reasons_id_data?: {
    guid?: string;
    title?: string;
    [key: string]: any;
  } | null;
  dismissial_reasons_id_data?: {
    guid?: string;
    title?: string;
    [key: string]: any;
  } | null;

  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  [key: string]: any;
}

const EMPLOYEE_ROLE_ID = import.meta.env.VITE_EMPLOYEE_ROLE_ID || "";

// ───── Imperative list fetch (for bulk operations outside hooks) ─────
export const fetchEmployeesList = async (params: {
  limit?: number;
  offset?: number;
  search?: string;
  status?: EmployeeStatus;
  departments_id?: string[];
} = {}): Promise<{ count: number; response: Employee[] }> => {
  const dataObj: Record<string, any> = {
    limit: params.limit ?? 200,
    offset: params.offset ?? 0,
  };

  if (EMPLOYEE_ROLE_ID) {
    dataObj.role_id = EMPLOYEE_ROLE_ID;
  }

  if (params.search) {
    dataObj.search = params.search;
  }

  if (params.status) {
    dataObj.status = [params.status];
  }

  if (params.departments_id && params.departments_id.length > 0) {
    dataObj.departments_id = params.departments_id;
  }

  const res = await instance.get(`/v2/items/${SLUG}`, {
    params: {
      "project-id": PROJECT_ID,
      data: JSON.stringify(dataObj),
    },
  });

  const data = res.data?.data?.data;
  return {
    count: Number(data?.count || 0),
    response: Array.isArray(data?.response) ? (data.response as Employee[]) : [],
  };
};

// ───── List employees ─────
export const useEmployeesQuery = (
  params: {
    limit?: number;
    offset?: number;
    search?: string;
    status?: EmployeeStatus;
    positions_id?: string[];
    departments_id?: string[];
    enabled?: boolean;
  } = {}
) => {
  return useQuery(["employees", params], async () => {
    const dataObj: Record<string, any> = {
      limit: params.limit ?? 10,
      offset: params.offset ?? 0,
    };

    if (EMPLOYEE_ROLE_ID) {
      dataObj.role_id = EMPLOYEE_ROLE_ID;
    }

    if (params.search) {
      dataObj.search = params.search;
    }

    if (params.status) {
      dataObj.status = [params.status];
    }

    if (params.positions_id && params.positions_id.length > 0) {
      dataObj.positions_id = params.positions_id;
    }

    if (params.departments_id && params.departments_id.length > 0) {
      dataObj.departments_id = params.departments_id;
    }

    const res = await instance.get(`/v2/items/${SLUG}`, {
      params: {
        "project-id": PROJECT_ID,
        data: JSON.stringify(dataObj),
      },
    });
    return res.data?.data?.data;
  }, {
    enabled: params.enabled ?? true,
    keepPreviousData: true,
  });
};

// ───── Get single employee ─────
export const useEmployeeQuery = (guid: string) => {
  return useQuery(["employee", guid], async () => {
    const res = await instance.get(`/v2/items/${SLUG}/${guid}`, {
      params: { 
        "project-id": PROJECT_ID,
        with_relations: true,
      },
    });
    return res.data?.data?.data?.response as Employee;
  }, { enabled: !!guid });
};

// ───── Create employee ─────
export const useCreateEmployee = () => {
  const qc = useQueryClient();
  return useMutation(
    async (data: Partial<Employee>) => {
      const res = await instance.post(`/v2/items/${SLUG}`, { data }, {
        params: { "project-id": PROJECT_ID },
      });
      return res.data;
    },
    { onSuccess: () => qc.invalidateQueries("employees") }
  );
};

// ───── Update employee ─────
export const useUpdateEmployee = () => {
  const qc = useQueryClient();
  return useMutation(
    async (data: Partial<Employee> & { guid: string }) => {
      const res = await instance.put(`/v2/items/${SLUG}`, { data }, {
        params: { "project-id": PROJECT_ID },
      });
      return res.data;
    },
    {
      onSuccess: () => {
        qc.invalidateQueries("employees");
        qc.invalidateQueries("employee");
      }
    }
  );
};

// ───── Delete employee ─────
export const useDeleteEmployee = () => {
  const qc = useQueryClient();
  return useMutation(
    async (guid: string) => {
      const res = await instance.delete(`/v2/items/${SLUG}`, {
        params: { "project-id": PROJECT_ID },
        data: { ids: [guid] },
      });
      return res.data;
    },
    { onSuccess: () => qc.invalidateQueries("employees") }
  );
};
