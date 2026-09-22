import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import { CalendarCheck, CalendarDays, List, Plane } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import CalendarModule from "../Calendar";
import TimeAttendancePage from "./Attendance";
import AttendanceEventsPage from "./Attendance/AttendanceEventsPage";
import AbsenceRequestsView from "./components/AbsenceRequestsView";
import { useTranslation } from "../../i18n";

type TimeView = "calendar" | "attendance" | "events" | "absence";

const VIEW_TABS: { value: TimeView; label: string; icon: typeof CalendarDays }[] = [
  { value: "calendar", label: "Календарь", icon: CalendarDays },
  { value: "attendance", label: "Список", icon: List },
  { value: "events", label: "Посещаемость", icon: CalendarCheck },
  { value: "absence", label: "Отсутствие", icon: Plane },
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
            {tab.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      <PageMeta title="Время | HRMS" description="Посещаемость и отсутствие сотрудников" />

      {/* Active view (mounted conditionally to avoid breadcrumb/meta conflicts).
          The shared view selector is passed as `leftSlot` so it sits on the left
          of each tab's toolbar row. */}
      {activeView === "calendar" && <CalendarModule leftSlot={viewSelect} />}
      {activeView === "attendance" && <TimeAttendancePage leftSlot={viewSelect} />}
      {activeView === "events" && <AttendanceEventsPage leftSlot={viewSelect} />}
      {activeView === "absence" && <AbsenceRequestsView leftSlot={viewSelect} />}
    </>
  );
}

export default TimeModule;
