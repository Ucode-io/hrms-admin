// Demo seed for the Recruiting mock store.
//
// Rows use the same snake_case shape the real items API will return, so the
// service mappers work unchanged when the backend is connected.
//
// Bump SEED_VERSION whenever the row shape changes — stale localStorage data
// is then discarded and reseeded.

export const SEED_VERSION = 3;

export type Row = Record<string, unknown>;

export interface MockDbShape {
  version: number;
  stage_templates: Row[];
  vacancies: Row[];
  candidates: Row[];
}

// ───── Date helpers (relative to "today") ─────

const iso = (daysAgo: number, hour = 10): string => {
  const d = new Date();
  d.setHours(hour, 15, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
};
const dateOnly = (daysAgo: number): string => iso(daysAgo).slice(0, 10);

// ───── Stage templates ─────

interface StagePreset {
  name: string;
  color: string;
}

const stageRows = (prefix: string, preset: StagePreset[]): Row[] =>
  preset.map((s, i) => ({ id: `${prefix}-st${i + 1}`, name: s.name, color: s.color, order: i }));

const IT_STAGES: StagePreset[] = [
  { name: "Скрининг", color: "blue" },
  { name: "Интервью с HR", color: "violet" },
  { name: "Тех. интервью", color: "indigo" },
  { name: "Тестовое задание", color: "amber" },
  { name: "Оффер", color: "emerald" },
];

const FAST_STAGES: StagePreset[] = [
  { name: "Скрининг", color: "blue" },
  { name: "Интервью", color: "violet" },
  { name: "Оффер", color: "emerald" },
];

const SALES_STAGES: StagePreset[] = [
  { name: "Скрининг", color: "blue" },
  { name: "Интервью с HR", color: "violet" },
  { name: "Ролевая игра", color: "orange" },
  { name: "Интервью с руководителем", color: "teal" },
  { name: "Оффер", color: "emerald" },
];

const seedStageTemplates = (): Row[] => [
  {
    guid: "tpl-it",
    name: "Стандартный IT-найм",
    description: "Полный цикл для инженерных позиций: от скрининга до оффера.",
    stages: stageRows("tpl-it", IT_STAGES),
    is_default: true,
    created_at: iso(120),
  },
  {
    guid: "tpl-fast",
    name: "Быстрый найм",
    description: "Сокращённый цикл для массовых и срочных позиций.",
    stages: stageRows("tpl-fast", FAST_STAGES),
    is_default: false,
    created_at: iso(90),
  },
  {
    guid: "tpl-sales",
    name: "Продажи и офис",
    description: "Воронка с ролевой игрой для коммерческих позиций.",
    stages: stageRows("tpl-sales", SALES_STAGES),
    is_default: false,
    created_at: iso(60),
  },
];

// ───── Vacancies ─────

interface SeedVacancy {
  guid: string;
  title: string;
  dep: { id: string; title: string };
  pos: { id: string; title: string };
  tag: string;
  level: string;
  workMode: string;
  salary: [number, number];
  status: string;
  priority: string;
  openings: number;
  recruiter: { id: string; name: string };
  manager: { id: string; name: string };
  templateId: string;
  stagesPreset: StagePreset[];
  openedDaysAgo: number;
  closedDaysAgo?: number;
  description: string;
  requirements: string;
  skills: string[];
}

const SEED_VACANCIES: SeedVacancy[] = [
  {
    guid: "vac-1",
    title: "Backend Developer (Senior)",
    dep: { id: "dep-eng", title: "Разработка" },
    pos: { id: "pos-backend", title: "Backend Developer" },
    tag: "BACKEND",
    level: "Senior",
    workMode: "office",
    salary: [8_000_000, 12_000_000],
    status: "open",
    priority: "high",
    openings: 2,
    recruiter: { id: "emp-1", name: "Азиза Саидова" },
    manager: { id: "emp-5", name: "Тимур Ахмедов" },
    templateId: "tpl-it",
    stagesPreset: IT_STAGES,
    openedDaysAgo: 48,
    description: "Развитие основной платформы, проектирование сервисов и API.",
    requirements: "Go или Node.js от 4 лет\nPostgreSQL, Redis\nОпыт highload",
    skills: ["Go", "PostgreSQL", "Redis", "gRPC", "Docker"],
  },
  {
    guid: "vac-2",
    title: "Frontend Developer (Middle)",
    dep: { id: "dep-eng", title: "Разработка" },
    pos: { id: "pos-frontend", title: "Frontend Developer" },
    tag: "FRONTEND",
    level: "Middle",
    workMode: "hybrid",
    salary: [6_000_000, 9_000_000],
    status: "open",
    priority: "medium",
    openings: 1,
    recruiter: { id: "emp-1", name: "Азиза Саидова" },
    manager: { id: "emp-5", name: "Тимур Ахмедов" },
    templateId: "tpl-it",
    stagesPreset: IT_STAGES,
    openedDaysAgo: 40,
    description: "Развитие клиентских приложений на React.",
    requirements: "React от 2 лет\nTypeScript\nTailwind",
    skills: ["React", "TypeScript", "Tailwind", "Vite"],
  },
  {
    guid: "vac-3",
    title: "QA Engineer",
    dep: { id: "dep-qa", title: "QA" },
    pos: { id: "pos-qa", title: "QA Engineer" },
    tag: "QA",
    level: "Middle",
    workMode: "office",
    salary: [5_000_000, 7_000_000],
    status: "open",
    priority: "medium",
    openings: 1,
    recruiter: { id: "emp-6", name: "Нигора Исмаилова" },
    manager: { id: "emp-2", name: "Бекзод Рустамов" },
    templateId: "tpl-fast",
    stagesPreset: FAST_STAGES,
    openedDaysAgo: 35,
    description: "Обеспечение качества продукта.",
    requirements: "Опыт ручного тестирования\nPostman, SQL\nБазовые автотесты",
    skills: ["Postman", "SQL", "Selenium", "TestRail"],
  },
  {
    guid: "vac-4",
    title: "Project Manager",
    dep: { id: "dep-pm", title: "Проектный офис" },
    pos: { id: "pos-pm", title: "Project Manager" },
    tag: "PM",
    level: "Senior",
    workMode: "office",
    salary: [7_000_000, 10_000_000],
    status: "paused",
    priority: "low",
    openings: 1,
    recruiter: { id: "emp-1", name: "Азиза Саидова" },
    manager: { id: "emp-4", name: "Мадина Юлдашева" },
    templateId: "tpl-fast",
    stagesPreset: FAST_STAGES,
    openedDaysAgo: 60,
    description: "Управление командами доставки проектов.",
    requirements: "Опыт PM от 3 лет\nScrum/Kanban\nАнглийский B2",
    skills: ["Scrum", "Jira", "Roadmap"],
  },
  {
    guid: "vac-5",
    title: "Sales Manager",
    dep: { id: "dep-sales", title: "Продажи" },
    pos: { id: "pos-sales", title: "Sales Manager" },
    tag: "SALES",
    level: "Middle",
    workMode: "office",
    salary: [5_000_000, 8_000_000],
    status: "open",
    priority: "high",
    openings: 3,
    recruiter: { id: "emp-6", name: "Нигора Исмаилова" },
    manager: { id: "emp-3", name: "Дилшод Каримов" },
    templateId: "tpl-sales",
    stagesPreset: SALES_STAGES,
    openedDaysAgo: 28,
    description: "Продажи B2B решений компании.",
    requirements: "Опыт продаж от 2 лет\nCRM\nКоммуникабельность",
    skills: ["CRM", "B2B", "Переговоры"],
  },
  {
    guid: "vac-6",
    title: "DevOps Engineer",
    dep: { id: "dep-eng", title: "Разработка" },
    pos: { id: "pos-devops", title: "DevOps Engineer" },
    tag: "DEVOPS",
    level: "Senior",
    workMode: "remote",
    salary: [10_000_000, 15_000_000],
    status: "closed",
    priority: "medium",
    openings: 1,
    recruiter: { id: "emp-1", name: "Азиза Саидова" },
    manager: { id: "emp-5", name: "Тимур Ахмедов" },
    templateId: "tpl-it",
    stagesPreset: IT_STAGES,
    openedDaysAgo: 90,
    closedDaysAgo: 20,
    description: "Инфраструктура и CI/CD.",
    requirements: "AWS/GCP\nTerraform\nDocker, k8s",
    skills: ["Kubernetes", "Terraform", "AWS", "CI/CD"],
  },
];

const seedVacancies = (): Row[] =>
  SEED_VACANCIES.map((v) => ({
    guid: v.guid,
    title: v.title,
    departments_id: v.dep.id,
    departments_id_data: { guid: v.dep.id, title: v.dep.title },
    positions_id: v.pos.id,
    positions_id_data: { guid: v.pos.id, title: v.pos.title },
    tag: v.tag,
    locations_id: v.workMode === "remote" ? "loc-remote" : "loc-tashkent",
    locations_id_data:
      v.workMode === "remote"
        ? { guid: "loc-remote", title: "Удалённо" }
        : { guid: "loc-tashkent", title: "Офис Ташкент" },
    location: v.workMode === "remote" ? "Удалённо" : "Офис Ташкент",
    work_mode: [v.workMode],
    employment_type: "Полная занятость",
    experience_level: v.level,
    salary_min: v.salary[0],
    salary_max: v.salary[1],
    salary_currency: "UZS",
    status: [v.status],
    priority: [v.priority],
    openings: v.openings,
    recruiter_id: v.recruiter.id,
    recruiter_name: v.recruiter.name,
    hiring_manager_id: v.manager.id,
    hiring_manager_name: v.manager.name,
    description: v.description,
    responsibilities: "",
    requirements: v.requirements,
    conditions: "Официальное трудоустройство, ДМС, гибкий график, обучение за счёт компании.",
    skills: v.skills,
    deadline: dateOnly(v.openedDaysAgo - 75),
    opened_at: iso(v.openedDaysAgo),
    closed_at: v.closedDaysAgo != null ? iso(v.closedDaysAgo) : null,
    created_at: iso(v.openedDaysAgo),
    stage_template_id: v.templateId,
    stages: stageRows(v.guid, v.stagesPreset),
  }));

// ───── Candidates ─────

interface SeedCandidate {
  last: string;
  first: string;
  vac: string;
  level: string;
  /** Index of the current stage; for terminal outcomes — last visited stage. */
  stageIdx: number;
  outcome?: string; // hired | rejected | reserve (default active)
  reason?: string;
  source: string;
  applied: number; // days ago
  /** Scores for visited stages (0 → not scored). Length ≤ stageIdx+1. */
  scores: number[];
}

const SEED_CANDIDATES: SeedCandidate[] = [
  // vac-1 Backend (5 этапов)
  { last: "Петров", first: "Алексей", vac: "vac-1", level: "Junior", stageIdx: 0, source: "headhunter", applied: 6, scores: [0] },
  { last: "Тошматов", first: "Сардор", vac: "vac-1", level: "Middle", stageIdx: 1, source: "headhunter", applied: 11, scores: [6, 0] },
  { last: "Холматов", first: "Жасур", vac: "vac-1", level: "Senior", stageIdx: 2, source: "linkedin", applied: 14, scores: [8, 7, 0] },
  { last: "Нормматов", first: "Отабек", vac: "vac-1", level: "Middle", stageIdx: 3, source: "linkedin", applied: 19, scores: [7, 8, 6, 0] },
  { last: "Рахимов", first: "Жавохир", vac: "vac-1", level: "Senior", stageIdx: 4, source: "networking", applied: 26, scores: [9, 8, 9, 8, 0] },
  { last: "Усмонов", first: "Шохрух", vac: "vac-1", level: "Middle", stageIdx: 2, outcome: "rejected", reason: "experience_mismatch", source: "headhunter", applied: 18, scores: [5, 4, 3] },
  { last: "Эргашев", first: "Бобур", vac: "vac-1", level: "Senior", stageIdx: 4, outcome: "hired", source: "linkedin", applied: 45, scores: [8, 9, 9, 8, 10] },
  // vac-2 Frontend (5 этапов)
  { last: "Юсупова", first: "Дилноза", vac: "vac-2", level: "Middle", stageIdx: 0, source: "linkedin", applied: 7, scores: [0] },
  { last: "Ахмедова", first: "Зульфия", vac: "vac-2", level: "Middle", stageIdx: 1, source: "telegram", applied: 12, scores: [7, 0] },
  { last: "Каримов", first: "Аброр", vac: "vac-2", level: "Junior", stageIdx: 2, source: "career_site", applied: 15, scores: [6, 7, 5] },
  { last: "Собиров", first: "Улугбек", vac: "vac-2", level: "Middle", stageIdx: 4, source: "headhunter", applied: 30, scores: [8, 8, 9, 7, 0] },
  { last: "Назарова", first: "Камила", vac: "vac-2", level: "Middle", stageIdx: 1, outcome: "rejected", reason: "salary_expectations", source: "applications", applied: 20, scores: [6, 5] },
  { last: "Хакимов", first: "Сухроб", vac: "vac-2", level: "Junior", stageIdx: 4, outcome: "hired", source: "telegram", applied: 50, scores: [7, 8, 7, 8, 9] },
  // vac-3 QA (3 этапа)
  { last: "Мирзаева", first: "Камола", vac: "vac-3", level: "Middle", stageIdx: 1, source: "telegram", applied: 13, scores: [7, 0] },
  { last: "Рашидов", first: "Бобур", vac: "vac-3", level: "Junior", stageIdx: 0, source: "referral", applied: 9, scores: [0] },
  { last: "Юлдашев", first: "Азиз", vac: "vac-3", level: "Middle", stageIdx: 2, source: "headhunter", applied: 17, scores: [8, 7, 0] },
  { last: "Каримова", first: "Севара", vac: "vac-3", level: "Middle", stageIdx: 1, outcome: "rejected", reason: "soft_skills_mismatch", source: "headhunter", applied: 24, scores: [6, 3] },
  { last: "Тураев", first: "Фаррух", vac: "vac-3", level: "Junior", stageIdx: 1, outcome: "reserve", source: "career_site", applied: 26, scores: [7, 6] },
  // vac-4 PM (3 этапа)
  { last: "Кодирова", first: "Нилуфар", vac: "vac-4", level: "Senior", stageIdx: 1, source: "referral", applied: 16, scores: [8, 0] },
  { last: "Алиев", first: "Рустам", vac: "vac-4", level: "Middle", stageIdx: 1, outcome: "rejected", reason: "grade_mismatch", source: "linkedin", applied: 28, scores: [5, 4] },
  { last: "Бекмуродов", first: "Достон", vac: "vac-4", level: "Senior", stageIdx: 2, source: "networking", applied: 34, scores: [9, 8, 0] },
  // vac-5 Sales (5 этапов)
  { last: "Каримов", first: "Амир", vac: "vac-5", level: "Middle", stageIdx: 2, source: "headhunter", applied: 10, scores: [7, 6, 0] },
  { last: "Исроилов", first: "Жахонгир", vac: "vac-5", level: "Junior", stageIdx: 0, source: "applications", applied: 4, scores: [0] },
  { last: "Сафарова", first: "Малика", vac: "vac-5", level: "Middle", stageIdx: 1, source: "career_site", applied: 8, scores: [6, 0] },
  { last: "Зокиров", first: "Элёр", vac: "vac-5", level: "Middle", stageIdx: 3, source: "headhunter", applied: 21, scores: [7, 8, 8, 0] },
  { last: "Хамидов", first: "Санжар", vac: "vac-5", level: "Junior", stageIdx: 1, outcome: "rejected", reason: "no_show", source: "telegram", applied: 19, scores: [5, 0] },
  { last: "Абдуллаев", first: "Шерзод", vac: "vac-5", level: "Middle", stageIdx: 4, outcome: "hired", source: "headhunter", applied: 40, scores: [8, 7, 9, 8, 9] },
  // vac-6 DevOps (закрыта, 5 этапов)
  { last: "Маткаримов", first: "Темур", vac: "vac-6", level: "Senior", stageIdx: 4, outcome: "hired", source: "linkedin", applied: 75, scores: [9, 9, 10, 9, 10] },
  { last: "Юнусов", first: "Икром", vac: "vac-6", level: "Senior", stageIdx: 2, outcome: "rejected", reason: "vacancy_closed_other", source: "networking", applied: 70, scores: [8, 7, 7] },
];

const SKILLS_BY_TAG: Record<string, string[]> = {
  BACKEND: ["Go", "PostgreSQL", "Redis", "gRPC", "Docker"],
  FRONTEND: ["React", "TypeScript", "Tailwind", "Redux"],
  QA: ["Postman", "SQL", "Selenium", "TestRail"],
  PM: ["Scrum", "Jira", "Roadmap"],
  SALES: ["CRM", "B2B", "Переговоры"],
  DEVOPS: ["Kubernetes", "Terraform", "AWS", "CI/CD"],
};

const COMMENT_POOL: Record<"good" | "mid" | "bad", string[]> = {
  good: [
    "Сильный кандидат, уверенно отвечает, хороший опыт.",
    "Отличная коммуникация, чёткие примеры из практики.",
    "Глубокие знания, рекомендую двигать дальше.",
    "Очень мотивирован, быстро ориентируется в вопросах.",
  ],
  mid: [
    "Неплохой уровень, но есть пробелы в базовых темах.",
    "Средне: справился с частью вопросов, нужен второй взгляд.",
    "Опыт релевантный, но ответы поверхностные.",
  ],
  bad: [
    "Слабые ответы на ключевые вопросы.",
    "Не хватает опыта для этого грейда.",
    "Коммуникация затруднена, много общих слов.",
  ],
};

const commentFor = (score: number, idx: number): string => {
  const pool = score >= 8 ? COMMENT_POOL.good : score >= 5 ? COMMENT_POOL.mid : COMMENT_POOL.bad;
  return pool[idx % pool.length];
};

/** Demo documents: every candidate gets a CV, advanced ones a certificate. */
const seedDocuments = (
  idx: number,
  first: string,
  last: string,
  stageIdx: number,
  recruiterName: string,
  appliedDaysAgo: number
): Row[] => {
  const handle = `${first}_${last}`.toLowerCase().replace(/[^a-z_]/g, "") || "candidate";
  const docs: Row[] = [
    {
      id: `doc-${idx}-cv`,
      name: `CV_${handle}.pdf`,
      type: "cv",
      url: `https://hh.uz/resume/${handle}.pdf`,
      size: null,
      uploaded_at: iso(appliedDaysAgo, 11),
      uploaded_by_name: recruiterName,
    },
  ];
  if (stageIdx >= 2) {
    docs.push({
      id: `doc-${idx}-cert`,
      name: `Certificate_${handle}.pdf`,
      type: "certificate",
      url: `https://example.com/certificates/${handle}.pdf`,
      size: null,
      uploaded_at: iso(Math.max(0, appliedDaysAgo - 3), 15),
      uploaded_by_name: recruiterName,
    });
  }
  return docs;
};

const buildLinks = (first: string, last: string, source: string): string[] => {
  const handle = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, "") || "candidate";
  const links = [`https://www.linkedin.com/in/${handle}`];
  if (source === "headhunter") links.unshift(`https://hh.uz/resume/${handle}`);
  return links;
};

const seedCandidates = (vacancies: Row[]): Row[] =>
  SEED_CANDIDATES.map((c, idx) => {
    const vac = vacancies.find((v) => v.guid === c.vac)!;
    const stages = vac.stages as Array<{ id: string; name: string }>;
    const recruiterId = String(vac.recruiter_id);
    const recruiterName = String(vac.recruiter_name);
    const outcome = c.outcome ?? "active";
    const isTerminal = outcome !== "active";
    const visited = stages.slice(0, c.stageIdx + 1);

    // Evaluations: one per visited stage, with 0–2 comments depending on score.
    const evaluations = visited.map((stage, i) => {
      const score = c.scores[i] ?? 0;
      const daysAgo = Math.max(0, c.applied - Math.round(((i + 1) * c.applied) / (visited.length + 1)));
      const comments =
        score > 0
          ? [
              {
                id: `cm-${idx}-${i}-1`,
                text: commentFor(score, idx + i),
                author_id: recruiterId,
                author_name: recruiterName,
                created_at: iso(daysAgo, 14),
              },
              ...(i === c.stageIdx && score >= 8
                ? [
                    {
                      id: `cm-${idx}-${i}-2`,
                      text: "Согласен, двигаем дальше.",
                      author_id: String(vac.hiring_manager_id),
                      author_name: String(vac.hiring_manager_name),
                      created_at: iso(Math.max(0, daysAgo - 1), 17),
                    },
                  ]
                : []),
            ]
          : [];
      return { stage_id: stage.id, score: score > 0 ? score : null, comments };
    });

    // History: added → each stage move → optional terminal outcome.
    const history: Row[] = [];
    visited.forEach((stage, i) => {
      const daysAgo = Math.max(0, c.applied - Math.round((i * c.applied) / (visited.length + 1)));
      history.push({
        id: `h-${idx}-${i}`,
        from_stage_id: i === 0 ? null : visited[i - 1].id,
        to_stage_id: stage.id,
        to_outcome: null,
        at: iso(daysAgo),
        by_id: recruiterId,
        by_name: recruiterName,
      });
    });
    if (isTerminal) {
      history.push({
        id: `h-${idx}-out`,
        from_stage_id: visited[visited.length - 1]?.id ?? null,
        to_stage_id: null,
        to_outcome: outcome,
        at: iso(Math.max(0, c.applied - visited.length - 2)),
        by_id: recruiterId,
        by_name: recruiterName,
      });
    }

    const stageChangedDaysAgo = Math.max(0, Math.round(c.applied / (visited.length + 1)));

    return {
      guid: `cand-${idx + 1}`,
      first_name: c.first,
      last_name: c.last,
      photo: null,
      email: `${c.first}.${c.last}@example.com`.toLowerCase(),
      phone: `+9989${String((idx + 10) % 100).padStart(2, "0")}1234567`.slice(0, 13),
      source: [c.source],
      links: buildLinks(c.first, c.last, c.source),
      skills: SKILLS_BY_TAG[String(vac.tag)] ?? [],
      level: c.level,
      salary_expectation: 4_000_000 + (idx % 6) * 1_000_000,
      salary_currency: "UZS",
      applied_date: dateOnly(c.applied),
      resume_url: null,
      notes: idx % 5 === 0 ? "Готов выйти в течение двух недель." : "",
      recruiter_id: recruiterId,
      recruiter_name: recruiterName,
      vacancies_id: c.vac,
      vacancies_id_data: { guid: c.vac, title: vac.title, tag: vac.tag },
      current_stage_id: isTerminal ? null : stages[c.stageIdx]?.id ?? null,
      outcome: [outcome],
      rejection_reason: c.reason ? [c.reason] : null,
      hired_at: outcome === "hired" ? dateOnly(Math.max(0, c.applied - visited.length - 2)) : null,
      stage_changed_at: iso(stageChangedDaysAgo),
      stage_evaluations: evaluations,
      stage_history: history,
      documents: seedDocuments(idx, c.first, c.last, c.stageIdx, recruiterName, c.applied),
      created_at: iso(c.applied),
    };
  });

export const buildSeed = (): MockDbShape => {
  const vacancies = seedVacancies();
  return {
    version: SEED_VERSION,
    stage_templates: seedStageTemplates(),
    vacancies,
    candidates: seedCandidates(vacancies),
  };
};
