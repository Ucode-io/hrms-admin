import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { ChevronDown, FileSpreadsheet, Info, Loader2, LogIn, MousePointerClick, SlidersHorizontal, X } from "lucide-react";
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
import { useLatePermissionsQuery } from "../../../api/services/latePermission.service";
import { useOffices } from "../../../components/map/useOffices";
import { BCP47, getLocale, translate, useTranslation } from "../../../i18n";
import { type FilterOption, filterSelectStyles } from "../../Calendar";
import { EmployeeAvatar } from "../../Timesheet/components/badges";
import { PeriodRangeNavigator } from "../../Timesheet/components/PeriodNavigator";
import { SCALE_META, formatDateRu, formatDuration, fromIsoDate, isToday, isWeekend, rangeForScale, shiftDays, toIsoDate, weekdayShort } from "../../Timesheet/constants";
import HoverTooltip from "../../../components/ui/tooltip/HoverTooltip";
import { Dropdown } from "../../../components/ui/dropdown/Dropdown";
import { type SheetCell, type SheetTotals, buildRow } from "./sheet";
import { type SheetData, employeeName, isDismissed, sheetInputsOf } from "./sheetData";
import DayModal from "./DayModal";
import { exportSheetXlsx } from "./exportSheet";

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
  // Сколько сотрудников показано: растёт по PAGE_SIZE при прокрутке вниз.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
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
  // Состав зависит и от периода (уволенные в нём), поэтому список — с начала.
  useEffect(() => setVisibleCount(PAGE_SIZE), [debouncedSearch, departmentIds, positionIds, locationIds, range.from]);
  const dates = useMemo(() => datesOf(range), [range]);
  const today = toIsoDate(new Date());

  const filters = {
    search: debouncedSearch || undefined,
    positions_id: positionIds.length ? positionIds : undefined,
    departments_id: departmentIds.length ? departmentIds : undefined,
    locations_id: locationIds.length ? locationIds : undefined,
  };
  // Состав табеля (решение 8): активные, за ними — уволенные не раньше начала
  // периода. В Items API нет «$or» и «IS NULL», поэтому это два запроса, а не один.
  // ponytail: подгрузка — растущий limit с нуля, каждая порция перезапрашивает
  // уже показанных (и их отметки); хватит на сотни строк, дальше — useInfiniteQuery.
  const activeQuery = useEmployeesQuery({ limit: visibleCount, offset: 0, status: "active", ...filters });
  const dismissedQuery = useEmployeesQuery({ limit: DISMISSED_LIMIT, offset: 0, status: "dismissed", dismissed_since: range.from, ...filters });
  const activeCount = Number(activeQuery.data?.count || 0);
  const dismissed = useMemo(() => (dismissedQuery.data?.response || []) as Employee[], [dismissedQuery.data?.response]);
  const employees = useMemo(() => {
    const active = (activeQuery.data?.response || []) as Employee[];
    const rows = [...active, ...dismissed.slice(0, Math.max(0, visibleCount - active.length))];
    // Принятые после конца периода в нём не работали.
    return rows.filter((employee) => !employee.date_hire || employee.date_hire.slice(0, 10) <= range.to);
  }, [activeQuery.data?.response, dismissed, visibleCount, range.to]);
  const totalCount = activeCount + dismissed.length;
  const hasMore = visibleCount < totalCount;
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
  // Late Permission всей компании за период — одним запросом, как смены.
  const permitsQuery = useLatePermissionsQuery({ dateFrom: range.from, dateTo: range.to, status: "approved" });
  const { data: policiesData } = useSettingsDirectoryQuery({ slug: "absence_policies", params: { limit: 1000, offset: 0 } });
  const policies = useMemo(() => ((policiesData as { response?: Record<string, unknown>[] } | undefined)?.response ?? []), [policiesData]);

  const data: SheetData = useMemo(
    () => ({
      attendance: attendanceQuery.data?.response ?? [],
      absences: absencesQuery.data?.response ?? [],
      shifts: shiftsQuery.data?.response ?? [],
      policies,
      latePermissions: permitsQuery.data ?? [],
    }),
    [attendanceQuery.data?.response, absencesQuery.data?.response, shiftsQuery.data?.response, policies, permitsQuery.data]
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
    (employeeIds.length > 0 && (attendanceQuery.isLoading || absencesQuery.isLoading || shiftsQuery.isLoading || permitsQuery.isLoading));
  const isFetching =
    activeQuery.isFetching || dismissedQuery.isFetching || attendanceQuery.isFetching || absencesQuery.isFetching || shiftsQuery.isFetching || permitsQuery.isFetching;
  // Смены периода приходят одной выборкой с потолком: обрезанная — это ложные «В» и заниженная норма.
  const shiftsTruncated = isShiftListTruncated(shiftsQuery.data);
  // Выгрузка берёт смены с экрана — только когда они уже этого периода.
  const shiftsReady = !shiftsQuery.isFetching && !shiftsQuery.isPreviousData;

  // Следующая порция — когда маркер под таблицей подходит к низу её прокрутки.
  // Пока грузится хоть что-то, не просим новую; после — эффект перепроверит маркер.
  // Ждём все запросы, а не только порционные: маркер есть лишь у отрисованной
  // таблицы, а её держит спиннер, пока не дошли уволенные и смены.
  const isLoadingMore = isFetching;
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || isLoadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setVisibleCount((count) => count + PAGE_SIZE);
      },
      { root: scrollRef.current, rootMargin: "300px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, visibleCount]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportSheetXlsx({ filters, range, dates, today, shifts: data.shifts, latePermissions: data.latePermissions, policies, label: `${range.from}_${range.to}` });
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
              {isExporting ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
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

        {/* Строка периода — как в прототипе: даты и обозначения слева, масштаб справа. */}
        <div className="flex flex-wrap items-center gap-2 border-x border-b border-slate-200 bg-white px-4 py-2 lg:px-6">
          <PeriodRangeNavigator scale={scale} anchor={anchor} onAnchorChange={setAnchor} />
          <button
            type="button"
            onClick={() => setAnchor(toIsoDate(new Date()))}
            className="inline-flex h-[38px] items-center rounded-[10px] border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            {t("common.today")}
          </button>
          <span className="mx-0.5 hidden h-5 w-px bg-slate-200 sm:block" />
          <Legend policies={policies} />
          <div className={`${PILL_GROUP} ml-auto`}>
            {(["month", "week"] as const).map((item) => (
              <button key={item} type="button" onClick={() => setScale(item)} className={`${pillButton(item === scale)} min-w-[72px] justify-center`}>
                {SCALE_META[item].label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 py-4 lg:px-6">
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
              <div ref={scrollRef} className="max-h-[calc(100vh-260px)] max-w-full overflow-auto">
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
                {hasMore ? (
                  <div ref={sentinelRef} className="sticky left-0 flex h-12 items-center justify-center">
                    {isLoadingMore ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : null}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>


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

const TOTAL_COLUMNS = ["plan", "hours", "late", "overtime", "days", "absences", "off_schedule"] as const;

const totalsHeaders = (t: ReturnType<typeof useTranslation>["t"], withOffSchedule: boolean) =>
  TOTAL_COLUMNS.filter((key) => withOffSchedule || key !== "off_schedule").map((key) => ({
    label: t(`attendance_sheet.col.${key}`),
    hint: t(`attendance_sheet.col_hint.${key}`),
  }));

/** Итог в часах и минутах; ровные часы — без «00м». */
const durationText = (minutes: number): string =>
  minutes > 0 && minutes % 60 === 0 ? translate("timesheet.duration.hours", { hours: minutes / 60 }) : formatDuration(minutes * 60);

/** Часы против нормы: от 80% — зелёный, от 50% — жёлтый, ниже — красный; без нормы — обычный. */
const hoursColor = ({ workedMinutes, planMinutes }: SheetTotals): string => {
  if (!planMinutes) return "text-slate-900";
  const ratio = workedMinutes / planMinutes;
  return ratio >= 0.8 ? "text-emerald-600" : ratio >= 0.5 ? "text-amber-500" : "text-rose-600";
};

function TotalsCells({ totals, withOffSchedule }: { totals: SheetTotals; withOffSchedule: boolean }) {
  const cell = "whitespace-nowrap px-2 py-1.5 text-right text-[12px]";
  return (
    <>
      <td className={`${cell} border-l border-slate-200 text-slate-400`}>{durationText(totals.planMinutes)}</td>
      <td className={`${cell} font-bold ${hoursColor(totals)}`}>{durationText(totals.workedMinutes)}</td>
      <td className={`${cell} font-semibold text-slate-700`}>
        {durationText(totals.lateMinutes)}
        {/* Под чертой — сколько отпросился (одобренные Late Permission до сегодня). */}
        {totals.permittedMinutes ? (
          <div className="mt-0.5 border-t border-slate-200 pt-0.5 text-[11px] font-medium text-slate-400">−{durationText(totals.permittedMinutes)}</div>
        ) : null}
      </td>
      <td className={`${cell} font-semibold text-slate-700`}>{durationText(totals.overtimeMinutes)}</td>
      <td className={`${cell} font-semibold text-slate-700`}>{totals.days || "—"}</td>
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
      // Пусто, как «нет данных»: что именно не так — в подсказке и модалке дня.
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
  if (cell.permitArriveBy) {
    hints.push(t("attendance_sheet.hint.permitted", { time: cell.permitArriveBy, duration: formatDuration(cell.permittedMinutes * 60) }));
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

/** Знак ячейки в обозначениях — плашка, как в прототипе. */
const LEGEND_CODE = "inline-flex h-[19px] min-w-[24px] flex-none items-center justify-center rounded px-1 text-[11px] font-semibold tabular-nums ring-1 ring-inset ring-slate-200";

function Legend({ policies }: { policies: Record<string, unknown>[] }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const items: { code: ReactNode; className?: string; label: string; desc: string }[] = [
    { code: "8,0", className: "text-slate-800", label: t("attendance_sheet.legend.worked"), desc: t("attendance_sheet.legend_desc.worked") },
    { code: "8,0", className: "text-orange-600", label: t("attendance_sheet.legend.late"), desc: t("attendance_sheet.legend_desc.late") },
    { code: <X size={12} strokeWidth={2.5} />, className: "bg-rose-50 text-rose-600", label: t("attendance_sheet.legend.absent"), desc: t("attendance_sheet.hint.absent") },
    { code: t("attendance_sheet.day_off_short"), className: "text-slate-400", label: t("attendance_sheet.legend.day_off"), desc: t("attendance_sheet.hint.day_off") },
    { code: <LogIn size={12} />, className: "text-emerald-600", label: t("attendance_sheet.legend.at_work"), desc: t("attendance_sheet.hint.at_work") },
    { code: "", label: t("attendance_sheet.legend.missing_mark"), desc: t("attendance_sheet.legend_desc.missing_mark") },
    { code: "4,0", className: "bg-slate-100 italic text-slate-400", label: t("attendance_sheet.legend.off_schedule"), desc: t("attendance_sheet.hint.off_schedule") },
    { code: <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />, label: t("attendance_sheet.legend.pending"), desc: t("attendance_sheet.legend_desc.pending") },
    ...policies.flatMap((policy) =>
      typeof policy.guid === "string" && typeof policy.title === "string"
        ? [{
            code: <Icon icon={typeof policy.icon === "string" && policy.icon ? policy.icon : "mdi:airplane"} className="h-3.5 w-3.5" style={{ color: typeof policy.color === "string" ? policy.color : undefined }} />,
            label: policy.title,
            desc: t("attendance_sheet.legend_desc.leave"),
          }]
        : []
    ),
  ];
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        title={t("attendance_sheet.legend.button_hint")}
        className={`dropdown-toggle inline-flex h-[30px] items-center gap-1.5 rounded-md px-2 text-[13px] text-slate-600 transition hover:bg-slate-100 ${isOpen ? "bg-slate-100" : ""}`}
      >
        <Info size={14} />
        {t("attendance_sheet.xlsx_legend")}
        {/* Как в прототипе: второй «8,0» (опоздание) в свёрнутом виде не повторяем. */}
        <span className="ml-0.5 hidden gap-[3px] md:inline-flex">
          {items.slice(0, 7).filter((_, index) => index !== 1).map((item, index) => (
            <em key={index} className={`${LEGEND_CODE} not-italic ${item.className ?? ""}`}>{item.code}</em>
          ))}
        </span>
        <ChevronDown size={14} className={`transition ${isOpen ? "rotate-180" : ""}`} />
      </button>
      <Dropdown isOpen={isOpen} onClose={() => setIsOpen(false)} className="left-0 w-[380px] max-w-[calc(100vw-32px)] overflow-hidden">
        <div className="px-3 pb-1 pt-2.5 text-[12px] font-semibold text-slate-500">{t("attendance_sheet.legend.title")}</div>
        <div className="max-h-[420px] overflow-auto px-1 pb-1">
          {items.map((item, index) => (
            <div key={index} className="flex items-start gap-2.5 rounded-md px-2 py-[7px] hover:bg-slate-50">
              <em className={`${LEGEND_CODE} mt-px h-[22px] min-w-[32px] text-[12px] not-italic ${item.className ?? ""}`}>{item.code}</em>
              <div className="min-w-0">
                <b className="block text-[13.5px] font-semibold text-slate-800">{item.label}</b>
                <small className="block text-[12.5px] leading-snug text-slate-500">{item.desc}</small>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-start gap-2 border-t border-slate-200 px-3 py-2.5 text-[12px] leading-snug text-slate-500">
          <MousePointerClick size={14} className="mt-px flex-none" />
          <span>{t("attendance_sheet.legend.footer")}</span>
        </div>
      </Dropdown>
    </div>
  );
}
