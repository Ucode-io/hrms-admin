import { useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import { Link } from "react-router";
import { Cake, Gift } from "lucide-react";
import PageMeta from "../../../components/common/PageMeta";
import Spinner from "../../../components/ui/Spinner";
import companyStore from "../../../store/company.store";
import {
  type BirthdayEmployee,
  type BirthdaysMonthGroup,
  useBirthdaysReportQuery,
} from "../../../api/services/reports.service";
import { translate, useTranslation } from "../../../i18n";

const MONTH_KEYS = [
  "reports.birthdays.month_january",
  "reports.birthdays.month_february",
  "reports.birthdays.month_march",
  "reports.birthdays.month_april",
  "reports.birthdays.month_may",
  "reports.birthdays.month_june",
  "reports.birthdays.month_july",
  "reports.birthdays.month_august",
  "reports.birthdays.month_september",
  "reports.birthdays.month_october",
  "reports.birthdays.month_november",
  "reports.birthdays.month_december",
] as const;

const MONTH_SHORT_KEYS = [
  "reports.birthdays.month_short_january",
  "reports.birthdays.month_short_february",
  "reports.birthdays.month_short_march",
  "reports.birthdays.month_short_april",
  "reports.birthdays.month_short_may",
  "reports.birthdays.month_short_june",
  "reports.birthdays.month_short_july",
  "reports.birthdays.month_short_august",
  "reports.birthdays.month_short_september",
  "reports.birthdays.month_short_october",
  "reports.birthdays.month_short_november",
  "reports.birthdays.month_short_december",
] as const;

// ponytail: translate() — these run outside components too; it re-reads the locale per call.
const monthName = (index: number) => (MONTH_KEYS[index] ? translate(MONTH_KEYS[index]) : "");
const monthShortName = (index: number) =>
  MONTH_SHORT_KEYS[index] ? translate(MONTH_SHORT_KEYS[index]) : "";

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return translate("reports.common.load_error");
};

const getInitials = (fullName: string): string => {
  const parts = fullName
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
};

const getTurningAgeText = (value: number | null): string => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "";
  }
  return translate("reports.birthdays.turning_age", { age: value });
};

const pluralizeDays = (days: number): string => {
  const mod100 = days % 100;
  const mod10 = days % 10;
  if (mod100 >= 11 && mod100 <= 14) return translate("reports.birthdays.days_plural");
  if (mod10 === 1) return translate("reports.birthdays.day_singular");
  if (mod10 >= 2 && mod10 <= 4) return translate("reports.birthdays.days_few");
  return translate("reports.birthdays.days_plural");
};

const getDaysUntilLabel = (days: number | null): string => {
  if (typeof days !== "number" || !Number.isFinite(days)) return "";
  if (days === 0) return translate("reports.birthdays.today");
  if (days === 1) return translate("reports.birthdays.tomorrow");
  return translate("reports.birthdays.in_days", { days, unit: pluralizeDays(days) });
};

function UpcomingRow({ employee }: { employee: BirthdayEmployee }) {
  const isToday = employee.is_today;
  return (
    <li
      className="flex items-center gap-3 px-4 py-2.5"
      style={isToday ? { backgroundColor: "rgba(41,128,185,0.05)" } : undefined}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-600">
        {employee.photo ? (
          <img
            src={employee.photo}
            alt={employee.full_name}
            className="h-9 w-9 rounded-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          getInitials(employee.full_name)
        )}
      </span>

      <span className="min-w-0 flex-1">
        <Link
          to={`/employees/${employee.guid}`}
          className="block truncate text-sm font-semibold text-gray-800 transition hover:text-brand-500"
        >
          {employee.full_name}
        </Link>
        <span className="block truncate text-xs text-gray-500">
          {employee.birth_day} {monthShortName(employee.birth_month - 1)}
          {getTurningAgeText(employee.turning_age)
            ? ` · ${getTurningAgeText(employee.turning_age)}`
            : ""}
        </span>
      </span>

      <span
        className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold"
        style={{
          backgroundColor: isToday ? "#2980B9" : "#f1f5f9",
          color: isToday ? "#ffffff" : "#475569",
        }}
      >
        {getDaysUntilLabel(employee.days_until)}
      </span>
    </li>
  );
}

function EmployeeRow({ employee }: { employee: BirthdayEmployee }) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-600">
        {employee.photo ? (
          <img
            src={employee.photo}
            alt={employee.full_name}
            className="h-9 w-9 rounded-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          getInitials(employee.full_name)
        )}
      </span>

      <span className="min-w-0 flex-1">
        <Link
          to={`/employees/${employee.guid}`}
          className="block truncate text-sm font-semibold text-gray-800 transition hover:text-brand-500"
        >
          {employee.full_name}
        </Link>
        <span className="block truncate text-xs text-gray-500">
          {employee.position}
          {/* not a UI string: the backend sends this exact placeholder for an empty department */}
          {employee.department && employee.department !== "Не указано"
            ? ` · ${employee.department}`
            : ""}
        </span>
      </span>

      <span className="shrink-0 text-right">
        <span className="block text-sm font-semibold text-gray-900">
          {employee.birth_day} {monthShortName(employee.birth_month - 1)}
        </span>
        {getTurningAgeText(employee.turning_age) ? (
          <span className="block text-xs text-gray-400">
            {getTurningAgeText(employee.turning_age)}
          </span>
        ) : null}
      </span>
    </li>
  );
}

function MonthCard({ group }: { group: BirthdaysMonthGroup }) {
  const { t } = useTranslation();
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-brand-100 bg-brand-50 text-brand-500">
            <Cake size={14} />
          </span>
          <h3 className="text-sm font-semibold text-gray-900">{group.label}</h3>
        </div>
        <span className="inline-flex items-center rounded-lg bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          {group.employees_count}
        </span>
      </div>

      {group.employees.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-4 py-6 text-xs text-gray-400">
          {t("reports.birthdays.no_birthdays")}
        </div>
      ) : (
        <ul className="divide-y divide-gray-50">
          {group.employees.map((employee) => (
            <EmployeeRow key={employee.guid} employee={employee} />
          ))}
        </ul>
      )}
    </article>
  );
}

function BirthdaysPage() {
  const { t } = useTranslation();
  const currentMonth = new Date().getMonth() + 1;
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const { data, isLoading, isFetching, isError, error, refetch } =
    useBirthdaysReportQuery();

  const result = data?.result;
  const months = result?.months ?? [];
  const upcoming = result?.upcoming ?? [];
  const totalEmployees = result?.total_employees ?? 0;

  const currentMonthCount = useMemo(
    () => months.find((m) => m.month === currentMonth)?.employees_count ?? 0,
    [months, currentMonth]
  );

  const visibleMonths = useMemo(() => {
    if (selectedMonth == null) return months;
    return months.filter((m) => m.month === selectedMonth);
  }, [months, selectedMonth]);

  if (isLoading) {
    return (
      <>
        <PageMeta
          title={t("reports.birthdays.page_title")}
          description={t("reports.birthdays.page_description")}
        />
        <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-gray-200 bg-white">
          <Spinner />
        </div>
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageMeta
          title={t("reports.birthdays.page_title")}
          description={t("reports.birthdays.page_description")}
        />
        <div className="rounded-2xl border border-error-200 bg-error-50 p-6">
          <p className="text-sm font-medium text-error-700">{getErrorMessage(error)}</p>
          <button
            type="button"
            onClick={() => {
              void refetch();
            }}
            className="mt-3 inline-flex h-10 items-center justify-center rounded-xl bg-error-600 px-4 text-sm font-semibold text-white transition hover:bg-error-700"
          >
            {t("reports.common.retry_button")}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageMeta
        title={t("reports.birthdays.page_title")}
        description={t("reports.birthdays.page_description")}
      />

      <div className="space-y-4">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <article className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-sm font-medium text-gray-500">
              {t("reports.birthdays.card_total_employees")}
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">
              {totalEmployees}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {t("reports.birthdays.card_with_birth_date")}
            </p>
          </article>

          <article className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-brand-100 bg-brand-50 text-brand-500">
                <Gift size={14} />
              </span>
              <p className="text-sm font-medium text-gray-500">
                {t("reports.birthdays.card_this_month", { month: monthName(currentMonth - 1) })}
              </p>
            </div>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">
              {currentMonthCount}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {t("reports.birthdays.card_birthday_people")}
            </p>
          </article>
        </section>

        {upcoming.length > 0 ? (
          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-brand-100 bg-brand-50 text-brand-500">
                <Gift size={14} />
              </span>
              <h2 className="text-sm font-semibold text-gray-900">
                {t("reports.birthdays.upcoming_birthdays")}
              </h2>
            </div>
            <ul className="divide-y divide-gray-50">
              {upcoming.map((employee) => (
                <UpcomingRow key={employee.guid} employee={employee} />
              ))}
            </ul>
          </section>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedMonth(null)}
            className="inline-flex h-8 items-center rounded-lg border px-3 text-xs font-medium transition"
            style={{
              borderColor: selectedMonth == null ? companyStore.mainColor || "#2980B9" : "#e5e7eb",
              backgroundColor:
                selectedMonth == null ? companyStore.mainColor || "#2980B9" : "#ffffff",
              color: selectedMonth == null ? "#ffffff" : "#334155",
            }}
          >
            {t("reports.birthdays.all_months")}
          </button>
          {months.map((group) => {
            const isActive = selectedMonth === group.month;
            return (
              <button
                key={group.month}
                type="button"
                onClick={() => setSelectedMonth(isActive ? null : group.month)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition"
                style={{
                  borderColor: isActive ? companyStore.mainColor || "#2980B9" : "#e5e7eb",
                  backgroundColor: isActive ? companyStore.mainColor || "#2980B9" : "#ffffff",
                  color: isActive ? "#ffffff" : "#334155",
                }}
              >
                {monthShortName(group.month - 1)}
                <span
                  className="rounded px-1 text-[10px]"
                  style={{
                    backgroundColor: isActive ? "rgba(255,255,255,0.25)" : "#f1f5f9",
                    color: isActive ? "#ffffff" : "#64748b",
                  }}
                >
                  {group.employees_count}
                </span>
              </button>
            );
          })}
        </div>

        {totalEmployees === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
            <p className="text-base font-medium text-gray-800">{t("reports.common.no_data")}</p>
            <p className="mt-1 text-sm text-gray-500">
              {t("reports.birthdays.no_birth_dates")}
            </p>
          </div>
        ) : (
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleMonths.map((group) => (
              <MonthCard key={group.month} group={group} />
            ))}
          </section>
        )}

        {isFetching ? (
          <p className="text-right text-xs text-gray-400">{t("reports.common.updating")}</p>
        ) : null}
      </div>
    </>
  );
}

export default observer(BirthdaysPage);
