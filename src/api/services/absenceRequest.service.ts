import { useMutation, useQuery, useQueryClient } from "react-query";
import httpRequest from "../httpRequest";
import encodeJsonToUrlParam from "../../utils/encodeJsonToUrlParam";
import { COMPANY_ID } from "./settingsDirectory.service";

const ABSENCES_COLLECTION = "absences";

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

const escapeSqlValue = (value: string): string => value.replace(/'/g, "''");

const buildCalendarWhereClause = ({
  employeeIds,
  dateFrom,
  dateTo,
  userBaseColumn = "user_base_id",
  dateFromColumn = "date_from",
  dateToColumn = "date_to",
}: CalendarAbsencesParams & {
  userBaseColumn?: string;
  dateFromColumn?: string;
  dateToColumn?: string;
}): string => {
  const sanitizedIds = employeeIds
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => `'${escapeSqlValue(id)}'`);

  if (sanitizedIds.length === 0) return "1 = 0";

  const safeDateFrom = escapeSqlValue(dateFrom);
  const safeDateTo = escapeSqlValue(dateTo);

  return [
    `${userBaseColumn} IN (${sanitizedIds.join(",")})`,
    `${dateFromColumn} <= '${safeDateTo}'`,
    `${dateToColumn} >= '${safeDateFrom}'`,
  ].join(" AND ");
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

    if (normalizedIds.length === 0) {
      return {
        count: 0,
        response: [],
      };
    }

    const limit = 200;
    const maxRequests = 100;
    let offset = 0;
    let totalCount = 0;
    const response: Absence[] = [];
    const where = buildCalendarWhereClause({
      employeeIds: normalizedIds,
      dateFrom,
      dateTo,
    });
    const whereWithAlias = buildCalendarWhereClause({
      employeeIds: normalizedIds,
      dateFrom,
      dateTo,
      userBaseColumn: "a.user_base_id",
      dateFromColumn: "a.date_from",
      dateToColumn: "a.date_to",
    });

    for (let requestIndex = 0; requestIndex < maxRequests; requestIndex += 1) {
      let res: unknown;

      try {
        res = await httpRequest.post("/v2/items/store/aggregation", {
          data: {
            operation: "SELECT",
            table: "absences a LEFT JOIN absence_policies ap ON ap.guid = a.absence_policies_id",
            columns: [
              "a.guid",
              "a.user_base_id",
              "a.absence_policies_id",
              "a.date_from",
              "a.date_to",
              "a.requested_days",
              "a.status",
              "a.created_at",
              "a.updated_at",
              "ap.title AS absence_policy_title",
              "ap.icon AS absence_policy_icon",
              "ap.color AS absence_policy_color",
            ],
            where: whereWithAlias,
            order_by: ["a.date_from ASC", "a.created_at DESC"],
            limit,
            offset,
          },
          is_cached: true,
        });
      } catch {
        res = await httpRequest.post(`/v2/items/${ABSENCES_COLLECTION}/aggregation`, {
          data: {
            operation: "SELECT",
            table: ABSENCES_COLLECTION,
            columns: [
              "guid",
              "user_base_id",
              "absence_policies_id",
              "date_from",
              "date_to",
              "requested_days",
              "status",
              "created_at",
              "updated_at",
            ],
            where,
            order_by: ["date_from ASC", "created_at DESC"],
            limit,
            offset,
          },
          is_cached: true,
        });
      }

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
