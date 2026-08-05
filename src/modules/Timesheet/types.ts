/**
 * Источник записи времени — производная от `mode` в Time Doctor.
 *
 * `hrms_manual` — ручное время, заведённое в HRMS и прошедшее согласование;
 * от `manual` (правка в самом Time Doctor) отличается принципиально: у него
 * есть статус и автор.
 */
export type TimesheetSource =
  | "tracker"
  | "manual"
  | "mobile"
  | "break"
  | "hrms_manual"
  | "other";

/** Статус ручной записи: заводится как `pending`, дальше решение согласующего. */
export type ManualTimeStatus = "pending" | "approved" | "rejected";

export type TimesheetView = "table" | "timeline";

/** Масштаб таймлайна. Определяет только диапазон дат запроса. */
export type TimelineScale = "day" | "week" | "month";

export type TimesheetEmployee = {
  mappingId: string;
  employeeId: string;
  name: string;
  photo: string;
  email: string;
  departmentId: string | null;
  department: string;
  positionId: string | null;
  position: string;
};

export type TimesheetEntry = {
  id: string;
  mappingId: string;
  date: string;
  /** Локальное время «как на стене», без Z: сервер уже применил часовой пояс. */
  start: string | null;
  end: string | null;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  durationHours: number;
  source: TimesheetSource;
  mode: string;
  projectId: string;
  projectName: string;
  taskId: string;
  taskName: string;
  reason: string;
  /** Запись правили вручную в самом Time Doctor. */
  isEdited: boolean;
  deviceId: string;
  employeeId: string | null;
  employeeName: string;
  employeePhoto: string;
  department: string;
  /** Нужен, чтобы найти процесс согласования записи (процесс задан на отдел). */
  departmentId?: string | null;
  position: string;
  /** Ниже — только у ручных записей HRMS. */
  isManual?: boolean;
  status?: ManualTimeStatus;
  createdBy?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewComment?: string;
  createdAt?: string | null;
};

export type TimesheetTotals = {
  totalSeconds: number;
  totalHours: number;
  breakSeconds: number;
  breakHours: number;
  workedSeconds: number;
  workedHours: number;
  bySource: Record<TimesheetSource, number>;
  entryCount: number;
};

export type TimesheetDirectoryItem = { id: string; name: string; projectId?: string };

export type TimesheetListResult = {
  from: string;
  to: string;
  total: number;
  limit: number;
  offset: number;
  totals: TimesheetTotals;
  /** Ручное время, ещё не прошедшее согласование: показано, но в итоги не входит. */
  pendingManual?: { count: number; seconds: number };
  entries: TimesheetEntry[];
  employees: TimesheetEmployee[];
  projects: TimesheetDirectoryItem[];
  tasks: TimesheetDirectoryItem[];
};

export type TimelineDay = {
  date: string;
  totalSeconds: number;
  workedSeconds: number;
  breakSeconds: number;
  bySource: Record<TimesheetSource, number>;
  entryCount: number;
  planHours: number;
  planSeconds: number;
  isDayOff: boolean;
  holiday: string | null;
  absence: string | null;
  firstStart: string;
  lastEnd: string;
};

export type TimelineRow = {
  mappingId: string;
  employeeId: string;
  name: string;
  photo: string;
  department: string;
  departmentId: string | null;
  position: string;
  totalSeconds: number;
  totalHours: number;
  workedSeconds: number;
  workedHours: number;
  planHours: number;
  planSeconds: number;
  days: TimelineDay[];
};

export type TimesheetTimelineResult = {
  from: string;
  to: string;
  dates: string[];
  dayTotals: number[];
  /** Итоги по всей компании, а не по странице строк. */
  totals: TimesheetTotals;
  /** План по всей компании за период. */
  planSeconds: number;
  rows: TimelineRow[];
  /** Всего сотрудников под фильтрами — предел подгрузки. */
  total: number;
  limit: number;
  offset: number;
  employees: TimesheetEmployee[];
  projects: TimesheetDirectoryItem[];
  tasks: TimesheetDirectoryItem[];
};

export type TimesheetDaySummary = TimesheetTotals & {
  date: string;
  planHours: number;
  planSeconds: number;
  isDayOff: boolean;
  holiday: string | null;
  absence: string | null;
  firstStart: string | null;
  lastEnd: string | null;
};

export type TimesheetProjectGroup = {
  projectId: string;
  projectName: string;
  totalSeconds: number;
  totalHours: number;
  entryCount: number;
  tasks: { taskId: string; taskName: string; seconds: number; hours: number }[];
};

export type TimesheetHistoryDay = {
  date: string;
  totalSeconds: number;
  totalHours: number;
  workedSeconds: number;
  breakSeconds: number;
  bySource: Record<TimesheetSource, number>;
  entryCount: number;
  planHours: number;
  isDayOff: boolean;
  holiday: string | null;
  absence: string | null;
};

export type TimesheetDayResult = {
  date: string;
  employee: TimesheetEmployee;
  day: TimesheetDaySummary;
  entries: TimesheetEntry[];
  /** Справочники для формы ручного времени прямо на странице дня. */
  projects: TimesheetDirectoryItem[];
  tasks: TimesheetDirectoryItem[];
  byProject: TimesheetProjectGroup[];
  history: TimesheetHistoryDay[];
};

/** Фильтры разделены на две группы: диапазон дат живёт отдельно, им управляет
 *  навигатор периода, а не панель фильтров. */
export type TimesheetFilters = {
  search: string;
  employeeId: string;
  departmentId: string;
  projectId: string;
  taskId: string;
  source: TimesheetSource | "";
};
