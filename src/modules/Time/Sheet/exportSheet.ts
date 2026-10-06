// Выгрузка табеля в Excel (решение 13): все сотрудники по фильтрам, а не
// видимая страница. Часы — числами, знаки — буквами и цветами экрана («П», «В»,
// «Нет отметки» — пусто), легенда под таблицей.

import { type EmployeesListParams, type Employee, fetchEmployees } from "../../../api/services/employee.service";
import { fetchCalendarAttendance } from "../../../api/services/attendanceCalendar.service";
import absenceService, { type Absence } from "../../../api/services/absenceRequest.service";
import type { Shift } from "../../../api/services/shift.service";
import { translate } from "../../../i18n";
import type { MessageKey } from "../../../i18n/messages";
import { fromIsoDate, weekdayShort } from "../../Timesheet/constants";
import { type SheetCell, type SheetTotals, buildRow } from "./sheet";
import { employeeName, sheetInputsOf } from "./sheetData";
import { type Cell, type CellStyle, buildXlsx, downloadBlob } from "./xlsx";

// ponytail: активные одной выборкой до 2000 — крупнее компаний пока нет; дальше — постранично.
const ACTIVE_LIMIT = 2000;
const DISMISSED_LIMIT = 500;

/** Часы числом: по колонке в Excel считают. */
const hours = (minutes: number): number => Math.round((minutes / 60) * 100) / 100;
const HOURS = "0.0#";

// Те же цвета, что на экране (tailwind): знак читается так же, как в табеле.
const STYLE = {
  header: { bold: true, fill: "F1F5F9", align: "center" },
  headerWeekend: { bold: true, fill: "F1F5F9", align: "center", color: "F43F5E" },
  name: { bold: true },
  worked: { numFmt: HOURS, align: "center" },
  late: { numFmt: HOURS, align: "center", bold: true, color: "EA580C" },
  offSchedule: { numFmt: HOURS, align: "center", italic: true, color: "94A3B8", fill: "F1F5F9" },
  atWork: { align: "center", color: "059669" },
  absent: { align: "center", color: "E11D48", fill: "FFE4E6" },
  dayOff: { align: "center", color: "94A3B8" },
  pending: { align: "center", italic: true, color: "94A3B8" },
  outside: { fill: "F8FAFC" },
  total: { bold: true, align: "right" },
  totalHours: { bold: true, align: "right", numFmt: HOURS },
} satisfies Record<string, CellStyle>;

/** Светлый оттенок цвета политики — заливка Leave, как на экране. */
const lighten = (hex: string): string => {
  const clean = /^#?([0-9a-f]{6})$/i.exec(hex.trim())?.[1] ?? "14B8A6";
  return [0, 2, 4]
    .map((i) => Math.round(parseInt(clean.slice(i, i + 2), 16) + (255 - parseInt(clean.slice(i, i + 2), 16)) * 0.82))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
};

const cellOf = (cell: SheetCell): Cell => {
  const worked = cell.workedMinutes != null ? hours(cell.workedMinutes) : null;
  if (!cell.counted && cell.kind !== "off_schedule" && cell.kind !== "absent") {
    // Ждёт решения и не засчитано: числом его не считать, поэтому текстом.
    const value = worked != null ? String(worked).replace(".", ",") : translate(`attendance_sheet.legend.${cell.kind === "at_work" ? "at_work" : "missing_mark"}`);
    return { value: `${translate("attendance_sheet.csv_pending")}: ${value}`, style: STYLE.pending };
  }
  switch (cell.kind) {
    case "worked":
      return { value: worked, style: STYLE.worked };
    case "late":
      return { value: worked, style: STYLE.late };
    case "off_schedule":
      return { value: worked, style: STYLE.offSchedule };
    case "at_work":
      return { value: translate("attendance_sheet.legend.at_work"), style: STYLE.atWork };
    case "absent":
      return { value: translate("attendance_sheet.absent_short"), style: STYLE.absent };
    case "leave":
      return {
        value: cell.leave?.title || translate("dashboard.fallback.absence"),
        style: { align: "center", fill: lighten(cell.leave?.color || "") },
      };
    case "day_off":
      return { value: translate("attendance_sheet.day_off_short"), style: STYLE.dayOff };
    case "outside":
      return { value: null, style: STYLE.outside };
    default:
      return null;
  }
};

const totalsOf = (totals: SheetTotals, withOffSchedule: boolean): Cell[] => [
  { value: hours(totals.planMinutes), style: STYLE.totalHours },
  { value: hours(totals.workedMinutes), style: STYLE.totalHours },
  { value: hours(totals.lateMinutes), style: STYLE.totalHours },
  { value: hours(totals.overtimeMinutes), style: STYLE.totalHours },
  { value: totals.days, style: STYLE.total },
  { value: totals.absences, style: STYLE.total },
  ...(withOffSchedule ? [{ value: totals.offScheduleDays, style: STYLE.total }] : []),
];

/** Легенда под таблицей: в файле нет экрана с подсказками. */
const legendRows = (policies: Record<string, unknown>[]): Cell[][] => [
  [{ value: translate("attendance_sheet.xlsx_legend"), style: { bold: true } }],
  [{ value: 8, style: STYLE.worked }, translate("attendance_sheet.legend.worked")],
  [{ value: 8, style: STYLE.late }, translate("attendance_sheet.legend.late")],
  [{ value: 4, style: STYLE.offSchedule }, translate("attendance_sheet.hint.off_schedule")],
  [{ value: translate("attendance_sheet.absent_short"), style: STYLE.absent }, translate("attendance_sheet.hint.absent")],
  [null, `${translate("attendance_sheet.legend.missing_mark")}: ${translate("attendance_sheet.legend_desc.missing_mark")}`],
  [{ value: translate("attendance_sheet.legend.at_work"), style: STYLE.atWork }, translate("attendance_sheet.hint.at_work")],
  [{ value: translate("attendance_sheet.day_off_short"), style: STYLE.dayOff }, translate("attendance_sheet.hint.day_off")],
  [{ value: `${translate("attendance_sheet.csv_pending")}: 8`, style: STYLE.pending }, translate("attendance_sheet.hint.not_counted")],
  ...policies
    .filter((policy) => typeof policy.title === "string" && policy.title)
    .map((policy): Cell[] => [
      { value: String(policy.title), style: { align: "center", fill: lighten(typeof policy.color === "string" ? policy.color : "") } },
      translate("dashboard.fallback.absence"),
    ]),
];

export const exportSheetXlsx = async ({
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

  const totalsHeader: MessageKey[] = [
    "attendance_sheet.col.plan",
    "attendance_sheet.col.hours",
    "attendance_sheet.col.late",
    "attendance_sheet.col.overtime",
    "attendance_sheet.col.days",
    "attendance_sheet.col.absences",
    ...(withOffSchedule ? (["attendance_sheet.col.off_schedule"] as const) : []),
  ];
  const header: Cell[] = [
    { value: translate("absence_request.employee"), style: STYLE.header },
    { value: translate("absence_calendar.position"), style: STYLE.header },
    ...dates.map((date): Cell => {
      const day = fromIsoDate(date);
      const weekend = day.getDay() === 0 || day.getDay() === 6;
      return {
        value: `${String(day.getDate()).padStart(2, "0")} ${weekdayShort(day.getDay())}`,
        style: weekend ? STYLE.headerWeekend : STYLE.header,
      };
    }),
    ...totalsHeader.map((key): Cell => ({ value: translate(key), style: STYLE.header })),
  ];
  const body = rows.map(({ employee, cells, totals }): Cell[] => [
    { value: employeeName(employee), style: STYLE.name },
    employee.positions_id_data?.title ?? "",
    ...cells.map(cellOf),
    ...totalsOf(totals, withOffSchedule),
  ]);

  const blob = await buildXlsx({
    name: translate("attendance_sheet.tab"),
    rows: [header, ...body, [], [], ...legendRows(policies)],
    widths: [30, 22, ...dates.map(() => 10), ...totalsHeader.map(() => 11)],
    freeze: { cols: 2, rows: 1 },
  });
  downloadBlob(blob, `attendance-sheet_${label}.xlsx`);
};
