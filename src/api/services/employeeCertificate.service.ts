import { useMutation, useQuery, useQueryClient } from "react-query";
import axios from "axios";
import authStore from "../../store/auth.store";

const BASE_URL = "https://api.admin.u-code.io";
const PROJECT_ID = "84f1983d-5095-490e-ba9c-d2618b164c99";
const SLUG = "employee_certificates";

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

export interface EmployeeCertificate {
  guid: string;
  user_base_id: string;
  title: string;
  issuer: string;
  credential_id: string | null;
  issue_date: string | null;
  expiration_date: string | null;
  no_expiration: boolean;
  credential_url: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  user_base_id_data?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface EmployeeCertificateListResponse {
  count: number;
  response: EmployeeCertificate[];
}

export const useEmployeeCertificatesQuery = ({
  userBaseId,
  limit = 100,
  offset = 0,
}: {
  userBaseId: string;
  limit?: number;
  offset?: number;
}) => {
  return useQuery(
    ["employee-certificates", userBaseId, limit, offset],
    async (): Promise<EmployeeCertificateListResponse> => {
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
          ? (payload.response as EmployeeCertificate[])
          : [],
      };
    },
    { enabled: !!userBaseId }
  );
};

export const useCreateEmployeeCertificate = (userBaseId: string) => {
  const qc = useQueryClient();
  return useMutation(
    async (data: Partial<EmployeeCertificate>) => {
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
        qc.invalidateQueries(["employee-certificates", userBaseId]);
        qc.invalidateQueries("employee-certificates");
      },
    }
  );
};

export const useUpdateEmployeeCertificate = (userBaseId: string) => {
  const qc = useQueryClient();
  return useMutation(
    async (data: Partial<EmployeeCertificate> & { guid: string }) => {
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
        qc.invalidateQueries(["employee-certificates", userBaseId]);
        qc.invalidateQueries("employee-certificates");
      },
    }
  );
};

export const useDeleteEmployeeCertificate = (userBaseId: string) => {
  const qc = useQueryClient();
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
        qc.invalidateQueries(["employee-certificates", userBaseId]);
        qc.invalidateQueries("employee-certificates");
      },
    }
  );
};
