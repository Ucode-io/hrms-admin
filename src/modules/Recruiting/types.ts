// Domain types, constants and formatters for the Recruiting (Рекрутинг) module.
// Two sub-domains: Vacancies (Вакансии) and Candidates (Кандидаты).
//
// The data model is intentionally rich so it can power the recruiting reports:
//   • Воронка цикла вакансии (hiring funnel by stage + rejection reasons)
//   • Кандидаты по источникам (candidates by source / by date)
//   • Сроки закрытия вакансий (time-to-fill: opened_at → hired_at)

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
  divisionId: string | null;
  divisionTitle: string;
  positionId: string | null;
  positionTitle: string;
  /** Short tag derived for the colored chip, e.g. BACKEND, FRONTEND, QA. */
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
  /** Number of openings (headcount) for this vacancy. */
  openings: number;
  /** Responsible recruiter (Ответственный). */
  recruiterId: string | null;
  recruiterName: string | null;
  hiringManagerId: string | null;
  hiringManagerName: string | null;
  description: string;
  responsibilities: string;
  requirements: string;
  conditions: string;
  skills: string[];
  deadline: string | null;
  /** When the vacancy was opened (used as the start of time-to-fill). */
  openedAt: string | null;
  /** When the vacancy was closed (for time-to-fill / archive). */
  closedAt: string | null;
  createdAt: string;
  /** Derived from the candidates collection (counts per stage). */
  candidatesCount: number;
  hiredCount: number;
}

export interface VacancyDraft {
  title: string;
  departmentId: string | null;
  divisionId: string | null;
  positionId: string | null;
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
  recruiterId: string | null;
  recruiterName: string | null;
  hiringManagerId: string | null;
  hiringManagerName: string | null;
  description: string;
  responsibilities: string;
  requirements: string;
  conditions: string;
  skills: string[];
  deadline: string | null;
  openedAt: string | null;
}

export const VACANCY_STATUS_ORDER: VacancyStatus[] = ["open", "paused", "closed", "draft"];

export const VACANCY_STATUS_CONFIG: Record<
  VacancyStatus,
  { label: string; badgeClassName: string; dotClassName: string; barClassName: string }
> = {
  open: {
    label: "Открыта",
    badgeClassName: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
    dotClassName: "bg-emerald-500",
    barClassName: "bg-emerald-500",
  },
  paused: {
    label: "На паузе",
    badgeClassName: "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
    dotClassName: "bg-amber-500",
    barClassName: "bg-amber-500",
  },
  closed: {
    label: "Закрыта",
    badgeClassName: "bg-rose-50 text-rose-700 ring-1 ring-rose-100",
    dotClassName: "bg-rose-500",
    barClassName: "bg-rose-400",
  },
  draft: {
    label: "Черновик",
    badgeClassName: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
    dotClassName: "bg-slate-400",
    barClassName: "bg-slate-400",
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

// Full ATS funnel — covers every step shown in the "Воронка цикла вакансии" report.
export type CandidateStage =
  | "new" // Новые
  | "resume_reviewed" // Рассмотрено резюме
  | "screening_call" // Первичный созвон
  | "interview" // Интервью
  | "test_task" // Тестовое задание
  | "tech_interview" // Техническое собеседование
  | "offer_sent" // Отправлен оффер
  | "offer_considering" // Рассматривает оффер
  | "offer_accepted" // Оффер принят
  | "hired" // Вышел на работу
  | "passed_probation" // Прошёл испытательный срок
  | "reserve" // Скамейка (резерв)
  | "rejected" // Отказ
  | "failed_probation" // Не прошёл испытательный срок
  | "fired"; // Уволен

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

// Reasons mirror the "Причины отказа" breakdown in the funnel report.
export type CandidateRejectionReason =
  | "resume_rejected"
  | "not_relevant"
  | "insufficient_qualification"
  | "experience_mismatch"
  | "grade_mismatch"
  | "age_restriction"
  | "vacancy_closed_other"
  | "self_not_interested"
  | "language_barrier"
  | "location_mismatch"
  | "not_interested"
  | "culture_mismatch"
  | "salary_expectations"
  | "soft_skills_mismatch"
  | "no_show"
  | "found_job"
  | "not_finished_studies"
  | "no_russian";

export interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  photo: string | null;
  vacancyId: string | null;
  vacancyTitle: string;
  positionTitle: string;
  /** Short colored tag, e.g. BACKEND, FRONTEND, QA, PM, SALES. */
  tag: string;
  level: string;
  stage: CandidateStage;
  source: CandidateSource;
  rejectionReason: CandidateRejectionReason | null;
  appliedDate: string | null;
  email: string;
  phone: string;
  dateOfBirth: string | null;
  gender: Gender | null;
  /** External profile links (hh.ru, LinkedIn, GitHub, …). */
  links: string[];
  skills: string[];
  resumeUrl: string | null;
  coverLetter: string;
  rating: number; // 0..5
  salaryExpectation: number | null;
  salaryCurrency: string;
  notes: string;
  /** Responsible recruiter (Рекрутер). */
  recruiterId: string | null;
  recruiterName: string | null;
  /** Who added the candidate (Кем добавлена). */
  addedById: string | null;
  addedByName: string | null;
  stageChangedAt: string | null;
  /** When the candidate reached "hired" (end of time-to-fill). */
  hiredAt: string | null;
  stageHistory: CandidateStageHistoryEntry[];
  createdAt: string;
}

export interface CandidateDraft {
  firstName: string;
  lastName: string;
  photo: string | null;
  vacancyId: string | null;
  positionTitle: string;
  tag: string;
  level: string;
  stage: CandidateStage;
  source: CandidateSource;
  rejectionReason: CandidateRejectionReason | null;
  appliedDate: string | null;
  email: string;
  phone: string;
  dateOfBirth: string | null;
  gender: Gender | null;
  links: string[];
  skills: string[];
  resumeUrl: string | null;
  coverLetter: string;
  rating: number;
  salaryExpectation: number | null;
  salaryCurrency: string;
  notes: string;
  recruiterId: string | null;
  recruiterName: string | null;
  addedById: string | null;
  addedByName: string | null;
}

// Full funnel order (used by the funnel report and the form's stage select).
export const CANDIDATE_STAGE_ORDER: CandidateStage[] = [
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

// Columns shown on the working Kanban board (post-hire/terminal states excluded).
export const CANDIDATE_KANBAN_STAGES: CandidateStage[] = [
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
  "reserve",
  "rejected",
];

// In-progress stages (used for "active funnel" metric / conversion).
export const CANDIDATE_ACTIVE_STAGES: CandidateStage[] = [
  "new",
  "resume_reviewed",
  "screening_call",
  "interview",
  "test_task",
  "tech_interview",
  "offer_sent",
  "offer_considering",
  "offer_accepted",
];

export const CANDIDATE_STAGE_CONFIG: Record<
  CandidateStage,
  {
    label: string;
    /** Header accent color for the kanban column. */
    accentClassName: string;
    /** Left border accent applied to cards in this stage. */
    cardAccentClassName: string;
    badgeClassName: string;
    dotClassName: string;
  }
> = {
  new: {
    label: "Новые",
    accentClassName: "text-slate-600",
    cardAccentClassName: "border-l-slate-300",
    badgeClassName: "bg-slate-100 text-slate-600",
    dotClassName: "bg-slate-400",
  },
  resume_reviewed: {
    label: "Рассмотрено резюме",
    accentClassName: "text-sky-600",
    cardAccentClassName: "border-l-sky-400",
    badgeClassName: "bg-sky-50 text-sky-700",
    dotClassName: "bg-sky-500",
  },
  screening_call: {
    label: "Первичный созвон",
    accentClassName: "text-amber-600",
    cardAccentClassName: "border-l-amber-400",
    badgeClassName: "bg-amber-50 text-amber-700",
    dotClassName: "bg-amber-500",
  },
  interview: {
    label: "Интервью",
    accentClassName: "text-blue-600",
    cardAccentClassName: "border-l-blue-500",
    badgeClassName: "bg-blue-50 text-blue-700",
    dotClassName: "bg-blue-500",
  },
  test_task: {
    label: "Тестовое задание",
    accentClassName: "text-violet-600",
    cardAccentClassName: "border-l-violet-500",
    badgeClassName: "bg-violet-50 text-violet-700",
    dotClassName: "bg-violet-500",
  },
  tech_interview: {
    label: "Техническое собеседование",
    accentClassName: "text-indigo-600",
    cardAccentClassName: "border-l-indigo-500",
    badgeClassName: "bg-indigo-50 text-indigo-700",
    dotClassName: "bg-indigo-500",
  },
  offer_sent: {
    label: "Отправлен оффер",
    accentClassName: "text-teal-600",
    cardAccentClassName: "border-l-teal-500",
    badgeClassName: "bg-teal-50 text-teal-700",
    dotClassName: "bg-teal-500",
  },
  offer_considering: {
    label: "Рассматривает оффер",
    accentClassName: "text-cyan-600",
    cardAccentClassName: "border-l-cyan-500",
    badgeClassName: "bg-cyan-50 text-cyan-700",
    dotClassName: "bg-cyan-500",
  },
  offer_accepted: {
    label: "Оффер принят",
    accentClassName: "text-emerald-600",
    cardAccentClassName: "border-l-emerald-400",
    badgeClassName: "bg-emerald-50 text-emerald-700",
    dotClassName: "bg-emerald-400",
  },
  hired: {
    label: "Вышел на работу",
    accentClassName: "text-emerald-700",
    cardAccentClassName: "border-l-emerald-600",
    badgeClassName: "bg-emerald-100 text-emerald-800",
    dotClassName: "bg-emerald-600",
  },
  passed_probation: {
    label: "Прошёл исп. срок",
    accentClassName: "text-green-700",
    cardAccentClassName: "border-l-green-600",
    badgeClassName: "bg-green-100 text-green-800",
    dotClassName: "bg-green-600",
  },
  reserve: {
    label: "Скамейка",
    accentClassName: "text-gray-500",
    cardAccentClassName: "border-l-gray-300",
    badgeClassName: "bg-gray-100 text-gray-600",
    dotClassName: "bg-gray-400",
  },
  rejected: {
    label: "Отказ",
    accentClassName: "text-rose-600",
    cardAccentClassName: "border-l-rose-400",
    badgeClassName: "bg-rose-50 text-rose-700",
    dotClassName: "bg-rose-500",
  },
  failed_probation: {
    label: "Не прошёл исп. срок",
    accentClassName: "text-red-600",
    cardAccentClassName: "border-l-red-400",
    badgeClassName: "bg-red-50 text-red-700",
    dotClassName: "bg-red-500",
  },
  fired: {
    label: "Уволен",
    accentClassName: "text-red-800",
    cardAccentClassName: "border-l-red-700",
    badgeClassName: "bg-red-100 text-red-900",
    dotClassName: "bg-red-700",
  },
};

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
  networking: { label: "Самостоятельный поиск (нетворкинг)" },
  applications: { label: "Отклики" },
  referral: { label: "Реферал" },
  external_recruiter: { label: "Внешний рекрутер" },
  other: { label: "Другое" },
};

export const CANDIDATE_REJECTION_REASON_ORDER: CandidateRejectionReason[] = [
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

export const CANDIDATE_REJECTION_REASON_CONFIG: Record<CandidateRejectionReason, { label: string }> = {
  resume_rejected: { label: "Отказ по резюме" },
  not_relevant: { label: "Не релевантный кандидат" },
  insufficient_qualification: { label: "Недостаточная квалификация" },
  experience_mismatch: { label: "Не подходит опыт" },
  grade_mismatch: { label: "Не подходит по грейду" },
  age_restriction: { label: "Возрастное ограничение" },
  vacancy_closed_other: { label: "Вакансия закрылась другим" },
  self_not_interested: { label: "Самостоятельно: не интересен" },
  language_barrier: { label: "Языковой барьер" },
  location_mismatch: { label: "Не подходит локация" },
  not_interested: { label: "Не заинтересован" },
  culture_mismatch: { label: "Не подходит по культуре" },
  salary_expectations: { label: "Завышенные ожидания по ЗП" },
  soft_skills_mismatch: { label: "Несоответствует Soft Skills" },
  no_show: { label: "Не пришёл на собеседование" },
  found_job: { label: "Нашёл работу" },
  not_finished_studies: { label: "Не окончил обучение" },
  no_russian: { label: "Не разговаривает на русском" },
};

// Stages that represent a rejection/exit where a reason is relevant.
export const NEGATIVE_STAGES: CandidateStage[] = ["rejected", "failed_probation", "fired"];

export type Gender = "male" | "female";

export const GENDER_CONFIG: Record<Gender, { label: string }> = {
  male: { label: "Мужчина" },
  female: { label: "Женщина" },
};

// One movement of a candidate through the pipeline (powers the История tab).
export interface CandidateStageHistoryEntry {
  id: string;
  fromStage: CandidateStage | null;
  toStage: CandidateStage;
  at: string; // ISO datetime
  byName: string | null; // who moved the candidate
  comment: string;
}

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

export const daysBetween = (from: string | null, to: string | null): number | null => {
  if (!from || !to) return null;
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.max(0, Math.round((b - a) / 86_400_000));
};

export const daysOpenLabel = (iso: string | null): string => {
  const d = daysSince(iso);
  if (d === null) return "—";
  if (d === 0) return "сегодня";
  if (d === 1) return "1 день";
  if (d < 5) return `${d} дня`;
  return `${d} дней`;
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

export const createEmptyVacancyDraft = (): VacancyDraft => ({
  title: "",
  departmentId: null,
  divisionId: null,
  positionId: null,
  tag: "",
  locationId: null,
  location: "Офис Ташкент",
  workMode: "office",
  employmentType: "Полная занятость",
  experienceLevel: "Middle",
  salaryMin: null,
  salaryMax: null,
  salaryCurrency: "UZS",
  status: "open",
  priority: "medium",
  openings: 1,
  recruiterId: null,
  recruiterName: null,
  hiringManagerId: null,
  hiringManagerName: null,
  description: "",
  responsibilities: "",
  requirements: "",
  conditions: "",
  skills: [],
  deadline: null,
  openedAt: formatDateIso(new Date().toISOString()),
});

export const vacancyDraftFromItem = (v: Vacancy): VacancyDraft => ({
  title: v.title,
  departmentId: v.departmentId,
  divisionId: v.divisionId,
  positionId: v.positionId,
  tag: v.tag,
  locationId: v.locationId,
  location: v.location,
  workMode: v.workMode,
  employmentType: v.employmentType,
  experienceLevel: v.experienceLevel,
  salaryMin: v.salaryMin,
  salaryMax: v.salaryMax,
  salaryCurrency: v.salaryCurrency,
  status: v.status,
  priority: v.priority,
  openings: v.openings,
  recruiterId: v.recruiterId,
  recruiterName: v.recruiterName,
  hiringManagerId: v.hiringManagerId,
  hiringManagerName: v.hiringManagerName,
  description: v.description,
  responsibilities: v.responsibilities,
  requirements: v.requirements,
  conditions: v.conditions,
  skills: v.skills,
  deadline: v.deadline,
  openedAt: v.openedAt,
});

export const createEmptyCandidateDraft = (): CandidateDraft => ({
  firstName: "",
  lastName: "",
  photo: null,
  vacancyId: null,
  positionTitle: "",
  tag: "",
  level: "Middle",
  stage: "new",
  source: "headhunter",
  rejectionReason: null,
  appliedDate: formatDateIso(new Date().toISOString()),
  email: "",
  phone: "",
  dateOfBirth: null,
  gender: null,
  links: [],
  skills: [],
  resumeUrl: null,
  coverLetter: "",
  rating: 0,
  salaryExpectation: null,
  salaryCurrency: "UZS",
  notes: "",
  recruiterId: null,
  recruiterName: null,
  addedById: null,
  addedByName: null,
});

export const candidateDraftFromItem = (c: Candidate): CandidateDraft => ({
  firstName: c.firstName,
  lastName: c.lastName,
  photo: c.photo,
  vacancyId: c.vacancyId,
  positionTitle: c.positionTitle,
  tag: c.tag,
  level: c.level,
  stage: c.stage,
  source: c.source,
  rejectionReason: c.rejectionReason,
  appliedDate: c.appliedDate,
  email: c.email,
  phone: c.phone,
  dateOfBirth: c.dateOfBirth,
  gender: c.gender,
  links: c.links,
  skills: c.skills,
  resumeUrl: c.resumeUrl,
  coverLetter: c.coverLetter,
  rating: c.rating,
  salaryExpectation: c.salaryExpectation,
  salaryCurrency: c.salaryCurrency,
  notes: c.notes,
  recruiterId: c.recruiterId,
  recruiterName: c.recruiterName,
  addedById: c.addedById,
  addedByName: c.addedByName,
});
