import { useMutation, useQuery, useQueryClient } from "react-query";
import httpRequest from "../httpRequest";
import { COMPANY_ID } from "./settingsDirectory.service";
import { RECRUITING_USE_MOCK } from "../../modules/Recruiting/mock/mockConfig";
import {
  mockCreateStageTemplate,
  mockDeleteStageTemplate,
  mockGetStageTemplate,
  mockListStageTemplates,
  mockUpdateStageTemplate,
} from "../../modules/Recruiting/mock/mockApi";
import {
  sortStages,
  stageColorOf,
  type StageDef,
  type StageTemplate,
  type StageTemplateDraft,
} from "../../modules/Recruiting/types";

const TEMPLATES_SLUG = "recruiting_stage_templates";

// ───── Raw API row shape ─────

export interface StageDefApiRow {
  id?: string;
  name?: string;
  color?: string;
  order?: number;
}

export interface StageTemplateApiRow {
  guid: string;
  name?: string | null;
  description?: string | null;
  stages?: StageDefApiRow[] | null;
  is_default?: boolean | null;
  created_at?: string | null;
  [key: string]: unknown;
}

interface ListResponse<T> {
  count: number;
  response: T[];
}

// ───── Mappers ─────

export const mapStageDefs = (rows: StageDefApiRow[] | null | undefined): StageDef[] => {
  if (!Array.isArray(rows)) return [];
  return sortStages(
    rows.map((r, i) => ({
      id: String(r.id ?? `stage-${i}`),
      name: String(r.name ?? `Этап ${i + 1}`),
      color: stageColorOf(r.color),
      order: Number.isFinite(r.order) ? Number(r.order) : i,
    }))
  );
};

export const stageDefsToPayload = (stages: StageDef[]): StageDefApiRow[] =>
  sortStages(stages).map((s, i) => ({ id: s.id, name: s.name, color: s.color, order: i }));

export const mapStageTemplateRow = (row: StageTemplateApiRow): StageTemplate => ({
  id: row.guid,
  name: row.name || "Без названия",
  description: row.description || "",
  stages: mapStageDefs(row.stages),
  isDefault: Boolean(row.is_default),
  createdAt: row.created_at || "",
});

const draftToPayload = (draft: StageTemplateDraft): Record<string, unknown> => ({
  name: draft.name,
  description: draft.description,
  stages: stageDefsToPayload(draft.stages),
  is_default: draft.isDefault,
});

// ───── Items API CRUD ─────

const stageTemplateService = {
  getList: () => {
    if (RECRUITING_USE_MOCK)
      return mockListStageTemplates() as unknown as Promise<ListResponse<StageTemplateApiRow>>;
    return httpRequest.get(`/v2/items/${TEMPLATES_SLUG}`, {
      params: { data: JSON.stringify({ limit: 100, offset: 0 }) },
    }) as unknown as Promise<ListResponse<StageTemplateApiRow>>;
  },

  getByGuid: (guid: string) => {
    if (RECRUITING_USE_MOCK)
      return mockGetStageTemplate(guid) as unknown as Promise<StageTemplateApiRow | null>;
    return httpRequest.get(
      `/v2/items/${TEMPLATES_SLUG}/${guid}`
    ) as unknown as Promise<StageTemplateApiRow>;
  },

  create: (draft: StageTemplateDraft) => {
    if (RECRUITING_USE_MOCK) return mockCreateStageTemplate(draftToPayload(draft));
    return httpRequest.post(`/v2/items/${TEMPLATES_SLUG}`, {
      data: { companies_id: COMPANY_ID, ...draftToPayload(draft) },
    });
  },

  update: (guid: string, draft: StageTemplateDraft) => {
    if (RECRUITING_USE_MOCK) return mockUpdateStageTemplate(guid, draftToPayload(draft));
    return httpRequest.put(`/v2/items/${TEMPLATES_SLUG}/${guid}`, {
      data: { ...draftToPayload(draft), guid },
    });
  },

  delete: async (guid: string) => {
    if (RECRUITING_USE_MOCK) return mockDeleteStageTemplate(guid);
    try {
      return await httpRequest.delete(`/v2/items/${TEMPLATES_SLUG}`, { data: { ids: [guid] } });
    } catch {
      return httpRequest.delete(`/v2/items/${TEMPLATES_SLUG}/${guid}`);
    }
  },
};

// ───── React Query hooks ─────

export const useStageTemplatesQuery = () =>
  useQuery({
    queryKey: ["stage-templates"],
    queryFn: () => stageTemplateService.getList(),
  });

export const useStageTemplateQuery = (guid: string | undefined) =>
  useQuery({
    queryKey: ["stage-template", guid],
    queryFn: () => stageTemplateService.getByGuid(guid as string),
    enabled: Boolean(guid),
  });

export const useCreateStageTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draft: StageTemplateDraft) => stageTemplateService.create(draft),
    onSuccess: () => queryClient.invalidateQueries(["stage-templates"]),
  });
};

export const useUpdateStageTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ guid, draft }: { guid: string; draft: StageTemplateDraft }) =>
      stageTemplateService.update(guid, draft),
    onSuccess: () => queryClient.invalidateQueries(["stage-templates"]),
  });
};

export const useDeleteStageTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (guid: string) => stageTemplateService.delete(guid),
    onSuccess: () => queryClient.invalidateQueries(["stage-templates"]),
  });
};

export default stageTemplateService;
