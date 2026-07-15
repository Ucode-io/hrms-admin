import { useMutation, useQuery, useQueryClient } from "react-query";
import httpRequest from "../httpRequest";

export const COMPANY_ID = "0de6b2b6-0777-4184-a620-aca70c294111";

export type SurveyStatus = "draft" | "active" | "archived";

export interface Survey {
  guid: string;
  title: string;
  companies_id: string;
  body?: string | null;
  status?: SurveyStatus | string | string[] | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface SurveyListResponse {
  count: number;
  response: Survey[];
}

export interface SurveyListParams {
  limit?: number;
  offset?: number;
  search?: string;
}

export interface SurveyUpsertPayload {
  title: string;
  body?: string | null;
  status?: string[] | null;
  companies_id?: string;
}

export const parseSurveyBody = (body: unknown): Record<string, unknown> => {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }

  if (typeof body === "string" && body.trim()) {
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // fallthrough
    }
  }

  return {};
};

export const serializeSurveyBody = (json: unknown): string =>
  JSON.stringify(json ?? {});

const surveyService = {
  getList: async (params?: SurveyListParams): Promise<SurveyListResponse> => {
    const res = await httpRequest.get("/v2/items/surveys", { params });

    return {
      count: Number(res?.count || 0),
      response: Array.isArray(res?.response) ? (res.response as Survey[]) : [],
    };
  },

  getOne: async (guid: string): Promise<Survey | null> => {
    const res = await httpRequest.get(`/v2/items/surveys/${guid}`);
    const obj = (res && typeof res === "object") ? (res as Record<string, unknown>) : {};
    const direct = obj.response && typeof obj.response === "object" && !Array.isArray(obj.response)
      ? (obj.response as Survey)
      : null;

    if (direct?.guid) return direct;
    if (typeof obj.guid === "string" && obj.guid) return obj as unknown as Survey;
    return null;
  },

  create: (data: SurveyUpsertPayload) =>
    httpRequest.post("/v2/items/surveys", {
      data: {
        companies_id: COMPANY_ID,
        status: ["draft"],
        ...data,
      },
    }),

  update: (guid: string, data: Partial<Survey>) =>
    httpRequest.put(`/v2/items/surveys/${guid}`, { data }),

  delete: async (guid: string) => {
    try {
      return await httpRequest.delete("/v2/items/surveys", {
        data: { ids: [guid] },
      });
    } catch {
      return httpRequest.delete(`/v2/items/surveys/${guid}`);
    }
  },
};

export const useSurveysQuery = ({
  params,
  querySettings = {},
}: {
  params?: SurveyListParams;
  querySettings?: any;
}) => {
  return useQuery({
    queryKey: ["SURVEYS", params],
    queryFn: () => surveyService.getList(params),
    ...querySettings,
  });
};

export const useSurveyQuery = (guid: string, querySettings: any = {}) => {
  return useQuery({
    queryKey: ["SURVEYS", "one", guid],
    queryFn: () => surveyService.getOne(guid),
    enabled: Boolean(guid),
    ...querySettings,
  });
};

export const useCreateSurvey = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SurveyUpsertPayload) => surveyService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["SURVEYS"]);
    },
  });
};

export const useUpdateSurvey = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ guid, data }: { guid: string; data: Partial<Survey> }) =>
      surveyService.update(guid, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["SURVEYS"]);
    },
  });
};

export const useDeleteSurvey = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (guid: string) => surveyService.delete(guid),
    onSuccess: () => {
      queryClient.invalidateQueries(["SURVEYS"]);
      queryClient.invalidateQueries(["SURVEY_EMPLOYEES"]);
    },
  });
};

export default surveyService;
