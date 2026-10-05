import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { AlertCircle, Download, Loader2, LogIn, SlidersHorizontal, X } from "lucide-react";
import Select from "react-select";
import { toast } from "sonner";
import PageMeta from "../../../components/common/PageMeta";
import ExpandableSearchInput from "../../../components/form/ExpandableSearchInput";
import { showSelectedOptions } from "../../../components/form/showSelectedOptions";
import { PILL_GROUP, pillButton } from "../../../components/common/toolbarPill";
import { type Employee, useEmployeesQuery } from "../../../api/services/employee.service";
import { usePositionsQuery } from "../../../api/services/position.service";
import { useDepartmentsSettingsQuery } from "../../../api/services/department.service";
import { useSettingsDirectoryQuery } from "../../../api/services/settingsDirectory.service";
import { useCalendarAttendanceQuery } from "../../../api/services/attendanceCalendar.service";
import { useCalendarAbsencesQuery } from "../../../api/services/absenceRequest.service";
import { isShiftListTruncated, useShiftsQuery } from "../../../api/services/shift.service";
import { useOffices } from "../../../components/map/useOffices";
import companyStore from "../../../store/company.store";
import { BCP47, getLocale, useTranslation } from "../../../i18n";
import { type FilterOption, filterSelectStyles } from "../../Calendar";
import { EmployeeAvatar } from "../../Timesheet/components/badges";
import { PeriodRangeNavigator } from "../../Timesheet/components/PeriodNavigator";
import { SCALE_META, formatDateRu, formatDuration, fromIsoDate, isToday, isWeekend, rangeForScale, shiftDays, toIsoDate, weekdayShort } from "../../Timesheet/constants";
import EmployeesPaginationFooter from "../../Employees/List/components/EmployeesPaginationFooter";
import HoverTooltip from "../../../components/ui/tooltip/HoverTooltip";
import { buildPaginationItems } from "../Attendance";
import { type SheetCell, type SheetTotals, buildRow } from "./sheet";
import { type SheetData, employeeName, isDismissed, sheetInputsOf } from "./sheetData";
import DayModal from "./DayModal";
import { exportSheetCsv } from "./exportSheet";

const PAGE_SIZE = 20;
// ponytail: уволенные в периоде — одним запросом до 500; хватит, пока компании не текут сотнями в месяц.
const DISMISSED_LIMIT = 500;

type Scale = "month" | "week";

const datesOf = (range: { from: string; to: string }): string[] => {
  const dates: string[] = [];
  for (let date = range.from; date <= range.to; date = shiftDays(date, 1)) dates.push(date);
  return dates;
};

/** Часы ячейки: «8,5» — коротко, как в бумажном табеле. */
const hoursText = (minutes: number): string =>
  new Intl.NumberFormat(BCP47[getLocale()], { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(minutes / 60);

export default function AttendanceSheetView({ leftSlot }: { leftSlot?: ReactNode } = {}) {
  const { t } = useTranslation();
  const [scale, setScale] = useState<Scale>("month");
  const [anchor, setAnchor] = useState(() => toIsoDate(new Date()));
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [positionIds, setPositionIds] = useState<string[]>([]);
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<{ employeeId: string; date: string } | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  const range = useMemo(() => rangeForScale(scale, anchor), [scale, anchor]);
  // Состав зависит и от периода (уволенные в нём), поэтому страница — с первой.
  useEffect(() => setPage(1), [debouncedSearch, departmentIds, positionIds, locationIds, range.from]);
  const dates = useMemo(() => datesOf(range), [range]);
  const today = toIsoDate(new Date());

  const filters = {
    search: debouncedSearch || undefined,
    positions_id: positionIds.length ? positionIds : undefined,
    departments_id: departmentIds.length ? departmentIds : undefined,
    locations_id: locationIds.length ? locationIds : undefined,
  };
  const offset = (page - 1) * PAGE_SIZE;
  // Состав табеля (решение 8): активные постранично, за ними — уволенные не
  // раньше начала периода. В Items API нет «$or» и «IS NULL», поэтому это два
  // запроса, а не один.
  const activeQuery = useEmployeesQuery({ limit: PAGE_SIZE, offset, status: "active", ...filters });
  const dismissedQuery = useEmployeesQuery({ limit: DISMISSED_LIMIT, offset: 0, status: "dismissed", dismissed_since: range.from, ...filters });
  const activeCount = Number(activeQuery.data?.count || 0);
  const dismissed = useMemo(() => (dismissedQuery.data?.response || []) as Employee[], [dismissedQuery.data?.response]);
  const employees = useMemo(() => {
    const active = (activeQuery.data?.response || []) as Employee[];
    const start = Math.max(0, offset - activeCount);
    const rows = [...active, ...dismissed.slice(start, start + PAGE_SIZE - active.length)];
    // Принятые после конца периода в нём не работали.
    return rows.filter((employee) => !employee.date_hire || employee.date_hire.slice(0, 10) <= range.to);
  }, [activeQuery.data?.response, dismissed, offset, activeCount, range.to]);
  const totalCount = activeCount + dismissed.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const employeeIds = useMemo(() => employees.map((employee) => employee.guid), [employees]);

  const attendanceQuery = useCalendarAttendanceQuery({
    params: { employeeIds, dateFrom: range.from, dateTo: range.to },
    querySettings: { keepPreviousData: true },
  });
  const absencesQuery = useCalendarAbsencesQuery({
    params: { employeeIds, dateFrom: range.from, dateTo: range.to },
    querySettings: { keepPreviousData: true },
  });
  const shiftsQuery = useShiftsQuery(range);
  const { data: policiesData } = useSettingsDirectoryQuery({ slug: "absence_policies", params: { limit: 1000, offset: 0 } });
  const policies = useMemo(() => ((policiesData as { response?: Record<string, unknown>[] } | undefined)?.response ?? []), [policiesData]);

  const data: SheetData = useMemo(
    () => ({
      attendance: attendanceQuery.data?.response ?? [],
      absences: absencesQuery.data?.response ?? [],
      shifts: shiftsQuery.data?.response ?? [],
      policies,
    }),
    [attendanceQuery.data?.response, absencesQuery.data?.response, shiftsQuery.data?.response, policies]
  );
  const rows = useMemo(() => {
    const inputs = sheetInputsOf(data, dates, today);
    return employees.map((employee) => ({ employee, ...buildRow(inputs(employee)) }));
  }, [data, dates, today, employees]);
  const hasOffSchedule = rows.some((row) => row.totals.offScheduleDays > 0);

  const { data: positionsData } = usePositionsQuery({ params: { all: true } });
  const { data: departmentsData } = useDepartmentsSettingsQuery({ params: { limit: 1000 } });
  const offices = useOffices();
  const optionsOf = (source: unknown): FilterOption[] =>
    (((source as { response?: { guid?: string; title?: string }[] } | undefined)?.response) ?? [])
      .filter((item) => item?.guid && item?.title)
      .map((item) => ({ value: item.guid as string, label: item.title as string }));
  const positionOptions = useMemo(() => optionsOf(positionsData), [positionsData]);
  const departmentOptions = useMemo(() => optionsOf(departmentsData), [departmentsData]);
  const locationOptions = useMemo(
    () => [...offices.entries()].map(([value, office]) => ({ value, label: office.title })).filter((option) => option.label),
    [offices]
  );
  const activeFiltersCount = [departmentIds, positionIds, locationIds].filter((list) => list.length > 0).length;
  const selectPortalTarget = typeof document !== "undefined" ? document.body : null;

  const isLoading =
    activeQuery.isLoading ||
    dismissedQuery.isLoading ||
    (employeeIds.length > 0 && (attendanceQuery.isLoading || absencesQuery.isLoading || shiftsQuery.isLoading));
  const isFetching =
    activeQuery.isFetching || dismissedQuery.isFetching || attendanceQuery.isFetching || absencesQuery.isFetching || shiftsQuery.isFetching;
  // Смены периода приходят одной выборкой с потолком: обрезанная — это ложные «В» и заниженная норма.
  const shiftsTruncated = isShiftListTruncated(shiftsQuery.data);
  // Выгрузка берёт смены с экрана — только когда они уже этого периода.
  const shiftsReady = !shiftsQuery.isFetching && !shiftsQuery.isPreviousData;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportSheetCsv({ filters, range, dates, today, shifts: data.shifts, policies, label: `${range.from}_${range.to}` });
    } catch (error) {
      console.error("Attendance sheet export failed:", error);
      toast.error(t("attendance_sheet.export_error"));
    } finally {
      setIsExporting(false);
    }
  };

  const selectedEmployee = selected ? employees.find((employee) => employee.guid === selected.employeeId) ?? null : null;
  const selectedRow = selected ? rows.find((row) => row.employee.guid === selected.employeeId) : undefined;
  const selectedCell = selected ? selectedRow?.cells.find((cell) => cell.date === selected.date) ?? null : null;
  const selectedAttendance = selected
    ? data.attendance.find((row) => row.user_base_id === selected.employeeId && String(row.date).slice(0, 10) === selected.date) ?? null
    : null;

  const filterSelect = (id: string, options: FilterOption[], value: string[], onChange: (next: string[]) => void, placeholder: string) => (
    <div style={{ minWidth: "200px", maxWidth: "280px", flex: "0 1 280px" }}>
      <Select<FilterOption, true>
        isMulti {...showSelectedOptions}
        inputId={id}
        options={options}
        value={options.filter((option) => value.includes(option.value))}
        onChange={(next) => onChange(next.map((option) => option.value))}
        placeholder={placeholder}
        noOptionsMessage={() => t("common.no_options_found")}
        styles={filterSelectStyles}
        menuPortalTarget={selectPortalTarget}
        menuPosition="fixed"
      />
    </div>
  );

  return (
    <>
      <PageMeta title={`${t("attendance_sheet.tab")} | HRMS`} description={t("time_module.meta_description")} />
      <div className="-mx-3 -mt-3 md:-mx-4 md:-mt-4">
        <div className="flex flex-wrap items-center gap-2.5 border border-t-0 border-slate-200 bg-white px-4 py-2 lg:px-6">
          {leftSlot}
          <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2">
            <div className={PILL_GROUP}>
              {(["month", "week"] as const).map((item) => (
                <button key={item} type="button" onClick={() => setScale(item)} className={pillButton(item === scale)}>
                  {SCALE_META[item].label}
                </button>
              ))}
            </div>
            <PeriodRangeNavigator scale={scale} anchor={anchor} onAnchorChange={setAnchor} />
            <ExpandableSearchInput
              value={search}
              onChange={setSearch}
              inputId="attendance-sheet-search"
              placeholder={t("tasks.assignee.search_placeholder")}
              expandedWidth={280}
              collapsedSize={38}
              brandColor="var(--color-brand-500)"
            />
            <button
              type="button"
              onClick={() => setIsFiltersOpen((open) => !open)}
              aria-label={activeFiltersCount > 0 ? t("tasks.filters.filter_button_with_count", { count: activeFiltersCount }) : t("tasks.filters.filter_button")}
              title={activeFiltersCount > 0 ? t("tasks.filters.filter_button_with_count", { count: activeFiltersCount }) : t("tasks.filters.filter_button")}
              className={`relative inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] border transition ${
                isFiltersOpen || activeFiltersCount > 0 ? "border-brand-200 bg-brand-50 text-brand-500" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <SlidersHorizontal size={15} />
              {activeFiltersCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-semibold text-white">
                  {activeFiltersCount}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={isExporting || totalCount === 0 || !shiftsReady}
              className="inline-flex h-[38px] items-center gap-1.5 rounded-[10px] border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isExporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              {isExporting ? t("attendance_sheet.exporting") : t("attendance_sheet.export")}
            </button>
          </div>
        </div>

        {isFiltersOpen ? (
          <div className="flex flex-wrap items-center gap-2 border border-t border-slate-200 bg-slate-50 px-4 py-2 lg:px-6">
            {filterSelect("attendance-sheet-department", departmentOptions, departmentIds, setDepartmentIds, t("absence_calendar.department"))}
            {filterSelect("attendance-sheet-position", positionOptions, positionIds, setPositionIds, t("absence_calendar.position"))}
            {filterSelect("attendance-sheet-location", locationOptions, locationIds, setLocationIds, t("attendance_sheet.branch"))}
            {activeFiltersCount > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setDepartmentIds([]);
                  setPositionIds([]);
                  setLocationIds([]);
                }}
                className="ml-auto inline-flex h-10 items-center rounded-xl border border-brand-200 bg-brand-50 px-3 text-sm font-medium text-brand-500 transition hover:bg-brand-100"
              >
                {t("common.reset")}
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="px-4 py-4 pb-20 lg:px-6">
          <Legend policies={policies} />
          {shiftsTruncated ? (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-700">
              {t("attendance_sheet.shifts_truncated", { count: shiftsQuery.data?.count ?? 0 })}
            </div>
          ) : null}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {isFetching && !isLoading ? <div className="absolute inset-x-0 top-0 z-30 h-0.5 animate-pulse bg-brand-400" /> : null}
            {isLoading ? (
              <div className="flex min-h-[320px] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
            ) : rows.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-500">{t("attendance_sheet.empty")}</div>
            ) : (
              // Своя прокрутка по обеим осям — иначе шапка с датами не закрепится:
              // sticky держится за ближайший прокручиваемый контейнер.
              <div className="max-h-[calc(100vh-250px)] max-w-full overflow-auto">
                <table className="min-w-full border-collapse text-[12px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className={`sticky left-0 top-0 z-30 min-w-[230px] bg-slate-50 px-4 py-2 text-left text-xs font-semibold text-slate-500 ${HEAD_EDGE}`}>{t("absence_request.employee")}</th>
                      {dates.map((date) => {
                        const day = fromIsoDate(date);
                        return (
                          <th
                            key={date}
                            className={`sticky top-0 z-20 px-0.5 py-1.5 text-center font-semibold ${HEAD_EDGE} ${scale === "week" ? "min-w-[84px]" : "min-w-[38px]"} ${isToday(date) ? "bg-blue-50 text-blue-700" : isWeekend(date) ? "bg-slate-50 text-rose-500" : "bg-slate-50 text-slate-600"}`}
                          >
                            <div className="text-[12px] leading-tight">{day.getDate()}</div>
                            <div className="text-[10px] font-medium leading-tight opacity-70">{weekdayShort(day.getDay())}</div>
                          </th>
                        );
                      })}
                      {totalsHeaders(t, hasOffSchedule).map(({ label, hint }, index) => (
                        <th key={label} className={`sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-2 py-2 text-right ${HEAD_EDGE} text-[11px] font-semibold text-slate-500 ${index === 0 ? "border-l border-slate-200" : ""}`}>
                          <HoverTooltip text={hint} align="end">
                            <span className="cursor-help border-b border-dotted border-slate-300">{label}</span>
                          </HoverTooltip>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map(({ employee, cells, totals }) => (
                      <tr key={employee.guid} className="group hover:bg-slate-50/60">
                        <td className="sticky left-0 z-10 bg-white px-4 py-1.5 group-hover:bg-slate-50">
                          <div className="flex items-center gap-2.5">
                            <EmployeeAvatar name={employeeName(employee)} photo={employee.photo ?? undefined} seed={employee.guid} size={28} />
                            <div className="min-w-0">
                              <div className="truncate text-[13px] font-semibold text-slate-800">{employeeName(employee)}</div>
                              <div className="truncate text-[11px] text-slate-400">
                                {isDismissed(employee) && employee.dismissal_date
                                  ? t("attendance_sheet.dismissed_on", { date: employee.dismissal_date.slice(0, 10).split("-").reverse().join(".") })
                                  : employee.positions_id_data?.title || ""}
                              </div>
                            </div>
                          </div>
                        </td>
                        {cells.map((cell) => (
                          <td key={cell.date} className={`px-0.5 py-[3px] text-center ${isToday(cell.date) ? "bg-blue-50/50" : ""}`}>
                            <SheetCellView cell={cell} onOpen={() => setSelected({ employeeId: employee.guid, date: cell.date })} />
                          </td>
                        ))}
                        <TotalsCells totals={totals} withOffSchedule={hasOffSchedule} />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {totalCount > 0 ? (
        <EmployeesPaginationFooter
          visibleRangeLabel={t("attendance.showing_range", { from: offset + 1, to: Math.min(offset + PAGE_SIZE, totalCount), total: totalCount })}
          paginationItems={buildPaginationItems(page, totalPages)}
          currentPage={page}
          totalPages={totalPages}
          brandColor={companyStore.mainColor}
          onPrevious={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
          onPageChange={setPage}
        />
      ) : null}

      {selected && selectedEmployee && selectedCell ? (
        <DayModal
          employee={selectedEmployee}
          cell={selectedCell}
          attendance={selectedAttendance}
          shifts={(data.shifts || []).filter((shift) => shift.user_base_id === selected.employeeId && String(shift.date).slice(0, 10) === selected.date)}
          canPrev={selected.date > range.from}
          canNext={selected.date < range.to}
          onNavigate={(direction) => setSelected({ ...selected, date: shiftDays(selected.date, direction) })}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </>
  );
}

/** Нижняя граница закреплённой шапки: обычный border у sticky-ячейки с border-collapse уезжает. */
const HEAD_EDGE = "shadow-[inset_0_-1px_0_#e2e8f0]";

const TOTAL_COLUMNS = ["days", "hours", "plan", "late", "overtime", "absences", "off_schedule"] as const;

const totalsHeaders = (t: ReturnType<typeof useTranslation>["t"], withOffSchedule: boolean) =>
  TOTAL_COLUMNS.filter((key) => withOffSchedule || key !== "off_schedule").map((key) => ({
    label: t(`attendance_sheet.col.${key}`),
    hint: t(`attendance_sheet.col_hint.${key}`),
  }));

function TotalsCells({ totals, withOffSchedule }: { totals: SheetTotals; withOffSchedule: boolean }) {
  const cell = "whitespace-nowrap px-2 py-1.5 text-right text-[12px]";
  return (
    <>
      <td className={`${cell} border-l border-slate-200 font-semibold text-slate-700`}>{totals.days || "—"}</td>
      <td className={`${cell} font-bold text-slate-900`}>{totals.workedMinutes ? hoursText(totals.workedMinutes) : "—"}</td>
      <td className={`${cell} text-slate-400`}>{totals.planMinutes ? hoursText(totals.planMinutes) : "—"}</td>
      <td className={`${cell} ${totals.lateMinutes ? "font-semibold text-orange-600" : "text-slate-400"}`}>{formatDuration(totals.lateMinutes * 60)}</td>
      <td className={`${cell} ${totals.overtimeMinutes ? "font-semibold text-emerald-600" : "text-slate-400"}`}>{formatDuration(totals.overtimeMinutes * 60)}</td>
      <td className={`${cell} ${totals.absences ? "font-semibold text-rose-600" : "text-slate-400"}`}>{totals.absences || "—"}</td>
      {withOffSchedule ? <td className={`${cell} text-slate-500`}>{totals.offScheduleDays || "—"}</td> : null}
    </>
  );
}

/** Заливка Leave — цвет политики с прозрачностью. */
const tint = (hex: string, alpha: number): string => {
  const clean = /^#?([0-9a-f]{6})$/i.exec(hex.trim())?.[1];
  if (!clean) return `rgba(20, 184, 166, ${alpha})`;
  const value = parseInt(clean, 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
};

function SheetCellView({ cell, onOpen }: { cell: SheetCell; onOpen: () => void }) {
  const { t } = useTranslation();
  if (cell.kind === "outside") return <div className="h-[30px] rounded-[5px] bg-[repeating-linear-gradient(135deg,#f8fafc_0_4px,#f1f5f9_4px_8px)]" />;

  let content: ReactNode = null;
  let className = "text-slate-800";
  let style: React.CSSProperties | undefined;
  // Подсказка: что значит знак, и цифры дня. Время отметок сюда не кладём —
  // оно по часам сотрудника, а админка показывает время смотрящего (ADR-0014).
  const hints: string[] = [];
  const worked = cell.workedMinutes != null ? t("attendance_sheet.hint.worked", { hours: hoursText(cell.workedMinutes) }) : "";
  const plan = cell.planMinutes ? t("attendance_sheet.hint.plan", { hours: hoursText(cell.planMinutes) }) : "";
  const overtime = cell.overtimeMinutes ? t("attendance_sheet.hint.overtime", { duration: formatDuration(cell.overtimeMinutes * 60) }) : "";
  const missing = cell.checkIn ? t("attendance_sheet.hint.missing_out") : t("attendance_sheet.hint.missing_in");

  switch (cell.kind) {
    case "worked":
    case "late":
    case "off_schedule":
      content = cell.workedMinutes != null ? hoursText(cell.workedMinutes) : "—";
      if (cell.kind === "late") {
        className = "font-semibold text-orange-600";
        hints.push(t("attendance_sheet.hint.late", { duration: formatDuration(cell.lateMinutes * 60) }));
      }
      if (cell.kind === "off_schedule") {
        className = "italic text-slate-400 bg-slate-100";
        hints.push(t("attendance_sheet.hint.off_schedule"), worked);
      } else {
        hints.push(worked, plan, overtime);
      }
      break;
    case "at_work":
      content = <LogIn size={14} className="mx-auto text-emerald-600" />;
      hints.push(t("attendance_sheet.hint.at_work"), plan);
      break;
    case "missing_mark":
      content = <AlertCircle size={14} className="mx-auto text-amber-500" />;
      // Заливка — как у Leave: цвет знака с прозрачностью.
      style = { backgroundColor: tint("#f59e0b", 0.14) };
      hints.push(missing, plan);
      break;
    case "absent":
      content = <X size={14} strokeWidth={2.5} className="mx-auto text-rose-600" />;
      className = "bg-rose-50";
      hints.push(t("attendance_sheet.hint.absent"), plan);
      break;
    case "leave":
      content = <Icon icon={cell.leave?.icon || "mdi:airplane"} className="mx-auto h-4 w-4" style={{ color: cell.leave?.color }} />;
      style = { backgroundColor: tint(cell.leave?.color || "", 0.14) };
      hints.push(cell.leave?.title || t("dashboard.fallback.absence"));
      if (cell.leave) hints.push(cell.leave.dateFrom === cell.leave.dateTo ? formatDateRu(cell.leave.dateFrom) : `${formatDateRu(cell.leave.dateFrom)} — ${formatDateRu(cell.leave.dateTo)}`);
      break;
    case "day_off":
      content = t("attendance_sheet.day_off_short");
      className = "text-slate-300 bg-slate-50/80";
      hints.push(t("attendance_sheet.hint.day_off"));
      break;
    case "empty":
      hints.push(t("attendance_sheet.hint.empty"), plan);
      break;
    default:
      content = null;
  }
  // Не засчитано (ждёт согласования) — серым, точка скажет почему.
  if (!cell.counted && cell.kind !== "off_schedule") {
    className = "text-slate-400";
    hints.push(t("attendance_sheet.hint.not_counted"));
  }
  if (cell.pending.includes("mark")) hints.push(t("attendance_sheet.pending.mark"));
  if (cell.pendingLeave) hints.push(t("attendance_sheet.pending.leave", { title: cell.pendingLeave.title }));

  return (
    <HoverTooltip text={hints.filter(Boolean).join(" · ")} className="flex w-full">
    <button
      type="button"
      onClick={onOpen}
      className={`relative flex h-[30px] w-full items-center justify-center rounded-[5px] px-0.5 text-[12px] tabular-nums outline-none transition hover:ring-1 hover:ring-inset hover:ring-brand-300 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400 ${className}`}
      style={style}
    >
      {content}
      {cell.pending.length > 0 ? <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-amber-400" /> : null}
    </button>
    </HoverTooltip>
  );
}

function Legend({ policies }: { policies: Record<string, unknown>[] }) {
  const { t } = useTranslation();
  const chip = "inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600";
  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      <span className={chip}><b className="tabular-nums text-slate-800">8,0</b>{t("attendance_sheet.legend.worked")}</span>
      <span className={chip}><b className="tabular-nums text-orange-600">8,0</b>{t("attendance_sheet.legend.late")}</span>
      <span className={chip}><X size={12} strokeWidth={2.5} className="text-rose-600" />{t("attendance_sheet.legend.absent")}</span>
      <span className={chip}><b className="text-slate-400">{t("attendance_sheet.day_off_short")}</b>{t("attendance_sheet.legend.day_off")}</span>
      <span className={chip}><LogIn size={12} className="text-emerald-600" />{t("attendance_sheet.legend.at_work")}</span>
      <span className={chip}><AlertCircle size={12} className="text-amber-500" />{t("attendance_sheet.legend.missing_mark")}</span>
      <span className={chip}><i className="text-slate-400">4,0</i>{t("attendance_sheet.legend.off_schedule")}</span>
      <span className={chip}><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />{t("attendance_sheet.legend.pending")}</span>
      {policies.map((policy) =>
        typeof policy.guid === "string" && typeof policy.title === "string" ? (
          <span key={policy.guid} className={chip}>
            <Icon icon={typeof policy.icon === "string" && policy.icon ? policy.icon : "mdi:airplane"} className="h-3.5 w-3.5" style={{ color: typeof policy.color === "string" ? policy.color : undefined }} />
            {policy.title}
          </span>
        ) : null
      )}
    </div>
  );
}
