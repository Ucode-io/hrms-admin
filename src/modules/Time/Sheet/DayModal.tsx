import { type ReactNode, useState } from "react";
import { Link } from "react-router";
import { Icon } from "@iconify/react";
import { ArrowUpRight, ChevronLeft, ChevronRight, Hourglass, Plus, UserX } from "lucide-react";
import { useQueryClient } from "react-query";
import { toast } from "sonner";
import { Modal } from "../../../components/ui/modal";
import type { Employee } from "../../../api/services/employee.service";
import type { Shift } from "../../../api/services/shift.service";
import type { CalendarAttendanceRow } from "../../../api/services/attendanceCalendar.service";
import { useApproveAbsence, useUpdateAbsence } from "../../../api/services/absenceRequest.service";
import { findApprovalProcessFor, useApprovalProcessesQuery, useEntityApprovalsQuery } from "../../../api/services/approval.service";
import { isProcessComplete } from "../../Settings/Approvals/approvalRuntime";
import { getAttendanceSourceKind } from "../../../utils/attendanceSourcePriority";
import { useTranslation } from "../../../i18n";
import { EmployeeAvatar } from "../../Timesheet/components/badges";
import { formatDateRu, formatDayHeader, formatDuration, fromIsoDate } from "../../Timesheet/constants";
import { formatShiftTime } from "../../Shifts/constants";
import AttendanceDayDetail from "../Attendance/AttendanceDayDetail";
import AttendanceMarkModal from "../Attendance/AttendanceMarkModal";
import { type ReviewRecord, useAttendanceReview } from "../Attendance/useAttendanceReview";
import { type SheetCell, clockOf } from "./sheet";
import { employeeName } from "./sheetData";

const first = (value: unknown): string => String([value].flat()[0] ?? "").trim().toLowerCase();

const reviewRecordOf = (row: CalendarAttendanceRow, employee: Employee, cell: SheetCell): ReviewRecord => {
  const status = first(row.status);
  const action = first(row.action_status);
  return {
    guid: row.guid,
    date: cell.date,
    employeeGuid: employee.guid,
    departmentId: employee.departments_id ?? "",
    checkInTime: cell.checkIn,
    checkOutTime: cell.checkOut,
    delayTime: clockOf(row.delay_time),
    // Неподтверждённая ручная строка — та же нерешённая заявка, что и
    // «requested»: иначе окно согласования открылось бы только для чтения.
    requestStatus: status === "accepted" || status === "rejected" ? status : "requested",
    actionStatus: action === "present" || action === "late" || action === "absent" ? action : "unknown",
    sourceType: getAttendanceSourceKind(row.source_type),
  };
};

/**
 * День сотрудника из табеля (решения 11–12): что было, и действия над ним —
 * ручная отметка и решения по тому, что ждёт. Leave отсюда не заводится: для
 * этого есть «Календарь».
 */
export default function DayModal({
  employee,
  cell,
  attendance,
  shifts,
  canPrev,
  canNext,
  onNavigate,
  onClose,
}: {
  employee: Employee;
  cell: SheetCell;
  attendance: CalendarAttendanceRow | null;
  shifts: Shift[];
  canPrev: boolean;
  canNext: boolean;
  onNavigate: (direction: 1 | -1) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isMarkOpen, setIsMarkOpen] = useState(false);
  const approveAbsence = useApproveAbsence();
  const updateAbsence = useUpdateAbsence();

  const refresh = () => {
    void queryClient.invalidateQueries(["calendar-attendance"]);
    void queryClient.invalidateQueries(["calendar-absences"]);
  };

  const reviewRecord = attendance && cell.pending.includes("mark") ? reviewRecordOf(attendance, employee, cell) : null;
  const review = useAttendanceReview({
    records: reviewRecord ? [reviewRecord] : [],
    onError: (message) => toast.error(message),
    onDone: refresh,
  });

  const decideLeave = async (status: "approved" | "rejected") => {
    const leave = cell.pendingLeave;
    if (!leave) return;
    try {
      if (status === "approved") {
        await approveAbsence.mutateAsync({ guid: leave.guid });
      } else {
        await updateAbsence.mutateAsync({ guid: leave.guid, data: { status: [status], reviewed_at: new Date().toISOString() } });
      }
      refresh();
      toast.success(status === "approved" ? t("absence_calendar.request_approved") : t("absence_calendar.request_rejected"));
    } catch (error) {
      console.error("Attendance sheet: leave decision failed", error);
      toast.error(t("absence_calendar.status_change_error"));
    }
  };
  const isDecidingLeave = approveAbsence.isLoading || updateAbsence.isLoading;

  // Одобрение Leave идёт через процесс согласования отдела, как в «Отсутствиях»:
  // пока этапы не пройдены, одобрить отсюда нельзя — только перейти туда.
  const { data: approvalProcesses } = useApprovalProcessesQuery();
  const leaveProcess = cell.pendingLeave
    ? findApprovalProcessFor(approvalProcesses ?? [], "absence_approval", employee.departments_id ?? "")
    : undefined;
  const { data: leaveProgress } = useEntityApprovalsQuery("absence", leaveProcess && cell.pendingLeave ? [cell.pendingLeave.guid] : []);
  const leaveNeedsStages = Boolean(
    leaveProcess && cell.pendingLeave && !isProcessComplete(leaveProcess, leaveProgress?.[cell.pendingLeave.guid] ?? null)
  );

  const name = employeeName(employee);
  const shiftText = shifts.map(formatShiftTime).filter(Boolean).join(", ");
  const year = fromIsoDate(cell.date).getFullYear();
  const hasMarks = Boolean(cell.checkIn || cell.checkOut);
  const today = new Date();
  const isPast = cell.date <= `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const canAddMark = isPast && cell.kind !== "leave" && cell.kind !== "outside";

  const statusChip = (): ReactNode => {
    const chip = (label: string, tone: string) => (
      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-semibold ${tone}`}>{label}</span>
    );
    switch (cell.kind) {
      case "worked":
        return chip(t("attendance_sheet.status.worked"), "bg-emerald-50 text-emerald-700");
      case "late":
        return chip(`${t("attendance_sheet.legend.late")} · ${formatDuration(cell.lateMinutes * 60)}`, "bg-orange-50 text-orange-700");
      case "at_work":
        return chip(t("attendance_sheet.legend.at_work"), "bg-emerald-50 text-emerald-700");
      case "missing_mark":
        return chip(t("attendance_sheet.legend.missing_mark"), "bg-amber-50 text-amber-700");
      case "absent":
        return chip(t("attendance_sheet.legend.absent"), "bg-rose-50 text-rose-700");
      case "off_schedule":
        return chip(t("attendance_sheet.legend.off_schedule"), "bg-slate-100 text-slate-600");
      case "day_off":
        return chip(t("attendance_sheet.legend.day_off"), "bg-slate-100 text-slate-500");
      case "leave":
        return chip(cell.leave?.title || t("dashboard.fallback.absence"), "bg-sky-50 text-sky-700");
      default:
        return null;
    }
  };

  const reasonCard = (icon: ReactNode, title: string, hint: string, tone = "border-slate-200 bg-slate-50") => (
    <div className={`flex items-start gap-3 rounded-2xl border px-4 py-4 ${tone}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
      </div>
    </div>
  );

  const body = (): ReactNode => {
    if (cell.kind === "leave") {
      const leave = cell.leave;
      return reasonCard(
        <Icon icon={leave?.icon || "mdi:airplane"} className="h-6 w-6" style={{ color: leave?.color }} />,
        leave?.title || t("dashboard.fallback.absence"),
        leave ? `${formatDateRu(leave.dateFrom)}${leave.dateTo !== leave.dateFrom ? ` — ${formatDateRu(leave.dateTo)}` : ""}` : ""
      );
    }
    if (cell.kind === "absent") {
      return reasonCard(<UserX size={22} className="text-rose-500" />, t("attendance_sheet.day.absent_title"), t("attendance_sheet.day.absent_hint"), "border-rose-100 bg-rose-50/60");
    }
    if (hasMarks) return <AttendanceDayDetail employeeId={employee.guid} date={cell.date} withManual />;
    if (cell.kind === "day_off") return reasonCard(<Hourglass size={20} className="text-slate-400" />, t("attendance_sheet.legend.day_off"), t("attendance_sheet.day.day_off_hint"));
    if (cell.kind === "future") return reasonCard(<Hourglass size={20} className="text-slate-400" />, t("attendance_sheet.day.future_title"), "");
    return reasonCard(<Hourglass size={20} className="text-slate-400" />, t("attendance_sheet.day.empty_title"), t("attendance_sheet.day.empty_hint"));
  };

  return (
    <>
      {/* Поверх открыта форма или согласование — Escape закрывает только их. */}
      <Modal isOpen onClose={isMarkOpen || review.isOpen ? () => undefined : onClose} className="w-full max-w-4xl p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-6 py-4 pr-14">
          <div className="inline-flex items-center gap-1">
            <button type="button" disabled={!canPrev} onClick={() => onNavigate(-1)} aria-label={t("time_events.prev_day")} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40">
              <ChevronLeft size={16} />
            </button>
            <button type="button" disabled={!canNext} onClick={() => onNavigate(1)} aria-label={t("time_events.next_day")} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40">
              <ChevronRight size={16} />
            </button>
          </div>
          <EmployeeAvatar name={name} photo={employee.photo ?? undefined} seed={employee.guid} size={40} />
          <div className="min-w-0">
            <div className="truncate text-base font-bold text-slate-900">{name}</div>
            <div className="text-xs text-slate-500">
              {formatDayHeader(cell.date)} {year} · {shiftText ? t("attendance_sheet.day.shift", { range: shiftText }) : t("attendance_sheet.day.no_shift")}
            </div>
          </div>
          {statusChip()}
        </div>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto bg-slate-50/60 px-6 py-5">
          {cell.pendingLeave ? (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <Icon icon={cell.pendingLeave.icon} className="h-5 w-5" style={{ color: cell.pendingLeave.color }} />
              <div className="min-w-0 flex-1 text-sm text-amber-900">
                <b>{t("attendance_sheet.pending.leave", { title: cell.pendingLeave.title })}</b>
                <span className="ml-1.5 text-amber-700">
                  {formatDateRu(cell.pendingLeave.dateFrom)}
                  {cell.pendingLeave.dateTo !== cell.pendingLeave.dateFrom ? ` — ${formatDateRu(cell.pendingLeave.dateTo)}` : ""}
                </span>
              </div>
              <button type="button" disabled={isDecidingLeave} onClick={() => void decideLeave("rejected")} className="h-8 rounded-lg border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60">
                {t("attendance_sheet.day.reject")}
              </button>
              {leaveNeedsStages ? (
                <Link to="/time?view=absence" className="inline-flex h-8 items-center rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700">
                  {t("attendance_sheet.day.review")}
                </Link>
              ) : (
                <button type="button" disabled={isDecidingLeave} onClick={() => void decideLeave("approved")} className="h-8 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                  {t("attendance_sheet.day.approve")}
                </button>
              )}
            </div>
          ) : null}

          {reviewRecord ? (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="min-w-0 flex-1 text-sm font-semibold text-amber-900">{t("attendance_sheet.pending.mark")}</div>
              <button type="button" onClick={() => review.open(reviewRecord)} className="h-8 rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-800 hover:bg-amber-100">
                {t("attendance_sheet.day.review")}
              </button>
              <button type="button" disabled={review.isUpdating} onClick={() => void review.confirm(reviewRecord)} className="h-8 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                {t("attendance.confirm_record")}
              </button>
            </div>
          ) : null}

          {body()}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-6 py-4">
          <Link
            to={`/time?view=events&employee=${employee.guid}&date=${cell.date}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowUpRight size={15} />
            {t("attendance_sheet.day.open_events")}
          </Link>
          <span className="flex-1" />
          {canAddMark ? (
            <button
              type="button"
              onClick={() => setIsMarkOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-500 px-4 text-[13px] font-semibold text-white hover:bg-brand-600"
            >
              <Plus size={15} />
              {t("attendance_sheet.day.add_mark")}
            </button>
          ) : null}
          <button type="button" onClick={onClose} className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 hover:bg-slate-50">
            {t("common.close")}
          </button>
        </div>
      </Modal>

      <AttendanceMarkModal
        isOpen={isMarkOpen}
        onClose={() => setIsMarkOpen(false)}
        defaultDate={cell.date}
        employee={{ guid: employee.guid, label: name }}
        initialTimes={hasMarks ? { checkIn: cell.checkIn, checkOut: cell.checkOut } : undefined}
        onSaved={refresh}
      />
      {review.modal}
    </>
  );
}
