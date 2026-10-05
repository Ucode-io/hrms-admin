// Ответы API → вход `buildRow`. Общее для экрана и CSV-выгрузки: оба строят
// табель из одних и тех же трёх источников, что и «Календарь».

import type { Employee } from "../../../api/services/employee.service";
import type { Absence } from "../../../api/services/absenceRequest.service";
import type { CalendarAttendanceRow } from "../../../api/services/attendanceCalendar.service";
import type { Shift } from "../../../api/services/shift.service";
import type { RowInput, SheetLeave } from "./sheet";

export type SheetData = {
  attendance: CalendarAttendanceRow[];
  absences: Absence[];
  shifts: Shift[];
  policies: Record<string, unknown>[];
};

export const employeeName = (employee: Employee): string =>
  [employee.second_name, employee.first_name].filter(Boolean).join(" ").trim() || "—";

export const isDismissed = (employee: Employee): boolean =>
  [employee.status].flat().map(String).includes("dismissed");

const text = (value: unknown): string => (typeof value === "string" ? value : "");

/** Leave из ответа `get_calendar_absences`; отклонённые табелю не нужны. */
const leaveOf = (absence: Absence, policies: Map<string, Record<string, unknown>>): SheetLeave | null => {
  const status = String([absence.status].flat()[0] ?? "").trim().toLowerCase();
  if (status !== "approved" && status !== "pending") return null;
  const dateFrom = text(absence.date_from).slice(0, 10);
  const dateTo = text(absence.date_to).slice(0, 10) || dateFrom;
  if (!dateFrom) return null;
  const policy = policies.get(absence.absence_policies_id) ?? {};
  const relation = absence.absence_policies_id_data ?? {};
  return {
    guid: absence.guid,
    title: text(relation.title) || text(absence.absence_policy_title) || text(policy.title),
    icon: text(relation.icon) || text(absence.absence_policy_icon) || text(policy.icon) || "mdi:airplane",
    color: text(relation.color) || text(absence.absence_policy_color) || text(policy.color) || "#14B8A6",
    status,
    dateFrom,
    dateTo,
  };
};

/** Фабрика входа строки: индексы строятся один раз на весь табель. */
export const sheetInputsOf = (data: SheetData, dates: string[], today: string) => {
  const policies = new Map(data.policies.map((policy) => [text(policy.guid), policy]));

  const attendance = new Map<string, Map<string, CalendarAttendanceRow>>();
  for (const row of data.attendance) {
    const date = text(row.date).slice(0, 10);
    if (!row.user_base_id || !date) continue;
    const byDate = attendance.get(row.user_base_id) ?? new Map();
    byDate.set(date, row);
    attendance.set(row.user_base_id, byDate);
  }

  const shifts = new Map<string, Map<string, Shift[]>>();
  for (const shift of data.shifts) {
    if (!shift.user_base_id) continue;
    const date = text(shift.date).slice(0, 10);
    const byDate = shifts.get(shift.user_base_id) ?? new Map();
    byDate.set(date, [...(byDate.get(date) ?? []), shift]);
    shifts.set(shift.user_base_id, byDate);
  }

  const leaves = new Map<string, SheetLeave[]>();
  const leaveById = new Map<string, SheetLeave>();
  for (const absence of data.absences) {
    const leave = leaveOf(absence, policies);
    if (!leave) continue;
    leaves.set(absence.user_base_id, [...(leaves.get(absence.user_base_id) ?? []), leave]);
    leaveById.set(leave.guid, leave);
  }

  return (employee: Employee): RowInput => ({
    dates,
    today,
    hireDate: text(employee.date_hire).slice(0, 10),
    dismissalDate: isDismissed(employee) ? text(employee.dismissal_date).slice(0, 10) : "",
    shiftsByDate: shifts.get(employee.guid) ?? new Map(),
    attendanceByDate: attendance.get(employee.guid) ?? new Map(),
    leaves: leaves.get(employee.guid) ?? [],
    leaveById,
  });
};
