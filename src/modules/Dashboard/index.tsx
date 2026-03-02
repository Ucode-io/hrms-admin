import {
  Bell,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  MessageSquareText,
  Plane,
  Plus,
  Sparkles,
} from "lucide-react";
import { observer } from "mobx-react-lite";
import PageMeta from "../../components/common/PageMeta";
import authStore from "../../store/auth.store";
import companyStore from "../../store/company.store";

type Task = {
  id: string;
  title: string;
  description: string;
  time: string;
  type: "task" | "request";
};

type AgendaDay = {
  id: string;
  label: string;
  date: string;
  active?: boolean;
};

const TASKS: Task[] = [
  {
    id: "t1",
    title: "Пройдите welcome-опрос",
    description: "У вас есть невыполненное задание по адаптации",
    time: "1ч",
    type: "task",
  },
  {
    id: "t2",
    title: "Подтвердите обновление профиля",
    description: "Сотрудник ожидает согласование изменений",
    time: "2ч",
    type: "task",
  },
  {
    id: "t3",
    title: "Запрос на аванс",
    description: "MAXMUDXO'JAYEV S. отправил запрос на самообслуживание",
    time: "1ч",
    type: "request",
  },
  {
    id: "t4",
    title: "Запрос на удаленную работу",
    description: "IBROXIMOV F. отправил запрос на самообслуживание",
    time: "3ч",
    type: "request",
  },
  {
    id: "t5",
    title: "Запрос на командировку",
    description: "ISMATULLAYEV R. отправил запрос на самообслуживание",
    time: "1д",
    type: "request",
  },
];

const AGENDA_DAYS: AgendaDay[] = [
  { id: "1", label: "Пн", date: "09", active: true },
  { id: "2", label: "Вт", date: "10" },
  { id: "3", label: "Ср", date: "11" },
  { id: "4", label: "Чт", date: "12" },
  { id: "5", label: "Пт", date: "13" },
  { id: "6", label: "Сб", date: "14" },
  { id: "7", label: "Вс", date: "15" },
];

function DashboardPage() {
  const user = authStore.user;
  const displayName = user?.first_name || user?.login || "Сотрудник";
  const avatar = user?.avatar || "/images/user/owner.jpg";

  return (
    <>
      <PageMeta title="Главная страница" description="Главная страница" />

      <div className="grid gap-4 pb-2 xl:grid-cols-12">
        <aside className="space-y-4 xl:col-span-4 xl:order-2">
          <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
                <CalendarDays size={17} />
              </span>
              <h3 className="text-xl font-semibold text-gray-900">Повестка дня</h3>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="grid grid-cols-7 gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2.5">
                {AGENDA_DAYS.map((day) => (
                  <div
                    key={day.id}
                    className={`rounded-lg px-1 py-2 text-center ${
                      day.active ? "bg-rose-50 text-rose-500" : "bg-white text-gray-700"
                    }`}
                  >
                    <div className="text-[11px] font-medium uppercase opacity-70">{day.label}</div>
                    <div className="mt-1 text-lg font-semibold">{day.date}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <CalendarClock size={14} className="text-gray-500" />
                  Сегодня, Фев. 09, 2026
                </div>
                <p className="mt-1 text-sm text-gray-500">Нет событий</p>
              </div>
            </div>
          </article>

          <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-500">
                  <Plane size={17} />
                </span>
                <h3 className="text-xl font-semibold text-gray-900">Отпуск</h3>
              </div>
              <span className="text-sm text-gray-500">1 из 5</span>
            </div>

            <div className="space-y-4 px-5 py-4">
              <p className="text-3xl font-semibold text-brand-500">
                0.0 <span className="text-base font-medium text-gray-600">доступные дни</span>
              </p>
              <button className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-100">
                Запросить выходной
              </button>
            </div>
          </article>

          <article className="rounded-2xl border border-brand-100 bg-[linear-gradient(140deg,#f5fcff_0%,#ffffff_48%,#e9f8ff_100%)] p-4 shadow-theme-xs">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-brand-100 bg-white text-2xl font-semibold text-brand-500">
                  10
                </span>
                <p className="text-base font-semibold text-gray-900">дней до окончания trial</p>
              </div>
              <button className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
                Подписаться
              </button>
            </div>
          </article>
        </aside>

        <main className="space-y-4 xl:col-span-8 xl:order-1">
          <section
            className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white p-5 sm:p-6"
            style={
              companyStore.company?.company_cover
                ? {
                    backgroundImage: `linear-gradient(95deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.72) 45%, rgba(255,255,255,0.25) 100%), url(${companyStore.company.company_cover})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : undefined
            }
          >
            <div className="absolute -left-20 -top-20 h-44 w-44 rounded-full bg-brand-100/70 blur-2xl" />
            <div className="absolute -bottom-20 right-0 h-44 w-44 rounded-full bg-cyan-100/80 blur-2xl" />

            <div className="relative space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={avatar}
                      alt="user"
                      className="h-11 w-11 rounded-full border-2 border-white object-cover shadow-sm"
                    />
                    <h1 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
                      Добрый день, {String(displayName).toUpperCase()}{" "}
                      <Sparkles className="mb-1 inline-flex text-amber-400" size={20} />
                    </h1>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-theme-xs">
                    <Bell size={14} className="text-brand-500" />
                    Запрос на получение выходного
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
                    <MessageSquareText size={16} />
                    Быстрый опрос
                  </button>
                  <button className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-500 px-3.5 text-sm font-medium text-white transition hover:bg-brand-600">
                    <Plus size={16} />
                    Создать объявление
                  </button>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5">
                  <p className="text-xs text-gray-500">Новые задачи</p>
                  <p className="text-xl font-semibold text-gray-900">7</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5">
                  <p className="text-xs text-gray-500">Запросы на согласование</p>
                  <p className="text-xl font-semibold text-gray-900">3</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5">
                  <p className="text-xs text-gray-500">Новые сотрудники</p>
                  <p className="text-xl font-semibold text-gray-900">1</p>
                </div>
              </div>
            </div>
          </section>

          <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Задачи</h2>
                <p className="text-xs text-gray-500">Ваши актуальные действия на сегодня</p>
              </div>
              <button className="text-sm font-semibold text-brand-500 hover:text-brand-600">Открыть все</button>
            </div>

            <div className="divide-y divide-gray-100">
              {TASKS.map((task) => (
                <div key={task.id} className="flex items-start gap-3 px-5 py-3.5">
                  {task.type === "task" ? (
                    <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
                      <CheckCircle2 size={18} />
                    </span>
                  ) : (
                    <img
                      src={avatar}
                      alt="avatar"
                      className="mt-0.5 h-9 w-9 rounded-full border border-white object-cover shadow-sm"
                    />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">{task.title}</p>
                    <p className="truncate text-sm text-gray-500">
                      {task.description} <span className="font-medium text-gray-400">• {task.time}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </main>
      </div>
    </>
  );
}

export default observer(DashboardPage);
