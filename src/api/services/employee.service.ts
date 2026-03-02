import { useMutation, useQuery, useQueryClient } from "react-query";
import axios from "axios";
import authStore from "../../store/auth.store";

const BASE_URL = "https://api.admin.u-code.io";
const PROJECT_ID = "84f1983d-5095-490e-ba9c-d2618b164c99";

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

export interface Employee {
  guid: string;
  surname: string;
  first_name: string;
  second_name: string;
  birth_date: string | null;
  date_hire: string | null;
  phone: string;
  gender: string[];
  departments_id: string | null;
  departments_id_data: {
    guid: string;
    name_ru: string;
    name_uz: string;
  } | null;
  job_titles_id: string | null;
  job_titles_id_data: {
    guid: string;
    name_ru: string;
  } | null;
  foto: string | null;
  status: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  [key: string]: any;
}

export interface Department {
  guid: string;
  name_ru: string;
  name_uz: string;
  created_at: string;
  updated_at: string;
}

export interface JobTitle {
  guid: string;
  name_ru: string;
  name_uz: string;
  created_at: string;
  updated_at: string;
}

// ───── List employees ─────
export const useEmployeesQuery = (params: { limit?: number; offset?: number; search?: string } = {}) => {
  return useQuery(["employees", params], async () => {
    const queryParams: Record<string, string> = { "project-id": PROJECT_ID };
    if (params.limit) queryParams["limit"] = String(params.limit);
    if (params.offset) queryParams["offset"] = String(params.offset);
    if (params.search) queryParams["search"] = params.search;

    const res = await instance.get("/v2/items/employees", { params: queryParams });
    return res.data?.data?.data;
  });
};

// ───── Get single employee ─────
export const useEmployeeQuery = (guid: string) => {
  return useQuery(["employee", guid], async () => {
    const res = await instance.get(`/v2/items/employees/${guid}`, {
      params: { "project-id": PROJECT_ID },
    });
    return res.data?.data?.data?.response as Employee;
  }, { enabled: !!guid });
};

// ───── Create employee ─────
export const useCreateEmployee = () => {
  const qc = useQueryClient();
  return useMutation(
    async (data: Partial<Employee>) => {
      const res = await instance.post("/v2/items/employees", { data }, {
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
      const res = await instance.put("/v2/items/employees", { data }, {
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

// ───── List departments ─────
export const useDepartmentsQuery = () => {
  return useQuery(["departments"], async () => {
    const res = await instance.get("/v2/items/departments", {
      params: { "project-id": PROJECT_ID },
    });
    return (res.data?.data?.data?.response || []) as Department[];
  });
};

// ───── List job titles ─────
export const useJobTitlesQuery = () => {
  return useQuery(["job_titles"], async () => {
    const res = await instance.get("/v2/items/job_titles", {
      params: { "project-id": PROJECT_ID },
    });
    return (res.data?.data?.data?.response || []) as JobTitle[];
  });
};
