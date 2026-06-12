// Mock CRUD layer for the Recruiting module (replaces the items API while
// RECRUITING_USE_MOCK is on). Rows keep the snake_case u-code shape, all
// functions are async so the service layer stays transport-agnostic.

import { getDb, nextId, nowIso, saveDb } from "./mockDb";
import type { Row } from "./seed";

export interface DirectoryOption {
  value: string;
  label: string;
}

/** Who performs a mutation (история / комментарии). */
export interface MockActor {
  id: string | null;
  name: string;
}

// ───── Directories (replace settings/employees API while mocking) ─────

export const MOCK_DEPARTMENTS: DirectoryOption[] = [
  { value: "dep-eng", label: "Разработка" },
  { value: "dep-qa", label: "QA" },
  { value: "dep-pm", label: "Проектный офис" },
  { value: "dep-sales", label: "Продажи" },
  { value: "dep-hr", label: "HR" },
  { value: "dep-design", label: "Дизайн" },
];

export const MOCK_POSITIONS: DirectoryOption[] = [
  { value: "pos-backend", label: "Backend Developer" },
  { value: "pos-frontend", label: "Frontend Developer" },
  { value: "pos-qa", label: "QA Engineer" },
  { value: "pos-pm", label: "Project Manager" },
  { value: "pos-sales", label: "Sales Manager" },
  { value: "pos-devops", label: "DevOps Engineer" },
  { value: "pos-designer", label: "UI/UX Designer" },
];

export const MOCK_LOCATIONS: DirectoryOption[] = [
  { value: "loc-tashkent", label: "Офис Ташкент" },
  { value: "loc-samarkand", label: "Офис Самарканд" },
  { value: "loc-remote", label: "Удалённо" },
];

export const MOCK_EMPLOYEES: DirectoryOption[] = [
  { value: "emp-1", label: "Азиза Саидова" },
  { value: "emp-2", label: "Бекзод Рустамов" },
  { value: "emp-3", label: "Дилшод Каримов" },
  { value: "emp-4", label: "Мадина Юлдашева" },
  { value: "emp-5", label: "Тимур Ахмедов" },
  { value: "emp-6", label: "Нигора Исмаилова" },
];

// ───── Generic helpers ─────

const ok = <T>(value: T): Promise<T> => Promise.resolve(value);

const fail = (message: string): Promise<never> => Promise.reject(new Error(message));

const firstOf = (value: unknown): string =>
  Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");

const matchesSearch = (row: Row, search: string, fields: string[]): boolean => {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => String(row[f] ?? "").toLowerCase().includes(q));
};

const paginate = (rows: Row[], limit: number, offset: number) => ({
  count: rows.length,
  response: rows.slice(offset, offset + limit),
});

// ─────────────────────────────────────────────────────────────────────────────
// Stage templates
// ─────────────────────────────────────────────────────────────────────────────

export const mockListStageTemplates = () => {
  const rows = [...getDb().stage_templates].sort((a, b) =>
    String(a.created_at).localeCompare(String(b.created_at))
  );
  return ok({ count: rows.length, response: rows });
};

export const mockGetStageTemplate = (guid: string) =>
  ok(getDb().stage_templates.find((t) => t.guid === guid) ?? null);

const unsetOtherDefaults = (exceptGuid: string) => {
  const db = getDb();
  db.stage_templates = db.stage_templates.map((t) =>
    t.guid === exceptGuid ? t : { ...t, is_default: false }
  );
};

export const mockCreateStageTemplate = (payload: Row) => {
  const db = getDb();
  const guid = nextId("tpl");
  db.stage_templates = [...db.stage_templates, { guid, created_at: nowIso(), ...payload }];
  if (payload.is_default) unsetOtherDefaults(guid);
  saveDb();
  return ok({ guid });
};

export const mockUpdateStageTemplate = (guid: string, payload: Row) => {
  const db = getDb();
  db.stage_templates = db.stage_templates.map((t) =>
    t.guid === guid ? { ...t, ...payload, guid } : t
  );
  if (payload.is_default) unsetOtherDefaults(guid);
  saveDb();
  return ok({ guid });
};

export const mockDeleteStageTemplate = (guid: string) => {
  const db = getDb();
  db.stage_templates = db.stage_templates.filter((t) => t.guid !== guid);
  saveDb();
  return ok({ guid });
};

// ─────────────────────────────────────────────────────────────────────────────
// Vacancies
// ─────────────────────────────────────────────────────────────────────────────

export interface MockVacancyParams {
  limit: number;
  offset: number;
  search?: string;
  status?: string;
  departmentId?: string;
}

export const mockListVacancies = (params: MockVacancyParams) => {
  let rows = [...getDb().vacancies];
  if (params.search) rows = rows.filter((r) => matchesSearch(r, params.search!, ["title", "tag"]));
  if (params.status) rows = rows.filter((r) => firstOf(r.status) === params.status);
  if (params.departmentId) rows = rows.filter((r) => r.departments_id === params.departmentId);
  return ok(paginate(rows, params.limit, params.offset));
};

export const mockGetVacancy = (guid: string) =>
  ok(getDb().vacancies.find((v) => v.guid === guid) ?? null);

export const mockCreateVacancy = (payload: Row) => {
  const db = getDb();
  const guid = nextId("vac");
  const now = nowIso();
  db.vacancies = [
    { created_at: now, opened_at: payload.opened_at || now, ...payload, guid },
    ...db.vacancies,
  ];
  saveDb();
  return ok({ guid });
};

export const mockUpdateVacancy = (guid: string, payload: Row) => {
  const db = getDb();
  const current = db.vacancies.find((v) => v.guid === guid);
  if (!current) return fail("Вакансия не найдена");
  if (Array.isArray(payload.stages)) {
    const guard = checkStageRemoval(guid, payload.stages as Row[]);
    if (guard) return fail(guard);
  }
  db.vacancies = db.vacancies.map((v) => (v.guid === guid ? { ...v, ...payload, guid } : v));
  saveDb();
  syncCandidateVacancyData(guid);
  return ok({ guid });
};

export const mockUpdateVacancyStatus = (guid: string, status: string) => {
  const db = getDb();
  db.vacancies = db.vacancies.map((v) =>
    v.guid === guid
      ? { ...v, status: [status], ...(status === "closed" ? { closed_at: nowIso() } : {}) }
      : v
  );
  saveDb();
  return ok({ guid });
};

/** Update only the stage list of a vacancy (Изменить этапы on the detail page). */
export const mockUpdateVacancyStages = (guid: string, stages: Row[]) => {
  const guard = checkStageRemoval(guid, stages);
  if (guard) return fail(guard);
  const db = getDb();
  db.vacancies = db.vacancies.map((v) => (v.guid === guid ? { ...v, stages } : v));
  saveDb();
  return ok({ guid });
};

/** A stage that still has active candidates cannot be removed. */
const checkStageRemoval = (vacancyGuid: string, nextStages: Row[]): string | null => {
  const keptIds = new Set(nextStages.map((s) => String(s.id)));
  const blocked = getDb().candidates.find(
    (c) =>
      c.vacancies_id === vacancyGuid &&
      firstOf(c.outcome) === "active" &&
      c.current_stage_id &&
      !keptIds.has(String(c.current_stage_id))
  );
  if (!blocked) return null;
  return `Нельзя удалить этап: на нём находится кандидат «${blocked.last_name} ${blocked.first_name}». Сначала переместите кандидатов.`;
};

/** Keep the denormalized vacancy title/tag on candidate rows in sync. */
const syncCandidateVacancyData = (vacancyGuid: string) => {
  const db = getDb();
  const vac = db.vacancies.find((v) => v.guid === vacancyGuid);
  if (!vac) return;
  db.candidates = db.candidates.map((c) =>
    c.vacancies_id === vacancyGuid
      ? { ...c, vacancies_id_data: { guid: vacancyGuid, title: vac.title, tag: vac.tag } }
      : c
  );
  saveDb();
};

export const mockDeleteVacancy = (guid: string) => {
  const db = getDb();
  db.vacancies = db.vacancies.filter((v) => v.guid !== guid);
  db.candidates = db.candidates.filter((c) => c.vacancies_id !== guid);
  saveDb();
  return ok({ guid });
};

export interface VacancyCounts {
  total: number;
  hired: number;
  /** Active candidates per stage id (mini pipeline bar / kanban headers). */
  byStage: Record<string, number>;
}

export const mockVacancyCandidateCounts = () => {
  const map: Record<string, VacancyCounts> = {};
  for (const c of getDb().candidates) {
    const vacId = String(c.vacancies_id ?? "");
    if (!vacId) continue;
    if (!map[vacId]) map[vacId] = { total: 0, hired: 0, byStage: {} };
    map[vacId].total += 1;
    const outcome = firstOf(c.outcome) || "active";
    if (outcome === "hired") map[vacId].hired += 1;
    if (outcome === "active" && c.current_stage_id) {
      const sid = String(c.current_stage_id);
      map[vacId].byStage[sid] = (map[vacId].byStage[sid] ?? 0) + 1;
    }
  }
  return ok(map);
};

// ─────────────────────────────────────────────────────────────────────────────
// Candidates
// ─────────────────────────────────────────────────────────────────────────────

export interface MockCandidateParams {
  limit: number;
  offset: number;
  search?: string;
  vacancyId?: string;
  outcome?: string;
  stageId?: string;
  source?: string;
}

export const mockListCandidates = (params: MockCandidateParams) => {
  let rows = [...getDb().candidates];
  if (params.search)
    rows = rows.filter((r) =>
      matchesSearch(r, params.search!, ["first_name", "last_name", "email", "phone"])
    );
  if (params.vacancyId) rows = rows.filter((r) => r.vacancies_id === params.vacancyId);
  if (params.outcome) rows = rows.filter((r) => firstOf(r.outcome) === params.outcome);
  if (params.stageId) rows = rows.filter((r) => r.current_stage_id === params.stageId);
  if (params.source) rows = rows.filter((r) => firstOf(r.source) === params.source);
  return ok(paginate(rows, params.limit, params.offset));
};

export const mockGetCandidate = (guid: string) =>
  ok(getDb().candidates.find((c) => c.guid === guid) ?? null);

const historyEntry = (
  fromStageId: string | null,
  toStageId: string | null,
  toOutcome: string | null,
  actor: MockActor
): Row => ({
  id: nextId("h"),
  from_stage_id: fromStageId,
  to_stage_id: toStageId,
  to_outcome: toOutcome,
  at: nowIso(),
  by_id: actor.id,
  by_name: actor.name,
});

const ensureEvaluation = (row: Row, stageId: string): Row[] => {
  const evaluations = Array.isArray(row.stage_evaluations)
    ? [...(row.stage_evaluations as Row[])]
    : [];
  if (!evaluations.some((e) => e.stage_id === stageId)) {
    evaluations.push({ stage_id: stageId, score: null, comments: [] });
  }
  return evaluations;
};

export const mockCreateCandidate = (payload: Row, actor: MockActor) => {
  const db = getDb();
  const vac = db.vacancies.find((v) => v.guid === payload.vacancies_id);
  if (!vac) return fail("Выберите вакансию");
  const stages = Array.isArray(vac.stages) ? (vac.stages as Row[]) : [];
  const firstStage = stages.length ? String(stages[0].id) : null;
  const guid = nextId("cand");
  const now = nowIso();
  db.candidates = [
    {
      guid,
      created_at: now,
      stage_changed_at: now,
      ...payload,
      vacancies_id_data: { guid: vac.guid, title: vac.title, tag: vac.tag },
      current_stage_id: firstStage,
      outcome: ["active"],
      rejection_reason: null,
      hired_at: null,
      stage_evaluations: firstStage ? [{ stage_id: firstStage, score: null, comments: [] }] : [],
      stage_history: [historyEntry(null, firstStage, null, actor)],
    },
    ...db.candidates,
  ];
  saveDb();
  return ok({ guid });
};

export const mockUpdateCandidate = (guid: string, payload: Row) => {
  const db = getDb();
  const current = db.candidates.find((c) => c.guid === guid);
  if (!current) return fail("Кандидат не найден");
  // Анкета не трогает воронку: vacancies_id меняется только если кандидат ещё
  // не двигался (один этап в истории) — иначе оценки потеряют смысл.
  const next: Row = { ...current, ...payload, guid };
  if (payload.vacancies_id && payload.vacancies_id !== current.vacancies_id) {
    const history = Array.isArray(current.stage_history) ? (current.stage_history as Row[]) : [];
    if (history.length > 1) return fail("Нельзя сменить вакансию: кандидат уже двигался по этапам");
    const vac = db.vacancies.find((v) => v.guid === payload.vacancies_id);
    if (!vac) return fail("Вакансия не найдена");
    const stages = Array.isArray(vac.stages) ? (vac.stages as Row[]) : [];
    const firstStage = stages.length ? String(stages[0].id) : null;
    next.vacancies_id_data = { guid: vac.guid, title: vac.title, tag: vac.tag };
    next.current_stage_id = firstStage;
    next.stage_evaluations = firstStage ? [{ stage_id: firstStage, score: null, comments: [] }] : [];
    next.stage_history = history.length
      ? [{ ...history[0], to_stage_id: firstStage }]
      : [];
  }
  db.candidates = db.candidates.map((c) => (c.guid === guid ? next : c));
  saveDb();
  return ok({ guid });
};

export const mockMoveCandidateStage = (guid: string, toStageId: string, actor: MockActor) => {
  const db = getDb();
  const current = db.candidates.find((c) => c.guid === guid);
  if (!current) return fail("Кандидат не найден");
  const fromStageId = current.current_stage_id ? String(current.current_stage_id) : null;
  if (fromStageId === toStageId && firstOf(current.outcome) === "active") return ok({ guid });
  const history = Array.isArray(current.stage_history) ? [...(current.stage_history as Row[])] : [];
  history.push(historyEntry(fromStageId, toStageId, null, actor));
  db.candidates = db.candidates.map((c) =>
    c.guid === guid
      ? {
          ...c,
          current_stage_id: toStageId,
          outcome: ["active"],
          rejection_reason: null,
          stage_changed_at: nowIso(),
          stage_evaluations: ensureEvaluation(c, toStageId),
          stage_history: history,
        }
      : c
  );
  saveDb();
  return ok({ guid });
};

export const mockSetCandidateOutcome = (
  guid: string,
  outcome: string,
  rejectionReason: string | null,
  actor: MockActor
) => {
  const db = getDb();
  const current = db.candidates.find((c) => c.guid === guid);
  if (!current) return fail("Кандидат не найден");
  const fromStageId = current.current_stage_id ? String(current.current_stage_id) : null;
  const history = Array.isArray(current.stage_history) ? [...(current.stage_history as Row[])] : [];
  history.push(historyEntry(fromStageId, null, outcome, actor));
  db.candidates = db.candidates.map((c) =>
    c.guid === guid
      ? {
          ...c,
          current_stage_id: null,
          outcome: [outcome],
          rejection_reason: outcome === "rejected" && rejectionReason ? [rejectionReason] : null,
          hired_at: outcome === "hired" ? nowIso().slice(0, 10) : c.hired_at,
          stage_changed_at: nowIso(),
          stage_history: history,
        }
      : c
  );
  saveDb();
  return ok({ guid });
};

export const mockEvaluateCandidateStage = (guid: string, stageId: string, score: number | null) => {
  const db = getDb();
  const current = db.candidates.find((c) => c.guid === guid);
  if (!current) return fail("Кандидат не найден");
  const evaluations = ensureEvaluation(current, stageId).map((e) =>
    e.stage_id === stageId ? { ...e, score } : e
  );
  db.candidates = db.candidates.map((c) =>
    c.guid === guid ? { ...c, stage_evaluations: evaluations } : c
  );
  saveDb();
  return ok({ guid });
};

export const mockAddStageComment = (guid: string, stageId: string, text: string, actor: MockActor) => {
  const db = getDb();
  const current = db.candidates.find((c) => c.guid === guid);
  if (!current) return fail("Кандидат не найден");
  const comment = {
    id: nextId("cm"),
    text,
    author_id: actor.id,
    author_name: actor.name,
    created_at: nowIso(),
  };
  const evaluations = ensureEvaluation(current, stageId).map((e) =>
    e.stage_id === stageId
      ? { ...e, comments: [...((e.comments as Row[]) ?? []), comment] }
      : e
  );
  db.candidates = db.candidates.map((c) =>
    c.guid === guid ? { ...c, stage_evaluations: evaluations } : c
  );
  saveDb();
  return ok({ guid });
};

export const mockAddCandidateDocument = (guid: string, doc: Row, actor: MockActor) => {
  const db = getDb();
  const current = db.candidates.find((c) => c.guid === guid);
  if (!current) return fail("Кандидат не найден");
  const document = {
    id: nextId("doc"),
    uploaded_at: nowIso(),
    uploaded_by_name: actor.name,
    ...doc,
  };
  const documents = Array.isArray(current.documents) ? [...(current.documents as Row[])] : [];
  documents.push(document);
  db.candidates = db.candidates.map((c) => (c.guid === guid ? { ...c, documents } : c));
  saveDb();
  return ok({ guid });
};

export const mockDeleteCandidateDocument = (guid: string, documentId: string) => {
  const db = getDb();
  const current = db.candidates.find((c) => c.guid === guid);
  if (!current) return fail("Кандидат не найден");
  const documents = (Array.isArray(current.documents) ? (current.documents as Row[]) : []).filter(
    (d) => d.id !== documentId
  );
  db.candidates = db.candidates.map((c) => (c.guid === guid ? { ...c, documents } : c));
  saveDb();
  return ok({ guid });
};

export const mockDeleteCandidate = (guid: string) => {
  const db = getDb();
  db.candidates = db.candidates.filter((c) => c.guid !== guid);
  saveDb();
  return ok({ guid });
};
