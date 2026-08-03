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
  { name: "Скрининг", color: "blue" },
  { name: "Интервью", color: "violet" },
  { name: "Тех. интервью", color: "indigo" },
  { name: "Оффер", color: "emerald" },
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
    label: "Открыта",
    badgeClassName: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
    dotClassName: "bg-emerald-500",
  },
  paused: {
    label: "На паузе",
    badgeClassName: "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
    dotClassName: "bg-amber-500",
  },
  closed: {
    label: "Закрыта",
    badgeClassName: "bg-rose-50 text-rose-700 ring-1 ring-rose-100",
    dotClassName: "bg-rose-500",
  },
  draft: {
    label: "Черновик",
    badgeClassName: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
    dotClassName: "bg-slate-400",
  },
};

export const VACANCY_PRIORITY_CONFIG: Record<
  VacancyPriority,
  { label: string; badgeClassName: string }
> = {
  high: { label: "Высокий", badgeClassName: "bg-rose-50 text-rose-600 ring-1 ring-rose-100" },
  medium: { label: "Средний", badgeClassName: "bg-amber-50 text-amber-600 ring-1 ring-amber-100" },
  low: { label: "Низкий", badgeClassName: "bg-slate-100 text-slate-500 ring-1 ring-slate-200" },
};

export const WORK_MODE_CONFIG: Record<WorkMode, { label: string }> = {
  office: { label: "Офис" },
  remote: { label: "Удалённо" },
  hybrid: { label: "Гибрид" },
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
    label: "В работе",
    badgeClassName: "bg-blue-50 text-blue-700 ring-1 ring-blue-100",
    dotClassName: "bg-blue-500",
  },
  hired: {
    label: "Нанят",
    badgeClassName: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
    dotClassName: "bg-emerald-500",
  },
  rejected: {
    label: "Отказ",
    badgeClassName: "bg-rose-50 text-rose-700 ring-1 ring-rose-100",
    dotClassName: "bg-rose-500",
  },
  reserve: {
    label: "Резерв",
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
  headhunter: { label: "HeadHunter" },
  career_site: { label: "Карьерный сайт" },
  linkedin: { label: "LinkedIn" },
  telegram: { label: "Telegram job каналы" },
  networking: { label: "Нетворкинг" },
  applications: { label: "Отклики" },
  referral: { label: "Реферал" },
  external_recruiter: { label: "Внешний рекрутер" },
  other: { label: "Другое" },
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
  resume_rejected: { label: "Отказ по резюме" },
  not_relevant: { label: "Не релевантный кандидат" },
  insufficient_qualification: { label: "Недостаточная квалификация" },
  experience_mismatch: { label: "Не подходит опыт" },
  grade_mismatch: { label: "Не подходит по грейду" },
  vacancy_closed_other: { label: "Вакансия закрылась другим" },
  self_not_interested: { label: "Кандидат не заинтересован" },
  language_barrier: { label: "Языковой барьер" },
  location_mismatch: { label: "Не подходит локация" },
  culture_mismatch: { label: "Не подходит по культуре" },
  salary_expectations: { label: "Завышенные ожидания по ЗП" },
  soft_skills_mismatch: { label: "Не соответствует soft skills" },
  no_show: { label: "Не пришёл на собеседование" },
  found_job: { label: "Нашёл другую работу" },
  other: { label: "Другое" },
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
  cv: { label: "Резюме / CV", badgeClassName: "bg-blue-50 text-blue-700" },
  certificate: { label: "Сертификат", badgeClassName: "bg-emerald-50 text-emerald-700" },
  portfolio: { label: "Портфолио", badgeClassName: "bg-violet-50 text-violet-700" },
  test_task: { label: "Тестовое задание", badgeClassName: "bg-amber-50 text-amber-700" },
  other: { label: "Другое", badgeClassName: "bg-slate-100 text-slate-600" },
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
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
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

export const formatSalaryRange = (
  min: number | null,
  max: number | null,
  currency: string
): string => {
  const fmt = (v: number) => {
    if (v >= 1_000_000) {
      const m = v / 1_000_000;
      return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
    }
    if (v >= 1_000) return `${Math.round(v / 1_000)}K`;
    return String(v);
  };
  const cur = currency || "UZS";
  if (min && max) return `${fmt(min)}–${fmt(max)} ${cur}`;
  if (min) return `от ${fmt(min)} ${cur}`;
  if (max) return `до ${fmt(max)} ${cur}`;
  return "По договорённости";
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

export const pluralDays = (d: number): string => {
  const mod10 = d % 10;
  const mod100 = d % 100;
  if (mod10 === 1 && mod100 !== 11) return `${d} день`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${d} дня`;
  return `${d} дней`;
};

export const daysOpenLabel = (iso: string | null): string => {
  const d = daysSince(iso);
  if (d === null) return "—";
  if (d === 0) return "сегодня";
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
export const VACANCY_DESCRIPTION_SECTIONS = ["Описание", "Обязанности", "Требования", "Условия"];

/** Пустой каркас описания: 4 редактируемых заголовка с пустыми абзацами. */
export const DEFAULT_VACANCY_DESCRIPTION_HTML = VACANCY_DESCRIPTION_SECTIONS.map(
  (label) => `<h3>${label}</h3><p></p>`
).join("");

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
  description: DEFAULT_VACANCY_DESCRIPTION_HTML,
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
  description: v.description || DEFAULT_VACANCY_DESCRIPTION_HTML,
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
