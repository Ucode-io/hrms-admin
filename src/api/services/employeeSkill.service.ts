import { useMutation, useQuery, useQueryClient } from "react-query";
import axios from "axios";
import authStore from "../../store/auth.store";
import { retryWithFreshToken } from "../unauthorizedHandler";
import { injectCompaniesIdIntoItemsRequest } from "../httpRequest";

const BASE_URL = "https://api.admin.u-code.io";
const PROJECT_ID = "84f1983d-5095-490e-ba9c-d2618b164c99";
const SLUG = "employee_skills";

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

export interface EmployeeSkill {
  guid: string;
  user_base_id: string;
  skills_id: string;
  skills_id_data?: {
    guid: string;
    title: string;
    [key: string]: unknown;
  } | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  user_base_id_data?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface EmployeeSkillListResponse {
  count: number;
  response: EmployeeSkill[];
}

export const useEmployeeSkillsQuery = ({
  userBaseId,
  limit = 200,
  offset = 0,
}: {
  userBaseId: string;
  limit?: number;
  offset?: number;
}) => {
  return useQuery(
    ["employee-skills", userBaseId, limit, offset],
    async (): Promise<EmployeeSkillListResponse> => {
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
          ? (payload.response as EmployeeSkill[])
          : [],
      };
    },
    { enabled: !!userBaseId }
  );
};

export const useCreateEmployeeSkill = (userBaseId: string) => {
  const qc = useQueryClient();

  return useMutation(
    async (data: Pick<EmployeeSkill, "user_base_id" | "skills_id">) => {
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
        qc.invalidateQueries(["employee-skills", userBaseId]);
        qc.invalidateQueries("employee-skills");
      },
    }
  );
};

export const useDeleteEmployeeSkill = (userBaseId: string) => {
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
        qc.invalidateQueries(["employee-skills", userBaseId]);
        qc.invalidateQueries("employee-skills");
      },
    }
  );
};
