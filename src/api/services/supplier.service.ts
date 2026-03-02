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

export interface Supplier {
  guid: string;
  company_name: string;
  name: string;
  phone: string;
  created_at: string;
  updated_at: string;
}

export interface SuppliersResponse {
  status: string;
  description: string;
  data: {
    data: {
      count: number;
      response: Supplier[];
    };
  };
}

export interface SupplierResponse {
  status: string;
  description: string;
  data: {
    data: {
      response: Supplier;
    };
  };
}

// ------------------------------
// Hooks
// ------------------------------

// Get Suppliers List
export const useSuppliersQuery = (params: { limit?: number; offset?: number; search?: string } = {}) => {
  return useQuery(["suppliers", params], async () => {
    const queryParams: Record<string, string> = { "project-id": PROJECT_ID };
    if (params.limit) queryParams["limit"] = String(params.limit);
    if (params.offset) queryParams["offset"] = String(params.offset);
    if (params.search) queryParams["search"] = params.search;

    const res = await instance.get("/v2/items/suppliers", { params: queryParams });
    return res.data?.data?.data as { count: number; response: Supplier[] };
  });
};

// Get Single Supplier
export const useSupplierQuery = (guid: string) => {
  return useQuery(["supplier", guid], async () => {
    const res = await instance.get(`/v2/items/suppliers/${guid}`, {
      params: { "project-id": PROJECT_ID },
    });
    return res.data?.data?.data?.response as Supplier;
  }, { enabled: !!guid });
};

// Create Supplier
export const useCreateSupplierMutation = () => {
  const qc = useQueryClient();

  return useMutation(
    async (data: Partial<Supplier>) => {
      const res = await instance.post("/v2/items/suppliers", { data }, {
        params: { "project-id": PROJECT_ID },
      });
      return res.data;
    },
    { onSuccess: () => qc.invalidateQueries("suppliers") }
  );
};

// Update Supplier
export const useUpdateSupplierMutation = () => {
  const qc = useQueryClient();

  return useMutation(
    async (data: Partial<Supplier> & { guid: string }) => {
      const res = await instance.put("/v2/items/suppliers", { data }, {
        params: { "project-id": PROJECT_ID },
      });
      return res.data;
    },
    {
      onSuccess: (_, variables) => {
        qc.invalidateQueries("suppliers");
        qc.invalidateQueries(["supplier", variables.guid]);
      },
    }
  );
};
