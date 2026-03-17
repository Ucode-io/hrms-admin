import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Phone,
  MapPin,
  Briefcase,
  Users,
  Building2,
} from "lucide-react";
import { observer } from "mobx-react-lite";
import PageMeta from "../../../components/common/PageMeta";
import companyStore from "../../../store/company.store";
import { useEmployeeQuery } from "../../../api/services/employee.service";
import EducationSection from "./components/EducationSection";
import InterestsSection from "./components/InterestsSection";
import LicenseCertificatesSection from "./components/LicenseCertificatesSection";
import SkillsSection from "./components/SkillsSection";

const TABS = [
  "Личное",
  "Работа",
  "Компенсация",
  "Отсутствия",
  "Документы",
  "Больше",
] as const;

type Tab = (typeof TABS)[number];

/* ── helpers ── */
const GENDER_MAP: Record<string, string> = {
  male_slug: "Мужской",
  female_slug: "Женский",
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    const months = ["Янв.", "Февр.", "Март", "Апр.", "Май", "Июн.", "Июл.", "Авг.", "Сент.", "Окт.", "Нояб.", "Дек."];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

function calcTenure(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const start = new Date(dateStr);
    const now = new Date();
    let years = now.getFullYear() - start.getFullYear();
    let months = now.getMonth() - start.getMonth();
    let days = now.getDate() - start.getDate();
    if (days < 0) {
      months--;
      days += 30;
    }
    if (months < 0) {
      years--;
      months += 12;
    }
    const parts: string[] = [];
    if (years > 0) parts.push(`${years} ${years === 1 ? "год" : years < 5 ? "года" : "лет"}`);
    if (months > 0) parts.push(`${months} мес.`);
    if (days > 0) parts.push(`${days} дн.`);
    return parts.join(", ") || "Сегодня";
  } catch {
    return "—";
  }
}

/* ────────────────────────────────────────────────
 *  Main component
 * ──────────────────────────────────────────────── */
function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("Личное");
  const brandColor = companyStore.mainColor;
  const employeeCover = companyStore.company?.employee_cover;

  const { data: emp, isLoading } = useEmployeeQuery(id || "");
  const managerGuid =
    typeof emp?.departments_id_data?.user_base_id === "string"
      ? emp.departments_id_data.user_base_id
      : "";
  const { data: manager, isLoading: isManagerLoading } = useEmployeeQuery(managerGuid);

  if (isLoading || !emp) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="w-8 h-8 rounded-full border-4 border-slate-200 animate-spin"
          style={{ borderTopColor: brandColor }}
        />
      </div>
    );
  }

  const fullName = [emp.second_name, emp.first_name].filter(Boolean).join(" ");
  const positionTitle = emp.positions_id_data?.title || "";
  const departmentTitle = emp.departments_id_data?.title || "";
  const locationTitle = emp.locations_id_data?.title || "";
  const divisionTitle = emp.divisions_id_data?.title || "";
  const employmentTypeTitle = emp.employment_types_id_data?.title || "";
  const experienceLevelTitle = emp.experience_levels_id_data?.title || "";
  const managerFullName = manager
    ? [manager.second_name, manager.first_name].filter(Boolean).join(" ")
    : "";
  const genderLabel = emp.gender?.[0] ? GENDER_MAP[emp.gender[0]] || emp.gender[0] : "";
  const statusLabel = emp.status?.includes("active") ? "Активный" : emp.status?.[0] || "";

  return (
    <>
      <PageMeta
        title={`${fullName} | HRMS`}
        description="Карточка сотрудника"
      />

      {/* ── Cover + Profile Header ── */}
      <div className="relative rounded-2xl overflow-hidden bg-white border border-slate-200 mb-6">
        {/* Cover */}
        <div
          className="h-[140px] relative border-b border-slate-200"
          style={{
            background: employeeCover
              ? `url(${employeeCover}) center / cover no-repeat`
              : `linear-gradient(135deg, ${brandColor}15, ${brandColor}30, ${brandColor}10)`,
          }}
        >
          {!employeeCover && (
            <div
              className="absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23${brandColor.replace("#", "")}' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }}
            />
          )}
        </div>

        {/* Profile info */}
        <div className="px-7 pb-6 relative">
          {/* Avatar */}
          <div className="absolute top-[-48px] left-7">
            <div className="w-24 h-24 rounded-full border-4 border-white overflow-hidden shadow-sm bg-white top">
              {emp.photo ? (
                <img
                  src={emp.photo}
                  alt={fullName}
                  className="w-full h-full object-cover block"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-[28px] font-bold"
                  style={{ backgroundColor: `${brandColor}20`, color: brandColor }}
                >
                  {(emp.second_name || "").charAt(0)}
                  {(emp.first_name || "").charAt(0)}
                </div>
              )}
            </div>
          </div>

          {/* Name + meta */}
          <div className="pt-14 flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-[22px] font-bold text-slate-900 m-0 leading-snug">
                {fullName}
              </h1>
              <div className="flex items-center gap-4 mt-1.5 text-[13px] text-slate-500 flex-wrap">
                {positionTitle && (
                  <span className="flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5" />
                    {positionTitle}
                  </span>
                )}
                {locationTitle && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {locationTitle}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(-1)}
                className="flex items-center justify-center w-9 h-9 border border-slate-200 rounded-lg bg-white text-slate-600 cursor-pointer transition-colors hover:bg-slate-50"
              >
                <ChevronLeft className="w-[18px] h-[18px]" />
              </button>
              <button
                className="flex items-center justify-center w-9 h-9 border border-slate-200 rounded-lg bg-white text-slate-600 cursor-pointer transition-colors hover:bg-slate-50"
              >
                <ChevronRight className="w-[18px] h-[18px]" />
              </button>
              <button
                onClick={() => navigate(`/employees/${id}/edit`)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border-none text-white text-[13px] font-semibold cursor-pointer transition-opacity hover:opacity-90"
                style={{ backgroundColor: brandColor }}
              >
                <Pencil className="w-3.5 h-3.5" />
                Редактировать
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-t border-slate-100 pl-7 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-5 py-3.5 text-[13px] font-medium bg-transparent border-none cursor-pointer transition-colors whitespace-nowrap"
              style={{
                color: activeTab === tab ? brandColor : "#64748b",
                borderBottom: activeTab === tab ? `2px solid ${brandColor}` : "2px solid transparent",
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "Личное" ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 items-start">
          {/* Left column */}
          <div className="flex flex-col gap-5">
            {/* Личное */}
            <InfoSection title="Личное" icon={null} brandColor={brandColor} showAction={false}>
              <InfoRow label="ID сотрудника" value={emp.guid} />
              <InfoRow label="Фамилия" value={emp.second_name} />
              <InfoRow label="Имя" value={emp.first_name} />
              <InfoRow label="Отчество" value={emp.middle_name} />
              <InfoRow label="Эл. почта" value={emp.email || ""} linkType="email" />
              <InfoRow label="Личная эл. почта" value={emp.personal_email || ""} linkType="email" />
              <InfoRow label="Дата рождения" value={formatDate(emp.birth_date)} />
              <InfoRow label="Пол" value={genderLabel} />
              <InfoRow label="Статус" value={statusLabel} isStatus />
            </InfoSection>

            {/* Контакты */}
            <InfoSection
              title="Контакты"
              icon={<Phone className="w-4 h-4" />}
              brandColor={brandColor}
              showAction={false}
            >
              <InfoRow label="Мобильный телефон" value={emp.phone} linkType="phone" />
              <InfoRow label="Рабочий телефон" value={emp.work_phone || ""} linkType="phone" />
              <InfoRow label="Телеграм" value={emp.telegram || ""} />
            </InfoSection>

            {/* Интересы */}
            <InterestsSection employeeGuid={emp.guid} brandColor={brandColor} />

            {/* Навыки */}
            <SkillsSection employeeGuid={emp.guid} brandColor={brandColor} />

            {/* Образование */}
            <EducationSection employeeGuid={emp.guid} brandColor={brandColor} />

            {/* Лицензии и сертификаты */}
            <LicenseCertificatesSection employeeGuid={emp.guid} brandColor={brandColor} />
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-5">
            {/* Рабочие данные */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="text-[15px] font-bold text-slate-900 m-0 mb-5">
                Рабочие данные
              </h3>

              <div className="flex flex-col gap-4">
                <SummaryItem label="Почта" value={emp.email || ""} linkType="email" />
                <SummaryItem label="Мобильный телефон" value={emp.phone || ""} linkType="phone" />
                <SummaryItem label="Рабочий телефон" value={emp.work_phone || ""} linkType="phone" />
                <SummaryItem label="Телеграм" value={emp.telegram || ""} />
                <SummaryItem label="Дата начала" value={formatDate(emp.date_hire)} />
                <SummaryItem label="Тип работы" value={employmentTypeTitle} />
                <SummaryItem label="Должность" value={positionTitle} />
                <SummaryItem label="Уровень" value={experienceLevelTitle} />
                <SummaryItem label="Департамент" value={departmentTitle} />
                <SummaryItem label="Подразделение" value={divisionTitle} />
                <SummaryItem label="Локация" value={locationTitle} />
                <SummaryItem label="Срок работы" value={calcTenure(emp.date_hire)} />
              </div>
            </div>

            {/* Руководитель */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4" style={{ color: brandColor }} />
                <h3 className="text-[15px] font-bold text-slate-900 m-0">
                  Руководитель
                </h3>
              </div>
              {!managerGuid ? (
                <div className="text-[13px] text-slate-400 py-2">
                  Не назначен
                </div>
              ) : isManagerLoading ? (
                <div className="text-[13px] text-slate-400 py-2">
                  Загрузка...
                </div>
              ) : manager ? (
                <Link
                  to={`/employees/${manager.guid}`}
                  className="group -mx-2 flex items-center gap-3.5 rounded-lg px-2 py-1 transition hover:bg-slate-50"
                >
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-slate-200">
                    {manager.photo ? (
                      <img
                        src={manager.photo}
                        alt={managerFullName || "Руководитель"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-700">
                        {(manager.second_name || "").charAt(0)}
                        {(manager.first_name || "").charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="m-0 truncate text-[15px] font-bold leading-[1.3] text-slate-900 group-hover:underline">
                      {managerFullName || "—"}
                    </p>
                    <p className="m-0 mt-0.5 truncate text-[13px] leading-[1.4] text-slate-500">
                      {manager.positions_id_data?.title || "—"}
                    </p>
                  </div>
                </Link>
              ) : (
                <div className="text-[13px] text-slate-400 py-2">
                  Не найден
                </div>
              )}
            </div>

            {/* Прямые подчиненные */}
            {/* <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-4 h-4" style={{ color: brandColor }} />
                <h3 className="text-[15px] font-bold text-slate-900 m-0">
                  Прямые подчиненные
                </h3>
              </div>
              <div className="text-[13px] text-slate-400 py-2">
                Нет подчинённых
              </div>
            </div> */}

            {/* Org structure links */}
            <div className="flex flex-col gap-2">
              <button className="flex items-center gap-2 px-5 py-3.5 rounded-2xl border border-slate-200 bg-white text-slate-800 text-[13px] font-semibold cursor-pointer transition-colors hover:bg-slate-50 w-full text-left">
                <Building2 className="w-4 h-4" style={{ color: brandColor }} />
                Посмотреть в орг. структуре
              </button>
              <button className="flex items-center gap-2 px-5 py-3.5 rounded-2xl border border-slate-200 bg-white text-slate-800 text-[13px] font-semibold cursor-pointer transition-colors hover:bg-slate-50 w-full text-left">
                <Users className="w-4 h-4" style={{ color: brandColor }} />
                Посмотреть в орг. структуре департамента
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Under development placeholder for other tabs */
        <div className="flex flex-col items-center justify-center py-20 px-5 rounded-2xl border border-slate-200 bg-white">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
            style={{ backgroundColor: `${brandColor}10` }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke={brandColor}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 6V12L16 14" />
              <circle cx="12" cy="12" r="10" />
            </svg>
          </div>
          <h3 className="text-[16px] font-semibold text-slate-800 m-0 mb-2">
            Раздел «{activeTab}» в разработке
          </h3>
          <p className="text-[14px] text-slate-400 m-0 text-center max-w-[400px] leading-relaxed">
            Этот модуль пока находится в разработке. Мы работаем над ним и скоро он будет доступен.
          </p>
        </div>
      )}

    </>
  );
}

export default observer(EmployeeDetail);

/* ────────────────────────────────────────────────
 *  Sub-components
 * ──────────────────────────────────────────────── */

function InfoSection({
  title,
  icon,
  children,
  brandColor,
  actionLabel,
  showAction = true,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  brandColor: string;
  actionLabel?: string;
  showAction?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          {icon && <span style={{ color: brandColor }}>{icon}</span>}
          <h3 className="text-[15px] font-bold text-slate-900 m-0">{title}</h3>
        </div>
        {showAction && (
          <button className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-[12px] font-medium cursor-pointer transition-colors hover:bg-slate-50">
            {actionLabel ? (
              <span className="font-semibold" style={{ color: brandColor }}>{actionLabel}</span>
            ) : (
              <>
                <Pencil className="w-3 h-3" />
                Редактировать
              </>
            )}
          </button>
        )}
      </div>
      <div className="px-6 pt-1 pb-4">{children}</div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  isLink,
  linkType,
  isStatus,
  icon,
}: {
  label: string;
  value?: string;
  isLink?: boolean;
  linkType?: "email" | "phone" | "url";
  isStatus?: boolean;
  icon?: React.ReactNode;
}) {
  const brandColor = companyStore.mainColor;

  let href = undefined;
  if (value) {
    if (linkType === "email") href = `mailto:${value.trim()}`;
    if (linkType === "phone") href = `tel:${value.replace(/[^+\d]/g, "")}`;
    if (linkType === "url") href = value;
  }

  const isLinked = isLink || !!linkType;
  const Wrapper = href ? "a" : "span";

  return (
    <div className="flex items-center py-2.5 border-b border-slate-50 gap-3">
      {icon && <span className="text-slate-400 shrink-0">{icon}</span>}
      <span className="text-[13px] text-slate-400 min-w-[160px] shrink-0">
        {label}
      </span>
      <Wrapper
        {...(href ? { href, className: "text-[13px] flex-1 break-words hover:underline" } : { className: "text-[13px] flex-1 break-words" })}
        style={{
          fontWeight: value ? 500 : 400,
          color: isLinked && value ? brandColor : isStatus && value === "Активный" ? "#16a34a" : value ? "#1e293b" : "#cbd5e1",
        }}
      >
        {value || "—"}
      </Wrapper>
    </div>
  );
}

function SummaryItem({
  label,
  value,
  isLink,
  linkType,
}: {
  label: string;
  value: string;
  isLink?: boolean;
  linkType?: "email" | "phone" | "url";
}) {
  const brandColor = companyStore.mainColor;

  let href = undefined;
  if (value) {
    if (linkType === "email") href = `mailto:${value.trim()}`;
    if (linkType === "phone") href = `tel:${value.replace(/[^+\d]/g, "")}`;
    if (linkType === "url") href = value;
  }

  const isLinked = isLink || !!linkType;
  const Wrapper = href ? "a" : "div";

  return (
    <div>
      <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">
        {label}
      </div>
      <Wrapper
        {...(href ? { href, className: "block text-[14px] font-semibold mt-0.5 break-words hover:underline" } : { className: "text-[14px] font-semibold mt-0.5 break-words" })}
        style={{ color: isLinked ? brandColor : "#1e293b" }}
      >
        {value || "—"}
      </Wrapper>
    </div>
  );
}
