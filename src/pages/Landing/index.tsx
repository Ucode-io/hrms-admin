import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Database,
  FileSpreadsheet,
  FileText,
  Fingerprint,
  Globe,
  History,
  KeyRound,
  Lock,
  Mail,
  MapPin,
  Menu,
  MessageSquare,
  Quote,
  Rocket,
  Send,
  Server,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Users,
  Wallet,
  X,
} from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import { CountUp, Reveal } from "./Reveal";
import HeroMockup from "./HeroMockup";
import {
  AnalyticsIllustration,
  PayrollIllustration,
  RecruitingIllustration,
  TimeIllustration,
} from "./illustrations";
import "./landing.css";

const NAV_LINKS = [
  { href: "#features", label: "Возможности" },
  { href: "#modules", label: "Модули" },
  { href: "#integrations", label: "Интеграции" },
  { href: "#how", label: "Как это работает" },
  { href: "#faq", label: "FAQ" },
];

const ROTATING_WORDS = ["командой", "наймом", "временем", "зарплатой"];

const MARQUEE_MODULES = [
  "Сотрудники",
  "Рекрутинг",
  "Учёт времени",
  "Зарплата",
  "KPI",
  "Документы",
  "Отчёты",
  "Оргструктура",
  "Активы",
  "База знаний",
  "Согласования",
  "Биометрия",
];

const MARQUEE_PERKS = [
  "Telegram-бот",
  "Биометрия Hikvision",
  "Экспорт в Excel",
  "Производственный календарь",
  "Шаблоны документов",
  "Мобильная версия",
  "Гибкие роли и доступы",
  "Поддержка 24/7",
  "API для интеграций",
  "Импорт сотрудников",
];

const STATS = [
  { value: 40, suffix: " 000+", label: "сотрудников в системе" },
  { value: 500, suffix: "+", label: "компаний доверяют uHR" },
  { value: 99.9, suffix: "%", decimals: 1, label: "время безотказной работы" },
  { value: 3, suffix: " дня", label: "в среднем на внедрение" },
];

const FEATURES = [
  {
    icon: Users,
    title: "Сотрудники и оргструктура",
    text: "Полные профили, история изменений, отделы и дивизионы — вся команда как на ладони в одном окне.",
  },
  {
    icon: Fingerprint,
    title: "Учёт времени и биометрия",
    text: "Табели, смены и отпуска. Интеграция с биометрическими терминалами — отметки фиксируются автоматически.",
  },
  {
    icon: Wallet,
    title: "Зарплата и KPI",
    text: "Расчёт зарплаты, бонусы, удержания и прозрачные KPI. Сотрудники видят, за что и сколько получают.",
  },
  {
    icon: Building2,
    title: "Рекрутинг",
    text: "Вакансии, канбан кандидатов, этапы интервью и источники найма — весь путь кандидата до оффера.",
  },
  {
    icon: FileText,
    title: "Документы и шаблоны",
    text: "Генерация приказов и договоров по шаблонам в пару кликов. Электронный архив вместо бумажных папок.",
  },
  {
    icon: BarChart3,
    title: "Отчёты и аналитика",
    text: "Текучесть, посещаемость, фонд оплаты труда и воронка найма — готовые отчёты для решений на основе данных.",
  },
];

const MODULES = [
  {
    id: "recruiting",
    badge: "Рекрутинг",
    title: "Нанимайте быстрее, чем конкуренты",
    text: "Публикуйте вакансии, ведите кандидатов по этапам и анализируйте источники найма. Канбан-доска показывает всю воронку — от отклика до выхода на работу.",
    bullets: [
      "Канбан-доска кандидатов по этапам",
      "Шаблоны этапов под каждую вакансию",
      "Аналитика источников и сроков закрытия",
    ],
    illustration: RecruitingIllustration,
  },
  {
    id: "time",
    badge: "Учёт времени",
    title: "Каждая минута — под контролем",
    text: "Графики работы, посещаемость с биометрических терминалов, отпуска и больничные с цепочками согласований. Никаких таблиц и споров о переработках.",
    bullets: [
      "Автоматические отметки прихода и ухода",
      "Гибкие графики и производственный календарь",
      "Согласование отпусков в один клик",
    ],
    illustration: TimeIllustration,
  },
  {
    id: "payroll",
    badge: "Зарплата и финансы",
    title: "Зарплата без ошибок и задержек",
    text: "Компенсации, бонусы, удержания и KPI связаны с реальной посещаемостью. Расчётный лист формируется автоматически — прозрачно для компании и сотрудника.",
    bullets: [
      "Расчёт на основе табеля и KPI",
      "Бонусы и удержания с историей",
      "Отчёты по фонду оплаты труда",
    ],
    illustration: PayrollIllustration,
  },
  {
    id: "analytics",
    badge: "Аналитика",
    title: "Решения на основе данных, а не догадок",
    text: "Более 13 готовых отчётов: текучесть, стаж, возрастная структура, посещаемость, воронка найма. Всё обновляется в реальном времени.",
    bullets: [
      "Дашборды по ключевым HR-метрикам",
      "Отчёты по текучести и удержанию",
      "Экспорт данных для руководства",
    ],
    illustration: AnalyticsIllustration,
  },
];

const ORBIT_INNER = [
  { icon: Send, label: "Telegram" },
  { icon: Mail, label: "Email" },
  { icon: Calendar, label: "Календарь" },
  { icon: FileSpreadsheet, label: "Excel" },
];

const ORBIT_OUTER = [
  { icon: Fingerprint, label: "Биометрия" },
  { icon: Database, label: "1С" },
  { icon: Smartphone, label: "Мобильное приложение" },
  { icon: MessageSquare, label: "Чат-бот" },
  { icon: Globe, label: "API" },
  { icon: ShieldCheck, label: "SSO" },
];

const STEPS = [
  {
    icon: Rocket,
    title: "Подключение",
    text: "Регистрируем компанию, импортируем сотрудников из Excel и настраиваем оргструктуру. Обычно это занимает один день.",
  },
  {
    icon: Sparkles,
    title: "Настройка под вас",
    text: "Политики отпусков, графики работы, цепочки согласований и шаблоны документов — всё гибко настраивается без программистов.",
  },
  {
    icon: ShieldCheck,
    title: "Работа в удовольствие",
    text: "Команда пользуется системой каждый день, а вы видите живые метрики и принимаете решения на основе данных.",
  },
];

const TESTIMONIALS = [
  {
    name: "Дилноза К.",
    role: "HR-директор, IT-компания · 250 сотрудников",
    text: "Раньше табели и отпуска жили в пяти разных таблицах. Теперь всё в uHR — согласование отпуска занимает минуту, а не два дня переписки.",
  },
  {
    name: "Бекзод А.",
    role: "CEO, производственная компания",
    text: "Интеграция с биометрией окупила систему за первый квартал: посещаемость выросла, а расчёт зарплаты перестал быть ежемесячным авралом.",
  },
  {
    name: "Мадина Т.",
    role: "Руководитель рекрутинга",
    text: "Воронка кандидатов и аналитика источников — то, чего нам не хватало. Срок закрытия вакансий сократился почти на треть.",
  },
];

const FAQ_ITEMS = [
  {
    q: "Сколько времени занимает внедрение?",
    a: "В среднем 3 дня. Мы импортируем сотрудников из Excel, настраиваем оргструктуру, графики и политики отпусков вместе с вами. Для компаний до 100 человек запуск часто происходит в тот же день.",
  },
  {
    q: "Наши данные в безопасности?",
    a: "Да. Данные передаются по защищённому соединению, доступ разграничен ролями, а каждое действие фиксируется в истории изменений. Регулярные резервные копии исключают потерю информации.",
  },
  {
    q: "Есть ли мобильная версия?",
    a: "Да, uHR адаптирован под смартфоны: сотрудники отмечают посещаемость, подают заявки на отпуск и смотрят расчётные листы прямо с телефона.",
  },
  {
    q: "Можно ли подключить биометрические терминалы?",
    a: "Конечно. uHR из коробки интегрируется с терминалами Hikvision: отметки прихода и ухода попадают в табель автоматически и сразу влияют на расчёт зарплаты.",
  },
  {
    q: "Сколько это стоит?",
    a: "Стоимость зависит от количества сотрудников и выбранных модулей. Первые 14 дней — бесплатно, без привязки карты. Оставьте заявку, и мы подберём тариф под вашу компанию.",
  },
];

function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      setProgress(max > 0 ? el.scrollTop / max : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-gradient-to-r from-[#1858F3] via-[#4f7ef6] to-[#7592ff]"
      style={{ transform: `scaleX(${progress})` }}
    />
  );
}

function Tilt({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(1400px) rotateX(${(-y * 3.5).toFixed(2)}deg) rotateY(${(x * 5).toFixed(2)}deg)`;
  };

  const onLeave = () => {
    const el = ref.current;
    if (el) el.style.transform = "perspective(1400px) rotateX(0deg) rotateY(0deg)";
  };

  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} className="ld-tilt">
      {children}
    </div>
  );
}

function RotatingWord() {
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState<number | null>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const id = setInterval(
      () => setIndex((i) => (i + 1) % ROTATING_WORDS.length),
      2400
    );
    return () => clearInterval(id);
  }, []);

  useLayoutEffect(() => {
    const measure = () => {
      const el = wordRefs.current[index];
      if (el) setWidth(el.offsetWidth);
    };
    measure();
    document.fonts?.ready.then(measure);
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [index]);

  const prev = (index + ROTATING_WORDS.length - 1) % ROTATING_WORDS.length;

  return (
    <span
      className="relative inline-block h-[1.12em] overflow-hidden align-bottom transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
      style={{ width: width ?? "auto" }}
    >
      {ROTATING_WORDS.map((word, i) => (
        <span
          key={word}
          ref={(el) => {
            wordRefs.current[i] = el;
          }}
          aria-hidden={i !== index}
          className={`ld-word absolute bottom-0 left-0 whitespace-nowrap font-bold text-[#1858F3] ${
            i === index
              ? "translate-y-0 opacity-100"
              : i === prev
                ? "-translate-y-[110%] opacity-0"
                : "translate-y-[110%] opacity-0"
          }`}
        >
          {word}
        </span>
      ))}
    </span>
  );
}

function Logo({ size = "md" }: { size?: "md" | "sm" }) {
  const box = size === "md" ? "h-9 w-9 rounded-xl text-base" : "h-8 w-8 rounded-lg text-sm";
  const text = size === "md" ? "text-lg" : "text-base";
  return (
    <span className="flex items-center gap-2.5">
      <span
        className={`flex items-center justify-center bg-[#1858F3] font-bold text-white shadow-lg shadow-blue-600/30 ${box}`}
      >
        u
      </span>
      <span className={`font-bold tracking-tight text-gray-900 ${text}`}>
        uHR
      </span>
    </span>
  );
}

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-gray-100 bg-white/80 shadow-sm backdrop-blur-xl"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href="#top">
          <Logo />
        </a>

        <nav className="hidden items-center gap-7 lg:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-gray-500 transition-colors hover:text-[#1858F3]"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            to="/login"
            className="text-sm font-semibold text-gray-700 transition-colors hover:text-[#1858F3]"
          >
            Войти
          </Link>
          <Link
            to="/login"
            className="ld-btn-shine inline-flex items-center gap-1.5 rounded-xl bg-[#1858F3] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-[#0f3fbe] hover:shadow-blue-600/40"
          >
            Начать бесплатно
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <button
          className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 lg:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Меню"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-gray-100 bg-white px-4 py-4 lg:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                {l.label}
              </a>
            ))}
            <Link
              to="/login"
              className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1858F3] px-4 py-3 text-sm font-semibold text-white"
            >
              Начать бесплатно
              <ArrowRight className="h-4 w-4" />
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pb-28 pt-32 sm:pt-40">
      {/* Background */}
      <div className="ld-grid-bg absolute inset-0" />
      <div className="ld-blob absolute -top-24 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-[#1858F3]/15" />
      <div className="ld-blob absolute right-[-120px] top-64 h-72 w-72 rounded-full bg-[#7592ff]/20 [animation-delay:4s]" />
      <div className="ld-blob absolute left-[-100px] top-96 h-64 w-64 rounded-full bg-[#36bffa]/15 [animation-delay:8s]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/70 px-4 py-1.5 text-sm font-medium text-[#1858F3] shadow-sm backdrop-blur">
              <Sparkles className="h-4 w-4" />
              HR-платформа нового поколения
              <span className="ld-caret font-bold">|</span>
            </span>
          </Reveal>

          <Reveal delay={120}>
            <h1 className="mt-6 text-4xl font-bold leading-[1.12] tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
              Управляйте <RotatingWord />,<br />
              <span className="relative whitespace-nowrap">
                а не таблицами
                <svg
                  viewBox="0 0 300 12"
                  className="absolute -bottom-2 left-0 w-full"
                  preserveAspectRatio="none"
                >
                  <path
                    className="ld-draw"
                    d="M 4 8 Q 150 -2 296 7"
                    stroke="#1858F3"
                    strokeWidth="4"
                    fill="none"
                    strokeLinecap="round"
                    opacity="0.5"
                  />
                </svg>
              </span>
            </h1>
          </Reveal>

          <Reveal delay={240}>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-500 sm:text-xl">
              uHR объединяет кадры, рекрутинг, учёт времени, зарплату и
              аналитику в одной системе. Меньше рутины — больше времени на
              людей.
            </p>
          </Reveal>

          <Reveal delay={360}>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/login"
                className="ld-btn-shine inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1858F3] px-7 py-3.5 text-base font-semibold text-white shadow-xl shadow-blue-600/30 transition-all hover:-translate-y-0.5 hover:bg-[#0f3fbe] sm:w-auto"
              >
                Попробовать бесплатно
                <ArrowRight className="h-5 w-5" />
              </Link>
              <a
                href="#modules"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-7 py-3.5 text-base font-semibold text-gray-700 transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:text-[#1858F3] sm:w-auto"
              >
                Смотреть возможности
              </a>
            </div>
          </Reveal>

          <Reveal delay={460}>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
              {/* Avatar stack */}
              <div className="flex items-center">
                <div className="flex -space-x-2.5">
                  {["АК", "МТ", "БА", "ДР", "ЖС"].map((initials, i) => (
                    <span
                      key={initials}
                      className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white"
                      style={{
                        background: `linear-gradient(135deg, ${
                          ["#1858F3", "#4f7ef6", "#7592ff", "#0ba5ec", "#12b76a"][i]
                        }, ${["#7592ff", "#9cb9ff", "#c2d6ff", "#7cd4fd", "#6ce9a6"][i]})`,
                        zIndex: 5 - i,
                      }}
                    >
                      {initials}
                    </span>
                  ))}
                </div>
                <span className="ml-3 text-sm text-gray-500">
                  500+ команд уже с uHR
                </span>
              </div>

              <span className="hidden h-5 w-px bg-gray-200 sm:block" />

              {/* Rating */}
              <div className="flex items-center gap-1.5">
                <span className="flex">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-4 w-4 fill-amber-400 text-amber-400"
                    />
                  ))}
                </span>
                <span className="text-sm font-semibold text-gray-700">4.9</span>
                <span className="text-sm text-gray-400">— оценка клиентов</span>
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal delay={500} className="relative mt-16 sm:mt-24">
          {/* Rotating decorative ring behind mockup */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2">
            <div className="ld-spin-slow h-[560px] w-[560px] rounded-full border border-dashed border-blue-200/70 sm:h-[720px] sm:w-[720px]" />
          </div>
          <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-72 w-[85%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1858F3]/10 blur-3xl" />

          <Tilt>
            <HeroMockup />
          </Tilt>
        </Reveal>
      </div>
    </section>
  );
}

function MarqueeStrip() {
  const modules = [...MARQUEE_MODULES, ...MARQUEE_MODULES];
  const perks = [...MARQUEE_PERKS, ...MARQUEE_PERKS];

  return (
    <section className="space-y-3 border-y border-blue-100/70 bg-[#f0f5ff] py-6">
      <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
        <div className="ld-marquee gap-3">
          {modules.map((item, i) => (
            <span
              key={i}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#1858F3]" />
              {item}
            </span>
          ))}
        </div>
      </div>
      <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
        <div className="ld-marquee ld-marquee-reverse gap-3">
          {perks.map((item, i) => (
            <span
              key={i}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-blue-100 bg-[#eef3fe] px-4 py-2 text-sm font-medium text-[#1858F3]"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stats() {
  return (
    <section className="relative overflow-hidden py-16 sm:py-20">
      <div className="ld-dots-bg absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_70%_100%_at_50%_50%,black,transparent)]" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 100}>
              <div className="text-center">
                <div className="text-4xl font-bold tracking-tight text-[#1858F3] sm:text-5xl">
                  <CountUp to={s.value} suffix={s.suffix} decimals={s.decimals ?? 0} />
                </div>
                <div className="mt-2 text-sm text-gray-500 sm:text-base">
                  {s.label}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function SectionBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* Gradient base */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#eef3fc_0%,#f8faff_50%,#eef3fc_100%)]" />

      {/* Soft light accents */}
      <div className="absolute -left-48 -top-48 h-[520px] w-[520px] rounded-full bg-[#1858F3]/[0.06] blur-3xl" />
      <div className="absolute -bottom-48 -right-48 h-[520px] w-[520px] rounded-full bg-[#1858F3]/[0.05] blur-3xl" />

      {/* Fine grid */}
      <div className="ld-grid-soft absolute inset-0" />
    </div>
  );
}

function SectionHeading({
  badge,
  title,
  text,
}: {
  badge: string;
  title: string;
  text: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <Reveal>
        <span className="inline-flex items-center rounded-full bg-[#eef3fe] px-4 py-1.5 text-sm font-semibold text-[#1858F3]">
          {badge}
        </span>
      </Reveal>
      <Reveal delay={100}>
        <h2 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          {title}
        </h2>
      </Reveal>
      <Reveal delay={200}>
        <p className="mt-4 text-lg leading-relaxed text-gray-500">{text}</p>
      </Reveal>
    </div>
  );
}

function Features() {
  return (
    <section
      id="features"
      className="relative overflow-hidden border-y border-blue-100/70 py-16 sm:py-24"
    >
      <SectionBackdrop />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="Возможности"
          title="Всё для HR — в одной системе"
          text="Шесть модулей, которые закрывают весь жизненный цикл сотрудника: от отклика на вакансию до выхода на пенсию."
        />

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 120}>
              <div className="ld-card group h-full rounded-2xl border border-gray-100 bg-white p-7">
                <div className="flex items-start justify-between">
                  <div className="ld-card-icon flex h-12 w-12 items-center justify-center rounded-xl bg-[#eef3fe] text-[#1858F3]">
                    <f.icon className="h-6 w-6" />
                  </div>
                  <ArrowUpRight className="ld-card-arrow h-5 w-5 text-[#1858F3]" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-gray-900">
                  {f.title}
                </h3>
                <p className="mt-2 leading-relaxed text-gray-500">{f.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Modules() {
  return (
    <section id="modules" className="py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="Модули"
          title="Посмотрите, как это работает"
          text="Каждый модуль решает конкретную боль HR-отдела и экономит часы рутинной работы каждую неделю."
        />

        <div className="mt-16 space-y-20 sm:space-y-28">
          {MODULES.map((m, i) => {
            const Illustration = m.illustration;
            const reversed = i % 2 === 1;
            return (
              <div
                key={m.id}
                className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${
                  reversed ? "lg:[&>*:first-child]:order-2" : ""
                }`}
              >
                <Reveal>
                  <div>
                    <span className="inline-flex items-center rounded-full bg-[#eef3fe] px-3.5 py-1 text-sm font-semibold text-[#1858F3]">
                      {m.badge}
                    </span>
                    <h3 className="mt-4 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                      {m.title}
                    </h3>
                    <p className="mt-4 text-lg leading-relaxed text-gray-500">
                      {m.text}
                    </p>
                    <ul className="mt-6 space-y-3">
                      {m.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-3">
                          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#1858F3]" />
                          <span className="text-gray-600">{b}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      to="/login"
                      className="mt-7 inline-flex items-center gap-1.5 font-semibold text-[#1858F3] transition-colors hover:text-[#0f3fbe]"
                    >
                      Попробовать модуль
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </div>
                </Reveal>
                <Reveal delay={150}>
                  <div className="ld-conic-frame rounded-3xl p-[1.5px] shadow-[0_16px_48px_-16px_rgba(24,88,243,0.18)]">
                    <div className="rounded-[calc(1.5rem-1.5px)] bg-white p-2">
                      <Illustration />
                    </div>
                  </div>
                </Reveal>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Integrations() {
  return (
    <section
      id="integrations"
      className="relative overflow-hidden border-y border-blue-100/70 py-16 sm:py-24"
    >
      <SectionBackdrop />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-10">
          <Reveal>
            <div>
              <span className="inline-flex items-center rounded-full bg-[#eef3fe] px-4 py-1.5 text-sm font-semibold text-[#1858F3]">
                Интеграции
              </span>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                uHR дружит с вашими инструментами
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-gray-500">
                Биометрические терминалы, Telegram-уведомления, экспорт в
                Excel и открытый API — платформа встраивается в существующие
                процессы, а не ломает их.
              </p>
              <ul className="mt-7 space-y-4">
                {[
                  {
                    icon: Fingerprint,
                    title: "Биометрия Hikvision",
                    text: "Отметки прихода и ухода — автоматически в табель",
                  },
                  {
                    icon: Send,
                    title: "Telegram-уведомления",
                    text: "Согласования и напоминания прямо в мессенджере",
                  },
                  {
                    icon: Globe,
                    title: "Открытый API",
                    text: "Подключайте 1С, бухгалтерию и внутренние системы",
                  },
                ].map((item) => (
                  <li key={item.title} className="flex items-start gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#1858F3] shadow-sm ring-1 ring-gray-100">
                      <item.icon className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="font-semibold text-gray-900">
                        {item.title}
                      </div>
                      <div className="text-sm text-gray-500">{item.text}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          {/* Orbit animation */}
          <Reveal delay={150}>
            <div className="relative mx-auto flex h-[360px] w-[360px] items-center justify-center sm:h-[440px] sm:w-[440px]">
              {/* Rings */}
              <div className="absolute inset-[70px] rounded-full border border-dashed border-blue-200 sm:inset-[90px]" />
              <div className="absolute inset-3 rounded-full border border-dashed border-blue-100 sm:inset-4" />

              {/* Center logo */}
              <div className="ld-radar relative z-10 flex h-20 w-20 items-center justify-center rounded-2xl bg-[#1858F3] text-2xl font-bold text-white shadow-2xl shadow-blue-600/40">
                u
              </div>

              {/* Inner orbit */}
              {ORBIT_INNER.map((item, i) => (
                <div
                  key={item.label}
                  className="ld-orbit-item absolute left-1/2 top-1/2 -ml-6 -mt-6"
                  style={{
                    ["--ld-orbit-r" as string]: "clamp(110px, 26vw, 130px)",
                    ["--ld-orbit-dur" as string]: "22s",
                    ["--ld-orbit-delay" as string]: `${(-22 / ORBIT_INNER.length) * i}s`,
                  }}
                  title={item.label}
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#1858F3] shadow-lg shadow-blue-900/10 ring-1 ring-gray-100">
                    <item.icon className="h-5 w-5" />
                  </span>
                </div>
              ))}

              {/* Outer orbit */}
              {ORBIT_OUTER.map((item, i) => (
                <div
                  key={item.label}
                  className="ld-orbit-item absolute left-1/2 top-1/2 -ml-6 -mt-6"
                  style={{
                    ["--ld-orbit-r" as string]: "clamp(165px, 42vw, 205px)",
                    ["--ld-orbit-dur" as string]: "38s",
                    ["--ld-orbit-delay" as string]: `${(-38 / ORBIT_OUTER.length) * i}s`,
                  }}
                  title={item.label}
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-gray-500 shadow-lg shadow-blue-900/10 ring-1 ring-gray-100">
                    <item.icon className="h-5 w-5" />
                  </span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="relative overflow-hidden py-16 sm:py-24">
      <div className="ld-blob absolute -left-32 top-1/3 h-72 w-72 rounded-full bg-[#1858F3]/10" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="Как это работает"
          title="От регистрации до результата — 3 шага"
          text="Никаких месяцев внедрения и дорогих консультантов. Начните работать уже на этой неделе."
        />

        <div className="relative mt-16 grid gap-10 md:grid-cols-3">
          {/* Connector line */}
          <svg
            className="absolute left-0 right-0 top-10 hidden h-2 w-full md:block"
            preserveAspectRatio="none"
            viewBox="0 0 100 2"
          >
            <line
              className="ld-dash"
              x1="16"
              y1="1"
              x2="84"
              y2="1"
              stroke="#9cb9ff"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* Running pulses along the connector */}
          <span className="ld-run-dot absolute top-10 -mt-[3px] hidden h-2 w-2 rounded-full bg-[#1858F3] shadow-[0_0_10px_rgba(24,88,243,0.8)] md:block" />
          <span
            className="ld-run-dot absolute top-10 -mt-[3px] hidden h-2 w-2 rounded-full bg-[#1858F3] shadow-[0_0_10px_rgba(24,88,243,0.8)] md:block"
            style={{ ["--ld-delay" as string]: "2100ms" }}
          />

          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 150}>
              <div className="relative flex flex-col items-center text-center">
                <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-2xl border border-blue-100 bg-white text-[#1858F3] shadow-lg shadow-blue-600/10">
                  <s.icon className="h-8 w-8" />
                  <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#1858F3] text-xs font-bold text-white">
                    {i + 1}
                  </span>
                </div>
                <h3 className="mt-6 text-xl font-semibold text-gray-900">
                  {s.title}
                </h3>
                <p className="mt-3 leading-relaxed text-gray-500">{s.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const SECURITY_POINTS = [
  {
    icon: KeyRound,
    title: "Роли и права доступа",
    text: "Каждый видит только то, что положено: гибкая настройка ролей до отдельного поля.",
  },
  {
    icon: History,
    title: "Журнал всех действий",
    text: "Кто, что и когда изменил — полная история по каждому сотруднику и документу.",
  },
  {
    icon: Server,
    title: "Резервное копирование",
    text: "Автоматические бэкапы и отказоустойчивая инфраструктура с аптаймом 99.9%.",
  },
  {
    icon: Lock,
    title: "Шифрование данных",
    text: "Персональные данные передаются и хранятся в зашифрованном виде.",
  },
];

const SECURITY_LOG = [
  { time: "09:02", text: "Сотрудник отметился на входе", ok: true },
  { time: "09:15", text: "Отпуск согласован руководителем", ok: true },
  { time: "10:00", text: "Сформированы расчётные листы", ok: true },
  { time: "11:24", text: "Попытка входа заблокирована", ok: false },
];

function Security() {
  return (
    <section id="security" className="py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-blue-100 bg-[linear-gradient(160deg,#f3f7ff_0%,#e9f0ff_100%)] px-6 py-12 sm:px-12 sm:py-16">
            {/* Backdrop details */}
            <div
              aria-hidden
              className="ld-dots-bg pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_70%_80%_at_70%_30%,black_20%,transparent_80%)]"
            />
            <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full border border-blue-200/50" />
            <div className="pointer-events-none absolute -right-14 -top-14 h-60 w-60 rounded-full border border-blue-200/40" />

            <div className="relative grid items-center gap-14 lg:grid-cols-2 lg:gap-16">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-[#1858F3]/10 px-4 py-1.5 text-sm font-semibold text-[#1858F3]">
                  <ShieldCheck className="h-4 w-4" />
                  Безопасность
                </span>
                <h2 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                  Данные сотрудников под надёжной защитой
                </h2>
                <p className="mt-4 text-lg leading-relaxed text-gray-500">
                  Кадровые данные — самое чувствительное, что есть у компании.
                  Поэтому безопасность в uHR не опция, а фундамент архитектуры.
                </p>

                <div className="mt-8 grid gap-6 sm:grid-cols-2">
                  {SECURITY_POINTS.map((p) => (
                    <div key={p.title} className="flex items-start gap-3.5">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#1858F3] shadow-sm ring-1 ring-blue-100">
                        <p.icon className="h-5 w-5" />
                      </span>
                      <div>
                        <div className="font-semibold text-gray-900">
                          {p.title}
                        </div>
                        <div className="mt-1 text-sm leading-relaxed text-gray-500">
                          {p.text}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative mx-auto flex h-[440px] w-full max-w-md flex-col items-center sm:h-[480px]">
                {/* Shield with radar rings */}
                <div className="relative mt-6 flex h-52 w-52 items-center justify-center">
                  <div className="ld-radar absolute inset-6 rounded-full" />
                  <div className="absolute inset-0 rounded-full border border-blue-200/60" />
                  <div className="absolute inset-6 rounded-full border border-blue-100 bg-white shadow-[0_16px_40px_-12px_rgba(24,88,243,0.25)]" />
                  <ShieldCheck
                    className="relative h-20 w-20 text-[#1858F3]"
                    strokeWidth={1.5}
                  />
                  {/* Scanning beam */}
                  <div className="ld-scan absolute inset-x-10 h-px bg-gradient-to-r from-transparent via-[#1858F3]/70 to-transparent" />
                </div>

                {/* Floating chips */}
                <div className="ld-float absolute left-0 top-16 flex items-center gap-2 rounded-full border border-blue-100 bg-white px-3.5 py-2 text-xs font-medium text-gray-700 shadow-md shadow-blue-900/5 sm:left-4">
                  <Lock className="h-3.5 w-3.5 text-[#1858F3]" />
                  AES-256
                </div>
                <div className="ld-float-slow absolute right-0 top-60 flex items-center gap-2 rounded-full border border-blue-100 bg-white px-3.5 py-2 text-xs font-medium text-gray-700 shadow-md shadow-blue-900/5 sm:right-4">
                  <Fingerprint className="h-3.5 w-3.5 text-[#1858F3]" />
                  Двухфакторная защита
                </div>

                {/* Live event log */}
                <div className="absolute bottom-0 w-full max-w-sm rounded-2xl border border-blue-100 bg-white p-5 shadow-[0_20px_50px_-20px_rgba(24,88,243,0.25)]">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900">
                      Журнал событий
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-emerald-600">
                      <span className="ld-pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-500 text-emerald-500" />
                      в реальном времени
                    </span>
                  </div>
                  <div className="space-y-3">
                    {SECURITY_LOG.map((row, i) => (
                      <div
                        key={row.text}
                        className="ld-log-row flex items-center gap-3 text-sm"
                        style={{ ["--ld-delay" as string]: `${i * 1600}ms` }}
                      >
                        <span className="font-mono text-xs text-gray-400">
                          {row.time}
                        </span>
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            row.ok ? "bg-emerald-500" : "bg-red-400"
                          }`}
                        />
                        <span className="text-gray-600">{row.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section
      id="reviews"
      className="relative overflow-hidden border-y border-blue-100/70 py-16 sm:py-24"
    >
      <SectionBackdrop />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="Отзывы"
          title="Нас рекомендуют коллегам"
          text="HR-команды по всей стране экономят время с uHR — вот что они говорят."
        />

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={t.name} delay={i * 130}>
              <figure className="ld-card flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-7">
                <div className="flex items-center justify-between">
                  <Quote className="h-8 w-8 text-[#c2d6ff]" />
                  <span className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star
                        key={j}
                        className="h-4 w-4 fill-amber-400 text-amber-400"
                      />
                    ))}
                  </span>
                </div>
                <blockquote className="mt-4 flex-1 leading-relaxed text-gray-600">
                  {t.text}
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3 border-t border-gray-100 pt-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#1858F3] to-[#7592ff] text-sm font-bold text-white">
                    {t.name[0]}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      {t.name}
                    </div>
                    <div className="text-xs text-gray-400">{t.role}</div>
                  </div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="FAQ"
          title="Частые вопросы"
          text="Не нашли ответ? Напишите нам — отвечаем в течение рабочего дня."
        />

        <div className="mt-12 space-y-3">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <Reveal key={item.q} delay={i * 80}>
                <div
                  className={`overflow-hidden rounded-2xl border transition-colors duration-300 ${
                    isOpen
                      ? "border-blue-200 bg-[#f7f9ff]"
                      : "border-gray-100 bg-white hover:border-blue-100"
                  }`}
                >
                  <button
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    aria-expanded={isOpen}
                  >
                    <span className="font-semibold text-gray-900">
                      {item.q}
                    </span>
                    <span
                      className={`ld-acc-chevron flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        isOpen
                          ? "is-open bg-[#1858F3] text-white"
                          : "bg-gray-50 text-gray-400"
                      }`}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </span>
                  </button>
                  <div className={`ld-acc-body ${isOpen ? "is-open" : ""}`}>
                    <div className="ld-acc-inner">
                      <p className="px-6 pb-6 leading-relaxed text-gray-500">
                        {item.a}
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section className="px-4 pb-20 sm:px-6 sm:pb-28 lg:px-8">
      <Reveal>
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-[#1858F3] px-6 py-16 text-center sm:px-16 sm:py-20">
          {/* Decorative rings */}
          <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full border border-white/15" />
          <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full border border-white/15" />
          <div className="pointer-events-none absolute -bottom-32 -right-20 h-80 w-80 rounded-full border border-white/15" />
          <div className="ld-blob pointer-events-none absolute right-10 top-0 h-48 w-48 rounded-full bg-white/10" />

          <h2 className="relative text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Готовы навести порядок в HR?
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-lg text-blue-100">
            Присоединяйтесь к компаниям, которые уже перевели кадровые процессы
            на uHR. Первые 14 дней — бесплатно.
          </p>
          <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/login"
              className="ld-btn-shine inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-7 py-3.5 text-base font-semibold text-[#1858F3] shadow-xl transition-all hover:-translate-y-0.5 sm:w-auto"
            >
              Начать бесплатно
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              to="/login"
              className="inline-flex w-full items-center justify-center rounded-xl border border-white/40 px-7 py-3.5 text-base font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-white/10 sm:w-auto"
            >
              Запросить демо
            </Link>
          </div>
          <p className="relative mt-5 text-sm text-blue-200">
            Без привязки карты · Отмена в любой момент · Поддержка на русском и
            узбекском
          </p>
        </div>
      </Reveal>
    </section>
  );
}

const FOOTER_COLS = [
  {
    title: "Продукт",
    links: [
      { label: "Возможности", href: "#features" },
      { label: "Модули", href: "#modules" },
      { label: "Интеграции", href: "#integrations" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Компания",
    links: [
      { label: "Отзывы", href: "#reviews" },
      { label: "Как это работает", href: "#how" },
      { label: "Войти", href: "/login", isRoute: true },
    ],
  },
];

function Footer() {
  return (
    <footer className="border-t border-blue-100/70 bg-[#f0f5ff]">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div>
            <Logo size="sm" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-gray-500">
              HR-платформа, которая объединяет кадры, рекрутинг, учёт времени,
              зарплату и аналитику в одной системе.
            </p>
            <div className="mt-5 flex gap-2">
              {[Send, Mail, Globe].map((Icon, i) => (
                <a
                  key={i}
                  href="#top"
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-gray-400 ring-1 ring-gray-100 transition-colors hover:text-[#1858F3] hover:ring-blue-200"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {FOOTER_COLS.map((col) => (
            <div key={col.title}>
              <div className="text-sm font-semibold uppercase tracking-wide text-gray-900">
                {col.title}
              </div>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) =>
                  l.isRoute ? (
                    <li key={l.label}>
                      <Link
                        to={l.href}
                        className="text-sm text-gray-500 transition-colors hover:text-[#1858F3]"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ) : (
                    <li key={l.label}>
                      <a
                        href={l.href}
                        className="text-sm text-gray-500 transition-colors hover:text-[#1858F3]"
                      >
                        {l.label}
                      </a>
                    </li>
                  )
                )}
              </ul>
            </div>
          ))}

          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-gray-900">
              Контакты
            </div>
            <ul className="mt-4 space-y-2.5 text-sm text-gray-500">
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-[#1858F3]" />
                hello@uhr.uz
              </li>
              <li className="flex items-center gap-2.5">
                <Send className="h-4 w-4 text-[#1858F3]" />
                @uhr_support
              </li>
              <li className="flex items-center gap-2.5">
                <MapPin className="h-4 w-4 text-[#1858F3]" />
                Ташкент, Узбекистан
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-gray-200/70 pt-6 sm:flex-row">
          <div className="text-sm text-gray-400">
            © {new Date().getFullYear()} uHR. Все права защищены.
          </div>
          <div className="text-sm text-gray-400">
            Система управления персоналом для бизнеса
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <>
      <PageMeta
        title="uHR — HR-платформа для управления командой"
        description="Кадры, рекрутинг, учёт времени, зарплата и аналитика — в одной системе. Внедрение за 3 дня."
      />
      <div className="landing min-h-screen bg-white text-gray-900 antialiased">
        <ScrollProgress />
        <Navbar />
        <main>
          <Hero />
          <MarqueeStrip />
          <Stats />
          <Features />
          <Modules />
          <Integrations />
          <HowItWorks />
          <Security />
          <Testimonials />
          <Faq />
          <CtaSection />
        </main>
        <Footer />
      </div>
    </>
  );
}
