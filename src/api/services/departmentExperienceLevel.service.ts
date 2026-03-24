import { useMutation, useQuery, useQueryClient } from "react-query";
import httpRequest from "../httpRequest";

const COLLECTION = "department_experience_levels";

export interface DepartmentExperienceLevelRelation {
  guid: string;
  departments_id: string;
  experience_levels_id: string;
  experience_levels_id_data?: {
    guid?: string;
    title?: string;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

export interface DepartmentExperienceLevelListResponse {
  count: number;
  response: DepartmentExperienceLevelRelation[];
}

export interface DepartmentExperienceLevelSummaryItem {
  guid: string;
  departments_id: string;
  experience_levels_id: string;
  experience_level_title?: string;
}

export interface DepartmentExperienceLevelSummaryResponse {
  count: number;
  response: DepartmentExperienceLevelSummaryItem[];
}

const normalizeIds = (ids: string[]): string[] =>
  Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));

const normalizeListResponse = (res: unknown): DepartmentExperienceLevelListResponse => {
  const obj = (res && typeof res === "object") ? (res as Record<string, unknown>) : {};
  const rawResponse = obj.response;

  return {
    count: Number(obj.count || 0),
    response: Array.isArray(rawResponse)
      ? (rawResponse as DepartmentExperienceLevelRelation[])
      : [],
  };
};

const normalizeSummaryResponse = (res: unknown): DepartmentExperienceLevelSummaryResponse => {
  const obj = (res && typeof res === "object") ? (res as Record<string, unknown>) : {};
  const directDataArray = Array.isArray(obj.data) ? obj.data : null;
  const nestedData =
    obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)
      ? (obj.data as Record<string, unknown>)
      : null;
  const nestedInnerData =
    nestedData?.data && typeof nestedData.data === "object"
      ? (nestedData.data as Record<string, unknown>)
      : null;
  const rawResponse = Array.isArray(obj.response)
    ? obj.response
    : directDataArray
      ? directDataArray
    : Array.isArray(nestedInnerData?.data)
      ? nestedInnerData.data
      : [];
  const rawCount =
    typeof obj.count === "number"
      ? obj.count
      : Array.isArray(obj.data)
        ? obj.data.length
      : typeof nestedInnerData?.count === "number"
        ? nestedInnerData.count
        : Array.isArray(rawResponse)
          ? rawResponse.length
          : 0;

  return {
    count: Number(rawCount || 0),
    response: Array.isArray(rawResponse)
      ? (rawResponse as DepartmentExperienceLevelSummaryItem[])
      : [],
  };
};

const escapeSqlValue = (value: string) => value.replace(/'/g, "''");

const buildDepartmentsWhereClause = (departmentIds: string[]) => {
  const normalizedIds = normalizeIds(departmentIds);
  if (normalizedIds.length === 0) {
    return "";
  }

  const quotedIds = normalizedIds.map((id) => `'${escapeSqlValue(id)}'`).join(", ");
  return `del.departments_id IN (${quotedIds})`;
};

const departmentExperienceLevelService = {
  getListByDepartment: async (
    departmentGuid: string
  ): Promise<DepartmentExperienceLevelListResponse> => {
    try {
      const res = await httpRequest.get(`/v2/items/${COLLECTION}`, {
        params: {
          limit: 1000,
          offset: 0,
          departments_id: departmentGuid,
          with_relations: true,
        },
      });

      const normalized = normalizeListResponse(res);
      const filtered = normalized.response.filter(
        (relation) => relation.departments_id === departmentGuid
      );

      return {
        count: filtered.length,
        response: filtered,
      };
    } catch {
      const where = `departments_id='${departmentGuid}'`;
      const res = await httpRequest.post(`/v2/items/${COLLECTION}/aggregation`, {
        data: {
          operation: "SELECT",
          table: COLLECTION,
          columns: ["guid", "departments_id", "experience_levels_id"],
          where,
          order_by: ["created_at DESC"],
          limit: 1000,
          offset: 0,
        },
        is_cached: true,
      });

      return normalizeListResponse(res);
    }
  },

  getSummaryByDepartments: async (
    departmentIds: string[]
  ): Promise<DepartmentExperienceLevelSummaryResponse> => {
    const where = buildDepartmentsWhereClause(departmentIds);
    if (!where) {
      return {
        count: 0,
        response: [],
      };
    }

    const limit = 200;
    const maxRequests = 100;
    let offset = 0;
    let totalCount = 0;
    const response: DepartmentExperienceLevelSummaryItem[] = [];

    for (let requestIndex = 0; requestIndex < maxRequests; requestIndex += 1) {
      const res = await httpRequest.post("/v2/items/departments/aggregation", {
        data: {
          operation: "SELECT",
          table:
            "department_experience_levels del LEFT JOIN experience_levels el ON el.guid = del.experience_levels_id",
          columns: [
            "del.guid",
            "del.departments_id",
            "del.experience_levels_id",
            "el.title AS experience_level_title",
          ],
          where,
          order_by: ["el.title ASC", "del.created_at DESC"],
          limit,
          offset,
        },
        is_cached: true,
      });

      const normalizedChunk = normalizeSummaryResponse(res);
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

  multipleInsert: async (
    items: Array<{ departments_id: string; experience_levels_id: string }>
  ) => {
    if (items.length === 0) return null;

    try {
      return await httpRequest.post(`/v2/items/${COLLECTION}/multiple-insert`, { items });
    } catch {
      return Promise.all(
        items.map((item) => httpRequest.post(`/v2/items/${COLLECTION}`, { data: item }))
      );
    }
  },

  deleteMany: async (ids: string[]) => {
    const normalizedIds = normalizeIds(ids);
    if (normalizedIds.length === 0) return null;

    try {
      return await httpRequest.delete(`/v2/items/${COLLECTION}`, {
        data: { ids: normalizedIds },
      });
    } catch {
      return Promise.all(
        normalizedIds.map((guid) => httpRequest.delete(`/v2/items/${COLLECTION}/${guid}`))
      );
    }
  },

  syncByDepartment: async ({
    departmentGuid,
    experienceLevelIds,
  }: {
    departmentGuid: string;
    experienceLevelIds: string[];
  }) => {
    const targetIds = normalizeIds(experienceLevelIds);
    const existing = await departmentExperienceLevelService.getListByDepartment(departmentGuid);

    const existingIdsByLevel = new Map<string, string>();
    for (const relation of existing.response) {
      if (relation.experience_levels_id) {
        existingIdsByLevel.set(relation.experience_levels_id, relation.guid);
      }
    }

    const targetSet = new Set(targetIds);
    const toDelete = existing.response
      .filter((relation) => !targetSet.has(relation.experience_levels_id))
      .map((relation) => relation.guid);

    const toInsert = targetIds
      .filter((levelId) => !existingIdsByLevel.has(levelId))
      .map((levelId) => ({
        departments_id: departmentGuid,
        experience_levels_id: levelId,
      }));

    await departmentExperienceLevelService.deleteMany(toDelete);
    await departmentExperienceLevelService.multipleInsert(toInsert);
  },
};

export const useSyncDepartmentExperienceLevels = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      departmentGuid,
      experienceLevelIds,
    }: {
      departmentGuid: string;
      experienceLevelIds: string[];
    }) =>
      departmentExperienceLevelService.syncByDepartment({
        departmentGuid,
        experienceLevelIds,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries(["DEPARTMENTS_SETTINGS"]);
      queryClient.invalidateQueries(["DEPARTMENTS_SETTINGS", "aggregation"]);
      queryClient.invalidateQueries(["DEPARTMENT_EXPERIENCE_LEVELS"]);
    },
  });
};

export const useDepartmentExperienceLevelsSummaryQuery = ({
  departmentIds,
  querySettings = {},
}: {
  departmentIds: string[];
  querySettings?: Record<string, unknown>;
}) => {
  const normalizedIds = normalizeIds(departmentIds);

  return useQuery({
    queryKey: ["DEPARTMENT_EXPERIENCE_LEVELS_SUMMARY", normalizedIds],
    queryFn: () => departmentExperienceLevelService.getSummaryByDepartments(normalizedIds),
    enabled: normalizedIds.length > 0,
    ...querySettings,
  });
};

export default departmentExperienceLevelService;
