import { observer } from "mobx-react-lite";
import { Link } from "react-router";
import {
  BarChart3,
  CalendarCheck,
  CalendarDays,
  Clock3,
  Dumbbell,
  LineChart,
  PieChart,
  UserMinus,
} from "lucide-react";
import PageMeta from "../../components/common/PageMeta";

function ReportsHomePage() {
  return (
    <>
      <PageMeta title="Отчеты | HRMS" description="Обзор модулей отчетности" />

      <div className="space-y-4">
        <section className="rounded-2xl border border-gray-200 bg-white px-5 py-4">
          <h1 className="text-2xl font-semibold text-gray-900">Отчеты</h1>
          <p className="mt-1 text-sm text-gray-500">Выберите модуль отчетности</p>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Link
            to="/reports/age-distribution"
            className="group rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-sm"
          >
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
              <BarChart3 size={20} />
            </div>
            <h2 className="mt-3 text-lg font-semibold text-gray-900 group-hover:text-brand-500">
              Возрастное распределение
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Динамика возрастных групп, birthdays по месяцам и аналитика по отделам.
            </p>
          </Link>

          <Link
            to="/reports/gender-distribution"
            className="group rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-sm"
          >
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
              <PieChart size={20} />
            </div>
            <h2 className="mt-3 text-lg font-semibold text-gray-900 group-hover:text-brand-500">
              Гендерное распределение
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Соотношение по полу и детализация сотрудников с пагинацией.
            </p>
          </Link>

          <Link
            to="/reports/staff-count"
            className="group rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-sm"
          >
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
              <LineChart size={20} />
            </div>
            <h2 className="mt-3 text-lg font-semibold text-gray-900 group-hover:text-brand-500">
              Численность персонала
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Прирост и текучесть по месяцам, срезы по подразделениям и локациям.
            </p>
          </Link>

          <Link
            to="/reports/staff-turnover"
            className="group rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-sm"
          >
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
              <UserMinus size={20} />
            </div>
            <h2 className="mt-3 text-lg font-semibold text-gray-900 group-hover:text-brand-500">
              Текучесть сотрудников
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Аналитика увольнений по месяцам, причинам и типам с детальной таблицей.
            </p>
          </Link>

          <Link
            to="/reports/tenure"
            className="group rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-sm"
          >
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
              <Clock3 size={20} />
            </div>
            <h2 className="mt-3 text-lg font-semibold text-gray-900 group-hover:text-brand-500">
              Стаж
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Средний срок работы сотрудников, годовщины и распределение по командам.
            </p>
          </Link>

          <Link
            to="/reports/absence-balance"
            className="group rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-sm"
          >
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
              <CalendarDays size={20} />
            </div>
            <h2 className="mt-3 text-lg font-semibold text-gray-900 group-hover:text-brand-500">
              Остаточный баланс выходных
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Текущие остатки по типам отсутствий с детализацией по сотрудникам.
            </p>
          </Link>

          <Link
            to="/reports/attendance"
            className="group rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-sm"
          >
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
              <CalendarCheck size={20} />
            </div>
            <h2 className="mt-3 text-lg font-semibold text-gray-900 group-hover:text-brand-500">
              Посещаемость
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Рабочие дни, опоздания и отсутствия сотрудников за выбранный месяц.
            </p>
          </Link>

          <Link
            to="/reports/sport-attendance"
            className="group rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-sm"
          >
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
              <Dumbbell size={20} />
            </div>
            <h2 className="mt-3 text-lg font-semibold text-gray-900 group-hover:text-brand-500">
              Посещение спорта
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Количество спортивных посещений по сотрудникам за выбранный месяц.
            </p>
          </Link>
        </section>
      </div>
    </>
  );
}

export default observer(ReportsHomePage);
