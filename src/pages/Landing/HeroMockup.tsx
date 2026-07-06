import {
  BarChart3,
  Bell,
  CalendarClock,
  CheckCircle2,
  FileText,
  LayoutDashboard,
  Search,
  Settings,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";

const CHART_BARS = [42, 58, 36, 72, 54, 88, 64, 96, 70, 82, 60, 90];

const SIDEBAR_ITEMS = [
  { icon: LayoutDashboard, active: true },
  { icon: Users, active: false },
  { icon: CalendarClock, active: false },
  { icon: Wallet, active: false },
  { icon: BarChart3, active: false },
  { icon: FileText, active: false },
  { icon: Settings, active: false },
];

export default function HeroMockup() {
  return (
    <div className="relative mx-auto w-full max-w-5xl">
      {/* Main dashboard window */}
      <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_24px_80px_-24px_rgba(24,88,243,0.25)]">
        {/* Browser bar */}
        <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/80 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <div className="mx-auto flex h-6 w-64 max-w-[50%] items-center justify-center gap-1.5 rounded-md bg-white text-[10px] text-gray-400 ring-1 ring-gray-200">
            <Search className="h-2.5 w-2.5" />
            app.uhr.uz/dashboard
          </div>
        </div>

        <div className="flex">
          {/* Sidebar */}
          <div className="hidden w-14 flex-col items-center gap-1.5 border-r border-gray-100 py-4 sm:flex">
            <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-[#1858F3] text-[11px] font-bold text-white">
              u
            </div>
            {SIDEBAR_ITEMS.map(({ icon: Icon, active }, i) => (
              <div
                key={i}
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  active
                    ? "bg-[#eef3fe] text-[#1858F3]"
                    : "text-gray-300"
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 p-4 sm:p-6">
            {/* Header row */}
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="h-2 w-20 rounded-full bg-gray-100" />
                <div className="mt-2 text-sm font-semibold text-gray-800 sm:text-base">
                  Добрый день, Азиза 👋
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-50 text-gray-400 ring-1 ring-gray-100">
                  <Bell className="h-3.5 w-3.5" />
                </div>
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#1858F3] to-[#7592ff]" />
              </div>
            </div>

            {/* Stat cards */}
            <div className="mb-5 grid grid-cols-3 gap-3">
              {[
                { label: "Сотрудники", value: "248", trend: "+12" },
                { label: "На работе", value: "231", trend: "93%" },
                { label: "Вакансии", value: "14", trend: "+3" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border border-gray-100 bg-white p-3"
                >
                  <div className="text-[10px] text-gray-400 sm:text-xs">
                    {s.label}
                  </div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-base font-bold text-gray-900 sm:text-xl">
                      {s.value}
                    </span>
                    <span className="flex items-center text-[9px] font-medium text-emerald-500 sm:text-[10px]">
                      <TrendingUp className="mr-0.5 h-2.5 w-2.5" />
                      {s.trend}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Chart */}
            <div className="rounded-xl border border-gray-100 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">
                  Посещаемость за год
                </span>
                <span className="rounded-md bg-[#eef3fe] px-2 py-0.5 text-[10px] font-medium text-[#1858F3]">
                  2026
                </span>
              </div>
              <svg viewBox="0 0 480 140" className="h-24 w-full sm:h-32">
                {CHART_BARS.map((h, i) => (
                  <rect
                    key={i}
                    className="ld-bar"
                    style={{ ["--ld-bar-delay" as string]: `${i * 90}ms` }}
                    x={i * 40 + 10}
                    y={140 - h * 1.35}
                    width={22}
                    height={h * 1.35}
                    rx={5}
                    fill={i === 7 ? "#1858F3" : "#dbe5fd"}
                  />
                ))}
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Floating card — new candidate */}
      <div className="ld-float absolute -left-6 top-16 hidden w-52 rounded-2xl border border-gray-100 bg-white p-4 shadow-xl shadow-blue-900/10 md:block lg:-left-16">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eef3fe] text-[#1858F3]">
            <UserPlus className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-800">
              Новый кандидат
            </div>
            <div className="text-[11px] text-gray-400">Frontend-разработчик</div>
          </div>
        </div>
        <div className="mt-3 flex gap-1.5">
          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
            Интервью
          </span>
          <span className="rounded-md bg-gray-50 px-2 py-0.5 text-[10px] text-gray-400">
            5 лет опыта
          </span>
        </div>
      </div>

      {/* Floating card — approval */}
      <div className="ld-float-fast absolute -right-4 top-8 hidden w-56 rounded-2xl border border-gray-100 bg-white p-4 shadow-xl shadow-blue-900/10 md:block lg:-right-14">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-800">
              Отпуск согласован
            </div>
            <div className="text-[11px] text-gray-400">
              12–19 августа · 7 дней
            </div>
          </div>
        </div>
      </div>

      {/* Floating card — KPI ring */}
      <div className="ld-float-slow absolute -bottom-8 -right-2 hidden w-44 rounded-2xl border border-gray-100 bg-white p-4 shadow-xl shadow-blue-900/10 md:block lg:-right-10">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 64 64" className="h-14 w-14 -rotate-90">
            <circle
              cx="32"
              cy="32"
              r="28"
              fill="none"
              stroke="#eef3fe"
              strokeWidth="7"
            />
            <circle
              className="ld-ring"
              cx="32"
              cy="32"
              r="28"
              fill="none"
              stroke="#1858F3"
              strokeWidth="7"
              strokeLinecap="round"
            />
          </svg>
          <div>
            <div className="text-lg font-bold text-gray-900">87%</div>
            <div className="text-[11px] leading-tight text-gray-400">
              KPI команды
            </div>
          </div>
        </div>
      </div>

      {/* Floating chip — clock-in */}
      <div className="ld-float absolute -bottom-5 left-8 hidden items-center gap-2 rounded-full border border-gray-100 bg-white py-2 pl-3 pr-4 shadow-lg shadow-blue-900/10 md:flex lg:left-0">
        <span className="ld-pulse-dot h-2 w-2 rounded-full bg-emerald-500 text-emerald-500" />
        <span className="text-xs font-medium text-gray-700">
          231 сотрудник на месте
        </span>
      </div>
    </div>
  );
}
