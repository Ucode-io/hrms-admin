import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router";
import {
  ChevronDown,
  Pencil,
  KeyRound,
  Copy,
  Check,
  Phone,
  Search,
  MapPin,
  Briefcase,
  Users,
  Building2,
  UserX,
  UserCheck,
} from "lucide-react";
import { observer } from "mobx-react-lite";
import { toast } from "sonner";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import PageMeta from "../../../components/common/PageMeta";
import companyStore from "../../../store/company.store";
import { useEmployeeQuery, useUpdateEmployee } from "../../../api/services/employee.service";
import { useUserAccessQuery } from "../../../api/services/role.service";
import { useEmployeeWorksQuery } from "../../../api/services/employeeWork.service";
import { useHeaderBreadcrumbLabel } from "../../../context/HeaderBreadcrumbContext";
import { Dropdown } from "../../../components/ui/dropdown/Dropdown";
import { DropdownItem } from "../../../components/ui/dropdown/DropdownItem";
import { Modal } from "../../../components/ui/modal";
import Button from "../../../components/ui/button/Button";
import EducationSection from "./components/EducationSection";
import AbsencesSection from "./components/AbsencesSection";
import AttendanceSection from "./components/AttendanceSection";
import SportAttendanceSection from "./components/SportAttendanceSection";
import EmployeeDocumentsSection from "./components/DocumentsSection";
import InterestsSection from "./components/InterestsSection";
import LicenseCertificatesSection from "./components/LicenseCertificatesSection";
import SkillsSection from "./components/SkillsSection";
import WorkSection from "./components/WorkSection";
import CompensationSection from "./components/CompensationSection";
import { useSettingsDirectoryQuery } from "../../../api/services/settingsDirectory.service";
import encodeJsonToUrlParam from "../../../utils/encodeJsonToUrlParam";

const PRIMARY_TABS = [
  "Личное",
  "Работа",
  "Компенсация",
  "Отсутствия",
  "Документы",
] as const;

const MORE_TABS = ["Посещаемость", "Посещение спорта"] as const;
const DISMISSAL_TYPES_SLUG = "dismissal_types";
const DISMISSAL_REASONS_SLUG = "dismissal_reasons";
const DISMISSIAL_TYPES_SLUG = "dismissial_types";
const DISMISSIAL_REASONS_SLUG = "dismissial_reasons";
const UNIQUE_USERS_SLUG = "unique_users";

type Tab = (typeof PRIMARY_TABS)[number] | (typeof MORE_TABS)[number];

type UniqueHikvisionUserItem = {
  guid: string;
  full_name?: string | null;
  hikvision_id?: string | null;
  picture?: string | null;
};

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

function toIsoDate(value: Date | null): string | null {
  if (!value) return null;
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function normalizeRelationId(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function getDismissalTypeFieldKey(employee: Record<string, unknown>): "dismissial_types_id" | "dismissal_types_id" {
  if ("dismissial_types_id" in employee) {
    return "dismissial_types_id";
  }
  return "dismissal_types_id";
}

function getDismissalReasonFieldKey(employee: Record<string, unknown>): "dismissial_reasons_id" | "dismissal_reasons_id" {
  if ("dismissial_reasons_id" in employee) {
    return "dismissial_reasons_id";
  }
  return "dismissal_reasons_id";
}

function getEmployeeDismissalTypeId(employee: Record<string, unknown>): string {
  return (
    normalizeRelationId(employee.dismissial_types_id) ||
    normalizeRelationId(employee.dismissal_types_id)
  );
}

function getEmployeeDismissalReasonId(employee: Record<string, unknown>): string {
  return (
    normalizeRelationId(employee.dismissial_reasons_id) ||
    normalizeRelationId(employee.dismissal_reasons_id)
  );
}

const PASSWORD_UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const PASSWORD_LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const PASSWORD_DIGITS = "0123456789";
const PASSWORD_SYMBOLS = "!@#$%^&*()_+-=[]{}|;:,.<>?";

function getRandomInt(max: number): number {
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return array[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function pickRandomChar(source: string): string {
  return source.charAt(getRandomInt(source.length));
}

function generateStrongPassword(length = 12): string {
  const finalLength = Math.max(8, length);
  const allChars = PASSWORD_UPPERCASE + PASSWORD_LOWERCASE + PASSWORD_DIGITS + PASSWORD_SYMBOLS;
  const chars: string[] = [
    pickRandomChar(PASSWORD_UPPERCASE),
    pickRandomChar(PASSWORD_LOWERCASE),
    pickRandomChar(PASSWORD_DIGITS),
    pickRandomChar(PASSWORD_SYMBOLS),
  ];

  while (chars.length < finalLength) {
    chars.push(pickRandomChar(allChars));
  }

  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = getRandomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

const resolveHikvisionPictureSrc = (picture: string | null | undefined): string => {
  const value = String(picture || "").trim();
  if (!value) return "";
  if (/^(data:image\/|https?:\/\/|blob:|\/)/i.test(value)) return value;
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length > 120) {
    return `data:image/jpeg;base64,${value}`;
  }
  return value;
};

const buildHikvisionInitials = (name: string | null | undefined): string => {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return (parts[0]?.charAt(0) || "?")
    .concat(parts[1]?.charAt(0) || "")
    .toUpperCase();
};

const getHikvisionUserName = (item: UniqueHikvisionUserItem): string => {
  return String(item.full_name || "").trim() || "Без имени";
};

const getHikvisionUserId = (item: UniqueHikvisionUserItem): string => {
  return String(item.hikvision_id || "").trim();
};

/* ────────────────────────────────────────────────
 *  Main component
 * ──────────────────────────────────────────────── */
function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>(
    location.state?.activeTab === "Документы" ? "Документы" : "Личное"
  );
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [isDismissModalOpen, setIsDismissModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [isPasswordResultModalOpen, setIsPasswordResultModalOpen] = useState(false);
  const [isHikvisionModalOpen, setIsHikvisionModalOpen] = useState(false);
  const [selectedHikvisionId, setSelectedHikvisionId] = useState("");
  const [hikvisionSearch, setHikvisionSearch] = useState("");
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [isPasswordCopied, setIsPasswordCopied] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [isGeneratingPassword, setIsGeneratingPassword] = useState(false);
  const [isSavingHikvisionId, setIsSavingHikvisionId] = useState(false);
  const [returnEmployeeRequestKey, setReturnEmployeeRequestKey] = useState(0);
  const [dismissalDate, setDismissalDate] = useState<Date | null>(new Date());
  const [dismissalTypeId, setDismissalTypeId] = useState<string>("");
  const [dismissalReasonId, setDismissalReasonId] = useState<string>("");
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);
  const actionButtonRef = useRef<HTMLButtonElement | null>(null);
  const brandColor = companyStore.mainColor;
  const employeeCover = companyStore.company?.employee_cover;

  const { data: emp, isLoading } = useEmployeeQuery(id || "");
  const { data: userAccess } = useUserAccessQuery(id || "");
  const accessRoleTitle = userAccess?.role?.title || "—";
  const breadcrumbEmployeeName = [emp?.first_name, emp?.second_name].filter(Boolean).join(" ").trim();
  useHeaderBreadcrumbLabel(breadcrumbEmployeeName);
  const { data: employeeWorksData } = useEmployeeWorksQuery({
    userBaseId: emp?.guid || "",
    limit: 100,
    offset: 0,
  });
  const managerGuid =
    typeof emp?.departments_id_data?.user_base_id === "string"
      ? emp.departments_id_data.user_base_id
      : "";
  const { data: manager, isLoading: isManagerLoading } = useEmployeeQuery(managerGuid);
  const { data: dismissialTypesData } = useSettingsDirectoryQuery({
    slug: DISMISSIAL_TYPES_SLUG,
    params: { limit: 200, offset: 0 },
  });
  const { data: dismissalTypesData } = useSettingsDirectoryQuery({
    slug: DISMISSAL_TYPES_SLUG,
    params: { limit: 200, offset: 0 },
  });
  const { data: dismissialReasonsData } = useSettingsDirectoryQuery({
    slug: DISMISSIAL_REASONS_SLUG,
    params: { limit: 200, offset: 0 },
  });
  const { data: dismissalReasonsData } = useSettingsDirectoryQuery({
    slug: DISMISSAL_REASONS_SLUG,
    params: { limit: 200, offset: 0 },
  });
  const updateEmployeeMutation = useUpdateEmployee();
  const hikvisionUsersQueryParams = useMemo(
    () => ({
      data: encodeJsonToUrlParam({
        limit: 200,
        offset: 0,
        ...(hikvisionSearch.trim() ? { search: hikvisionSearch.trim() } : {}),
      }),
    }),
    [hikvisionSearch]
  );
  const hikvisionUsersQuery = useSettingsDirectoryQuery({
    slug: UNIQUE_USERS_SLUG,
    params: hikvisionUsersQueryParams,
    querySettings: {
      enabled: isHikvisionModalOpen,
      keepPreviousData: true,
    },
  });

  useEffect(() => {
    if (location.state?.activeTab === "Документы") {
      setActiveTab("Документы");
    }
  }, [location.state]);

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
  const employeeDepartmentId =
    normalizeRelationId(emp.departments_id) ||
    normalizeRelationId(emp.departments_id_data?.guid) ||
    null;
  const locationTitle = emp.locations_id_data?.title || "";
  const divisionTitle = emp.divisions_id_data?.title || "";
  const employmentTypeTitle = emp.employment_types_id_data?.title || "";
  const experienceLevelTitle = emp.experience_levels_id_data?.title || "";
  const currentWork =
    Array.isArray(employeeWorksData?.response) && employeeWorksData.response.length > 0
      ? employeeWorksData.response[0]
      : null;
  const workDateFrom =
    (currentWork && typeof currentWork.date_from === "string" && currentWork.date_from) ||
    emp.date_hire;
  const workEmploymentTypeTitle =
    (typeof currentWork?.employment_types_id_data?.title === "string" &&
      currentWork.employment_types_id_data.title) ||
    employmentTypeTitle;
  const workPositionTitle =
    (typeof currentWork?.positions_id_data?.title === "string" &&
      currentWork.positions_id_data.title) ||
    positionTitle;
  const workExperienceLevelTitle =
    (typeof currentWork?.experience_levels_id_data?.title === "string" &&
      currentWork.experience_levels_id_data.title) ||
    experienceLevelTitle;
  const workDepartmentTitle =
    (typeof currentWork?.departments_id_data?.title === "string" &&
      currentWork.departments_id_data.title) ||
    departmentTitle;
  const workDivisionTitle =
    (typeof currentWork?.divisions_id_data?.title === "string" &&
      currentWork.divisions_id_data.title) ||
    divisionTitle;
  const workLocationTitle =
    (typeof currentWork?.locations_id_data?.title === "string" &&
      currentWork.locations_id_data.title) ||
    locationTitle;
  const managerFullName = manager
    ? [manager.second_name, manager.first_name].filter(Boolean).join(" ")
    : "";
  const genderLabel = emp.gender?.[0] ? GENDER_MAP[emp.gender[0]] || emp.gender[0] : "";
  const isDismissed = emp.status?.includes("dismissed");
  const statusLabel = isDismissed
    ? "Уволен"
    : emp.status?.includes("active")
      ? "Активный"
      : emp.status?.[0] || "";
  const isMoreTabActive = MORE_TABS.includes(activeTab as (typeof MORE_TABS)[number]);
  const dismissalDateLabel = formatDate(emp.dismissal_date);
  const dismissalTypeLabel =
    (typeof emp.dismissial_types_id_data?.title === "string" && emp.dismissial_types_id_data.title) ||
    (typeof emp.dismissal_types_id_data?.title === "string" && emp.dismissal_types_id_data.title) ||
    "—";
  const dismissalReasonLabel =
    (typeof emp.dismissial_reasons_id_data?.title === "string" && emp.dismissial_reasons_id_data.title) ||
    (typeof emp.dismissal_reasons_id_data?.title === "string" && emp.dismissal_reasons_id_data.title) ||
    "—";
  const dismissalTypeOptions = (
    dismissialTypesData?.response?.length
      ? dismissialTypesData.response
      : dismissalTypesData?.response || []
  ).map((item) => ({
    value: item.guid,
    label: String(item.title || "Без названия"),
  }));
  const dismissalReasonOptions = (
    dismissialReasonsData?.response?.length
      ? dismissialReasonsData.response
      : dismissalReasonsData?.response || []
  ).map((item) => ({
    value: item.guid,
    label: String(item.title || "Без названия"),
  }));
  const hikvisionUsers = ((hikvisionUsersQuery.data?.response || []) as UniqueHikvisionUserItem[])
    .filter((item) => getHikvisionUserId(item));
  const selectedHikvisionUser = hikvisionUsers.find(
    (item) => getHikvisionUserId(item) === selectedHikvisionId
  );

  const openHikvisionModal = () => {
    setSelectedHikvisionId(typeof emp.hikvision_id === "string" ? emp.hikvision_id : "");
    setHikvisionSearch("");
    setIsHikvisionModalOpen(true);
  };

  const closeHikvisionModal = () => {
    if (isSavingHikvisionId) return;
    setSelectedHikvisionId(typeof emp.hikvision_id === "string" ? emp.hikvision_id : "");
    setHikvisionSearch("");
    setIsHikvisionModalOpen(false);
  };

  const handleSaveHikvisionId = async () => {
    try {
      setIsSavingHikvisionId(true);
      await updateEmployeeMutation.mutateAsync({
        guid: emp.guid,
        hikvision_id: selectedHikvisionId || null,
      });
      setIsHikvisionModalOpen(false);
      toast.success("Hikvision ID обновлен.");
    } catch (error) {
      console.error("Update Hikvision ID error:", error);
      toast.error("Не удалось обновить Hikvision ID.");
    } finally {
      setIsSavingHikvisionId(false);
    }
  };

  const handleDismissEmployee = async () => {
    const nextDismissalDate = toIsoDate(dismissalDate);
    if (!nextDismissalDate) {
      toast.error("Укажите дату увольнения.");
      return;
    }
    if (!dismissalTypeId) {
      toast.error("Выберите тип увольнения.");
      return;
    }
    if (!dismissalReasonId) {
      toast.error("Выберите причину увольнения.");
      return;
    }

    const dismissalTypeFieldKey = getDismissalTypeFieldKey(emp as Record<string, unknown>);
    const dismissalReasonFieldKey = getDismissalReasonFieldKey(emp as Record<string, unknown>);

    try {
      setIsDismissing(true);
      await updateEmployeeMutation.mutateAsync({
        guid: emp.guid,
        status: ["dismissed"],
        dismissal_date: nextDismissalDate,
        [dismissalTypeFieldKey]: dismissalTypeId,
        [dismissalReasonFieldKey]: dismissalReasonId,
      });
      setIsDismissModalOpen(false);
      setIsActionMenuOpen(false);
      toast.success("Сотрудник уволен.");
    } catch (error) {
      console.error("Dismiss employee error:", error);
      toast.error("Не удалось уволить сотрудника.");
    } finally {
      setIsDismissing(false);
    }
  };

  const handleEmployeeReturned = async () => {
    const dismissalTypeFieldKey = getDismissalTypeFieldKey(emp as Record<string, unknown>);
    const dismissalReasonFieldKey = getDismissalReasonFieldKey(emp as Record<string, unknown>);

    await updateEmployeeMutation.mutateAsync({
      guid: emp.guid,
      status: ["active"],
      dismissal_date: null,
      [dismissalTypeFieldKey]: null,
      [dismissalReasonFieldKey]: null,
    });
  };

  const handleGeneratePassword = async () => {
    try {
      setIsGeneratingPassword(true);
      const nextPassword = generateStrongPassword(12);

      await updateEmployeeMutation.mutateAsync({
        guid: emp.guid,
        password: nextPassword,
      });

      setGeneratedPassword(nextPassword);
      setIsPasswordCopied(false);
      setIsResetPasswordModalOpen(false);
      setIsPasswordResultModalOpen(true);
    } catch (error) {
      console.error("Generate password error:", error);
      toast.error("Не удалось сгенерировать пароль.");
    } finally {
      setIsGeneratingPassword(false);
    }
  };

  const handleCopyGeneratedPassword = async () => {
    if (!generatedPassword) return;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(generatedPassword);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = generatedPassword;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setIsPasswordCopied(true);
      setTimeout(() => setIsPasswordCopied(false), 1800);
    } catch {
      toast.error("Не удалось скопировать пароль.");
    }
  };

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
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-[22px] font-bold text-slate-900 m-0 leading-snug">
                  {fullName}
                </h1>
                {isDismissed ? (
                  <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
                    Уволен
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-4 mt-1.5 text-[13px] text-slate-500 flex-wrap">
                {workPositionTitle && (
                  <span className="flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5" />
                    {workPositionTitle}
                  </span>
                )}
                {workLocationTitle && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {workLocationTitle}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/employees/${id}/edit`)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border-none text-white text-[13px] font-semibold cursor-pointer transition-opacity hover:opacity-90"
                style={{ backgroundColor: brandColor }}
              >
                <Pencil className="w-3.5 h-3.5" />
                Редактировать
              </button>
              <div className="relative">
                <button
                  ref={actionButtonRef}
                  type="button"
                  onClick={() => setIsActionMenuOpen((prev) => !prev)}
                  className="dropdown-toggle flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-[13px] font-semibold cursor-pointer transition-colors hover:bg-slate-50"
                >
                  Действие
                  <ChevronDown
                    className="h-3.5 w-3.5"
                    style={{
                      transform: isActionMenuOpen ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.2s ease",
                    }}
                  />
                </button>

                <Dropdown
                  isOpen={isActionMenuOpen}
                  onClose={() => setIsActionMenuOpen(false)}
                  className="w-56 p-1"
                  usePortal
                  anchorEl={actionButtonRef.current}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setIsActionMenuOpen(false);
                      setIsResetPasswordModalOpen(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                  >
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                      <KeyRound className="h-4 w-4" />
                    </span>
                    <span className="block font-medium">Сгенерировать пароль</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (isDismissed) return;
                      setIsActionMenuOpen(false);
                      setDismissalDate(parseIsoDate(emp.dismissal_date) || new Date());
                      setDismissalTypeId(getEmployeeDismissalTypeId(emp as Record<string, unknown>));
                      setDismissalReasonId(getEmployeeDismissalReasonId(emp as Record<string, unknown>));
                      setIsDismissModalOpen(true);
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                      isDismissed
                        ? "cursor-not-allowed text-slate-400"
                        : "text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                    }`}
                    disabled={isDismissed}
                  >
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                      <UserX className="h-4 w-4" />
                    </span>
                    <span className="block font-medium">Уволить сотрудника</span>
                  </button>

                  {isDismissed ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsActionMenuOpen(false);
                        setActiveTab("Работа");
                        setReturnEmployeeRequestKey((prev) => prev + 1);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-emerald-600 transition hover:bg-emerald-50 hover:text-emerald-700"
                    >
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                        <UserCheck className="h-4 w-4" />
                      </span>
                      <span className="block font-medium">Вернуть сотрудника</span>
                    </button>
                  ) : null}
                </Dropdown>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-t border-slate-100 pl-7 overflow-x-auto">
          {PRIMARY_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setIsMoreMenuOpen(false);
              }}
              className="px-5 py-3.5 text-[13px] font-medium bg-transparent border-none cursor-pointer transition-colors whitespace-nowrap"
              style={{
                color: activeTab === tab ? brandColor : "#64748b",
                borderBottom: activeTab === tab ? `2px solid ${brandColor}` : "2px solid transparent",
              }}
            >
              {tab}
            </button>
          ))}

          <div className="relative">
            <button
              ref={moreButtonRef}
              type="button"
              onClick={() => setIsMoreMenuOpen((prev) => !prev)}
              className="dropdown-toggle flex items-center gap-1 px-5 py-3.5 text-[13px] font-medium bg-transparent border-none cursor-pointer transition-colors whitespace-nowrap"
              style={{
                color: isMoreTabActive ? brandColor : "#64748b",
                borderBottom: isMoreTabActive ? `2px solid ${brandColor}` : "2px solid transparent",
              }}
            >
              Больше
              <ChevronDown
                className="h-3.5 w-3.5"
                style={{
                  transform: isMoreMenuOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s ease",
                }}
              />
            </button>

            <Dropdown
              isOpen={isMoreMenuOpen}
              onClose={() => setIsMoreMenuOpen(false)}
              className="w-52 p-1"
              usePortal
              anchorEl={moreButtonRef.current}
            >
              {MORE_TABS.map((tab) => (
                <DropdownItem
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    setIsMoreMenuOpen(false);
                  }}
                  className="rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                >
                  {tab}
                </DropdownItem>
              ))}
            </Dropdown>
          </div>
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
              <InfoRow label="Дата рождения" value={formatDate(emp.birth_date)} />
              <InfoRow label="Пол" value={genderLabel} />
              <InfoRow
                label="Hikvision ID"
                value={emp.hikvision_id || "—"}
                action={
                  <button
                    type="button"
                    onClick={openHikvisionModal}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                    title="Редактировать Hikvision ID"
                    aria-label="Редактировать Hikvision ID"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                }
              />
              <InfoRow label="Статус" value={statusLabel} isStatus />
              {isDismissed ? (
                <>
                  <InfoRow label="Дата увольнения" value={dismissalDateLabel} />
                  <InfoRow label="Тип увольнения" value={dismissalTypeLabel} />
                  <InfoRow label="Причина увольнения" value={dismissalReasonLabel} />
                </>
              ) : null}
            </InfoSection>

            {/* Контакты */}
            <InfoSection
              title="Контакты"
              icon={<Phone className="w-4 h-4" />}
              brandColor={brandColor}
              showAction={false}
            >
              <InfoRow label="Эл. почта" value={emp.email || ""} linkType="email" />
              <InfoRow label="Личная эл. почта" value={emp.personal_email || ""} linkType="email" />
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
                <SummaryItem label="Дата начала" value={formatDate(workDateFrom)} />
                <SummaryItem label="Тип работы" value={workEmploymentTypeTitle} />
                <SummaryItem label="Должность" value={workPositionTitle} />
                <SummaryItem label="Уровень" value={workExperienceLevelTitle} />
                <SummaryItem label="Департамент" value={workDepartmentTitle} />
                <SummaryItem label="Подразделение" value={workDivisionTitle} />
                <SummaryItem label="Локация" value={workLocationTitle} />
                <SummaryItem label="Роль доступа" value={accessRoleTitle} />
                <SummaryItem label="Срок работы" value={calcTenure(workDateFrom)} />
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
      ) : activeTab === "Документы" ? (
        <EmployeeDocumentsSection
          employeeGuid={emp.guid}
          brandColor={brandColor}
        />
      ) : activeTab === "Работа" ? (
        <WorkSection
          employeeGuid={emp.guid}
          brandColor={brandColor}
          returnRequestKey={returnEmployeeRequestKey}
          onEmployeeReturned={handleEmployeeReturned}
        />
      ) : activeTab === "Компенсация" ? (
        <CompensationSection employeeGuid={emp.guid} brandColor={brandColor} />
      ) : activeTab === "Отсутствия" ? (
        <AbsencesSection
          employeeGuid={emp.guid}
          brandColor={brandColor}
          departmentId={employeeDepartmentId}
        />
      ) : activeTab === "Посещаемость" ? (
        <AttendanceSection
          employeeGuid={emp.guid}
          brandColor={brandColor}
          departmentId={employeeDepartmentId}
        />
      ) : activeTab === "Посещение спорта" ? (
        <SportAttendanceSection employeeGuid={emp.guid} brandColor={brandColor} />
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

      <Modal
        isOpen={isHikvisionModalOpen}
        onClose={closeHikvisionModal}
        className="max-w-2xl w-full p-6"
        showCloseButton={false}
      >
        <h4 className="m-0 text-[18px] font-bold text-slate-900">
          Изменить Hikvision ID
        </h4>
        <p className="mb-6 mt-2 text-[13px] text-slate-500">
          Выберите пользователя Hikvision, который будет связан с этим сотрудником.
        </p>
        <div className="mb-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={hikvisionSearch}
              onChange={(event) => setHikvisionSearch(event.target.value)}
              placeholder="Поиск по имени или Hikvision ID"
              disabled={isSavingHikvisionId}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] text-slate-800 outline-none transition focus:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          {selectedHikvisionId ? (
            <div className="mt-3 flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
              <div className="min-w-0 text-[12px] font-medium text-blue-700">
                Выбран:{" "}
                <span className="font-semibold">
                  {selectedHikvisionUser
                    ? `${getHikvisionUserName(selectedHikvisionUser)} (${selectedHikvisionId})`
                    : selectedHikvisionId}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHikvisionId("")}
                disabled={isSavingHikvisionId}
                className="ml-3 shrink-0 text-[12px] font-semibold text-blue-700 transition hover:text-blue-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Очистить
              </button>
            </div>
          ) : null}
        </div>

        <div className="mb-6 max-h-[420px] overflow-y-auto rounded-xl border border-slate-200 bg-white">
          {hikvisionUsersQuery.isLoading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <div key={`hikvision-user-skeleton-${index}`} className="flex items-center gap-3 border-b border-slate-100 px-3 py-3 last:border-b-0">
                <div className="h-14 w-14 animate-pulse rounded-lg bg-slate-200" />
                <div className="min-w-0 flex-1">
                  <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
                  <div className="mt-2 h-3 w-24 animate-pulse rounded bg-slate-100" />
                </div>
              </div>
            ))
          ) : hikvisionUsers.length === 0 ? (
            <div className="px-4 py-10 text-center text-[13px] text-slate-500">
              Пользователи Hikvision не найдены.
            </div>
          ) : (
            hikvisionUsers.map((user) => {
              const hikvisionId = getHikvisionUserId(user);
              const userName = getHikvisionUserName(user);
              const isSelected = selectedHikvisionId === hikvisionId;

              return (
                <button
                  key={user.guid || hikvisionId}
                  type="button"
                  onClick={() => setSelectedHikvisionId(hikvisionId)}
                  disabled={isSavingHikvisionId}
                  className={`flex w-full items-center gap-3 border-b px-3 py-3 text-left transition last:border-b-0 disabled:cursor-not-allowed disabled:opacity-60 ${
                    isSelected
                      ? "border-blue-100 bg-blue-50"
                      : "border-slate-100 bg-white hover:bg-slate-50"
                  }`}
                >
                  <HikvisionUserPicture picture={user.picture} name={userName} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold text-slate-900">
                      {userName}
                    </div>
                    <div className="mt-0.5 text-[12px] font-medium text-slate-500">
                      Hikvision ID: {hikvisionId}
                    </div>
                  </div>
                  {isSelected ? (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                      <Check className="h-4 w-4" />
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={closeHikvisionModal}
            disabled={isSavingHikvisionId}
            className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Отмена
          </button>
          <Button
            size="sm"
            className="!h-9 !px-4 !py-2 text-[13px]"
            onClick={() => void handleSaveHikvisionId()}
            disabled={isSavingHikvisionId}
          >
            {isSavingHikvisionId ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={isDismissModalOpen}
        onClose={() => {
          if (isDismissing) return;
          setIsDismissModalOpen(false);
          setDismissalDate(parseIsoDate(emp.dismissal_date) || new Date());
          setDismissalTypeId(getEmployeeDismissalTypeId(emp as Record<string, unknown>));
          setDismissalReasonId(getEmployeeDismissalReasonId(emp as Record<string, unknown>));
        }}
        className="max-w-md w-full p-6"
        showCloseButton={false}
      >
        <h4 className="m-0 text-[18px] font-bold text-slate-900">
          Уволить сотрудника?
        </h4>
        <p className="mb-6 mt-2 text-[13px] text-slate-500">
          После подтверждения статус сотрудника изменится на `dismissed`.
        </p>
        <div className="mb-6">
          <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
            Дата увольнения
          </label>
          <DatePicker
            selected={dismissalDate}
            onChange={(date) => setDismissalDate(date)}
            dateFormat="dd.MM.yyyy"
            placeholderText="дд.мм.гггг"
            showMonthDropdown
            showYearDropdown
            dropdownMode="select"
            wrapperClassName="w-full"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-slate-300"
          />
        </div>
        <div className="mb-4">
          <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
            Тип увольнения
          </label>
          <select
            value={dismissalTypeId}
            onChange={(event) => setDismissalTypeId(event.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-slate-300"
          >
            <option value="">Выберите тип увольнения</option>
            {dismissalTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-6">
          <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
            Причина увольнения
          </label>
          <select
            value={dismissalReasonId}
            onChange={(event) => setDismissalReasonId(event.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-slate-300"
          >
            <option value="">Выберите причину увольнения</option>
            {dismissalReasonOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setIsDismissModalOpen(false);
              setDismissalDate(parseIsoDate(emp.dismissal_date) || new Date());
              setDismissalTypeId(getEmployeeDismissalTypeId(emp as Record<string, unknown>));
              setDismissalReasonId(getEmployeeDismissalReasonId(emp as Record<string, unknown>));
            }}
            disabled={isDismissing}
            className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => void handleDismissEmployee()}
            disabled={isDismissing}
            className="h-9 rounded-lg border border-rose-200 bg-rose-50 px-4 text-[13px] font-semibold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDismissing ? "Увольнение..." : "Уволить"}
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={isResetPasswordModalOpen}
        onClose={() => {
          if (isGeneratingPassword) return;
          setIsResetPasswordModalOpen(false);
        }}
        className="max-w-md w-full p-6"
        showCloseButton={false}
      >
        <h4 className="m-0 text-[18px] font-bold text-slate-900">
          Сгенерировать новый пароль?
        </h4>
        <p className="mb-6 mt-2 text-[13px] text-slate-500">
          Действующий пароль сотрудника будет сброшен. После подтверждения система создаст новый пароль и сохранит его в профиле.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="!h-9 !px-4 !py-2 text-[13px]"
            onClick={() => setIsResetPasswordModalOpen(false)}
            disabled={isGeneratingPassword}
          >
            Отмена
          </Button>
          <Button
            size="sm"
            className="!h-9 !px-4 !py-2 text-[13px]"
            onClick={() => void handleGeneratePassword()}
            disabled={isGeneratingPassword}
          >
            {isGeneratingPassword ? "Генерация..." : "Сгенерировать"}
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={isPasswordResultModalOpen}
        onClose={() => setIsPasswordResultModalOpen(false)}
        className="max-w-md w-full p-6"
        showCloseButton={false}
      >
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
            <Check className="h-7 w-7" />
          </div>
        </div>
        <h4 className="m-0 text-[18px] font-bold text-slate-900">
          Пароль успешно сгенерирован
        </h4>
        <p className="mb-5 mt-2 text-[13px] text-slate-500">
          Новый пароль уже сохранен. Передайте его сотруднику безопасным способом.
        </p>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
          <div className="text-[12px] font-medium text-slate-500">Новый пароль</div>
          <div className="mt-1 break-all font-mono text-[22px] font-semibold leading-[1.35] text-slate-900">
            {generatedPassword}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="!h-9 !px-4 !py-2 text-[13px]"
            onClick={() => void handleCopyGeneratedPassword()}
            startIcon={
              isPasswordCopied ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )
            }
          >
            {isPasswordCopied ? "Скопировано" : "Копировать"}
          </Button>
          <Button
            size="sm"
            className="!h-9 !px-4 !py-2 text-[13px]"
            onClick={() => setIsPasswordResultModalOpen(false)}
          >
            Закрыть
          </Button>
        </div>
      </Modal>

    </>
  );
}

export default observer(EmployeeDetail);

/* ────────────────────────────────────────────────
 *  Sub-components
 * ──────────────────────────────────────────────── */

function HikvisionUserPicture({
  picture,
  name,
}: {
  picture?: string | null;
  name?: string | null;
}) {
  const [hasImageError, setHasImageError] = useState(false);
  const pictureSrc = resolveHikvisionPictureSrc(picture);

  if (pictureSrc && !hasImageError) {
    return (
      <img
        src={pictureSrc}
        alt={name || "Hikvision user"}
        className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 bg-slate-50 object-contain"
        loading="lazy"
        onError={() => setHasImageError(true)}
      />
    );
  }

  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-[13px] font-semibold text-slate-500">
      {buildHikvisionInitials(name)}
    </div>
  );
}

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
  action,
}: {
  label: string;
  value?: string;
  isLink?: boolean;
  linkType?: "email" | "phone" | "url";
  isStatus?: boolean;
  icon?: React.ReactNode;
  action?: React.ReactNode;
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
      <div className="flex flex-1 items-center gap-2">
        <Wrapper
          {...(href ? { href, className: "text-[13px] break-words hover:underline" } : { className: "text-[13px] break-words" })}
          style={{
            fontWeight: value ? 500 : 400,
            color:
              isLinked && value
                ? brandColor
                : isStatus && value === "Активный"
                  ? "#16a34a"
                  : isStatus && value === "Уволен"
                    ? "#dc2626"
                    : value
                      ? "#1e293b"
                      : "#cbd5e1",
          }}
        >
          {value || "—"}
        </Wrapper>
        {action}
      </div>
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
