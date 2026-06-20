import { useMutation, useQuery, useQueryClient } from "react-query";
import httpRequest from "../httpRequest";
import { COMPANY_ID } from "./settingsDirectory.service";
import encodeJsonToUrlParam from "../../utils/encodeJsonToUrlParam";
import { RECRUITING_USE_MOCK } from "../../modules/Recruiting/mock/mockConfig";
import {
  mockCreateVacancy,
  mockDeleteVacancy,
  mockGetVacancy,
  mockListVacancies,
  mockUpdateVacancy,
  mockUpdateVacancyStages,
  mockUpdateVacancyStatus,
  mockVacancyCandidateCounts,
  type VacancyCounts,
} from "../../modules/Recruiting/mock/mockApi";
import {
  mapStageDefs,
  stageDefsToPayload,
  type StageDefApiRow,
} from "./stageTemplate.service";
import {
  type StageDef,
  type Vacancy,
  type VacancyDraft,
  type VacancyPriority,
  type VacancyStatus,
  type WorkMode,
} from "../../modules/Recruiting/types";

const VACANCIES_SLUG = "vacancies";
const CANDIDATES_SLUG = "candidates";

export type { VacancyCounts };

// ───── Raw API row shape ─────

export interface VacancyApiRow {
  guid: string;
  title?: string | null;
  departments_id?: string | null;
  departments_id_data?: { guid?: string; title?: string } | null;
  positions_id?: string | null;
  positions_id_data?: { guid?: string; title?: string } | null;
  tag?: string | null;
  locations_id?: string | null;
  locations_id_data?: { guid?: string; title?: string } | null;
  work_mode?: string[] | string | null;
  employment_type?: string | null;
  experience_level?: string | null;
  salary_min?: number | string | null;
  salary_max?: number | string | null;
  salary_currency?: string | null;
  status?: string[] | string | null;
  priority?: string[] | string | null;
  openings?: number | string | null;
  description?: string | null;
  skills?: string[] | string | null;
  deadline?: string | null;
  opened_at?: string | null;
  closed_at?: string | null;
  created_at?: string | null;
  recruiting_stage_templates_id?: string | null;
  stages?: StageDefApiRow[] | string | null;
  [key: string]: unknown;
}

interface ListResponse<T> {
  count: number;
  response: T[];
}

// Items API single-item GET wraps the row under `.response`; the list keeps the
// row at top level. Unwrap so the mappers always get the bare row (with guid).
const unwrapItem = <T>(res: unknown): T => {
  if (res && typeof res === "object" && !Array.isArray(res)) {
    const inner = (res as Record<string, unknown>).response;
    if (inner && typeof inner === "object" && !Array.isArray(inner)) return inner as T;
  }
  return res as T;
};

// ───── Mappers ─────

const VALID_STATUSES: VacancyStatus[] = ["open", "paused", "closed", "draft"];
const VALID_PRIORITIES: VacancyPriority[] = ["low", "medium", "high"];
const VALID_WORK_MODES: WorkMode[] = ["office", "remote", "hybrid"];

const pickEnum = <T extends string>(
  value: string[] | string | null | undefined,
  valid: T[],
  fallback: T
): T => {
  const raw = Array.isArray(value) ? value[0] : value;
  return valid.includes(raw as T) ? (raw as T) : fallback;
};

const toNum = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const toStrArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim())
    return value.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const toUuidOrNull = (value: string | null): string | null =>
  value && UUID_RE.test(value) ? value : null;

const vacancyStagesToPayload = (stages: StageDef[]): string =>
  JSON.stringify(stageDefsToPayload(stages));

export const mapVacancyRow = (row: VacancyApiRow, counts?: VacancyCounts): Vacancy => ({
  id: row.guid,
  title: row.title || "Без названия",
  departmentId: row.departments_id ?? null,
  departmentTitle: row.departments_id_data?.title || "—",
  positionId: row.positions_id ?? null,
  positionTitle: row.positions_id_data?.title || row.title || "",
  tag: row.tag || "",
  locationId: row.locations_id ?? null,
  location: row.locations_id_data?.title || "",
  workMode: pickEnum(row.work_mode, VALID_WORK_MODES, "office"),
  employmentType: row.employment_type || "Полная занятость",
  experienceLevel: row.experience_level || "",
  salaryMin: toNum(row.salary_min),
  salaryMax: toNum(row.salary_max),
  salaryCurrency: row.salary_currency || "UZS",
  status: pickEnum(row.status, VALID_STATUSES, "open"),
  priority: pickEnum(row.priority, VALID_PRIORITIES, "medium"),
  openings: Number(row.openings) || 1,
  description: row.description || "",
  skills: toStrArray(row.skills),
  deadline: row.deadline || null,
  openedAt: row.opened_at || row.created_at || null,
  closedAt: row.closed_at || null,
  createdAt: row.created_at || "",
  stageTemplateId: row.recruiting_stage_templates_id ?? null,
  stages: mapStageDefs(row.stages),
  candidatesCount: counts?.total ?? 0,
  hiredCount: counts?.hired ?? 0,
});

const draftToPayload = (
  draft: VacancyDraft,
  { serializeStages = true }: { serializeStages?: boolean } = {}
): Record<string, unknown> => ({
  title: draft.title,
  departments_id: toUuidOrNull(draft.departmentId),
  positions_id: toUuidOrNull(draft.positionId),
  tag: draft.tag,
  locations_id: toUuidOrNull(draft.locationId),
  work_mode: [draft.workMode],
  employment_type: draft.employmentType,
  experience_level: draft.experienceLevel,
  salary_min: draft.salaryMin,
  salary_max: draft.salaryMax,
  salary_currency: draft.salaryCurrency,
  status: [draft.status],
  priority: [draft.priority],
  openings: draft.openings,
  description: draft.description,
  skills: draft.skills,
  deadline: draft.deadline,
  opened_at: draft.openedAt,
  closed_at: draft.closedAt,
  recruiting_stage_templates_id: draft.stageTemplateId,
  stages: serializeStages ? vacancyStagesToPayload(draft.stages) : stageDefsToPayload(draft.stages),
});

// ───── Items API CRUD ─────

export interface VacanciesQueryParams {
  limit: number;
  offset: number;
  search?: string;
  status?: VacancyStatus | "";
  departmentId?: string;
}

const vacancyService = {
  getList: (params: VacanciesQueryParams) => {
    if (RECRUITING_USE_MOCK)
      return mockListVacancies(params) as unknown as Promise<ListResponse<VacancyApiRow>>;
    const data: Record<string, unknown> = { limit: params.limit, offset: params.offset };
    if (params.search) data.search = params.search;
    if (params.status) data.status = [params.status];
    if (params.departmentId) data.departments_id = params.departmentId;
    return httpRequest.get(`/v2/items/${VACANCIES_SLUG}`, {
      params: { with_relations: true, data: encodeJsonToUrlParam(data) },
    }) as unknown as Promise<ListResponse<VacancyApiRow>>;
  },

  getByGuid: async (guid: string) => {
    if (RECRUITING_USE_MOCK) return mockGetVacancy(guid) as unknown as Promise<VacancyApiRow | null>;
    const res = await httpRequest.get(`/v2/items/${VACANCIES_SLUG}/${guid}`, {
      params: { with_relations: true },
    });
    return unwrapItem<VacancyApiRow>(res);
  },

  // Candidate counts per vacancy (total / hired / per-stage) — powers the
  // vacancy cards' mini pipeline bar and the kanban headers.
  getCandidateCounts: async (): Promise<Record<string, VacancyCounts>> => {
    if (RECRUITING_USE_MOCK) return mockVacancyCandidateCounts();
    try {
      const res = (await httpRequest.post(`/v2/items/${CANDIDATES_SLUG}/aggregation`, {
        data: {
          operation: "SELECT",
          table: CANDIDATES_SLUG,
          columns: ["vacancies_id", "outcome", "current_stage_id", "COUNT(*) AS cnt"],
          where: "deleted_at IS NULL",
          group_by: ["vacancies_id", "outcome", "current_stage_id"],
          limit: 2000,
          offset: 0,
        },
        is_cached: false,
      })) as unknown;

      const rows = extractRows(res);
      const map: Record<string, VacancyCounts> = {};
      for (const row of rows) {
        const vacancyId = String(row.vacancies_id ?? "");
        if (!vacancyId) continue;
        const outcome = Array.isArray(row.outcome) ? row.outcome[0] : row.outcome;
        const cnt = Number(row.cnt) || 0;
        if (!map[vacancyId]) map[vacancyId] = { total: 0, hired: 0, byStage: {} };
        map[vacancyId].total += cnt;
        if (outcome === "hired") map[vacancyId].hired += cnt;
        if ((outcome === "active" || !outcome) && row.current_stage_id) {
          const sid = String(row.current_stage_id);
          map[vacancyId].byStage[sid] = (map[vacancyId].byStage[sid] ?? 0) + cnt;
        }
      }
      return map;
    } catch {
      return {};
    }
  },

  create: (draft: VacancyDraft) => {
    if (RECRUITING_USE_MOCK) return mockCreateVacancy(draftToPayload(draft, { serializeStages: false }));
    return httpRequest.post(`/v2/items/${VACANCIES_SLUG}`, {
      data: { companies_id: COMPANY_ID, ...draftToPayload(draft) },
    });
  },

  update: (guid: string, draft: VacancyDraft) => {
    if (RECRUITING_USE_MOCK) return mockUpdateVacancy(guid, draftToPayload(draft, { serializeStages: false }));
    return httpRequest.put(`/v2/items/${VACANCIES_SLUG}/${guid}`, {
      data: { ...draftToPayload(draft), guid },
    });
  },

  updateStages: (guid: string, stages: StageDef[]) => {
    if (RECRUITING_USE_MOCK) return mockUpdateVacancyStages(guid, stageDefsToPayload(stages));
    return httpRequest.put(`/v2/items/${VACANCIES_SLUG}/${guid}`, {
      data: { stages: vacancyStagesToPayload(stages), guid },
    });
  },

  updateStatus: (guid: string, status: VacancyStatus) => {
    if (RECRUITING_USE_MOCK) return mockUpdateVacancyStatus(guid, status);
    // Stamp the closing date when a vacancy is closed; clear it when reopened.
    return httpRequest.put(`/v2/items/${VACANCIES_SLUG}/${guid}`, {
      data: {
        status: [status],
        closed_at: status === "closed" ? new Date().toISOString().slice(0, 10) : null,
        guid,
      },
    });
  },

  delete: async (guid: string) => {
    if (RECRUITING_USE_MOCK) return mockDeleteVacancy(guid);
    try {
      return await httpRequest.delete(`/v2/items/${VACANCIES_SLUG}`, { data: { ids: [guid] } });
    } catch {
      return httpRequest.delete(`/v2/items/${VACANCIES_SLUG}/${guid}`);
    }
  },
};

// Universal aggregation row extractor (see AI_ITEMS_API_GUIDE §7).
const extractRows = (res: unknown): Array<Record<string, unknown>> => {
  if (Array.isArray(res)) return res as Array<Record<string, unknown>>;
  if (res && typeof res === "object") {
    const obj = res as Record<string, unknown>;
    if (Array.isArray(obj.response)) return obj.response as Array<Record<string, unknown>>;
    if (Array.isArray(obj.data)) return obj.data as Array<Record<string, unknown>>;
    const nested = obj.data as Record<string, unknown> | undefined;
    if (nested && Array.isArray(nested.data)) return nested.data as Array<Record<string, unknown>>;
  }
  return [];
};

// ───── React Query hooks ─────

export const useVacanciesQuery = (params: VacanciesQueryParams) =>
  useQuery({
    queryKey: ["vacancies", params],
    queryFn: () => vacancyService.getList(params),
    keepPreviousData: true,
  });

export const useVacancyCandidateCounts = () =>
  useQuery({
    queryKey: ["vacancy-candidate-counts"],
    queryFn: () => vacancyService.getCandidateCounts(),
    staleTime: 30_000,
  });

export const useVacancyQuery = (guid: string | undefined) =>
  useQuery({
    queryKey: ["vacancy", guid],
    queryFn: () => vacancyService.getByGuid(guid as string),
    enabled: Boolean(guid),
  });

export const useCreateVacancy = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draft: VacancyDraft) => vacancyService.create(draft),
    onSuccess: () => queryClient.invalidateQueries(["vacancies"]),
  });
};

export const useUpdateVacancy = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ guid, draft }: { guid: string; draft: VacancyDraft }) =>
      vacancyService.update(guid, draft),
    onSuccess: (_, { guid }) => {
      queryClient.invalidateQueries(["vacancies"]);
      queryClient.invalidateQueries(["vacancy", guid]);
      queryClient.invalidateQueries(["candidates"]);
    },
  });
};

export const useUpdateVacancyStages = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ guid, stages }: { guid: string; stages: StageDef[] }) =>
      vacancyService.updateStages(guid, stages),
    onSuccess: (_, { guid }) => {
      queryClient.invalidateQueries(["vacancies"]);
      queryClient.invalidateQueries(["vacancy", guid]);
      queryClient.invalidateQueries(["vacancy-candidate-counts"]);
    },
  });
};

export const useUpdateVacancyStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ guid, status }: { guid: string; status: VacancyStatus }) =>
      vacancyService.updateStatus(guid, status),
    onSuccess: (_, { guid }) => {
      queryClient.invalidateQueries(["vacancies"]);
      queryClient.invalidateQueries(["vacancy", guid]);
    },
  });
};

export const useDeleteVacancy = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (guid: string) => vacancyService.delete(guid),
    onSuccess: () => {
      queryClient.invalidateQueries(["vacancies"]);
      queryClient.invalidateQueries(["candidates"]);
      queryClient.invalidateQueries(["vacancy-candidate-counts"]);
    },
  });
};

export default vacancyService;
