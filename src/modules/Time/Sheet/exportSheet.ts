// CSV табеля (решение 13): все сотрудники по фильтрам, а не видимая страница.
// Открывается в Excel — BOM и «;» даёт `downloadCsv` табеля времени.

import { type EmployeesListParams, type Employee, fetchEmployees } from "../../../api/services/employee.service";
import { fetchCalendarAttendance } from "../../../api/services/attendanceCalendar.service";
import absenceService, { type Absence } from "../../../api/services/absenceRequest.service";
import type { Shift } from "../../../api/services/shift.service";
import { translate } from "../../../i18n";
import { downloadCsv } from "../../Timesheet/exportCsv";
import { fromIsoDate } from "../../Timesheet/constants";
import { type SheetCell, type SheetTotals, buildRow } from "./sheet";
import { employeeName, sheetInputsOf } from "./sheetData";

// ponytail: активные одной выборкой до 2000 — крупнее компаний пока нет; дальше — постранично.
const ACTIVE_LIMIT = 2000;
const DISMISSED_LIMIT = 500;

const escapeCell = (value: string): string => `"${String(value ?? "").replace(/"/g, '""')}"`;

/** Часы числом с запятой: по колонке в Excel считают. */
const hours = (minutes: number): string => (Math.round((minutes / 60) * 100) / 100).toFixed(2).replace(".", ",");

const cellText = (cell: SheetCell): string => {
  let value = "";
  switch (cell.kind) {
    case "worked":
    case "late":
      value = cell.workedMinutes != null ? hours(cell.workedMinutes) : "";
      break;
    case "off_schedule":
      return `${translate("attendance_sheet.legend.off_schedule")} ${cell.workedMinutes != null ? hours(cell.workedMinutes) : ""}`.trim();
    case "at_work":
      value = translate("attendance_sheet.legend.at_work");
      break;
    case "missing_mark":
      value = translate("attendance_sheet.legend.missing_mark");
      break;
    case "absent":
      value = translate("attendance_sheet.legend.absent");
      break;
    case "leave":
      return cell.leave?.title || translate("dashboard.fallback.absence");
    case "day_off":
      // Словом, а не «В»: легенды в файле нет, рядом «Прогул» и «Нет отметки».
      return translate("attendance_sheet.csv_day_off");
    default:
      return "";
  }
  return cell.counted ? value : `${translate("attendance_sheet.csv_pending")}: ${value}`;
};

const totalsText = (totals: SheetTotals, withOffSchedule: boolean): string[] => [
  String(totals.days),
  hours(totals.workedMinutes),
  hours(totals.planMinutes),
  hours(totals.lateMinutes),
  hours(totals.overtimeMinutes),
  String(totals.absences),
  ...(withOffSchedule ? [String(totals.offScheduleDays)] : []),
];

export const exportSheetCsv = async ({
  filters,
  range,
  dates,
  today,
  shifts,
  policies,
  label,
}: {
  filters: EmployeesListParams;
  range: { from: string; to: string };
  dates: string[];
  today: string;
  /** Смены периода уже загружены экраном — компанией целиком. */
  shifts: Shift[];
  policies: Record<string, unknown>[];
  label: string;
}): Promise<void> => {
  const [active, dismissed] = await Promise.all([
    fetchEmployees({ ...filters, limit: ACTIVE_LIMIT, offset: 0, status: "active" }),
    fetchEmployees({ ...filters, limit: DISMISSED_LIMIT, offset: 0, status: "dismissed", dismissed_since: range.from }),
  ]);
  const employees = ([...(active?.response ?? []), ...(dismissed?.response ?? [])] as Employee[]).filter(
    (employee) => !employee.date_hire || employee.date_hire.slice(0, 10) <= range.to
  );
  const employeeIds = employees.map((employee) => employee.guid);
  const [attendance, absences] = await Promise.all([
    fetchCalendarAttendance({ employeeIds, dateFrom: range.from, dateTo: range.to }),
    absenceService.getCalendarListByAggregation({ employeeIds, dateFrom: range.from, dateTo: range.to }),
  ]);

  const inputs = sheetInputsOf(
    { attendance: attendance.response, absences: (absences.response ?? []) as Absence[], shifts, policies },
    dates,
    today
  );
  const rows = employees.map((employee) => ({ employee, ...buildRow(inputs(employee)) }));
  const withOffSchedule = rows.some((row) => row.totals.offScheduleDays > 0);

  const header = [
    translate("absence_request.employee"),
    translate("absence_calendar.position"),
    ...dates.map((date) => {
      const day = fromIsoDate(date);
      return `${String(day.getDate()).padStart(2, "0")}.${String(day.getMonth() + 1).padStart(2, "0")}`;
    }),
    translate("attendance_sheet.col.days"),
    translate("attendance_sheet.col.hours"),
    translate("attendance_sheet.col.plan"),
    translate("attendance_sheet.col.late"),
    translate("attendance_sheet.col.overtime"),
    translate("attendance_sheet.col.absences"),
    ...(withOffSchedule ? [translate("attendance_sheet.col.off_schedule")] : []),
  ];
  const lines = rows.map(({ employee, cells, totals }) =>
    [employeeName(employee), employee.positions_id_data?.title ?? "", ...cells.map(cellText), ...totalsText(totals, withOffSchedule)]
      .map(escapeCell)
      .join(";")
  );

  downloadCsv([header.map(escapeCell).join(";"), ...lines].join("\r\n"), `attendance-sheet_${label}.csv`);
};
