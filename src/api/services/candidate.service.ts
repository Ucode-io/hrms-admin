import { useMutation, useQuery, useQueryClient } from "react-query";
import httpRequest from "../httpRequest";
import { COMPANY_ID } from "./settingsDirectory.service";
import encodeJsonToUrlParam from "../../utils/encodeJsonToUrlParam";
import { RECRUITING_USE_MOCK } from "../../modules/Recruiting/mock/mockConfig";
import {
  mockCreateCandidate,
  mockDeleteCandidate,
  mockGetCandidate,
  mockListCandidates,
  mockUpdateCandidate,
  mockUpdateCandidateStage,
} from "../../modules/Recruiting/mock/mockStore";
import {
  type Candidate,
  type CandidateDraft,
  type CandidateRejectionReason,
  type CandidateSource,
  type CandidateStage,
} from "../../modules/Recruiting/types";

const CANDIDATES_SLUG = "candidates";

// ───── Raw API row shape ─────

export interface CandidateApiRow {
  guid: string;
  first_name?: string | null;
  last_name?: string | null;
  photo?: string | null;
  vacancies_id?: string | null;
  vacancies_id_data?: { guid?: string; title?: string; tag?: string } | null;
  position_title?: string | null;
  tag?: string | null;
  level?: string | null;
  stage?: string[] | string | null;
  source?: string[] | string | null;
  rejection_reason?: string[] | string | null;
  applied_date?: string | null;
  email?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  gender?: string[] | string | null;
  links?: string[] | string | null;
  skills?: string[] | string | null;
  resume_url?: string | null;
  cover_letter?: string | null;
  rating?: number | string | null;
  salary_expectation?: number | string | null;
  salary_currency?: string | null;
  notes?: string | null;
  recruiter_id?: string | null;
  recruiter_name?: string | null;
  added_by_id?: string | null;
  added_by_name?: string | null;
  stage_changed_at?: string | null;
  hired_at?: string | null;
  stage_history?: StageHistoryApiRow[] | null;
  created_at?: string | null;
  [key: string]: unknown;
}

interface StageHistoryApiRow {
  id?: string;
  from_stage?: string[] | string | null;
  to_stage?: string[] | string | null;
  at?: string | null;
  by_name?: string | null;
  comment?: string | null;
}

interface ListResponse<T> {
  count: number;
  response: T[];
}

// ───── Mappers ─────

const VALID_STAGES: CandidateStage[] = [
  "new",
  "resume_reviewed",
  "screening_call",
  "interview",
  "test_task",
  "tech_interview",
  "offer_sent",
  "offer_considering",
  "offer_accepted",
  "hired",
  "passed_probation",
  "reserve",
  "rejected",
  "failed_probation",
  "fired",
];
const VALID_SOURCES: CandidateSource[] = [
  "headhunter",
  "career_site",
  "linkedin",
  "telegram",
  "networking",
  "applications",
  "referral",
  "external_recruiter",
  "other",
];
const VALID_REJECTION_REASONS: CandidateRejectionReason[] = [
  "resume_rejected",
  "not_relevant",
  "insufficient_qualification",
  "experience_mismatch",
  "grade_mismatch",
  "age_restriction",
  "vacancy_closed_other",
  "self_not_interested",
  "language_barrier",
  "location_mismatch",
  "not_interested",
  "culture_mismatch",
  "salary_expectations",
  "soft_skills_mismatch",
  "no_show",
  "found_job",
  "not_finished_studies",
  "no_russian",
];

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

const mapStageHistory = (rows: StageHistoryApiRow[] | null | undefined) => {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r, i) => {
      const from = Array.isArray(r.from_stage) ? r.from_stage[0] : r.from_stage;
      const to = Array.isArray(r.to_stage) ? r.to_stage[0] : r.to_stage;
      return {
        id: r.id || `h-${i}`,
        fromStage: VALID_STAGES.includes(from as CandidateStage) ? (from as CandidateStage) : null,
        toStage: VALID_STAGES.includes(to as CandidateStage) ? (to as CandidateStage) : "new",
        at: r.at || "",
        byName: r.by_name ?? null,
        comment: r.comment || "",
      };
    })
    .sort((a, b) => b.at.localeCompare(a.at));
};

export const mapCandidateRow = (row: CandidateApiRow): Candidate => {
  const firstName = (row.first_name || "").trim();
  const lastName = (row.last_name || "").trim();
  const fullName = [lastName, firstName].filter(Boolean).join(" ") || "Без имени";
  return {
    id: row.guid,
    firstName,
    lastName,
    fullName,
    photo: row.photo || null,
    vacancyId: row.vacancies_id ?? null,
    vacancyTitle: row.vacancies_id_data?.title || "",
    positionTitle: row.position_title || row.vacancies_id_data?.title || "—",
    tag: row.tag || row.vacancies_id_data?.tag || "",
    level: row.level || "",
    stage: pickEnum(row.stage, VALID_STAGES, "new"),
    source: pickEnum(row.source, VALID_SOURCES, "other"),
    rejectionReason: (() => {
      const raw = Array.isArray(row.rejection_reason) ? row.rejection_reason[0] : row.rejection_reason;
      return VALID_REJECTION_REASONS.includes(raw as CandidateRejectionReason)
        ? (raw as CandidateRejectionReason)
        : null;
    })(),
    appliedDate: row.applied_date || null,
    email: row.email || "",
    phone: row.phone || "",
    dateOfBirth: row.date_of_birth || null,
    gender: (() => {
      const raw = Array.isArray(row.gender) ? row.gender[0] : row.gender;
      return raw === "male" || raw === "female" ? raw : null;
    })(),
    links: toStrArray(row.links),
    skills: toStrArray(row.skills),
    resumeUrl: row.resume_url || null,
    coverLetter: row.cover_letter || "",
    rating: Number(row.rating) || 0,
    salaryExpectation: toNum(row.salary_expectation),
    salaryCurrency: row.salary_currency || "UZS",
    notes: row.notes || "",
    recruiterId: row.recruiter_id ?? null,
    recruiterName: row.recruiter_name ?? null,
    addedById: row.added_by_id ?? null,
    addedByName: row.added_by_name ?? null,
    stageChangedAt: row.stage_changed_at || null,
    hiredAt: row.hired_at || null,
    stageHistory: mapStageHistory(row.stage_history),
    createdAt: row.created_at || "",
  };
};

const draftToPayload = (draft: CandidateDraft): Record<string, unknown> => ({
  first_name: draft.firstName,
  last_name: draft.lastName,
  photo: draft.photo,
  vacancies_id: draft.vacancyId,
  position_title: draft.positionTitle,
  tag: draft.tag,
  level: draft.level,
  stage: [draft.stage],
  source: [draft.source],
  rejection_reason: draft.rejectionReason ? [draft.rejectionReason] : null,
  applied_date: draft.appliedDate,
  email: draft.email,
  phone: draft.phone,
  date_of_birth: draft.dateOfBirth,
  gender: draft.gender ? [draft.gender] : null,
  links: draft.links,
  skills: draft.skills,
  resume_url: draft.resumeUrl,
  cover_letter: draft.coverLetter,
  rating: draft.rating,
  salary_expectation: draft.salaryExpectation,
  salary_currency: draft.salaryCurrency,
  notes: draft.notes,
  recruiter_id: draft.recruiterId,
  recruiter_name: draft.recruiterName,
  added_by_id: draft.addedById,
  added_by_name: draft.addedByName,
});

// ───── Items API CRUD ─────

export interface CandidatesQueryParams {
  limit: number;
  offset: number;
  search?: string;
  vacancyId?: string;
  stage?: CandidateStage | "";
}

const candidateService = {
  getList: (params: CandidatesQueryParams) => {
    if (RECRUITING_USE_MOCK)
      return mockListCandidates(params) as unknown as Promise<ListResponse<CandidateApiRow>>;
    const data: Record<string, unknown> = { limit: params.limit, offset: params.offset };
    if (params.search) data.search = params.search;
    if (params.vacancyId) data.vacancies_id = params.vacancyId;
    if (params.stage) data.stage = [params.stage];
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
    if (RECRUITING_USE_MOCK) return mockCreateCandidate(draftToPayload(draft));
    return httpRequest.post(`/v2/items/${CANDIDATES_SLUG}`, {
      data: {
        companies_id: COMPANY_ID,
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

  // Pipeline move (kanban drag / stage select).
  updateStage: (guid: string, stage: CandidateStage) => {
    if (RECRUITING_USE_MOCK) return mockUpdateCandidateStage(guid, stage);
    return httpRequest.put(`/v2/items/${CANDIDATES_SLUG}/${guid}`, {
      data: { stage: [stage], stage_changed_at: new Date().toISOString(), guid },
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

export const useCandidatesQuery = (params: CandidatesQueryParams) =>
  useQuery({
    queryKey: ["candidates", params],
    queryFn: () => candidateService.getList(params),
    keepPreviousData: true,
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
    onSuccess: () => {
      queryClient.invalidateQueries(["candidates"]);
      queryClient.invalidateQueries(["vacancy-candidate-counts"]);
    },
  });
};

export const useUpdateCandidate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ guid, draft }: { guid: string; draft: CandidateDraft }) =>
      candidateService.update(guid, draft),
    onSuccess: () => {
      queryClient.invalidateQueries(["candidates"]);
      queryClient.invalidateQueries(["vacancy-candidate-counts"]);
    },
  });
};

export const useUpdateCandidateStage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ guid, stage }: { guid: string; stage: CandidateStage }) =>
      candidateService.updateStage(guid, stage),
    onSuccess: () => {
      queryClient.invalidateQueries(["candidates"]);
      queryClient.invalidateQueries(["vacancy-candidate-counts"]);
    },
  });
};

export const useDeleteCandidate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (guid: string) => candidateService.delete(guid),
    onSuccess: () => {
      queryClient.invalidateQueries(["candidates"]);
      queryClient.invalidateQueries(["vacancy-candidate-counts"]);
    },
  });
};

export default candidateService;
