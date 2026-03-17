import { useMutation, useQueryClient } from "react-query";
import httpRequest from "../httpRequest";

const COLLECTION = "position_experience_levels";

export interface PositionExperienceLevelRelation {
  guid: string;
  positions_id: string;
  experience_levels_id: string;
  experience_levels_id_data?: {
    guid?: string;
    title?: string;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

export interface PositionExperienceLevelListResponse {
  count: number;
  response: PositionExperienceLevelRelation[];
}

const normalizeIds = (ids: string[]): string[] =>
  Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));

const normalizeListResponse = (res: unknown): PositionExperienceLevelListResponse => {
  const obj = (res && typeof res === "object") ? (res as Record<string, unknown>) : {};
  const rawResponse = obj.response;
  return {
    count: Number(obj.count || 0),
    response: Array.isArray(rawResponse)
      ? (rawResponse as PositionExperienceLevelRelation[])
      : [],
  };
};

const positionExperienceLevelService = {
  getListByPosition: async (
    positionGuid: string
  ): Promise<PositionExperienceLevelListResponse> => {
    try {
      const res = await httpRequest.get(`/v2/items/${COLLECTION}`, {
        params: {
          limit: 1000,
          offset: 0,
          positions_id: positionGuid,
          with_relations: true,
        },
      });

      const normalized = normalizeListResponse(res);
      const filtered = normalized.response.filter(
        (relation) => relation.positions_id === positionGuid
      );
      return {
        count: filtered.length,
        response: filtered,
      };
    } catch {
      const where = `positions_id='${positionGuid}'`;
      const res = await httpRequest.post(`/v2/items/${COLLECTION}/aggregation`, {
        data: {
          operation: "SELECT",
          table: COLLECTION,
          columns: ["guid", "positions_id", "experience_levels_id"],
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

  multipleInsert: async (items: Array<{ positions_id: string; experience_levels_id: string }>) => {
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

  syncByPosition: async ({
    positionGuid,
    experienceLevelIds,
  }: {
    positionGuid: string;
    experienceLevelIds: string[];
  }) => {
    const targetIds = normalizeIds(experienceLevelIds);
    const existing = await positionExperienceLevelService.getListByPosition(positionGuid);

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
        positions_id: positionGuid,
        experience_levels_id: levelId,
      }));

    await positionExperienceLevelService.deleteMany(toDelete);
    await positionExperienceLevelService.multipleInsert(toInsert);
  },
};

export const useSyncPositionExperienceLevels = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      positionGuid,
      experienceLevelIds,
    }: {
      positionGuid: string;
      experienceLevelIds: string[];
    }) => positionExperienceLevelService.syncByPosition({ positionGuid, experienceLevelIds }),
    onSuccess: () => {
      queryClient.invalidateQueries(["POSITIONS"]);
      queryClient.invalidateQueries(["POSITION_EXPERIENCE_LEVELS"]);
    },
  });
};

export default positionExperienceLevelService;
