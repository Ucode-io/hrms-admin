import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import { CalendarCheck, CalendarDays, List, MapPinOff, Plane } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import CalendarModule from "../Calendar";
import TimeAttendancePage from "./Attendance";
import AttendanceEventsPage from "./Attendance/AttendanceEventsPage";
import AbsenceRequestsView from "./components/AbsenceRequestsView";
import { useTranslation } from "../../i18n";
import type { MessageKey } from "../../i18n/messages";

type TimeView = "calendar" | "attendance" | "events" | "absence" | "remote";

const VIEW_TABS: { value: TimeView; labelKey: MessageKey; icon: typeof CalendarDays }[] = [
  { value: "calendar", labelKey: "breadcrumb.calendar", icon: CalendarDays },
  { value: "attendance", labelKey: "time_module.list", icon: List },
  { value: "events", labelKey: "breadcrumb.attendance", icon: CalendarCheck },
  { value: "absence", labelKey: "dashboard.fallback.absence", icon: Plane },
  { value: "remote", labelKey: "time_module.remote_marks", icon: MapPinOff },
];

const DEFAULT_VIEW: TimeView = "calendar";

const isTimeView = (value: string | null): value is TimeView =>
  value === "calendar" ||
  value === "attendance" ||
  value === "events" ||
  value === "absence" ||
  value === "remote";

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

  return (
    <>
      <PageMeta title={`${t("breadcrumb.time")} | HRMS`} description={t("time_module.meta_description")} />

      {/* Active view (mounted conditionally to avoid breadcrumb/meta conflicts).
          The shared view selector is passed as `leftSlot` so it sits on the left
          of each tab's toolbar row. */}
      {activeView === "calendar" && <CalendarModule leftSlot={viewSelect} />}
      {activeView === "attendance" && <TimeAttendancePage leftSlot={viewSelect} />}
      {activeView === "events" && <AttendanceEventsPage leftSlot={viewSelect} />}
      {activeView === "absence" && <AbsenceRequestsView leftSlot={viewSelect} />}
      {activeView === "remote" && <TimeAttendancePage leftSlot={viewSelect} remoteOnly />}
    </>
  );
}

export default TimeModule;
