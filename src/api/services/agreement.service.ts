import { useMutation, useQuery, useQueryClient } from "react-query";
import axios from "axios";
import authStore from "../../store/auth.store";
import { retryWithFreshToken } from "../unauthorizedHandler";
import { injectCompaniesIdIntoItemsRequest } from "../httpRequest";

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
  return injectCompaniesIdIntoItemsRequest(config);
});

instance.interceptors.response.use(
  (response) => response,
  retryWithFreshToken(instance)
);

export interface Agreement {
  guid: string;
  company_name: string;
  contract_number: string;
  contract_amount: number | string;
  file: string;
  status: boolean;
  created_at: string;
  updated_at: string;
}

// ------------------------------
// Hooks
// ------------------------------

// Get Agreements List
export const useAgreementsQuery = (params: { limit?: number; offset?: number; search?: string } = {}) => {
  return useQuery(["agreements", params], async () => {
    const queryParams: Record<string, string> = { "project-id": PROJECT_ID };
    if (params.limit) queryParams["limit"] = String(params.limit);
    if (params.offset) queryParams["offset"] = String(params.offset);
    if (params.search) queryParams["search"] = params.search;

    const res = await instance.get("/v2/items/agreements", { params: queryParams });
    return res.data?.data?.data as { count: number; response: Agreement[] };
  });
};

// Get Single Agreement
export const useAgreementQuery = (guid: string) => {
  return useQuery(["agreement", guid], async () => {
    const res = await instance.get(`/v2/items/agreements/${guid}`, {
      params: { "project-id": PROJECT_ID },
    });
    return res.data?.data?.data?.response as Agreement;
  }, { enabled: !!guid });
};

// Create Agreement
export const useCreateAgreementMutation = () => {
  const qc = useQueryClient();

  return useMutation(
    async (data: Partial<Agreement>) => {
      const res = await instance.post("/v2/items/agreements", { data }, {
        params: { "project-id": PROJECT_ID },
      });
      return res.data;
    },
    { onSuccess: () => qc.invalidateQueries("agreements") }
  );
};

// Update Agreement
export const useUpdateAgreementMutation = () => {
  const qc = useQueryClient();

  return useMutation(
    async (data: Partial<Agreement> & { guid: string }) => {
      const res = await instance.put("/v2/items/agreements", { data }, {
        params: { "project-id": PROJECT_ID },
      });
      return res.data;
    },
    {
      onSuccess: (_, variables) => {
        qc.invalidateQueries("agreements");
        qc.invalidateQueries(["agreement", variables.guid]);
      },
    }
  );
};
