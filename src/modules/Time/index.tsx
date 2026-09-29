import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import { CalendarCheck, CalendarDays, Clock, List, Plane } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import CalendarModule from "../Calendar";
import TimeAttendancePage from "./Attendance";
import AttendanceEventsPage from "./Attendance/AttendanceEventsPage";
import AbsenceRequestsView from "./components/AbsenceRequestsView";
import LatePermissionRequestsView from "./components/LatePermissionRequestsView";
import { useTranslation } from "../../i18n";
import type { MessageKey } from "../../i18n/messages";

type TimeView = "calendar" | "attendance" | "events" | "absence";

const VIEW_TABS: { value: TimeView; labelKey: MessageKey; icon: typeof CalendarDays }[] = [
  { value: "calendar", labelKey: "breadcrumb.calendar", icon: CalendarDays },
  { value: "attendance", labelKey: "time_module.list", icon: List },
  { value: "events", labelKey: "breadcrumb.attendance", icon: CalendarCheck },
  { value: "absence", labelKey: "dashboard.fallback.absence", icon: Plane },
];

const DEFAULT_VIEW: TimeView = "calendar";

const isTimeView = (value: string | null): value is TimeView =>
  value === "calendar" ||
  value === "attendance" ||
  value === "events" ||
  value === "absence";

function TimeModule() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeView: TimeView = useMemo(() => {
    const param = searchParams.get("view");
    return isTimeView(param) ? param : DEFAULT_VIEW;
  }, [searchParams]);

  const handleViewChange = useCallback(
    (view: TimeView) => {
      const next = new URLSearchParams(searchParams);
      next.set("view", view);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  // Внутри «Отсутствия» — ещё и заявки на опоздание (ADR-0015): тот же
  // разговор «отпросился», но другая сущность и свой список.
  const absenceKind = searchParams.get("kind") === "late" ? "late" : "absence";
  const handleKindChange = (kind: "absence" | "late") => {
    const next = new URLSearchParams(searchParams);
    if (kind === "late") next.set("kind", "late");
    else next.delete("kind");
    setSearchParams(next, { replace: true });
  };

  // Shared view selector rendered on the LEFT of each tab's toolbar row.
  const viewSelect = (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "3px",
        borderRadius: "12px",
        border: "1px solid #e2e8f0",
        backgroundColor: "#f8fafc",
        height: "38px",
      }}
    >
      {VIEW_TABS.map((tab) => {
        const isActive = activeView === tab.value;
        const TabIcon = tab.icon;
        return (
          <button
            key={tab.value}
            type="button"
            id={`time-view-${tab.value}`}
            onClick={() => handleViewChange(tab.value)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              height: "30px",
              padding: "0 12px",
              border: isActive ? "1px solid var(--color-brand-100)" : "1px solid transparent",
              borderRadius: "8px",
              backgroundColor: isActive ? "#fff" : "transparent",
              color: isActive ? "var(--company-color)" : "#64748b",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
              transition: "all 0.2s",
              boxShadow: isActive ? "0 1px 2px rgba(15, 23, 42, 0.06)" : "none",
              whiteSpace: "nowrap",
            }}
          >
            <TabIcon style={{ width: "17px", height: "17px" }} />
            {t(tab.labelKey)}
          </button>
        );
      })}
    </div>
  );

  // Вкладки над самой таблицей, а не в шапке: переключают список, не вид.
  const kindTabs = (
    <div className="flex items-center gap-1 border-b border-gray-100 px-3">
      {([
        { value: "absence", labelKey: "dashboard.fallback.absence", icon: Plane },
        { value: "late", labelKey: "late_permission.tab", icon: Clock },
      ] as const).map((kind) => {
        const isActive = absenceKind === kind.value;
        const KindIcon = kind.icon;
        return (
          <button
            key={kind.value}
            type="button"
            onClick={() => handleKindChange(kind.value)}
            className={`-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold transition ${
              isActive ? "" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
            style={isActive ? { color: "var(--company-color)", borderColor: "var(--company-color)" } : undefined}
          >
            <KindIcon className="h-4 w-4" />
            {t(kind.labelKey)}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      <PageMeta title={`${t("breadcrumb.time")} | HRMS`} description={t("time_module.meta_description")} />

      {/* Active view (mounted conditionally to avoid breadcrumb/meta conflicts).
          The shared view selector is passed as `leftSlot` so it sits on the left
          of each tab's toolbar row. */}
      {activeView === "calendar" && <CalendarModule leftSlot={viewSelect} />}
      {activeView === "attendance" && <TimeAttendancePage leftSlot={viewSelect} />}
      {activeView === "events" && <AttendanceEventsPage leftSlot={viewSelect} />}
      {activeView === "absence" && absenceKind === "absence" && (
        <AbsenceRequestsView leftSlot={viewSelect} tabs={kindTabs} />
      )}
      {activeView === "absence" && absenceKind === "late" && (
        <LatePermissionRequestsView leftSlot={viewSelect} tabs={kindTabs} />
      )}
    </>
  );
}

export default TimeModule;
