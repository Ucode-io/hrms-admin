// ─────────────────────────────────────────────────────────────────────────────
// Frontend-only mock data layer for the Recruiting module.
//
// While the backend collections are not ready, the whole module runs against this
// in-memory store. The services delegate here when RECRUITING_USE_MOCK is true.
// Rows use the same snake_case shape the real items API will return, so the
// existing mappers (mapVacancyRow / mapCandidateRow) work unchanged. When the API
// is ready, flip the flag in mockConfig.ts and the store is bypassed.
// ─────────────────────────────────────────────────────────────────────────────

export interface DirectoryOption {
  value: string;
  label: string;
}

type Row = Record<string, unknown>;

// ───── Directories (replace settings/employees API while mocking) ─────

export const MOCK_DEPARTMENTS: DirectoryOption[] = [
  { value: "dep-eng", label: "Разработка" },
  { value: "dep-qa", label: "QA" },
  { value: "dep-pm", label: "Проектный офис" },
  { value: "dep-sales", label: "Продажи" },
  { value: "dep-hr", label: "HR" },
  { value: "dep-design", label: "Дизайн" },
];

export const MOCK_DIVISIONS: DirectoryOption[] = [
  { value: "div-product", label: "Продукт" },
  { value: "div-platform", label: "Платформа" },
  { value: "div-delivery", label: "Доставка" },
  { value: "div-commercial", label: "Коммерция" },
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
  { value: "emp-3", label: "Дилшod Каримов" },
  { value: "emp-4", label: "Мадина Юлдашева" },
  { value: "emp-5", label: "Тимур Ахмедов" },
  { value: "emp-6", label: "Нигора Исмаилова" },
];

// ───── Date helpers (relative to "today") ─────

const iso = (daysAgo: number): string => {
  const d = new Date();
  d.setHours(10, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
};
const dateOnly = (daysAgo: number): string => iso(daysAgo).slice(0, 10);

let idCounter = 1000;
const nextId = (prefix: string) => `${prefix}-${++idCounter}`;

// ───── Seed: Vacancies ─────

let vacancies: Row[] = [
  {
    guid: "vac-1",
    title: "Backend Developer (Senior)",
    departments_id: "dep-eng",
    departments_id_data: { guid: "dep-eng", title: "Разработка" },
    divisions_id: "div-platform",
    divisions_id_data: { guid: "div-platform", title: "Платформа" },
    positions_id: "pos-backend",
    positions_id_data: { guid: "pos-backend", title: "Backend Developer" },
    tag: "BACKEND",
    locations_id: "loc-tashkent",
    locations_id_data: { guid: "loc-tashkent", title: "Офис Ташкент" },
    location: "Офис Ташкент",
    work_mode: ["office"],
    employment_type: "Полная занятость",
    experience_level: "Senior",
    salary_min: 8_000_000,
    salary_max: 12_000_000,
    salary_currency: "UZS",
    status: ["open"],
    priority: ["high"],
    openings: 2,
    recruiter_id: "emp-1",
    recruiter_name: "Азиза Саидова",
    hiring_manager_id: "emp-5",
    hiring_manager_name: "Тимур Ахмедов",
    description: "Развитие основной платформы, проектирование сервисов и API.",
    responsibilities: "Проектирование микросервисов\nОптимизация производительности\nКод-ревью",
    requirements: "Go или Node.js от 4 лет\nPostgreSQL, Redis\nОпыт highload",
    deadline: dateOnly(-30),
    opened_at: iso(48),
    created_at: iso(48),
  },
  {
    guid: "vac-2",
    title: "Frontend Developer (Middle)",
    departments_id: "dep-eng",
    departments_id_data: { guid: "dep-eng", title: "Разработка" },
    divisions_id: "div-product",
    divisions_id_data: { guid: "div-product", title: "Продукт" },
    positions_id: "pos-frontend",
    positions_id_data: { guid: "pos-frontend", title: "Frontend Developer" },
    tag: "FRONTEND",
    locations_id: "loc-tashkent",
    locations_id_data: { guid: "loc-tashkent", title: "Офис Ташкент" },
    location: "Офис Ташкент",
    work_mode: ["hybrid"],
    employment_type: "Полная занятость",
    experience_level: "Middle",
    salary_min: 6_000_000,
    salary_max: 9_000_000,
    salary_currency: "UZS",
    status: ["open"],
    priority: ["medium"],
    openings: 1,
    recruiter_id: "emp-1",
    recruiter_name: "Азиза Саидова",
    hiring_manager_id: "emp-5",
    hiring_manager_name: "Тимур Ахмедов",
    description: "Развитие клиентских приложений на React.",
    responsibilities: "Разработка UI\nИнтеграция с API\nUnit-тесты",
    requirements: "React от 2 лет\nTypeScript\nTailwind",
    deadline: dateOnly(-20),
    opened_at: iso(40),
    created_at: iso(40),
  },
  {
    guid: "vac-3",
    title: "QA Engineer",
    departments_id: "dep-qa",
    departments_id_data: { guid: "dep-qa", title: "QA" },
    divisions_id: "div-platform",
    divisions_id_data: { guid: "div-platform", title: "Платформа" },
    positions_id: "pos-qa",
    positions_id_data: { guid: "pos-qa", title: "QA Engineer" },
    tag: "QA",
    locations_id: "loc-tashkent",
    locations_id_data: { guid: "loc-tashkent", title: "Офис Ташкент" },
    location: "Офис Ташкент",
    work_mode: ["office"],
    employment_type: "Полная занятость",
    experience_level: "Middle",
    salary_min: 5_000_000,
    salary_max: 7_000_000,
    salary_currency: "UZS",
    status: ["open"],
    priority: ["medium"],
    openings: 1,
    recruiter_id: "emp-6",
    recruiter_name: "Нигора Исмаилова",
    hiring_manager_id: "emp-2",
    hiring_manager_name: "Бекзод Рустамов",
    description: "Обеспечение качества продукта.",
    responsibilities: "Тест-кейсы\nРегрессионное тестирование\nАвтотесты",
    requirements: "Опыт ручного тестирования\nPostman, SQL\nБазовые автотесты",
    deadline: dateOnly(-25),
    opened_at: iso(35),
    created_at: iso(35),
  },
  {
    guid: "vac-4",
    title: "Project Manager",
    departments_id: "dep-pm",
    departments_id_data: { guid: "dep-pm", title: "Проектный офис" },
    divisions_id: "div-delivery",
    divisions_id_data: { guid: "div-delivery", title: "Доставка" },
    positions_id: "pos-pm",
    positions_id_data: { guid: "pos-pm", title: "Project Manager" },
    tag: "PM",
    locations_id: "loc-tashkent",
    locations_id_data: { guid: "loc-tashkent", title: "Офис Ташкент" },
    location: "Офис Ташкент",
    work_mode: ["office"],
    employment_type: "Полная занятость",
    experience_level: "Senior",
    salary_min: 7_000_000,
    salary_max: 10_000_000,
    salary_currency: "UZS",
    status: ["paused"],
    priority: ["low"],
    openings: 1,
    recruiter_id: "emp-1",
    recruiter_name: "Азиза Саидова",
    hiring_manager_id: "emp-4",
    hiring_manager_name: "Мадина Юлдашева",
    description: "Управление командами доставки проектов.",
    responsibilities: "Планирование\nКоммуникация со стейкхолдерами\nРиск-менеджмент",
    requirements: "Опыт PM от 3 лет\nScrum/Kanban\nАнглийский B2",
    deadline: dateOnly(-10),
    opened_at: iso(60),
    created_at: iso(60),
  },
  {
    guid: "vac-5",
    title: "Sales Manager",
    departments_id: "dep-sales",
    departments_id_data: { guid: "dep-sales", title: "Продажи" },
    divisions_id: "div-commercial",
    divisions_id_data: { guid: "div-commercial", title: "Коммерция" },
    positions_id: "pos-sales",
    positions_id_data: { guid: "pos-sales", title: "Sales Manager" },
    tag: "SALES",
    locations_id: "loc-tashkent",
    locations_id_data: { guid: "loc-tashkent", title: "Офис Ташкент" },
    location: "Офис Ташкент",
    work_mode: ["office"],
    employment_type: "Полная занятость",
    experience_level: "Middle",
    salary_min: 5_000_000,
    salary_max: 8_000_000,
    salary_currency: "UZS",
    status: ["open"],
    priority: ["high"],
    openings: 3,
    recruiter_id: "emp-6",
    recruiter_name: "Нигора Исмаилова",
    hiring_manager_id: "emp-3",
    hiring_manager_name: "Дилшod Каримов",
    description: "Продажи B2B решений компании.",
    responsibilities: "Поиск клиентов\nВедение сделок\nВыполнение плана",
    requirements: "Опыт продаж от 2 лет\nCRM\nКоммуникабельность",
    deadline: dateOnly(-15),
    opened_at: iso(28),
    created_at: iso(28),
  },
  {
    guid: "vac-6",
    title: "DevOps Engineer",
    departments_id: "dep-eng",
    departments_id_data: { guid: "dep-eng", title: "Разработка" },
    divisions_id: "div-platform",
    divisions_id_data: { guid: "div-platform", title: "Платформа" },
    positions_id: "pos-devops",
    positions_id_data: { guid: "pos-devops", title: "DevOps Engineer" },
    tag: "DEVOPS",
    locations_id: "loc-remote",
    locations_id_data: { guid: "loc-remote", title: "Удалённо" },
    location: "Удалённо",
    work_mode: ["remote"],
    employment_type: "Полная занятость",
    experience_level: "Senior",
    salary_min: 10_000_000,
    salary_max: 15_000_000,
    salary_currency: "UZS",
    status: ["closed"],
    priority: ["medium"],
    openings: 1,
    recruiter_id: "emp-1",
    recruiter_name: "Азиза Саидова",
    hiring_manager_id: "emp-5",
    hiring_manager_name: "Тимур Ахмедов",
    description: "Инфраструктура и CI/CD.",
    responsibilities: "Kubernetes\nCI/CD пайплайны\nМониторинг",
    requirements: "AWS/GCP\nTerraform\nDocker, k8s",
    deadline: dateOnly(40),
    opened_at: iso(90),
    closed_at: iso(20),
    created_at: iso(90),
  },
];

// ───── Seed: Candidates ─────

interface SeedCandidate {
  last: string;
  first: string;
  vac: string;
  tag: string;
  level: string;
  stage: string;
  source: string;
  applied: number; // days ago
  rating?: number;
  reason?: string;
  hired?: number; // days ago
}

const SEED_CANDIDATES: SeedCandidate[] = [
  // vac-1 Backend
  { last: "Петров", first: "Алексей", vac: "vac-1", tag: "BACKEND", level: "Junior", stage: "new", source: "headhunter", applied: 6, rating: 0 },
  { last: "Тошматов", first: "Сардор", vac: "vac-1", tag: "BACKEND", level: "Middle", stage: "resume_reviewed", source: "headhunter", applied: 11, rating: 3 },
  { last: "Холматов", first: "Жасур", vac: "vac-1", tag: "BACKEND", level: "Senior", stage: "tech_interview", source: "linkedin", applied: 14, rating: 4 },
  { last: "Нормматов", first: "Отабек", vac: "vac-1", tag: "BACKEND", level: "Middle", stage: "test_task", source: "linkedin", applied: 9, rating: 4 },
  { last: "Рахимов", first: "Жавохир", vac: "vac-1", tag: "BACKEND", level: "Senior", stage: "offer_sent", source: "networking", applied: 22, rating: 5 },
  { last: "Усмонов", first: "Шохрух", vac: "vac-1", tag: "BACKEND", level: "Middle", stage: "rejected", source: "headhunter", applied: 18, rating: 2, reason: "experience_mismatch" },
  { last: "Эргашев", first: "Бобур", vac: "vac-1", tag: "BACKEND", level: "Senior", stage: "hired", source: "linkedin", applied: 45, rating: 5, hired: 8 },
  // vac-2 Frontend
  { last: "Юсупова", first: "Дилноза", vac: "vac-2", tag: "FRONTEND", level: "Middle", stage: "new", source: "linkedin", applied: 7, rating: 0 },
  { last: "Ахмедова", first: "Зульфия", vac: "vac-2", tag: "FRONTEND", level: "Middle", stage: "screening_call", source: "telegram", applied: 12, rating: 3 },
  { last: "Каримов", first: "Аброр", vac: "vac-2", tag: "FRONTEND", level: "Junior", stage: "interview", source: "career_site", applied: 15, rating: 4 },
  { last: "Собиров", first: "Улугбек", vac: "vac-2", tag: "FRONTEND", level: "Middle", stage: "offer_accepted", source: "headhunter", applied: 30, rating: 5 },
  { last: "Назарова", first: "Камила", vac: "vac-2", tag: "FRONTEND", level: "Middle", stage: "rejected", source: "applications", applied: 20, rating: 2, reason: "salary_expectations" },
  { last: "Хакимов", first: "Сухроб", vac: "vac-2", tag: "FRONTEND", level: "Junior", stage: "hired", source: "telegram", applied: 50, rating: 4, hired: 12 },
  // vac-3 QA
  { last: "Мирзаева", first: "Камола", vac: "vac-3", tag: "QA", level: "Middle", stage: "screening_call", source: "telegram", applied: 13, rating: 3 },
  { last: "Рашидов", first: "Бобур", vac: "vac-3", tag: "QA", level: "Junior", stage: "new", source: "referral", applied: 9, rating: 0 },
  { last: "Юлдашев", first: "Азиз", vac: "vac-3", tag: "QA", level: "Middle", stage: "test_task", source: "headhunter", applied: 17, rating: 4 },
  { last: "Каримова", first: "Севара", vac: "vac-3", tag: "QA", level: "Middle", stage: "rejected", source: "headhunter", applied: 24, rating: 2, reason: "soft_skills_mismatch" },
  { last: "Тураев", first: "Фаррух", vac: "vac-3", tag: "QA", level: "Junior", stage: "reserve", source: "career_site", applied: 26, rating: 3 },
  // vac-4 PM
  { last: "Кодирова", first: "Нилуфар", vac: "vac-4", tag: "PM", level: "Senior", stage: "interview", source: "referral", applied: 16, rating: 4 },
  { last: "Алиев", first: "Рустам", vac: "vac-4", tag: "PM", level: "Middle", stage: "rejected", source: "linkedin", applied: 28, rating: 2, reason: "grade_mismatch" },
  { last: "Бекмуродов", first: "Достон", vac: "vac-4", tag: "PM", level: "Senior", stage: "offer_considering", source: "networking", applied: 34, rating: 5 },
  // vac-5 Sales
  { last: "Каримов", first: "Амир", vac: "vac-5", tag: "SALES", level: "Middle", stage: "interview", source: "headhunter", applied: 10, rating: 3 },
  { last: "Исроилов", first: "Жахонгир", vac: "vac-5", tag: "SALES", level: "Junior", stage: "new", source: "applications", applied: 4, rating: 0 },
  { last: "Сафарова", first: "Малика", vac: "vac-5", tag: "SALES", level: "Middle", stage: "resume_reviewed", source: "career_site", applied: 8, rating: 3 },
  { last: "Зокиров", first: "Элёр", vac: "vac-5", tag: "SALES", level: "Middle", stage: "hired", source: "headhunter", applied: 40, rating: 4, hired: 6 },
  { last: "Хамидов", first: "Санжар", vac: "vac-5", tag: "SALES", level: "Junior", stage: "rejected", source: "telegram", applied: 19, rating: 1, reason: "no_show" },
  // vac-6 DevOps (closed) — hired
  { last: "Маткаримов", first: "Темур", vac: "vac-6", tag: "DEVOPS", level: "Senior", stage: "hired", source: "linkedin", applied: 75, rating: 5, hired: 21 },
  { last: "Юнусов", first: "Икром", vac: "vac-6", tag: "DEVOPS", level: "Senior", stage: "rejected", source: "networking", applied: 70, rating: 3, reason: "vacancy_closed_other" },
];

const RECRUITER_POOL = ["emp-1", "emp-6"];
const recruiterName = (id: string) => MOCK_EMPLOYEES.find((e) => e.value === id)?.label ?? null;

const SKILLS_BY_TAG: Record<string, string[]> = {
  BACKEND: ["Go", "PostgreSQL", "Redis", "gRPC", "Docker"],
  FRONTEND: ["React", "TypeScript", "Tailwind", "Redux", "Vite"],
  QA: ["Postman", "SQL", "Selenium", "TestRail"],
  PM: ["Scrum", "Jira", "Roadmap", "Stakeholders"],
  SALES: ["CRM", "B2B", "Переговоры", "Воронка"],
  DEVOPS: ["Kubernetes", "Terraform", "AWS", "CI/CD", "Prometheus"],
};

const GENDER_BY_INDEX = (idx: number): string => (idx % 3 === 0 ? "female" : "male");

const buildLinks = (first: string, last: string, source: string): string[] => {
  const handle = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, "");
  const links = [`https://www.linkedin.com/in/${handle}`];
  if (source === "headhunter") links.unshift(`https://hh.uz/resume/${handle}`);
  links.push(`https://github.com/${handle}`);
  return links;
};

// Plausible progression along the main pipeline up to the candidate's stage.
const MAIN_PATH = [
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
];

const buildStageHistory = (targetStage: string, appliedDaysAgo: number, byName: string | null): Row[] => {
  let path: string[];
  const mainIdx = MAIN_PATH.indexOf(targetStage);
  if (mainIdx >= 0) {
    path = MAIN_PATH.slice(0, mainIdx + 1);
  } else {
    // reserve / rejected / failed_probation / fired — a few active steps then the exit.
    path = ["new", "resume_reviewed", "screening_call", targetStage];
  }
  const n = path.length;
  const span = Math.max(1, appliedDaysAgo - 1);
  return path.map((stage, i) => {
    const daysAgo = Math.round(appliedDaysAgo - (span * i) / Math.max(1, n - 1));
    return {
      id: `h-${stage}-${i}`,
      from_stage: i === 0 ? null : [path[i - 1]],
      to_stage: [stage],
      at: iso(Math.max(0, daysAgo)),
      by_name: byName,
      comment: i === 0 ? "Кандидат добавлен в воронку" : "",
    };
  });
};

let candidates: Row[] = SEED_CANDIDATES.map((c, idx) => {
  const vac = vacancies.find((v) => v.guid === c.vac);
  const recId = RECRUITER_POOL[idx % RECRUITER_POOL.length];
  const recName = recruiterName(recId);
  const birthYear = 1990 + (idx % 12);
  return {
    guid: `cand-${idx + 1}`,
    first_name: c.first,
    last_name: c.last,
    photo: null,
    vacancies_id: c.vac,
    vacancies_id_data: { guid: c.vac, title: vac?.title, tag: c.tag },
    position_title: vac?.title ?? c.tag,
    tag: c.tag,
    level: c.level,
    stage: [c.stage],
    source: [c.source],
    rejection_reason: c.reason ? [c.reason] : null,
    applied_date: dateOnly(c.applied),
    email: `${c.first}.${c.last}@example.com`.toLowerCase(),
    phone: `+9989${(idx + 10).toString().padStart(2, "0")}1234567`.slice(0, 13),
    date_of_birth: `${birthYear}-0${(idx % 9) + 1}-1${idx % 9}`,
    gender: [GENDER_BY_INDEX(idx)],
    links: buildLinks(c.first, c.last, c.source),
    skills: SKILLS_BY_TAG[c.tag] ?? [],
    resume_url: null,
    cover_letter: idx % 4 === 0 ? "Заинтересован в позиции, готов приступить в ближайшее время." : "",
    rating: c.rating ?? 0,
    salary_expectation: 4_000_000 + (idx % 6) * 1_000_000,
    salary_currency: "UZS",
    notes: "",
    recruiter_id: recId,
    recruiter_name: recName,
    added_by_id: recId,
    added_by_name: recName,
    stage_changed_at: iso(Math.max(0, c.applied - 2)),
    hired_at: c.hired != null ? dateOnly(c.hired) : null,
    stage_history: buildStageHistory(c.stage, c.applied, recName),
    created_at: iso(c.applied),
  };
});

// Inject skills + conditions into the seeded vacancies (by tag) for demo richness.
vacancies = vacancies.map((v) => ({
  ...v,
  skills: SKILLS_BY_TAG[String(v.tag)] ?? [],
  conditions: "Официальное трудоустройство, ДМС, гибкий график, обучение за счёт компании.",
}));

// ───── Generic helpers ─────

const asResolved = <T>(value: T): Promise<T> => Promise.resolve(value);

const matchesSearch = (row: Row, search: string, fields: string[]): boolean => {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => String(row[f] ?? "").toLowerCase().includes(q));
};

const firstOf = (value: unknown): string =>
  Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");

// ───── Vacancies store API ─────

export interface MockVacancyParams {
  limit: number;
  offset: number;
  search?: string;
  status?: string;
  departmentId?: string;
}

export const mockListVacancies = (params: MockVacancyParams) => {
  let rows = [...vacancies];
  if (params.search) rows = rows.filter((r) => matchesSearch(r, params.search!, ["title", "tag"]));
  if (params.status) rows = rows.filter((r) => firstOf(r.status) === params.status);
  if (params.departmentId) rows = rows.filter((r) => r.departments_id === params.departmentId);
  const count = rows.length;
  const response = rows.slice(params.offset, params.offset + params.limit);
  return asResolved({ count, response });
};

export const mockGetVacancy = (guid: string) =>
  asResolved(vacancies.find((v) => v.guid === guid) ?? null);

export const mockCreateVacancy = (payload: Row) => {
  const guid = nextId("vac");
  const now = iso(0);
  vacancies = [
    { guid, created_at: now, opened_at: payload.opened_at || now, ...payload },
    ...vacancies,
  ];
  return asResolved({ guid });
};

export const mockUpdateVacancy = (guid: string, payload: Row) => {
  vacancies = vacancies.map((v) => (v.guid === guid ? { ...v, ...payload, guid } : v));
  return asResolved({ guid });
};

export const mockUpdateVacancyStatus = (guid: string, status: string) => {
  vacancies = vacancies.map((v) =>
    v.guid === guid
      ? { ...v, status: [status], ...(status === "closed" ? { closed_at: iso(0) } : {}) }
      : v
  );
  return asResolved({ guid });
};

export const mockDeleteVacancy = (guid: string) => {
  vacancies = vacancies.filter((v) => v.guid !== guid);
  return asResolved({ guid });
};

export const mockVacancyCandidateCounts = () => {
  const map: Record<string, { total: number; hired: number }> = {};
  for (const c of candidates) {
    const vacId = String(c.vacancies_id ?? "");
    if (!vacId) continue;
    if (!map[vacId]) map[vacId] = { total: 0, hired: 0 };
    map[vacId].total += 1;
    if (firstOf(c.stage) === "hired") map[vacId].hired += 1;
  }
  return asResolved(map);
};

// ───── Candidates store API ─────

export interface MockCandidateParams {
  limit: number;
  offset: number;
  search?: string;
  vacancyId?: string;
  stage?: string;
}

export const mockListCandidates = (params: MockCandidateParams) => {
  let rows = [...candidates];
  if (params.search)
    rows = rows.filter((r) =>
      matchesSearch(r, params.search!, ["first_name", "last_name", "position_title", "email"])
    );
  if (params.vacancyId) rows = rows.filter((r) => r.vacancies_id === params.vacancyId);
  if (params.stage) rows = rows.filter((r) => firstOf(r.stage) === params.stage);
  const count = rows.length;
  const response = rows.slice(params.offset, params.offset + params.limit);
  return asResolved({ count, response });
};

export const mockGetCandidate = (guid: string) =>
  asResolved(candidates.find((c) => c.guid === guid) ?? null);

const historyEntry = (from: string | null, to: string, byName: string | null, comment = ""): Row => ({
  id: nextId("h"),
  from_stage: from ? [from] : null,
  to_stage: [to],
  at: iso(0),
  by_name: byName,
  comment,
});

export const mockCreateCandidate = (payload: Row) => {
  const guid = nextId("cand");
  const now = iso(0);
  const stage = firstOf(payload.stage) || "new";
  const byName = (payload.recruiter_name as string) ?? null;
  candidates = [
    {
      guid,
      created_at: now,
      stage_changed_at: now,
      stage_history: [historyEntry(null, stage, byName, "Кандидат добавлен в воронку")],
      ...payload,
    },
    ...candidates,
  ];
  return asResolved({ guid });
};

export const mockUpdateCandidate = (guid: string, payload: Row) => {
  candidates = candidates.map((c) => {
    if (c.guid !== guid) return c;
    const prevStage = firstOf(c.stage);
    const nextStage = firstOf(payload.stage) || prevStage;
    const history = Array.isArray(c.stage_history) ? [...(c.stage_history as Row[])] : [];
    const patch: Row = { ...c, ...payload, guid };
    if (nextStage && nextStage !== prevStage) {
      history.push(historyEntry(prevStage || null, nextStage, (payload.recruiter_name as string) ?? null));
      patch.stage_history = history;
      patch.stage_changed_at = iso(0);
      if (nextStage === "hired" && !c.hired_at) patch.hired_at = dateOnly(0);
    }
    return patch;
  });
  return asResolved({ guid });
};

export const mockUpdateCandidateStage = (guid: string, stage: string) => {
  candidates = candidates.map((c) => {
    if (c.guid !== guid) return c;
    const prevStage = firstOf(c.stage);
    if (prevStage === stage) return c;
    const history = Array.isArray(c.stage_history) ? [...(c.stage_history as Row[])] : [];
    history.push(historyEntry(prevStage || null, stage, (c.recruiter_name as string) ?? null));
    return {
      ...c,
      stage: [stage],
      stage_changed_at: iso(0),
      stage_history: history,
      ...(stage === "hired" && !c.hired_at ? { hired_at: dateOnly(0) } : {}),
    };
  });
  return asResolved({ guid });
};

export const mockDeleteCandidate = (guid: string) => {
  candidates = candidates.filter((c) => c.guid !== guid);
  return asResolved({ guid });
};
