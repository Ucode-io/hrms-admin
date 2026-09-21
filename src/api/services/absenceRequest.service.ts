import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "react-query";
import httpRequest, {
  injectCompaniesIdIntoInvokeFunctionRequest,
} from "../httpRequest";
import authStore from "../../store/auth.store";
import { retryWithFreshToken } from "../unauthorizedHandler";
import encodeJsonToUrlParam from "../../utils/encodeJsonToUrlParam";
import { COMPANY_ID } from "./settingsDirectory.service";
import reportsService from "./reports.service";

const ABSENCES_COLLECTION = "absences";

const REPORTS_BASE_URL = "https://api.admin.u-code.io";
const REPORTS_FUNCTION_PATH =
  "/v2/invoke_function/udevs-hrms-reports?project-id=9a462573-ce11-4288-928a-a6ba754b6998";
const CALENDAR_ABSENCES_METHOD = "get_calendar_absences";

export type AbsenceRequestStatus = "pending" | "approved" | "rejected";

export interface Absence {
  guid: string;
  companies_id?: string;
  user_base_id: string;
  absence_policies_id: string;
  absence_policy_title?: string;
  absence_policy_icon?: string;
  absence_policy_color?: string;
  absence_policies_id_data?: {
    guid?: string;
    title?: string;
    icon?: string;
    color?: string;
    [key: string]: unknown;
  } | null;
  date_from: string;
  date_to: string;
  requested_days?: number;
  requested_breakdown?:
    | Array<{
        date: string;
        value: number;
      }>
    | string;
  note?: string | null;
  attachments?: string[] | string;
  status?: string | string[];
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  reject_reason?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

type AbsenceRequestsFilterData = {
  user_base_id?: string;
  absence_policies_id?: string;
  status?: string | string[];
  limit?: number;
  offset?: number;
  [key: string]: unknown;
};

export interface CalendarAbsencesParams {
  employeeIds: string[];
  dateFrom: string;
  dateTo: string;
}

interface AbsenceListResponse {
  count: number;
  response: Absence[];
}

const extractAbsenceRows = (res: unknown): Absence[] => {
  if (Array.isArray(res)) return res as Absence[];

  const obj = (res && typeof res === "object") ? (res as Record<string, unknown>) : {};

  if (Array.isArray(obj.response)) {
    return obj.response as Absence[];
  }

  if (Array.isArray(obj.data)) {
    return obj.data as Absence[];
  }

  const nestedData = obj.data;
  if (nestedData && typeof nestedData === "object") {
    const nestedObj = nestedData as Record<string, unknown>;
    if (Array.isArray(nestedObj.data)) {
      return nestedObj.data as Absence[];
    }
  }

  return [];
};

const normalizeListResponse = (res: unknown): AbsenceListResponse => {
  const obj = (res && typeof res === "object") ? (res as Record<string, unknown>) : {};
  const rows = extractAbsenceRows(res);
  const safeCount = Number(obj.count || 0);

  return {
    count: Number.isFinite(safeCount) && safeCount > 0 ? safeCount : rows.length,
    response: rows,
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const reportsRequest = axios.create({
  baseURL: REPORTS_BASE_URL,
  timeout: 100_000,
  headers: { "Content-Type": "application/json" },
});

reportsRequest.interceptors.request.use((config) => {
  const token = authStore.token ?? localStorage.getItem("auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return injectCompaniesIdIntoInvokeFunctionRequest(config);
});

reportsRequest.interceptors.response.use(
  (response) => response,
  retryWithFreshToken(reportsRequest)
);

const normalizeReportsListResult = (
  result: Record<string, unknown>
): AbsenceListResponse => {
  const response = Array.isArray(result.response)
    ? (result.response as Absence[])
    : [];
  const safeCount = Number(result.count || 0);
  return {
    count: Number.isFinite(safeCount) && safeCount > 0 ? safeCount : response.length,
    response,
  };
};

// The invoke_function response nests the gateway result under a few possible
// envelopes ({ data: { data: { method, result } } }, etc.). Walk down until we
// find the node carrying our method's result and pull out its `response` array.
const findCalendarAbsencesResult = (
  raw: unknown,
  depth = 0
): AbsenceListResponse | null => {
  if (depth > 6 || !isRecord(raw)) return null;

  const result = isRecord(raw.result) ? raw.result : null;
  if (raw.method === CALENDAR_ABSENCES_METHOD && result) {
    return normalizeReportsListResult(result);
  }

  if (result && Array.isArray((result as Record<string, unknown>).response)) {
    return normalizeReportsListResult(result);
  }

  if (Array.isArray((raw as Record<string, unknown>).response)) {
    return normalizeReportsListResult(raw);
  }

  return findCalendarAbsencesResult(raw.data, depth + 1);
};

const absenceService = {
  getList: (data: AbsenceRequestsFilterData) =>
    httpRequest.get(`/v2/items/${ABSENCES_COLLECTION}`, {
      params: { data: encodeJsonToUrlParam(data) },
    }),

  getListByUserBaseId: async (userBaseId: string): Promise<AbsenceListResponse> => {
    const normalizedUserBaseId = userBaseId.trim();
    if (!normalizedUserBaseId) {
      return {
        count: 0,
        response: [],
      };
    }

    const limit = 200;
    const maxRequests = 200;
    let offset = 0;
    let totalCount = 0;
    const response: Absence[] = [];

    for (let requestIndex = 0; requestIndex < maxRequests; requestIndex += 1) {
      const res = await absenceService.getList({
        user_base_id: normalizedUserBaseId,
        limit,
        offset,
      });

      const normalizedChunk = normalizeListResponse(res);
      if (normalizedChunk.count > 0) {
        totalCount = normalizedChunk.count;
      }

      if (normalizedChunk.response.length === 0) {
        break;
      }

      response.push(...normalizedChunk.response);
      offset += normalizedChunk.response.length;

      if (totalCount > 0 && response.length >= totalCount) {
        break;
      }

      if (normalizedChunk.response.length < limit) {
        break;
      }
    }

    return {
      count: totalCount || response.length,
      response,
    };
  },

  getCalendarListByAggregation: async ({
    employeeIds,
    dateFrom,
    dateTo,
  }: CalendarAbsencesParams): Promise<AbsenceListResponse> => {
    const normalizedIds = Array.from(
      new Set(employeeIds.map((id) => id.trim()).filter(Boolean))
    );

    if (normalizedIds.length === 0 || !dateFrom || !dateTo) {
      return {
        count: 0,
        response: [],
      };
    }

    // Server-side join + filter in a single round trip (udevs-hrms-reports
    // get_calendar_absences). Replaces the old limit/offset aggregation that
    // silently dropped late-dated absences once a month exceeded the row cap.
    const res = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
      data: {
        method: CALENDAR_ABSENCES_METHOD,
        data: {
          employee_ids: normalizedIds,
          date_from: dateFrom,
          date_to: dateTo,
        },
      },
    });

    return findCalendarAbsencesResult(res.data) || { count: 0, response: [] };
  },

  create: (data: Partial<Absence>) =>
    httpRequest.post(`/v2/items/${ABSENCES_COLLECTION}`, {
      data: {
        companies_id: COMPANY_ID,
        ...data,
      },
    }),

  update: async (guid: string, data: Partial<Absence>) => {
    const payload = {
      ...data,
      guid,
    };

    try {
      return await httpRequest.put(`/v2/items/${ABSENCES_COLLECTION}/${guid}`, {
        data: payload,
      });
    } catch {
      // Fallback for APIs expecting ids-based update on collection endpoint
      return httpRequest.put(`/v2/items/${ABSENCES_COLLECTION}`, {
        data: {
          ids: [guid],
          ...payload,
        },
      });
    }
  },

  delete: async (guid: string) => {
    try {
      return await httpRequest.delete(`/v2/items/${ABSENCES_COLLECTION}`, {
        data: { ids: [guid] },
      });
    } catch {
      return httpRequest.delete(`/v2/items/${ABSENCES_COLLECTION}/${guid}`);
    }
  },
};

export const useAbsencesQuery = ({
  data,
  querySettings = {},
  allowWithoutUserBaseId = false,
}: {
  data: AbsenceRequestsFilterData;
  querySettings?: Record<string, unknown>;
  allowWithoutUserBaseId?: boolean;
}) => {
  const settings = querySettings as Record<string, unknown> & {
    enabled?: boolean;
  };

  const { enabled: externalEnabled, ...restSettings } = settings;
  const baseEnabled = allowWithoutUserBaseId || Boolean(data?.user_base_id);
  const enabled =
    typeof externalEnabled === "boolean"
      ? baseEnabled && externalEnabled
      : baseEnabled;

  return useQuery({
    queryKey: ["absences", data],
    queryFn: () => absenceService.getList(data),
    enabled,
    ...restSettings,
  });
};

export const useCreateAbsence = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<Absence>) => absenceService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["absences"]);
      queryClient.invalidateQueries(["absences-by-user"]);
    },
  });
};

export const useUpdateAbsence = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      guid,
      data,
    }: {
      guid: string;
      data: Partial<Absence>;
    }) => absenceService.update(guid, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["absences"]);
      queryClient.invalidateQueries(["absences-by-user"]);
    },
  });
};

export const useDeleteAbsence = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (guid: string) => absenceService.delete(guid),
    onSuccess: () => {
      queryClient.invalidateQueries(["absences"]);
      queryClient.invalidateQueries(["absences-by-user"]);
      queryClient.invalidateQueries(["calendar-absences"]);
      queryClient.invalidateQueries(["employee-absence-summary"]);
    },
  });
};

const invalidateAbsenceAndAttendanceQueries = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries(["absences"]);
  queryClient.invalidateQueries(["absences-by-user"]);
  queryClient.invalidateQueries(["calendar-absences"]);
  queryClient.invalidateQueries(["employee-absence-summary"]);
  queryClient.invalidateQueries(["attendance"]);
  queryClient.invalidateQueries(["SETTINGS_DIRECTORY", "attendance"]);
  queryClient.invalidateQueries(["get_attendance"]);
  queryClient.invalidateQueries(["get_attendance_table"]);
};

export const useApproveAbsence = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      guid,
      reviewedBy,
    }: {
      guid: string;
      reviewedBy?: string | null;
    }) =>
      reportsService.approveAbsence({
        absences_id: guid,
        reviewed_by: reviewedBy ?? null,
      }),
    onSuccess: () => {
      invalidateAbsenceAndAttendanceQueries(queryClient);
    },
  });
};

export const useDeleteAbsenceWithAttendance = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (guid: string) =>
      reportsService.deleteAbsence({ absences_id: guid }),
    onSuccess: () => {
      invalidateAbsenceAndAttendanceQueries(queryClient);
    },
  });
};

export const useEmployeeAbsencesQuery = ({
  userBaseId,
  querySettings = {},
}: {
  userBaseId: string;
  querySettings?: Record<string, unknown>;
}) => {
  const settings = querySettings as Record<string, unknown> & {
    enabled?: boolean;
  };

  const { enabled: externalEnabled, ...restSettings } = settings;
  const baseEnabled = Boolean(userBaseId);
  const enabled =
    typeof externalEnabled === "boolean"
      ? baseEnabled && externalEnabled
      : baseEnabled;

  return useQuery({
    queryKey: ["absences-by-user", userBaseId],
    queryFn: () => absenceService.getListByUserBaseId(userBaseId),
    enabled,
    ...restSettings,
  });
};

export const useCalendarAbsencesQuery = ({
  params,
  querySettings = {},
}: {
  params: CalendarAbsencesParams;
  querySettings?: Record<string, unknown>;
}) => {
  const normalizedEmployeeIds = Array.from(
    new Set((params.employeeIds || []).map((id) => id.trim()).filter(Boolean))
  ).sort();

  return useQuery({
    queryKey: ["calendar-absences", normalizedEmployeeIds, params.dateFrom, params.dateTo],
    queryFn: () =>
      absenceService.getCalendarListByAggregation({
        employeeIds: normalizedEmployeeIds,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
      }),
    enabled:
      normalizedEmployeeIds.length > 0 &&
      Boolean(params.dateFrom) &&
      Boolean(params.dateTo),
    ...querySettings,
  });
};

// Backward-compatible aliases for old imports
export type AbsenceRequest = Absence;
export const useAbsenceRequestsQuery = useAbsencesQuery;
export const useCreateAbsenceRequest = useCreateAbsence;
export const useUpdateAbsenceRequest = useUpdateAbsence;

export default absenceService;
