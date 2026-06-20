// Demo seed for the Knowledge Base mock store.
//
// The module is a single article tree: one root article + nested sub-articles.
// Rows use a snake_case shape close to the future items API. Bump SEED_VERSION
// whenever the row shape changes — stale localStorage data is then reseeded.

export const SEED_VERSION = 3;

export type Row = Record<string, unknown>;

export interface MockDbShape {
  version: number;
  articles: Row[];
}

const iso = (daysAgo: number, hour = 10): string => {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
};

const AUTHOR = "Зафар Хамидуллаев";

// ───── Block helpers (BlockNote PartialBlock JSON) ─────

const heading = (text: string, level: 1 | 2 | 3 = 2): Row => ({
  type: "heading",
  props: { level },
  content: text,
});
const paragraph = (text: string): Row => ({ type: "paragraph", content: text });
const bullet = (text: string): Row => ({ type: "bulletListItem", content: text });
const check = (text: string, checked = false): Row => ({
  type: "checkListItem",
  props: { checked },
  content: text,
});
/** Reference to a child article — rendered as a clickable "sub-page" card. */
const pageLink = (articleId: string): Row => ({ type: "pageLink", props: { articleId } });

// ───── Articles (single tree by parent_id) ─────

const ARTICLES: Row[] = [
  // ── Root ──
  {
    guid: "art-root",
    parent_id: null,
    title: "База знаний компании",
    icon: "🏠",
    author: AUTHOR,
    created_at: iso(120),
    updated_at: iso(1),
    content: [
      paragraph(
        "Это внутренняя база знаний. Создавайте страницы и вкладывайте их друг в друга — нажмите «/» и выберите «Подстатья», либо «+» рядом со страницей в дереве слева."
      ),
      heading("Разделы", 2),
      pageLink("art-onboarding"),
      pageLink("art-hr"),
      pageLink("art-eng"),
    ],
  },

  // ── Онбординг ──
  {
    guid: "art-onboarding",
    parent_id: "art-root",
    title: "Онбординг",
    icon: "🚀",
    author: AUTHOR,
    created_at: iso(118),
    updated_at: iso(5),
    content: [
      paragraph("Всё для новых сотрудников: первые дни, доступы, регламенты."),
      pageLink("art-welcome"),
      pageLink("art-first-day"),
      pageLink("art-access"),
    ],
  },
  {
    guid: "art-welcome",
    parent_id: "art-onboarding",
    title: "Добро пожаловать в команду",
    icon: "👋",
    author: AUTHOR,
    created_at: iso(118),
    updated_at: iso(5),
    content: [
      paragraph(
        "Мы рады видеть тебя в команде! Этот раздел поможет быстро освоиться в первые недели."
      ),
      heading("Первые шаги", 2),
      check("Получить рабочий ноутбук и доступы", true),
      check("Настроить корпоративную почту", true),
      check("Познакомиться с командой", false),
      check("Прочитать регламенты ниже", false),
    ],
  },
  {
    guid: "art-first-day",
    parent_id: "art-onboarding",
    title: "Первый день",
    icon: "📅",
    author: AUTHOR,
    created_at: iso(118),
    updated_at: iso(10),
    content: [
      paragraph("План на первый рабочий день, чтобы ничего не упустить."),
      bullet("09:30 — встреча с HR, оформление документов"),
      bullet("11:00 — знакомство с командой и наставником"),
      bullet("14:00 — настройка рабочего окружения"),
      bullet("16:00 — обзор текущих задач"),
      heading("Что подготовить заранее", 2),
      check("Паспорт и ИНН для оформления", false),
      check("Реквизиты карты для зарплаты", false),
    ],
  },
  {
    guid: "art-access",
    parent_id: "art-onboarding",
    title: "Доступы и аккаунты",
    icon: "🔐",
    author: AUTHOR,
    created_at: iso(117),
    updated_at: iso(12),
    content: [
      paragraph("Список сервисов, к которым нужно получить доступ в первый день."),
      bullet("Корпоративная почта"),
      bullet("Slack / Telegram рабочие каналы"),
      bullet("Jira и Confluence"),
      bullet("Доступ в репозитории GitLab"),
      heading("Вложенная инструкция", 2),
      pageLink("art-vpn"),
    ],
  },
  {
    guid: "art-vpn",
    parent_id: "art-access",
    title: "Настройка VPN",
    icon: "🛡️",
    author: AUTHOR,
    created_at: iso(116),
    updated_at: iso(15),
    content: [
      paragraph("Пошаговая инструкция по подключению к корпоративному VPN."),
      bullet("Установи клиент WireGuard"),
      bullet("Запроси конфиг у IT-отдела"),
      bullet("Импортируй конфиг и подключись"),
    ],
  },

  // ── HR и кадры ──
  {
    guid: "art-hr",
    parent_id: "art-root",
    title: "HR и кадры",
    icon: "🧑‍💼",
    author: AUTHOR,
    created_at: iso(110),
    updated_at: iso(3),
    content: [
      paragraph("Отпуска, больничные, политика компании и льготы."),
      pageLink("art-vacation"),
      pageLink("art-benefits"),
    ],
  },
  {
    guid: "art-vacation",
    parent_id: "art-hr",
    title: "Как оформить отпуск",
    icon: "🏖️",
    author: AUTHOR,
    created_at: iso(80),
    updated_at: iso(3),
    content: [
      paragraph("Отпуск оформляется минимум за две недели до начала."),
      heading("Шаги", 2),
      bullet("Согласуй даты с руководителем"),
      bullet("Создай заявку в HRMS"),
      bullet("Дождись подтверждения от HR"),
      heading("Подробнее", 2),
      pageLink("art-vacation-types"),
    ],
  },
  {
    guid: "art-vacation-types",
    parent_id: "art-vacation",
    title: "Виды отпусков",
    icon: "📋",
    author: AUTHOR,
    created_at: iso(79),
    updated_at: iso(20),
    content: [
      bullet("Ежегодный оплачиваемый — 24 дня"),
      bullet("Без сохранения зарплаты — по согласованию"),
      bullet("Учебный отпуск — при наличии справки"),
    ],
  },
  {
    guid: "art-benefits",
    parent_id: "art-hr",
    title: "Льготы и бонусы",
    icon: "🎁",
    author: AUTHOR,
    created_at: iso(70),
    updated_at: iso(8),
    content: [
      bullet("ДМС со стоматологией"),
      bullet("Компенсация спорта"),
      bullet("Обучение за счёт компании"),
      bullet("Гибкий график"),
    ],
  },

  // ── Инженерия ──
  {
    guid: "art-eng",
    parent_id: "art-root",
    title: "Инженерия",
    icon: "💻",
    author: AUTHOR,
    created_at: iso(90),
    updated_at: iso(2),
    content: [
      paragraph("Гайды по разработке, окружение, code review, релизы."),
      pageLink("art-dev-setup"),
      pageLink("art-code-review"),
    ],
  },
  {
    guid: "art-dev-setup",
    parent_id: "art-eng",
    title: "Настройка окружения разработчика",
    icon: "⚙️",
    author: AUTHOR,
    created_at: iso(50),
    updated_at: iso(2),
    content: [
      paragraph("Минимальный набор инструментов для старта разработки."),
      bullet("Node.js LTS + nvm"),
      bullet("Docker и docker-compose"),
      bullet("VS Code с рекомендованными расширениями"),
    ],
  },
  {
    guid: "art-code-review",
    parent_id: "art-eng",
    title: "Регламент code review",
    icon: "🔍",
    author: AUTHOR,
    created_at: iso(48),
    updated_at: iso(6),
    content: [
      check("PR небольшой и сфокусированный", false),
      check("Есть описание и ссылка на задачу", false),
      check("Прошли линтер и тесты", false),
      check("Минимум один аппрув", false),
    ],
  },
];

export const buildSeed = (): MockDbShape => ({
  version: SEED_VERSION,
  articles: ARTICLES.map((a) => ({ ...a })),
});
