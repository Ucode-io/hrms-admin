import { getLocale, pluralForm, translate } from "../../i18n";
import type { MessageKey } from "../../i18n/messages";

// Domain types, constants and formatters for the Recruiting (Рекрутинг) module.
//
// Core model:
//   • StageTemplate — настраиваемый шаблон этапов (Настройки → Шаблоны этапов)
//   • Vacancy       — вакансия со СВОЕЙ копией этапов (создаётся из шаблона)
//   • Candidate     — кандидат привязан к вакансии и движется по её этапам;
//                     на каждом этапе — оценка 1–10 и ветка комментариев.

// ─────────────────────────────────────────────────────────────────────────────
// Stages & templates
// ─────────────────────────────────────────────────────────────────────────────

/** One stage of a hiring pipeline (inside a template or copied into a vacancy). */
export interface StageDef {
  /** Stable id — candidate evaluations/history reference it. */
  id: string;
  name: string;
  /** Key into STAGE_COLOR_CONFIG. */
  color: StageColor;
  order: number;
}

export interface StageTemplate {
  id: string;
  name: string;
  description: string;
  stages: StageDef[];
  isDefault: boolean;
  createdAt: string;
}

export interface StageTemplateDraft {
  name: string;
  description: string;
  stages: StageDef[];
  isDefault: boolean;
}

export type StageColor =
  | "slate"
  | "blue"
  | "violet"
  | "amber"
  | "emerald"
  | "cyan"
  | "rose"
  | "indigo"
  | "teal"
  | "orange";

export const STAGE_COLOR_ORDER: StageColor[] = [
  "blue",
  "violet",
  "amber",
  "cyan",
  "indigo",
  "teal",
  "orange",
  "emerald",
  "rose",
  "slate",
];

export const STAGE_COLOR_CONFIG: Record<
  StageColor,
  {
    /** Solid dot / swatch. */
    dotClassName: string;
    /** Pill badge (bg + text). */
    badgeClassName: string;
    /** Kanban column header accent. */
    accentClassName: string;
    /** Left border accent for kanban cards. */
    cardAccentClassName: string;
    /** Segment of the mini pipeline bar. */
    barClassName: string;
  }
> = {
  slate: {
    dotClassName: "bg-slate-400",
    badgeClassName: "bg-slate-100 text-slate-600",
    accentClassName: "text-slate-600",
    cardAccentClassName: "border-l-slate-300",
    barClassName: "bg-slate-400",
  },
  blue: {
    dotClassName: "bg-blue-500",
    badgeClassName: "bg-blue-50 text-blue-700",
    accentClassName: "text-blue-600",
    cardAccentClassName: "border-l-blue-500",
    barClassName: "bg-blue-500",
  },
  violet: {
    dotClassName: "bg-violet-500",
    badgeClassName: "bg-violet-50 text-violet-700",
    accentClassName: "text-violet-600",
    cardAccentClassName: "border-l-violet-500",
    barClassName: "bg-violet-500",
  },
  amber: {
    dotClassName: "bg-amber-500",
    badgeClassName: "bg-amber-50 text-amber-700",
    accentClassName: "text-amber-600",
    cardAccentClassName: "border-l-amber-400",
    barClassName: "bg-amber-500",
  },
  emerald: {
    dotClassName: "bg-emerald-500",
    badgeClassName: "bg-emerald-50 text-emerald-700",
    accentClassName: "text-emerald-600",
    cardAccentClassName: "border-l-emerald-500",
    barClassName: "bg-emerald-500",
  },
  cyan: {
    dotClassName: "bg-cyan-500",
    badgeClassName: "bg-cyan-50 text-cyan-700",
    accentClassName: "text-cyan-600",
    cardAccentClassName: "border-l-cyan-500",
    barClassName: "bg-cyan-500",
  },
  rose: {
    dotClassName: "bg-rose-500",
    badgeClassName: "bg-rose-50 text-rose-700",
    accentClassName: "text-rose-600",
    cardAccentClassName: "border-l-rose-400",
    barClassName: "bg-rose-500",
  },
  indigo: {
    dotClassName: "bg-indigo-500",
    badgeClassName: "bg-indigo-50 text-indigo-700",
    accentClassName: "text-indigo-600",
    cardAccentClassName: "border-l-indigo-500",
    barClassName: "bg-indigo-500",
  },
  teal: {
    dotClassName: "bg-teal-500",
    badgeClassName: "bg-teal-50 text-teal-700",
    accentClassName: "text-teal-600",
    cardAccentClassName: "border-l-teal-500",
    barClassName: "bg-teal-500",
  },
  orange: {
    dotClassName: "bg-orange-500",
    badgeClassName: "bg-orange-50 text-orange-700",
    accentClassName: "text-orange-600",
    cardAccentClassName: "border-l-orange-400",
    barClassName: "bg-orange-500",
  },
};

export const VALID_STAGE_COLORS = Object.keys(STAGE_COLOR_CONFIG) as StageColor[];

export const stageColorOf = (value: unknown): StageColor =>
  VALID_STAGE_COLORS.includes(value as StageColor) ? (value as StageColor) : "slate";

export const newStageId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `stage-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** Fallback stages when no template exists yet. */
export const DEFAULT_STAGE_PRESET: Array<{ name: string; color: StageColor }> = [
  { get name() { return translate("recruiting.default_stage.screening"); }, color: "blue" },
  { get name() { return translate("recruiting.default_stage.interview"); }, color: "violet" },
  { get name() { return translate("recruiting.default_stage.tech_interview"); }, color: "indigo" },
  { get name() { return translate("recruiting.default_stage.offer"); }, color: "emerald" },
];

export const buildStages = (preset: Array<{ name: string; color: StageColor }>): StageDef[] =>
  preset.map((s, i) => ({ id: newStageId(), name: s.name, color: s.color, order: i }));

/** Fresh ids for stages copied from a template into a vacancy. */
export const cloneStagesWithNewIds = (stages: StageDef[]): StageDef[] =>
  [...stages]
    .sort((a, b) => a.order - b.order)
    .map((s, i) => ({ ...s, id: newStageId(), order: i }));

export const sortStages = (stages: StageDef[]): StageDef[] =>
  [...stages].sort((a, b) => a.order - b.order);

// ─────────────────────────────────────────────────────────────────────────────
// Vacancies
// ─────────────────────────────────────────────────────────────────────────────

export type VacancyStatus = "open" | "paused" | "closed" | "draft";
export type VacancyPriority = "low" | "medium" | "high";
export type WorkMode = "office" | "remote" | "hybrid";

export interface Vacancy {
  id: string;
  title: string;
  departmentId: string | null;
  departmentTitle: string;
  positionId: string | null;
  positionTitle: string;
  /** Short tag for the colored chip, e.g. BACKEND, FRONTEND, QA. */
  tag: string;
  locationId: string | null;
  location: string;
  workMode: WorkMode;
  employmentType: string;
  experienceLevel: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  status: VacancyStatus;
  priority: VacancyPriority;
  openings: number;
  /** Единое HTML-описание (разделы Описание/Обязанности/Требования/Условия внутри). */
  description: string;
  skills: string[];
  deadline: string | null;
  openedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  /** Template the stages were copied from (informational). */
  stageTemplateId: string | null;
  /** Own, per-vacancy copy of the pipeline stages. */
  stages: StageDef[];
  /** Derived from candidates. */
  candidatesCount: number;
  hiredCount: number;
}

export interface VacancyDraft {
  /** Контейнер значений динамических полей (сериализованный JSON). */
  customData?: string;
  title: string;
  departmentId: string | null;
  positionId: string | null;
  tag: string;
  locationId: string | null;
  workMode: WorkMode;
  employmentType: string;
  experienceLevel: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  status: VacancyStatus;
  priority: VacancyPriority;
  openings: number;
  description: string;
  skills: string[];
  deadline: string | null;
  openedAt: string | null;
  closedAt: string | null;
  stageTemplateId: string | null;
  stages: StageDef[];
}

export const VACANCY_STATUS_ORDER: VacancyStatus[] = ["open", "paused", "closed", "draft"];

export const VACANCY_STATUS_CONFIG: Record<
  VacancyStatus,
  { label: string; badgeClassName: string; dotClassName: string }
> = {
  open: {
    get label() {
      return translate("recruiting.vacancy_status.open");
    },
    badgeClassName: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
    dotClassName: "bg-emerald-500",
  },
  paused: {
    get label() {
      return translate("recruiting.vacancy_status.paused");
    },
    badgeClassName: "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
    dotClassName: "bg-amber-500",
  },
  closed: {
    get label() {
      return translate("recruiting.vacancy_status.closed");
    },
    badgeClassName: "bg-rose-50 text-rose-700 ring-1 ring-rose-100",
    dotClassName: "bg-rose-500",
  },
  draft: {
    get label() {
      return translate("recruiting.vacancy_status.draft");
    },
    badgeClassName: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
    dotClassName: "bg-slate-400",
  },
};

export const VACANCY_PRIORITY_CONFIG: Record<
  VacancyPriority,
  { label: string; badgeClassName: string }
> = {
  high: { get label() { return translate("recruiting.vacancy_priority.high"); }, badgeClassName: "bg-rose-50 text-rose-600 ring-1 ring-rose-100" },
  medium: { get label() { return translate("recruiting.vacancy_priority.medium"); }, badgeClassName: "bg-amber-50 text-amber-600 ring-1 ring-amber-100" },
  low: { get label() { return translate("recruiting.vacancy_priority.low"); }, badgeClassName: "bg-slate-100 text-slate-500 ring-1 ring-slate-200" },
};

export const WORK_MODE_CONFIG: Record<WorkMode, { label: string }> = {
  office: { get label() { return translate("recruiting.work_mode.office"); } },
  remote: { get label() { return translate("recruiting.work_mode.remote"); } },
  hybrid: { get label() { return translate("recruiting.work_mode.hybrid"); } },
};

// ─────────────────────────────────────────────────────────────────────────────
// Candidates
// ─────────────────────────────────────────────────────────────────────────────

/** Where the candidate is relative to the pipeline. */
export type CandidateOutcome = "active" | "hired" | "rejected" | "reserve";

export const OUTCOME_ORDER: CandidateOutcome[] = ["active", "hired", "reserve", "rejected"];

export const OUTCOME_CONFIG: Record<
  CandidateOutcome,
  { label: string; badgeClassName: string; dotClassName: string }
> = {
  active: {
    get label() {
      return translate("recruiting.candidate_outcome.active");
    },
    badgeClassName: "bg-blue-50 text-blue-700 ring-1 ring-blue-100",
    dotClassName: "bg-blue-500",
  },
  hired: {
    get label() {
      return translate("recruiting.candidate_outcome.hired");
    },
    badgeClassName: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
    dotClassName: "bg-emerald-500",
  },
  rejected: {
    get label() {
      return translate("recruiting.candidate_outcome.rejected");
    },
    badgeClassName: "bg-rose-50 text-rose-700 ring-1 ring-rose-100",
    dotClassName: "bg-rose-500",
  },
  reserve: {
    get label() {
      return translate("recruiting.candidate_outcome.reserve");
    },
    badgeClassName: "bg-gray-100 text-gray-600 ring-1 ring-gray-200",
    dotClassName: "bg-gray-400",
  },
};

export type CandidateSource =
  | "headhunter"
  | "career_site"
  | "linkedin"
  | "telegram"
  | "networking"
  | "applications"
  | "referral"
  | "external_recruiter"
  | "other";

export const CANDIDATE_SOURCE_ORDER: CandidateSource[] = [
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

export const CANDIDATE_SOURCE_CONFIG: Record<CandidateSource, { label: string }> = {
  headhunter: { get label() { return translate("recruiting.candidate_source.headhunter"); } },
  career_site: { get label() { return translate("recruiting.candidate_source.career_site"); } },
  linkedin: { get label() { return translate("recruiting.candidate_source.linkedin"); } },
  telegram: { get label() { return translate("recruiting.candidate_source.telegram"); } },
  networking: { get label() { return translate("recruiting.candidate_source.networking"); } },
  applications: { get label() { return translate("recruiting.candidate_source.applications"); } },
  referral: { get label() { return translate("recruiting.candidate_source.referral"); } },
  external_recruiter: { get label() { return translate("recruiting.candidate_source.external_recruiter"); } },
  other: { get label() { return translate("recruiting.candidate_source.other"); } },
};

/**
 * Sources are a CRUD directory (`candidate_sources`). UI displays the related
 * title; legacy enum keys still resolve to their label.
 */
export const sourceLabel = (source: string | null | undefined): string => {
  if (!source) return "";
  return CANDIDATE_SOURCE_CONFIG[source as CandidateSource]?.label ?? source;
};

/**
 * Rejection reasons are a CRUD directory (`candidate_rejection_reasons`). UI
 * displays the related title; legacy enum keys still resolve to their label.
 */
export const rejectionReasonLabel = (
  reason: string | null | undefined
): string => {
  if (!reason) return "";
  return (
    CANDIDATE_REJECTION_REASON_CONFIG[reason as CandidateRejectionReason]?.label ??
    reason
  );
};

export type CandidateRejectionReason =
  | "resume_rejected"
  | "not_relevant"
  | "insufficient_qualification"
  | "experience_mismatch"
  | "grade_mismatch"
  | "vacancy_closed_other"
  | "self_not_interested"
  | "language_barrier"
  | "location_mismatch"
  | "culture_mismatch"
  | "salary_expectations"
  | "soft_skills_mismatch"
  | "no_show"
  | "found_job"
  | "other";

export const CANDIDATE_REJECTION_REASON_ORDER: CandidateRejectionReason[] = [
  "resume_rejected",
  "not_relevant",
  "insufficient_qualification",
  "experience_mismatch",
  "grade_mismatch",
  "vacancy_closed_other",
  "self_not_interested",
  "language_barrier",
  "location_mismatch",
  "culture_mismatch",
  "salary_expectations",
  "soft_skills_mismatch",
  "no_show",
  "found_job",
  "other",
];

export const CANDIDATE_REJECTION_REASON_CONFIG: Record<CandidateRejectionReason, { label: string }> = {
  resume_rejected: { get label() { return translate("recruiting.rejection_reason.resume_rejected"); } },
  not_relevant: { get label() { return translate("recruiting.rejection_reason.not_relevant"); } },
  insufficient_qualification: { get label() { return translate("recruiting.rejection_reason.insufficient_qualification"); } },
  experience_mismatch: { get label() { return translate("recruiting.rejection_reason.experience_mismatch"); } },
  grade_mismatch: { get label() { return translate("recruiting.rejection_reason.grade_mismatch"); } },
  vacancy_closed_other: { get label() { return translate("recruiting.rejection_reason.vacancy_closed_other"); } },
  self_not_interested: { get label() { return translate("recruiting.rejection_reason.self_not_interested"); } },
  language_barrier: { get label() { return translate("recruiting.rejection_reason.language_barrier"); } },
  location_mismatch: { get label() { return translate("recruiting.rejection_reason.location_mismatch"); } },
  culture_mismatch: { get label() { return translate("recruiting.rejection_reason.culture_mismatch"); } },
  salary_expectations: { get label() { return translate("recruiting.rejection_reason.salary_expectations"); } },
  soft_skills_mismatch: { get label() { return translate("recruiting.rejection_reason.soft_skills_mismatch"); } },
  no_show: { get label() { return translate("recruiting.rejection_reason.no_show"); } },
  found_job: { get label() { return translate("recruiting.rejection_reason.found_job"); } },
  other: { get label() { return translate("recruiting.rejection_reason.other"); } },
};

// ───── Candidate documents (CV, сертификаты и т.д.) ─────

export type CandidateDocumentType = "cv" | "certificate" | "portfolio" | "test_task" | "other";

export const DOCUMENT_TYPE_ORDER: CandidateDocumentType[] = [
  "cv",
  "certificate",
  "portfolio",
  "test_task",
  "other",
];

export const DOCUMENT_TYPE_CONFIG: Record<
  CandidateDocumentType,
  { label: string; badgeClassName: string }
> = {
  cv: { get label() { return translate("recruiting.document_type.cv"); }, badgeClassName: "bg-blue-50 text-blue-700" },
  certificate: { get label() { return translate("recruiting.document_type.certificate"); }, badgeClassName: "bg-emerald-50 text-emerald-700" },
  portfolio: { get label() { return translate("recruiting.document_type.portfolio"); }, badgeClassName: "bg-violet-50 text-violet-700" },
  test_task: { get label() { return translate("recruiting.document_type.test_task"); }, badgeClassName: "bg-amber-50 text-amber-700" },
  other: { get label() { return translate("recruiting.document_type.other"); }, badgeClassName: "bg-slate-100 text-slate-600" },
};

export interface CandidateDocument {
  id: string;
  name: string;
  type: CandidateDocumentType;
  /** Внешняя ссылка или data-URL загруженного файла (мок-режим). */
  url: string;
  /** Размер файла в байтах, null для внешних ссылок. */
  size: number | null;
  uploadedAt: string;
  uploadedByName: string;
}

export const formatFileSize = (bytes: number | null): string => {
  if (!bytes) return "";
  if (bytes < 1024) return translate("recruiting.size.b", { value: bytes });
  if (bytes < 1024 * 1024) return translate("recruiting.size.kb", { value: Math.round(bytes / 1024) });
  return translate("recruiting.size.mb", { value: (bytes / (1024 * 1024)).toFixed(1) });
};

/** One comment in a stage evaluation thread. */
export interface StageComment {
  id: string;
  text: string;
  authorId: string | null;
  authorName: string;
  createdAt: string;
}

/** Score + comment thread for one (candidate, stage) pair. Created lazily. */
export interface StageEvaluation {
  stageId: string;
  /** 1..10, null = ещё не оценён. */
  score: number | null;
  comments: StageComment[];
}

/** One movement through the pipeline (powers История). */
export interface StageHistoryEntry {
  id: string;
  fromStageId: string | null;
  toStageId: string | null;
  /** Set when the move is to a terminal outcome (hired/rejected/reserve). */
  toOutcome: CandidateOutcome | null;
  at: string;
  byId: string | null;
  byName: string;
}

export interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  photo: string | null;
  email: string;
  phone: string;
  sourceId: string | null;
  source: string;
  links: string[];
  skills: string[];
  level: string;
  salaryExpectation: number | null;
  salaryCurrency: string;
  appliedDate: string | null;
  resumeUrl: string | null;
  notes: string;
  vacancyId: string;
  vacancyTitle: string;
  vacancyTag: string;
  currentStageId: string | null;
  outcome: CandidateOutcome;
  rejectionReasonId: string | null;
  rejectionReason: string | null;
  hiredAt: string | null;
  stageChangedAt: string | null;
  evaluations: StageEvaluation[];
  history: StageHistoryEntry[];
  documents: CandidateDocument[];
  /** Average of all stage scores, null when nothing is scored yet. */
  avgScore: number | null;
  createdAt: string;
}

export interface CandidateDraft {
  /** Контейнер значений динамических полей (сериализованный JSON). */
  customData?: string;
  firstName: string;
  lastName: string;
  photo: string | null;
  email: string;
  phone: string;
  source: string;
  links: string[];
  skills: string[];
  level: string;
  salaryExpectation: number | null;
  salaryCurrency: string;
  appliedDate: string | null;
  resumeUrl: string | null;
  notes: string;
  vacancyId: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Score helpers (10-point scale)
// ─────────────────────────────────────────────────────────────────────────────

export const scoreTone = (
  score: number
): { textClassName: string; badgeClassName: string; barClassName: string } => {
  if (score < 4)
    return {
      textClassName: "text-rose-600",
      badgeClassName: "bg-rose-50 text-rose-700 ring-1 ring-rose-100",
      barClassName: "bg-rose-500",
    };
  if (score < 8)
    return {
      textClassName: "text-amber-600",
      badgeClassName: "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
      barClassName: "bg-amber-500",
    };
  return {
    textClassName: "text-emerald-600",
    badgeClassName: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
    barClassName: "bg-emerald-500",
  };
};

export const averageScore = (evaluations: StageEvaluation[]): number | null => {
  const scores = evaluations
    .map((e) => e.score)
    .filter((s): s is number => typeof s === "number" && s > 0);
  if (scores.length === 0) return null;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
};

// ─────────────────────────────────────────────────────────────────────────────
// Tag / level palettes
// ─────────────────────────────────────────────────────────────────────────────

export const TAG_COLOR_CONFIG: Record<string, string> = {
  BACKEND: "bg-blue-50 text-blue-600",
  FRONTEND: "bg-violet-50 text-violet-600",
  QA: "bg-cyan-50 text-cyan-600",
  PM: "bg-indigo-50 text-indigo-600",
  SALES: "bg-teal-50 text-teal-600",
  DEVOPS: "bg-orange-50 text-orange-600",
  DESIGN: "bg-pink-50 text-pink-600",
  HR: "bg-rose-50 text-rose-600",
  MOBILE: "bg-fuchsia-50 text-fuchsia-600",
  DEFAULT: "bg-slate-100 text-slate-600",
};

export const tagColor = (tag: string): string =>
  TAG_COLOR_CONFIG[tag?.toUpperCase()] ?? TAG_COLOR_CONFIG.DEFAULT;

export const LEVEL_COLOR_CONFIG: Record<string, string> = {
  Junior: "bg-emerald-50 text-emerald-600",
  Middle: "bg-blue-50 text-blue-600",
  Senior: "bg-violet-50 text-violet-600",
  Lead: "bg-rose-50 text-rose-600",
  DEFAULT: "bg-slate-100 text-slate-600",
};

export const levelColor = (level: string): string =>
  LEVEL_COLOR_CONFIG[level] ?? LEVEL_COLOR_CONFIG.DEFAULT;

// ─────────────────────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────────────────────

const fmtMoney = (v: number) => {
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  if (v >= 1_000) return `${Math.round(v / 1_000)}K`;
  return String(v);
};

/** Одна сумма без «от/до» — например, ожидания кандидата. */
export const formatSalaryAmount = (value: number, currency: string): string =>
  `${fmtMoney(value)} ${currency || "UZS"}`;

export const formatSalaryRange = (
  min: number | null,
  max: number | null,
  currency: string
): string => {
  const fmt = fmtMoney;
  const cur = currency || "UZS";
  if (min && max) return `${fmt(min)}–${fmt(max)} ${cur}`;
  if (min) return translate("recruiting.salary.from", { value: fmt(min), currency: cur });
  if (max) return translate("recruiting.salary.to", { value: fmt(max), currency: cur });
  return translate("recruiting.salary.negotiable");
};

export const formatDate = (iso: string | null): string => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()}`;
};

export const formatDateTime = (iso: string | null): string => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${formatDate(iso)} ${hh}:${mm}`;
};

export const formatDateIso = (iso: string | null): string => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
};

export const daysSince = (iso: string | null): number | null => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const diff = Date.now() - date.getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
};

/** «3 дня», «5 кандидатов» — форма слова по текущему языку. */
export const countLabel = (base: "days" | "candidates" | "stages", count: number): string =>
  translate(`recruiting.count.${base}.${pluralForm(getLocale(), count)}` as MessageKey, { count });

export const pluralDays = (d: number): string => countLabel("days", d);

export const daysOpenLabel = (iso: string | null): string => {
  const d = daysSince(iso);
  if (d === null) return "—";
  if (d === 0) return translate("recruiting.common.today_lower");
  return pluralDays(d);
};

export const initials = (first: string, last: string): string => {
  const a = (last || first || "?").trim().charAt(0).toUpperCase();
  const b = (first || "").trim().charAt(0).toUpperCase();
  return last && first ? `${a}${b}` : a;
};

const AVATAR_TINTS = [
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
  "bg-indigo-100 text-indigo-700",
  "bg-teal-100 text-teal-700",
];

export const avatarTint = (seed: string): string => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[hash % AVATAR_TINTS.length];
};

// ─────────────────────────────────────────────────────────────────────────────
// Draft factories
// ─────────────────────────────────────────────────────────────────────────────

// ───── Vacancy description (single rich-text field) ─────

/** Разделы по умолчанию для редактора описания вакансии. */
export const vacancyDescriptionSections = (): string[] =>
  (["description", "responsibilities", "requirements", "conditions"] as const).map((key) =>
    translate(`recruiting.vacancy_description.${key}`)
  );

/** Пустой каркас описания: 4 редактируемых заголовка с пустыми абзацами. */
export const defaultVacancyDescriptionHtml = (): string =>
  vacancyDescriptionSections()
    .map((label) => `<h3>${label}</h3><p></p>`)
    .join("");

/**
 * Типы занятости хранятся в БД русской строкой — переводим только подпись.
 * ponytail: значения зашиты, справочник — когда понадобятся свои типы.
 */
export const EMPLOYMENT_TYPE_KEYS: Record<string, MessageKey> = {
  "Полная занятость": "recruiting.employment.full_time",
  "Частичная занятость": "recruiting.employment.part_time",
  "Проектная работа": "recruiting.employment.project",
  "Стажировка": "recruiting.employment.internship",
};

export const employmentTypeLabel = (value: string): string =>
  EMPLOYMENT_TYPE_KEYS[value] ? translate(EMPLOYMENT_TYPE_KEYS[value]) : value;

export const createEmptyVacancyDraft = (): VacancyDraft => ({
  title: "",
  departmentId: null,
  positionId: null,
  tag: "",
  locationId: null,
  workMode: "office",
  employmentType: "Полная занятость",
  experienceLevel: "Middle",
  salaryMin: null,
  salaryMax: null,
  salaryCurrency: "UZS",
  status: "open",
  priority: "medium",
  openings: 1,
  description: defaultVacancyDescriptionHtml(),
  skills: [],
  deadline: null,
  openedAt: formatDateIso(new Date().toISOString()),
  closedAt: null,
  stageTemplateId: null,
  stages: [],
});

export const vacancyDraftFromItem = (v: Vacancy): VacancyDraft => ({
  title: v.title,
  departmentId: v.departmentId,
  positionId: v.positionId,
  tag: v.tag,
  locationId: v.locationId,
  workMode: v.workMode,
  employmentType: v.employmentType,
  experienceLevel: v.experienceLevel,
  salaryMin: v.salaryMin,
  salaryMax: v.salaryMax,
  salaryCurrency: v.salaryCurrency,
  status: v.status,
  priority: v.priority,
  openings: v.openings,
  description: v.description || defaultVacancyDescriptionHtml(),
  skills: v.skills,
  deadline: v.deadline,
  openedAt: v.openedAt,
  closedAt: v.closedAt,
  stageTemplateId: v.stageTemplateId,
  stages: sortStages(v.stages),
});

export const createEmptyCandidateDraft = (vacancyId: string | null = null): CandidateDraft => ({
  firstName: "",
  lastName: "",
  photo: null,
  email: "",
  phone: "",
  source: "",
  links: [],
  skills: [],
  level: "Middle",
  salaryExpectation: null,
  salaryCurrency: "UZS",
  appliedDate: formatDateIso(new Date().toISOString()),
  resumeUrl: null,
  notes: "",
  vacancyId,
});

export const candidateDraftFromItem = (c: Candidate): CandidateDraft => ({
  firstName: c.firstName,
  lastName: c.lastName,
  photo: c.photo,
  email: c.email,
  phone: c.phone,
  source: c.sourceId || c.source,
  links: c.links,
  skills: c.skills,
  level: c.level,
  salaryExpectation: c.salaryExpectation,
  salaryCurrency: c.salaryCurrency,
  appliedDate: c.appliedDate,
  resumeUrl: c.resumeUrl,
  notes: c.notes,
  vacancyId: c.vacancyId,
});
