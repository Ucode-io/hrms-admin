import { useMutation, useQuery, useQueryClient } from "react-query";
import httpRequest from "../httpRequest";
import { COMPANY_ID } from "./settingsDirectory.service";
import encodeJsonToUrlParam from "../../utils/encodeJsonToUrlParam";
import authStore from "../../store/auth.store";
import { RECRUITING_USE_MOCK } from "../../modules/Recruiting/mock/mockConfig";
import {
  mockAddCandidateDocument,
  mockAddStageComment,
  mockCreateCandidate,
  mockDeleteCandidate,
  mockDeleteCandidateDocument,
  mockEvaluateCandidateStage,
  mockGetCandidate,
  mockListCandidates,
  mockMoveCandidateStage,
  mockSetCandidateOutcome,
  mockUpdateCandidate,
  type MockActor,
} from "../../modules/Recruiting/mock/mockApi";
import {
  averageScore,
  CANDIDATE_REJECTION_REASON_ORDER,
  CANDIDATE_SOURCE_ORDER,
  DOCUMENT_TYPE_ORDER,
  OUTCOME_ORDER,
  type Candidate,
  type CandidateDocument,
  type CandidateDocumentType,
  type CandidateDraft,
  type CandidateOutcome,
  type CandidateRejectionReason,
  type CandidateSource,
  type StageComment,
  type StageEvaluation,
  type StageHistoryEntry,
} from "../../modules/Recruiting/types";

const CANDIDATES_SLUG = "candidates";

// ───── Raw API row shape ─────

interface StageCommentApiRow {
  id?: string;
  text?: string | null;
  author_id?: string | null;
  author_name?: string | null;
  created_at?: string | null;
}

interface StageEvaluationApiRow {
  stage_id?: string | null;
  score?: number | string | null;
  comments?: StageCommentApiRow[] | null;
}

interface CandidateDocumentApiRow {
  id?: string;
  name?: string | null;
  type?: string[] | string | null;
  url?: string | null;
  size?: number | string | null;
  uploaded_at?: string | null;
  uploaded_by_name?: string | null;
}

interface StageHistoryApiRow {
  id?: string;
  from_stage_id?: string | null;
  to_stage_id?: string | null;
  to_outcome?: string[] | string | null;
  at?: string | null;
  by_id?: string | null;
  by_name?: string | null;
}

export interface CandidateApiRow {
  guid: string;
  first_name?: string | null;
  last_name?: string | null;
  photo?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string[] | string | null;
  links?: string[] | string | null;
  skills?: string[] | string | null;
  level?: string | null;
  salary_expectation?: number | string | null;
  salary_currency?: string | null;
  applied_date?: string | null;
  resume_url?: string | null;
  notes?: string | null;
  recruiter_id?: string | null;
  recruiter_name?: string | null;
  vacancies_id?: string | null;
  vacancies_id_data?: { guid?: string; title?: string; tag?: string } | null;
  current_stage_id?: string | null;
  outcome?: string[] | string | null;
  rejection_reason?: string[] | string | null;
  hired_at?: string | null;
  stage_changed_at?: string | null;
  stage_evaluations?: StageEvaluationApiRow[] | null;
  stage_history?: StageHistoryApiRow[] | null;
  documents?: CandidateDocumentApiRow[] | null;
  created_at?: string | null;
  [key: string]: unknown;
}

interface ListResponse<T> {
  count: number;
  response: T[];
}

// ───── Mappers ─────

const pickEnum = <T extends string>(
  value: string[] | string | null | undefined,
  valid: readonly T[],
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

const mapComments = (rows: StageCommentApiRow[] | null | undefined): StageComment[] => {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r, i) => ({
      id: r.id || `cm-${i}`,
      text: r.text || "",
      authorId: r.author_id ?? null,
      authorName: r.author_name || "Рекрутер",
      createdAt: r.created_at || "",
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
};

const mapEvaluations = (rows: StageEvaluationApiRow[] | null | undefined): StageEvaluation[] => {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => r.stage_id)
    .map((r) => {
      const score = toNum(r.score);
      return {
        stageId: String(r.stage_id),
        score: score && score >= 1 && score <= 10 ? Math.round(score) : null,
        comments: mapComments(r.comments),
      };
    });
};

const mapHistory = (rows: StageHistoryApiRow[] | null | undefined): StageHistoryEntry[] => {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r, i) => {
      const outcome = Array.isArray(r.to_outcome) ? r.to_outcome[0] : r.to_outcome;
      return {
        id: r.id || `h-${i}`,
        fromStageId: r.from_stage_id ?? null,
        toStageId: r.to_stage_id ?? null,
        toOutcome: OUTCOME_ORDER.includes(outcome as CandidateOutcome)
          ? (outcome as CandidateOutcome)
          : null,
        at: r.at || "",
        byId: r.by_id ?? null,
        byName: r.by_name || "Рекрутер",
      };
    })
    .sort((a, b) => a.at.localeCompare(b.at));
};

const mapDocuments = (rows: CandidateDocumentApiRow[] | null | undefined): CandidateDocument[] => {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => r.url)
    .map((r, i) => ({
      id: r.id || `doc-${i}`,
      name: r.name || "Документ",
      type: pickEnum(r.type, DOCUMENT_TYPE_ORDER, "other"),
      url: String(r.url),
      size: toNum(r.size),
      uploadedAt: r.uploaded_at || "",
      uploadedByName: r.uploaded_by_name || "Рекрутер",
    }))
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
};

export const mapCandidateRow = (row: CandidateApiRow): Candidate => {
  const firstName = (row.first_name || "").trim();
  const lastName = (row.last_name || "").trim();
  const fullName = [lastName, firstName].filter(Boolean).join(" ") || "Без имени";
  const evaluations = mapEvaluations(row.stage_evaluations);
  return {
    id: row.guid,
    firstName,
    lastName,
    fullName,
    photo: row.photo || null,
    email: row.email || "",
    phone: row.phone || "",
    source: pickEnum(row.source, CANDIDATE_SOURCE_ORDER, "other"),
    links: toStrArray(row.links),
    skills: toStrArray(row.skills),
    level: row.level || "",
    salaryExpectation: toNum(row.salary_expectation),
    salaryCurrency: row.salary_currency || "UZS",
    appliedDate: row.applied_date || null,
    resumeUrl: row.resume_url || null,
    notes: row.notes || "",
    recruiterId: row.recruiter_id ?? null,
    recruiterName: row.recruiter_name ?? null,
    vacancyId: row.vacancies_id || "",
    vacancyTitle: row.vacancies_id_data?.title || "",
    vacancyTag: row.vacancies_id_data?.tag || "",
    currentStageId: row.current_stage_id ?? null,
    outcome: pickEnum(row.outcome, OUTCOME_ORDER, "active"),
    rejectionReason: (() => {
      const raw = Array.isArray(row.rejection_reason) ? row.rejection_reason[0] : row.rejection_reason;
      return CANDIDATE_REJECTION_REASON_ORDER.includes(raw as CandidateRejectionReason)
        ? (raw as CandidateRejectionReason)
        : null;
    })(),
    hiredAt: row.hired_at || null,
    stageChangedAt: row.stage_changed_at || null,
    evaluations,
    history: mapHistory(row.stage_history),
    documents: mapDocuments(row.documents),
    avgScore: averageScore(evaluations),
    createdAt: row.created_at || "",
  };
};

const draftToPayload = (draft: CandidateDraft): Record<string, unknown> => ({
  first_name: draft.firstName,
  last_name: draft.lastName,
  photo: draft.photo,
  email: draft.email,
  phone: draft.phone,
  source: [draft.source],
  links: draft.links,
  skills: draft.skills,
  level: draft.level,
  salary_expectation: draft.salaryExpectation,
  salary_currency: draft.salaryCurrency,
  applied_date: draft.appliedDate,
  resume_url: draft.resumeUrl,
  notes: draft.notes,
  recruiter_id: draft.recruiterId,
  recruiter_name: draft.recruiterName,
  vacancies_id: draft.vacancyId,
});

/** Current user as the author of comments / pipeline moves. */
const currentActor = (): MockActor => {
  const user = authStore.user_data;
  const name = [user?.first_name, user?.second_name].filter(Boolean).join(" ").trim();
  return { id: null, name: name || "Рекрутер" };
};

// ───── Items API CRUD ─────

export interface CandidatesQueryParams {
  limit: number;
  offset: number;
  search?: string;
  vacancyId?: string;
  outcome?: CandidateOutcome | "";
  stageId?: string;
  source?: CandidateSource | "";
}

const candidateService = {
  getList: (params: CandidatesQueryParams) => {
    if (RECRUITING_USE_MOCK)
      return mockListCandidates(params) as unknown as Promise<ListResponse<CandidateApiRow>>;
    const data: Record<string, unknown> = { limit: params.limit, offset: params.offset };
    if (params.search) data.search = params.search;
    if (params.vacancyId) data.vacancies_id = params.vacancyId;
    if (params.outcome) data.outcome = [params.outcome];
    if (params.stageId) data.current_stage_id = params.stageId;
    if (params.source) data.source = [params.source];
    return httpRequest.get(`/v2/items/${CANDIDATES_SLUG}`, {
      params: { with_relations: true, data: encodeJsonToUrlParam(data) },
    }) as unknown as Promise<ListResponse<CandidateApiRow>>;
  },

  getByGuid: (guid: string) => {
    if (RECRUITING_USE_MOCK)
      return mockGetCandidate(guid) as unknown as Promise<CandidateApiRow | null>;
    return httpRequest.get(`/v2/items/${CANDIDATES_SLUG}/${guid}`, {
      params: { with_relations: true },
    }) as unknown as Promise<CandidateApiRow>;
  },

  create: (draft: CandidateDraft) => {
    if (RECRUITING_USE_MOCK) return mockCreateCandidate(draftToPayload(draft), currentActor());
    // Real API: the backend (or a u-code function) seeds current_stage_id,
    // outcome and the first history entry from the vacancy's stages.
    return httpRequest.post(`/v2/items/${CANDIDATES_SLUG}`, {
      data: {
        companies_id: COMPANY_ID,
        outcome: ["active"],
        stage_changed_at: new Date().toISOString(),
        ...draftToPayload(draft),
      },
    });
  },

  update: (guid: string, draft: CandidateDraft) => {
    if (RECRUITING_USE_MOCK) return mockUpdateCandidate(guid, draftToPayload(draft));
    return httpRequest.put(`/v2/items/${CANDIDATES_SLUG}/${guid}`, {
      data: { ...draftToPayload(draft), guid },
    });
  },

  moveStage: (guid: string, toStageId: string) => {
    if (RECRUITING_USE_MOCK) return mockMoveCandidateStage(guid, toStageId, currentActor());
    return httpRequest.put(`/v2/items/${CANDIDATES_SLUG}/${guid}`, {
      data: {
        current_stage_id: toStageId,
        outcome: ["active"],
        stage_changed_at: new Date().toISOString(),
        guid,
      },
    });
  },

  setOutcome: (guid: string, outcome: CandidateOutcome, rejectionReason: CandidateRejectionReason | null) => {
    if (RECRUITING_USE_MOCK)
      return mockSetCandidateOutcome(guid, outcome, rejectionReason, currentActor());
    return httpRequest.put(`/v2/items/${CANDIDATES_SLUG}/${guid}`, {
      data: {
        outcome: [outcome],
        current_stage_id: null,
        rejection_reason: rejectionReason ? [rejectionReason] : null,
        stage_changed_at: new Date().toISOString(),
        guid,
      },
    });
  },

  evaluateStage: (guid: string, stageId: string, score: number | null) => {
    if (RECRUITING_USE_MOCK) return mockEvaluateCandidateStage(guid, stageId, score);
    // Real API: stage_evaluations is a jsonb column — read-modify-write will be
    // handled by a u-code function on the next stage.
    return httpRequest.put(`/v2/items/${CANDIDATES_SLUG}/${guid}`, {
      data: { stage_evaluation_patch: { stage_id: stageId, score }, guid },
    });
  },

  addComment: (guid: string, stageId: string, text: string) => {
    if (RECRUITING_USE_MOCK) return mockAddStageComment(guid, stageId, text, currentActor());
    return httpRequest.put(`/v2/items/${CANDIDATES_SLUG}/${guid}`, {
      data: { stage_comment_patch: { stage_id: stageId, text }, guid },
    });
  },

  addDocument: (guid: string, doc: NewCandidateDocument) => {
    const payload = {
      name: doc.name,
      type: [doc.type],
      url: doc.url,
      size: doc.size,
    };
    if (RECRUITING_USE_MOCK) return mockAddCandidateDocument(guid, payload, currentActor());
    // Real API: documents is a jsonb column — append handled by a u-code function.
    return httpRequest.put(`/v2/items/${CANDIDATES_SLUG}/${guid}`, {
      data: { document_patch: payload, guid },
    });
  },

  deleteDocument: (guid: string, documentId: string) => {
    if (RECRUITING_USE_MOCK) return mockDeleteCandidateDocument(guid, documentId);
    return httpRequest.put(`/v2/items/${CANDIDATES_SLUG}/${guid}`, {
      data: { document_delete: documentId, guid },
    });
  },

  delete: async (guid: string) => {
    if (RECRUITING_USE_MOCK) return mockDeleteCandidate(guid);
    try {
      return await httpRequest.delete(`/v2/items/${CANDIDATES_SLUG}`, { data: { ids: [guid] } });
    } catch {
      return httpRequest.delete(`/v2/items/${CANDIDATES_SLUG}/${guid}`);
    }
  },
};

// ───── React Query hooks ─────

const invalidateCandidateQueries = (
  queryClient: ReturnType<typeof useQueryClient>,
  guid?: string
) => {
  queryClient.invalidateQueries(["candidates"]);
  queryClient.invalidateQueries(["vacancy-candidate-counts"]);
  if (guid) queryClient.invalidateQueries(["candidate", guid]);
};

export const useCandidatesQuery = (params: CandidatesQueryParams, enabled = true) =>
  useQuery({
    queryKey: ["candidates", params],
    queryFn: () => candidateService.getList(params),
    keepPreviousData: true,
    enabled,
  });

export const useCandidateQuery = (guid: string | undefined) =>
  useQuery({
    queryKey: ["candidate", guid],
    queryFn: () => candidateService.getByGuid(guid as string),
    enabled: Boolean(guid),
  });

export const useCreateCandidate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draft: CandidateDraft) => candidateService.create(draft),
    onSuccess: () => invalidateCandidateQueries(queryClient),
  });
};

export const useUpdateCandidate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ guid, draft }: { guid: string; draft: CandidateDraft }) =>
      candidateService.update(guid, draft),
    onSuccess: (_, { guid }) => invalidateCandidateQueries(queryClient, guid),
  });
};

/** Kanban drag / "следующий этап" — optimistic so the board feels instant. */
export const useMoveCandidateStage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ guid, toStageId }: { guid: string; toStageId: string }) =>
      candidateService.moveStage(guid, toStageId),
    onMutate: async ({ guid, toStageId }) => {
      await queryClient.cancelQueries(["candidates"]);
      const snapshots = queryClient.getQueriesData(["candidates"]);
      queryClient.setQueriesData(["candidates"], (old: unknown) => {
        const list = old as ListResponse<CandidateApiRow> | undefined;
        if (!list?.response) return old;
        return {
          ...list,
          response: list.response.map((row) =>
            row.guid === guid
              ? { ...row, current_stage_id: toStageId, outcome: ["active"] }
              : row
          ),
        };
      });
      return { snapshots };
    },
    onError: (_err, _vars, context) => {
      const snapshots = (context as { snapshots?: Array<[unknown, unknown]> })?.snapshots ?? [];
      snapshots.forEach(([key, data]) =>
        queryClient.setQueryData(key as Parameters<typeof queryClient.setQueryData>[0], data)
      );
    },
    onSettled: (_data, _err, { guid }) => invalidateCandidateQueries(queryClient, guid),
  });
};

export const useSetCandidateOutcome = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      guid,
      outcome,
      rejectionReason = null,
    }: {
      guid: string;
      outcome: CandidateOutcome;
      rejectionReason?: CandidateRejectionReason | null;
    }) => candidateService.setOutcome(guid, outcome, rejectionReason),
    onSuccess: (_, { guid }) => invalidateCandidateQueries(queryClient, guid),
  });
};

export const useEvaluateCandidateStage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ guid, stageId, score }: { guid: string; stageId: string; score: number | null }) =>
      candidateService.evaluateStage(guid, stageId, score),
    onSuccess: (_, { guid }) => invalidateCandidateQueries(queryClient, guid),
  });
};

export const useAddStageComment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ guid, stageId, text }: { guid: string; stageId: string; text: string }) =>
      candidateService.addComment(guid, stageId, text),
    onSuccess: (_, { guid }) => invalidateCandidateQueries(queryClient, guid),
  });
};

export interface NewCandidateDocument {
  name: string;
  type: CandidateDocumentType;
  url: string;
  size: number | null;
}

export const useAddCandidateDocument = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ guid, doc }: { guid: string; doc: NewCandidateDocument }) =>
      candidateService.addDocument(guid, doc),
    onSuccess: (_, { guid }) => invalidateCandidateQueries(queryClient, guid),
  });
};

export const useDeleteCandidateDocument = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ guid, documentId }: { guid: string; documentId: string }) =>
      candidateService.deleteDocument(guid, documentId),
    onSuccess: (_, { guid }) => invalidateCandidateQueries(queryClient, guid),
  });
};

export const useDeleteCandidate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (guid: string) => candidateService.delete(guid),
    onSuccess: () => invalidateCandidateQueries(queryClient),
  });
};

export default candidateService;
