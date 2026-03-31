import axios from "axios";
import { useQuery } from "react-query";

const REPORTS_BASE_URL = "https://api.admin.u-code.io";
const REPORTS_FUNCTION_PATH =
  "/v2/invoke_function/udevs-hrms-reports?project-id=9a462573-ce11-4288-928a-a6ba754b6998";
const GET_AGE_DISTRIBUTION_METHOD = "get_age_distribution";
const GET_AGE_DISTRIBUTION_TABLE_METHOD = "get_age_distribution_table";
const GET_GENDER_DISTRIBUTION_METHOD = "get_gender_distribution";
const GET_GENDER_DISTRIBUTION_TABLE_METHOD = "get_gender_distribution_table";
const GET_STAFF_COUNT_METHOD = "get_staff_count";
const GET_STAFF_COUNT_TABLE_METHOD = "get_staff_count_table";
const GET_STAFF_TURNOVER_METHOD = "get_staff_turnover";
const GET_STAFF_TURNOVER_TABLE_METHOD = "get_staff_turnover_table";
const GET_TENURE_DISTRIBUTION_METHOD = "get_tenure_distribution";
const GET_TENURE_DISTRIBUTION_TABLE_METHOD = "get_tenure_distribution_table";
const GET_ABSENCE_BALANCE_METHOD = "get_absence_balance";
const GET_ABSENCE_BALANCE_TABLE_METHOD = "get_absence_balance_table";
const GET_ATTENDANCE_METHOD = "get_attendance";
const GET_ATTENDANCE_TABLE_METHOD = "get_attendance_table";
const GET_SPORT_ATTENDANCE_METHOD = "get_sport_attendance";
const GET_SPORT_ATTENDANCE_TABLE_METHOD = "get_sport_attendance_table";
const GET_PAYROLL_METHOD = "get_payroll";
const GET_PAYROLL_TABLE_METHOD = "get_payroll_table";

type JsonRecord = Record<string, unknown>;

export type EmployeeAgeInfo = {
  guid: string | null;
  full_name: string;
  age: number | null;
  birth_date: string | null;
};

export type AgeGroupDistributionItem = {
  key: string;
  label: string;
  count: number;
};

export type BirthdaysByMonthItem = {
  month: number;
  label: string;
  employees_count: number;
};

export type AverageAgeBreakdownItem = {
  id: string | null;
  label: string;
  average_age: number | null;
  employees_count: number;
};

export type AgeDistributionResult = {
  cards?: {
    average_age?: number;
    total_employees?: number;
    youngest_employee?: EmployeeAgeInfo | null;
    oldest_employee?: EmployeeAgeInfo | null;
  };
  charts?: {
    age_groups?: AgeGroupDistributionItem[];
    birthdays_by_month?: BirthdaysByMonthItem[];
    average_age_by_departments?: AverageAgeBreakdownItem[];
    average_age_by_locations?: AverageAgeBreakdownItem[];
  };
  filters_applied?: JsonRecord;
};

export type AgeDistributionInvokeResponse = {
  method: typeof GET_AGE_DISTRIBUTION_METHOD;
  result: AgeDistributionResult;
};

export type AgeDistributionTableItem = {
  guid: string;
  full_name: string;
  birth_date: string | null;
  age: number;
  level: string;
  position: string;
  department: string;
  division: string;
};

export type AgeDistributionTablePagination = {
  page: number;
  limit: number;
  total_count: number;
  total_pages: number;
  from: number;
  to: number;
  has_previous_page: boolean;
  has_next_page: boolean;
};

export type AgeDistributionTableResult = {
  items: AgeDistributionTableItem[];
  pagination: AgeDistributionTablePagination;
  filters_applied?: JsonRecord;
};

export type AgeDistributionTableInvokeResponse = {
  method: typeof GET_AGE_DISTRIBUTION_TABLE_METHOD;
  result: AgeDistributionTableResult;
};

export type GenderDistributionItem = {
  key: "male" | "female" | "unspecified" | string;
  label: string;
  count: number;
  percentage: number;
};

export type GenderDistributionResult = {
  summary?: {
    total_employees?: number;
  };
  chart?: {
    distribution?: GenderDistributionItem[];
  };
  filters_applied?: JsonRecord;
};

export type GenderDistributionInvokeResponse = {
  method: typeof GET_GENDER_DISTRIBUTION_METHOD;
  result: GenderDistributionResult;
};

export type GenderDistributionTableItem = {
  guid: string;
  full_name: string;
  gender: string;
  level: string;
  position: string;
  department: string;
  division: string;
  location: string;
};

export type GenderDistributionTablePagination = {
  page: number;
  limit: number;
  total_count: number;
  total_pages: number;
  from: number;
  to: number;
  has_previous_page: boolean;
  has_next_page: boolean;
};

export type GenderDistributionTableResult = {
  items: GenderDistributionTableItem[];
  pagination: GenderDistributionTablePagination;
  filters_applied?: JsonRecord;
};

export type GenderDistributionTableInvokeResponse = {
  method: typeof GET_GENDER_DISTRIBUTION_TABLE_METHOD;
  result: GenderDistributionTableResult;
};

export type StaffCountCardMetrics = {
  average_growth_percent: number;
  average_growth_people: number;
  average_turnover_percent: number;
  average_turnover_people: number;
  current_total: number;
};

export type StaffCountDynamicsItem = {
  month_start: string;
  label: string;
  new_hires: number;
  dismissed: number;
  total: number;
};

export type StaffCountShareItem = {
  id: string | null;
  label: string;
  employees_count: number;
  percentage: number;
};

export type StaffCountResult = {
  cards?: Partial<StaffCountCardMetrics>;
  charts?: {
    dynamics?: StaffCountDynamicsItem[];
    by_departments?: StaffCountShareItem[];
    by_locations?: StaffCountShareItem[];
  };
  filters_applied?: JsonRecord;
};

export type StaffCountInvokeResponse = {
  method: typeof GET_STAFF_COUNT_METHOD;
  result: StaffCountResult;
};

export type StaffCountTableItem = {
  guid: string;
  full_name: string;
  start_date: string | null;
  dismissed_from: string | null;
  level: string;
  position: string;
  department: string;
  division: string;
  location: string;
};

export type StaffCountTablePagination = {
  page: number;
  limit: number;
  total_count: number;
  total_pages: number;
  from: number;
  to: number;
  has_previous_page: boolean;
  has_next_page: boolean;
};

export type StaffCountTableResult = {
  items: StaffCountTableItem[];
  pagination: StaffCountTablePagination;
  filters_applied?: JsonRecord;
};

export type StaffCountTableInvokeResponse = {
  method: typeof GET_STAFF_COUNT_TABLE_METHOD;
  result: StaffCountTableResult;
};

export type StaffTurnoverCardMetrics = {
  total_turnover_percent: number;
  total_turnover_people: number;
  average_turnover_percent: number;
  average_turnover_people: number;
  average_tenure_months: number;
  current_total: number;
};

export type StaffTurnoverMonthlyItem = {
  month_start: string;
  label: string;
  turnover_percent: number;
  dismissed_count: number;
  total_employees: number;
};

export type StaffTurnoverShareItem = {
  id: string | null;
  label: string;
  dismissed_count: number;
  percentage: number;
};

export type StaffTurnoverResult = {
  cards?: Partial<StaffTurnoverCardMetrics>;
  charts?: {
    monthly_turnover?: StaffTurnoverMonthlyItem[];
    by_reasons?: StaffTurnoverShareItem[];
    by_types?: StaffTurnoverShareItem[];
  };
  filters_applied?: JsonRecord;
};

export type StaffTurnoverInvokeResponse = {
  method: typeof GET_STAFF_TURNOVER_METHOD;
  result: StaffTurnoverResult;
};

export type StaffTurnoverTableItem = {
  guid: string;
  full_name: string;
  last_day_in_office: string | null;
  last_working_day: string | null;
  tenure: string;
  tenure_days: number;
  dismissal_reason: string;
  dismissal_type: string;
};

export type StaffTurnoverTablePagination = {
  page: number;
  limit: number;
  total_count: number;
  total_pages: number;
  from: number;
  to: number;
  has_previous_page: boolean;
  has_next_page: boolean;
};

export type StaffTurnoverTableResult = {
  items: StaffTurnoverTableItem[];
  pagination: StaffTurnoverTablePagination;
  filters_applied?: JsonRecord;
};

export type StaffTurnoverTableInvokeResponse = {
  method: typeof GET_STAFF_TURNOVER_TABLE_METHOD;
  result: StaffTurnoverTableResult;
};

export type TenureEmployeeInfo = {
  guid: string | null;
  full_name: string;
  tenure_years: number | null;
  start_date: string | null;
};

export type TenureGroupDistributionItem = {
  key: string;
  label: string;
  count: number;
};

export type TenureAnniversaryByMonthItem = {
  month: number;
  label: string;
  employees_count: number;
};

export type AverageTenureBreakdownItem = {
  id: string | null;
  label: string;
  average_tenure_years: number | null;
  employees_count: number;
};

export type TenureDistributionResult = {
  cards?: {
    average_tenure_years?: number;
    total_employees?: number;
    longest_tenure_employee?: TenureEmployeeInfo | null;
  };
  charts?: {
    tenure_groups?: TenureGroupDistributionItem[];
    anniversaries_by_month?: TenureAnniversaryByMonthItem[];
    average_tenure_by_departments?: AverageTenureBreakdownItem[];
    average_tenure_by_locations?: AverageTenureBreakdownItem[];
  };
  filters_applied?: JsonRecord;
};

export type TenureDistributionInvokeResponse = {
  method: typeof GET_TENURE_DISTRIBUTION_METHOD;
  result: TenureDistributionResult;
};

export type TenureDistributionTableItem = {
  guid: string;
  full_name: string;
  age: number | null;
  start_date: string | null;
  tenure_years: number | null;
  tenure_label: string;
};

export type TenureDistributionTablePagination = {
  page: number;
  limit: number;
  total_count: number;
  total_pages: number;
  from: number;
  to: number;
  has_previous_page: boolean;
  has_next_page: boolean;
};

export type TenureDistributionTableResult = {
  items: TenureDistributionTableItem[];
  pagination: TenureDistributionTablePagination;
  filters_applied?: JsonRecord;
};

export type TenureDistributionTableInvokeResponse = {
  method: typeof GET_TENURE_DISTRIBUTION_TABLE_METHOD;
  result: TenureDistributionTableResult;
};

export type AbsenceBalancePolicyFilterItem = {
  id: string | null;
  label: string;
  color: string | null;
  icon: string | null;
  default_balance: number | null;
  rows_count: number;
};

export type AbsenceBalanceResult = {
  summary?: {
    total_rows?: number;
    total_employees?: number;
    total_policies?: number;
    as_of_date?: string;
  };
  filters?: {
    absence_policies?: AbsenceBalancePolicyFilterItem[];
  };
  filters_applied?: JsonRecord;
};

export type AbsenceBalanceInvokeResponse = {
  method: typeof GET_ABSENCE_BALANCE_METHOD;
  result: AbsenceBalanceResult;
};

export type AbsenceBalanceTableItem = {
  guid: string;
  full_name: string;
  work_summary: string;
  absence_policy_id: string | null;
  absence_type: string;
  initial_balance: number | null;
  accrued: number | null;
  used: number | null;
  carryover: number | null;
  adjustments: number | null;
  ending_balance: number | null;
  unit: string;
};

export type AbsenceBalanceTablePagination = {
  page: number;
  limit: number;
  total_count: number;
  total_pages: number;
  from: number;
  to: number;
  has_previous_page: boolean;
  has_next_page: boolean;
};

export type AbsenceBalanceTableResult = {
  items: AbsenceBalanceTableItem[];
  pagination: AbsenceBalanceTablePagination;
  filters_applied?: JsonRecord;
};

export type AbsenceBalanceTableInvokeResponse = {
  method: typeof GET_ABSENCE_BALANCE_TABLE_METHOD;
  result: AbsenceBalanceTableResult;
};

export type AttendanceMonthOption = {
  key: string;
  label: string;
};

export type AttendanceChartCountItem = {
  key: string;
  label: string;
  count: number;
};

export type AttendanceTopLateItem = {
  guid: string;
  full_name: string;
  total_late_time: number;
};

export type AttendanceReportResult = {
  cards?: {
    month?: string;
    employees_count?: number;
    total_work_days?: number;
    on_time_count?: number;
    total_late_time?: number;
    late_arrivals_count?: number;
  };
  charts?: {
    absence_counts?: AttendanceChartCountItem[];
    top_late_time?: AttendanceTopLateItem[];
  };
  filters?: {
    available_months?: AttendanceMonthOption[];
  };
  filters_applied?: JsonRecord;
};

export type AttendanceInvokeResponse = {
  method: typeof GET_ATTENDANCE_METHOD;
  result: AttendanceReportResult;
};

export type AttendanceTableItem = {
  guid: string;
  employee: string;
  month: string;
  total_work_days: number;
  day_off_count: number;
  bs_count: number;
  on_time_count: number;
  total_late_time: number;
  hospital_count: number;
  vacation_count: number;
};

export type AttendanceTablePagination = {
  page: number;
  limit: number;
  total_count: number;
  total_pages: number;
  from: number;
  to: number;
  has_previous_page: boolean;
  has_next_page: boolean;
};

export type AttendanceTableResult = {
  items: AttendanceTableItem[];
  pagination: AttendanceTablePagination;
  filters_applied?: JsonRecord;
};

export type AttendanceTableInvokeResponse = {
  method: typeof GET_ATTENDANCE_TABLE_METHOD;
  result: AttendanceTableResult;
};

export type SportAttendanceMonthOption = {
  key: string;
  label: string;
};

export type SportAttendanceDistributionItem = {
  key: "lt_4" | "between_4_5" | "between_6_7" | "gte_8" | string;
  label: string;
  count: number;
  percentage: number;
};

export type SportAttendanceResult = {
  summary?: {
    month?: string;
    participants_count?: number;
    total_visits?: number;
  };
  chart?: {
    distribution?: SportAttendanceDistributionItem[];
  };
  filters?: {
    available_months?: SportAttendanceMonthOption[];
  };
  filters_applied?: JsonRecord;
};

export type SportAttendanceInvokeResponse = {
  method: typeof GET_SPORT_ATTENDANCE_METHOD;
  result: SportAttendanceResult;
};

export type SportAttendanceTableItem = {
  guid: string;
  employee: string;
  month: string;
  attendance_count: number;
};

export type SportAttendanceTablePagination = {
  page: number;
  limit: number;
  total_count: number;
  total_pages: number;
  from: number;
  to: number;
  has_previous_page: boolean;
  has_next_page: boolean;
};

export type SportAttendanceTableResult = {
  items: SportAttendanceTableItem[];
  pagination: SportAttendanceTablePagination;
  filters_applied?: JsonRecord;
};

export type SportAttendanceTableInvokeResponse = {
  method: typeof GET_SPORT_ATTENDANCE_TABLE_METHOD;
  result: SportAttendanceTableResult;
};

export type PayrollFilterOption = {
  value: string | number;
  label: string;
};

export type PayrollFiltersResult = {
  years?: PayrollFilterOption[];
  months?: PayrollFilterOption[];
  employees?: PayrollFilterOption[];
  departments?: PayrollFilterOption[];
  defaults?: {
    years?: number[];
    months?: number[];
  };
};

export type PayrollInvokeResponse = {
  method: typeof GET_PAYROLL_METHOD;
  result: {
    filters?: PayrollFiltersResult;
    filters_applied?: JsonRecord;
  };
};

export type PayrollPeriod = {
  key: string;
  year: number;
  month: number;
  label: string;
};

export type PayrollPeriodMetrics = {
  salary: number | null;
  bonus: number | null;
  work_days: number | null;
  actual_work_days: number | null;
  total: number | null;
};

export type PayrollTableItem = {
  guid: string;
  first_name: string;
  second_name: string;
  full_name: string;
  department: string;
  periods: Record<string, PayrollPeriodMetrics>;
};

export type PayrollTableTotal = PayrollPeriodMetrics & {
  key: string;
  year: number;
  month: number;
  label: string;
};

export type PayrollTablePagination = {
  page: number;
  limit: number;
  total_count: number;
  total_pages: number;
  from: number;
  to: number;
  has_previous_page: boolean;
  has_next_page: boolean;
};

export type PayrollTableResult = {
  periods: PayrollPeriod[];
  items: PayrollTableItem[];
  totals: PayrollTableTotal[];
  pagination: PayrollTablePagination;
  filters_applied?: JsonRecord;
};

export type PayrollTableInvokeResponse = {
  method: typeof GET_PAYROLL_TABLE_METHOD;
  result: PayrollTableResult;
};

type AgeDistributionWrappedResponse = {
  data?: AgeDistributionInvokeResponse;
};

const reportsRequest = axios.create({
  baseURL: REPORTS_BASE_URL,
  timeout: 100_000,
  headers: {
    "Content-Type": "application/json",
  },
});

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null;

const isAgeDistributionInvokeResponse = (
  value: unknown
): value is AgeDistributionInvokeResponse => {
  if (!isRecord(value)) return false;
  return value.method === GET_AGE_DISTRIBUTION_METHOD && isRecord(value.result);
};

const isAgeDistributionTableInvokeResponse = (
  value: unknown
): value is AgeDistributionTableInvokeResponse => {
  if (!isRecord(value)) return false;
  return value.method === GET_AGE_DISTRIBUTION_TABLE_METHOD && isRecord(value.result);
};

const isGenderDistributionInvokeResponse = (
  value: unknown
): value is GenderDistributionInvokeResponse => {
  if (!isRecord(value)) return false;
  return value.method === GET_GENDER_DISTRIBUTION_METHOD && isRecord(value.result);
};

const isGenderDistributionTableInvokeResponse = (
  value: unknown
): value is GenderDistributionTableInvokeResponse => {
  if (!isRecord(value)) return false;
  return value.method === GET_GENDER_DISTRIBUTION_TABLE_METHOD && isRecord(value.result);
};

const isStaffCountInvokeResponse = (
  value: unknown
): value is StaffCountInvokeResponse => {
  if (!isRecord(value)) return false;
  return value.method === GET_STAFF_COUNT_METHOD && isRecord(value.result);
};

const isStaffCountTableInvokeResponse = (
  value: unknown
): value is StaffCountTableInvokeResponse => {
  if (!isRecord(value)) return false;
  return value.method === GET_STAFF_COUNT_TABLE_METHOD && isRecord(value.result);
};

const isStaffTurnoverInvokeResponse = (
  value: unknown
): value is StaffTurnoverInvokeResponse => {
  if (!isRecord(value)) return false;
  return value.method === GET_STAFF_TURNOVER_METHOD && isRecord(value.result);
};

const isStaffTurnoverTableInvokeResponse = (
  value: unknown
): value is StaffTurnoverTableInvokeResponse => {
  if (!isRecord(value)) return false;
  return value.method === GET_STAFF_TURNOVER_TABLE_METHOD && isRecord(value.result);
};

const isTenureDistributionInvokeResponse = (
  value: unknown
): value is TenureDistributionInvokeResponse => {
  if (!isRecord(value)) return false;
  return value.method === GET_TENURE_DISTRIBUTION_METHOD && isRecord(value.result);
};

const isTenureDistributionTableInvokeResponse = (
  value: unknown
): value is TenureDistributionTableInvokeResponse => {
  if (!isRecord(value)) return false;
  return value.method === GET_TENURE_DISTRIBUTION_TABLE_METHOD && isRecord(value.result);
};

const isAbsenceBalanceInvokeResponse = (
  value: unknown
): value is AbsenceBalanceInvokeResponse => {
  if (!isRecord(value)) return false;
  return value.method === GET_ABSENCE_BALANCE_METHOD && isRecord(value.result);
};

const isAbsenceBalanceTableInvokeResponse = (
  value: unknown
): value is AbsenceBalanceTableInvokeResponse => {
  if (!isRecord(value)) return false;
  return value.method === GET_ABSENCE_BALANCE_TABLE_METHOD && isRecord(value.result);
};

const isAttendanceInvokeResponse = (
  value: unknown
): value is AttendanceInvokeResponse => {
  if (!isRecord(value)) return false;
  return value.method === GET_ATTENDANCE_METHOD && isRecord(value.result);
};

const isAttendanceTableInvokeResponse = (
  value: unknown
): value is AttendanceTableInvokeResponse => {
  if (!isRecord(value)) return false;
  return value.method === GET_ATTENDANCE_TABLE_METHOD && isRecord(value.result);
};

const isSportAttendanceInvokeResponse = (
  value: unknown
): value is SportAttendanceInvokeResponse => {
  if (!isRecord(value)) return false;
  return value.method === GET_SPORT_ATTENDANCE_METHOD && isRecord(value.result);
};

const isSportAttendanceTableInvokeResponse = (
  value: unknown
): value is SportAttendanceTableInvokeResponse => {
  if (!isRecord(value)) return false;
  return value.method === GET_SPORT_ATTENDANCE_TABLE_METHOD && isRecord(value.result);
};

const isPayrollInvokeResponse = (
  value: unknown
): value is PayrollInvokeResponse => {
  if (!isRecord(value)) return false;
  return value.method === GET_PAYROLL_METHOD && isRecord(value.result);
};

const isPayrollTableInvokeResponse = (
  value: unknown
): value is PayrollTableInvokeResponse => {
  if (!isRecord(value)) return false;
  return value.method === GET_PAYROLL_TABLE_METHOD && isRecord(value.result);
};

const normalizeAgeDistributionResponse = (
  raw: unknown
): AgeDistributionInvokeResponse => {
  if (isAgeDistributionInvokeResponse(raw)) {
    return raw;
  }

  if (isRecord(raw)) {
    const nestedServerError =
      isRecord(raw.data) && typeof raw.data.server_error === "string"
        ? raw.data.server_error
        : null;

    if (typeof raw.server_error === "string" && raw.server_error) {
      throw new Error(raw.server_error);
    }

    if (nestedServerError) {
      throw new Error(nestedServerError);
    }

    const wrapped = raw as AgeDistributionWrappedResponse;
    if (isAgeDistributionInvokeResponse(wrapped.data)) {
      return wrapped.data;
    }

    if (isRecord(raw.data)) {
      const payload = raw.data.data;

      if (isAgeDistributionInvokeResponse(payload)) {
        return payload;
      }
    }
  }

  throw new Error("Unexpected response format for get_age_distribution");
};

const normalizeAgeDistributionTableResponse = (
  raw: unknown
): AgeDistributionTableInvokeResponse => {
  if (isAgeDistributionTableInvokeResponse(raw)) {
    return raw;
  }

  if (isRecord(raw)) {
    const nestedServerError =
      isRecord(raw.data) && typeof raw.data.server_error === "string"
        ? raw.data.server_error
        : null;

    if (typeof raw.server_error === "string" && raw.server_error) {
      throw new Error(raw.server_error);
    }

    if (nestedServerError) {
      throw new Error(nestedServerError);
    }

    if (isAgeDistributionTableInvokeResponse(raw.data)) {
      return raw.data;
    }

    if (isRecord(raw.data)) {
      const payload = raw.data.data;

      if (isAgeDistributionTableInvokeResponse(payload)) {
        return payload;
      }
    }
  }

  throw new Error("Unexpected response format for get_age_distribution_table");
};

const normalizeGenderDistributionResponse = (
  raw: unknown
): GenderDistributionInvokeResponse => {
  if (isGenderDistributionInvokeResponse(raw)) {
    return raw;
  }

  if (isRecord(raw)) {
    const nestedServerError =
      isRecord(raw.data) && typeof raw.data.server_error === "string"
        ? raw.data.server_error
        : null;

    if (typeof raw.server_error === "string" && raw.server_error) {
      throw new Error(raw.server_error);
    }

    if (nestedServerError) {
      throw new Error(nestedServerError);
    }

    if (isGenderDistributionInvokeResponse(raw.data)) {
      return raw.data;
    }

    if (isRecord(raw.data)) {
      const payload = raw.data.data;

      if (isGenderDistributionInvokeResponse(payload)) {
        return payload;
      }
    }
  }

  throw new Error("Unexpected response format for get_gender_distribution");
};

const normalizeGenderDistributionTableResponse = (
  raw: unknown
): GenderDistributionTableInvokeResponse => {
  if (isGenderDistributionTableInvokeResponse(raw)) {
    return raw;
  }

  if (isRecord(raw)) {
    const nestedServerError =
      isRecord(raw.data) && typeof raw.data.server_error === "string"
        ? raw.data.server_error
        : null;

    if (typeof raw.server_error === "string" && raw.server_error) {
      throw new Error(raw.server_error);
    }

    if (nestedServerError) {
      throw new Error(nestedServerError);
    }

    if (isGenderDistributionTableInvokeResponse(raw.data)) {
      return raw.data;
    }

    if (isRecord(raw.data)) {
      const payload = raw.data.data;

      if (isGenderDistributionTableInvokeResponse(payload)) {
        return payload;
      }
    }
  }

  throw new Error("Unexpected response format for get_gender_distribution_table");
};

const normalizeStaffCountResponse = (
  raw: unknown
): StaffCountInvokeResponse => {
  if (isStaffCountInvokeResponse(raw)) {
    return raw;
  }

  if (isRecord(raw)) {
    const nestedServerError =
      isRecord(raw.data) && typeof raw.data.server_error === "string"
        ? raw.data.server_error
        : null;

    if (typeof raw.server_error === "string" && raw.server_error) {
      throw new Error(raw.server_error);
    }

    if (nestedServerError) {
      throw new Error(nestedServerError);
    }

    if (isStaffCountInvokeResponse(raw.data)) {
      return raw.data;
    }

    if (isRecord(raw.data)) {
      const payload = raw.data.data;

      if (isStaffCountInvokeResponse(payload)) {
        return payload;
      }
    }
  }

  throw new Error("Unexpected response format for get_staff_count");
};

const normalizeStaffCountTableResponse = (
  raw: unknown
): StaffCountTableInvokeResponse => {
  if (isStaffCountTableInvokeResponse(raw)) {
    return raw;
  }

  if (isRecord(raw)) {
    const nestedServerError =
      isRecord(raw.data) && typeof raw.data.server_error === "string"
        ? raw.data.server_error
        : null;

    if (typeof raw.server_error === "string" && raw.server_error) {
      throw new Error(raw.server_error);
    }

    if (nestedServerError) {
      throw new Error(nestedServerError);
    }

    if (isStaffCountTableInvokeResponse(raw.data)) {
      return raw.data;
    }

    if (isRecord(raw.data)) {
      const payload = raw.data.data;

      if (isStaffCountTableInvokeResponse(payload)) {
        return payload;
      }
    }
  }

  throw new Error("Unexpected response format for get_staff_count_table");
};

const normalizeStaffTurnoverResponse = (
  raw: unknown
): StaffTurnoverInvokeResponse => {
  if (isStaffTurnoverInvokeResponse(raw)) {
    return raw;
  }

  if (isRecord(raw)) {
    const nestedServerError =
      isRecord(raw.data) && typeof raw.data.server_error === "string"
        ? raw.data.server_error
        : null;

    if (typeof raw.server_error === "string" && raw.server_error) {
      throw new Error(raw.server_error);
    }

    if (nestedServerError) {
      throw new Error(nestedServerError);
    }

    if (isStaffTurnoverInvokeResponse(raw.data)) {
      return raw.data;
    }

    if (isRecord(raw.data)) {
      const payload = raw.data.data;

      if (isStaffTurnoverInvokeResponse(payload)) {
        return payload;
      }
    }
  }

  throw new Error("Unexpected response format for get_staff_turnover");
};

const normalizeStaffTurnoverTableResponse = (
  raw: unknown
): StaffTurnoverTableInvokeResponse => {
  if (isStaffTurnoverTableInvokeResponse(raw)) {
    return raw;
  }

  if (isRecord(raw)) {
    const nestedServerError =
      isRecord(raw.data) && typeof raw.data.server_error === "string"
        ? raw.data.server_error
        : null;

    if (typeof raw.server_error === "string" && raw.server_error) {
      throw new Error(raw.server_error);
    }

    if (nestedServerError) {
      throw new Error(nestedServerError);
    }

    if (isStaffTurnoverTableInvokeResponse(raw.data)) {
      return raw.data;
    }

    if (isRecord(raw.data)) {
      const payload = raw.data.data;

      if (isStaffTurnoverTableInvokeResponse(payload)) {
        return payload;
      }
    }
  }

  throw new Error("Unexpected response format for get_staff_turnover_table");
};

const normalizeTenureDistributionResponse = (
  raw: unknown
): TenureDistributionInvokeResponse => {
  if (isTenureDistributionInvokeResponse(raw)) {
    return raw;
  }

  if (isRecord(raw)) {
    const nestedServerError =
      isRecord(raw.data) && typeof raw.data.server_error === "string"
        ? raw.data.server_error
        : null;

    if (typeof raw.server_error === "string" && raw.server_error) {
      throw new Error(raw.server_error);
    }

    if (nestedServerError) {
      throw new Error(nestedServerError);
    }

    if (isTenureDistributionInvokeResponse(raw.data)) {
      return raw.data;
    }

    if (isRecord(raw.data)) {
      const payload = raw.data.data;

      if (isTenureDistributionInvokeResponse(payload)) {
        return payload;
      }
    }
  }

  throw new Error("Unexpected response format for get_tenure_distribution");
};

const normalizeTenureDistributionTableResponse = (
  raw: unknown
): TenureDistributionTableInvokeResponse => {
  if (isTenureDistributionTableInvokeResponse(raw)) {
    return raw;
  }

  if (isRecord(raw)) {
    const nestedServerError =
      isRecord(raw.data) && typeof raw.data.server_error === "string"
        ? raw.data.server_error
        : null;

    if (typeof raw.server_error === "string" && raw.server_error) {
      throw new Error(raw.server_error);
    }

    if (nestedServerError) {
      throw new Error(nestedServerError);
    }

    if (isTenureDistributionTableInvokeResponse(raw.data)) {
      return raw.data;
    }

    if (isRecord(raw.data)) {
      const payload = raw.data.data;

      if (isTenureDistributionTableInvokeResponse(payload)) {
        return payload;
      }
    }
  }

  throw new Error("Unexpected response format for get_tenure_distribution_table");
};

const normalizeAbsenceBalanceResponse = (
  raw: unknown
): AbsenceBalanceInvokeResponse => {
  if (isAbsenceBalanceInvokeResponse(raw)) {
    return raw;
  }

  if (isRecord(raw)) {
    const nestedServerError =
      isRecord(raw.data) && typeof raw.data.server_error === "string"
        ? raw.data.server_error
        : null;

    if (typeof raw.server_error === "string" && raw.server_error) {
      throw new Error(raw.server_error);
    }

    if (nestedServerError) {
      throw new Error(nestedServerError);
    }

    if (isAbsenceBalanceInvokeResponse(raw.data)) {
      return raw.data;
    }

    if (isRecord(raw.data)) {
      const payload = raw.data.data;

      if (isAbsenceBalanceInvokeResponse(payload)) {
        return payload;
      }
    }
  }

  throw new Error("Unexpected response format for get_absence_balance");
};

const normalizeAbsenceBalanceTableResponse = (
  raw: unknown
): AbsenceBalanceTableInvokeResponse => {
  if (isAbsenceBalanceTableInvokeResponse(raw)) {
    return raw;
  }

  if (isRecord(raw)) {
    const nestedServerError =
      isRecord(raw.data) && typeof raw.data.server_error === "string"
        ? raw.data.server_error
        : null;

    if (typeof raw.server_error === "string" && raw.server_error) {
      throw new Error(raw.server_error);
    }

    if (nestedServerError) {
      throw new Error(nestedServerError);
    }

    if (isAbsenceBalanceTableInvokeResponse(raw.data)) {
      return raw.data;
    }

    if (isRecord(raw.data)) {
      const payload = raw.data.data;

      if (isAbsenceBalanceTableInvokeResponse(payload)) {
        return payload;
      }
    }
  }

  throw new Error("Unexpected response format for get_absence_balance_table");
};

const normalizeAttendanceResponse = (
  raw: unknown
): AttendanceInvokeResponse => {
  if (isAttendanceInvokeResponse(raw)) {
    return raw;
  }

  if (isRecord(raw)) {
    const nestedServerError =
      isRecord(raw.data) && typeof raw.data.server_error === "string"
        ? raw.data.server_error
        : null;

    if (typeof raw.server_error === "string" && raw.server_error) {
      throw new Error(raw.server_error);
    }

    if (nestedServerError) {
      throw new Error(nestedServerError);
    }

    if (isAttendanceInvokeResponse(raw.data)) {
      return raw.data;
    }

    if (isRecord(raw.data)) {
      const payload = raw.data.data;

      if (isAttendanceInvokeResponse(payload)) {
        return payload;
      }
    }
  }

  throw new Error("Unexpected response format for get_attendance");
};

const normalizeAttendanceTableResponse = (
  raw: unknown
): AttendanceTableInvokeResponse => {
  if (isAttendanceTableInvokeResponse(raw)) {
    return raw;
  }

  if (isRecord(raw)) {
    const nestedServerError =
      isRecord(raw.data) && typeof raw.data.server_error === "string"
        ? raw.data.server_error
        : null;

    if (typeof raw.server_error === "string" && raw.server_error) {
      throw new Error(raw.server_error);
    }

    if (nestedServerError) {
      throw new Error(nestedServerError);
    }

    if (isAttendanceTableInvokeResponse(raw.data)) {
      return raw.data;
    }

    if (isRecord(raw.data)) {
      const payload = raw.data.data;

      if (isAttendanceTableInvokeResponse(payload)) {
        return payload;
      }
    }
  }

  throw new Error("Unexpected response format for get_attendance_table");
};

const normalizeSportAttendanceResponse = (
  raw: unknown
): SportAttendanceInvokeResponse => {
  if (isSportAttendanceInvokeResponse(raw)) {
    return raw;
  }

  if (isRecord(raw)) {
    const nestedServerError =
      isRecord(raw.data) && typeof raw.data.server_error === "string"
        ? raw.data.server_error
        : null;

    if (typeof raw.server_error === "string" && raw.server_error) {
      throw new Error(raw.server_error);
    }

    if (nestedServerError) {
      throw new Error(nestedServerError);
    }

    if (isSportAttendanceInvokeResponse(raw.data)) {
      return raw.data;
    }

    if (isRecord(raw.data)) {
      const payload = raw.data.data;

      if (isSportAttendanceInvokeResponse(payload)) {
        return payload;
      }
    }
  }

  throw new Error("Unexpected response format for get_sport_attendance");
};

const normalizeSportAttendanceTableResponse = (
  raw: unknown
): SportAttendanceTableInvokeResponse => {
  if (isSportAttendanceTableInvokeResponse(raw)) {
    return raw;
  }

  if (isRecord(raw)) {
    const nestedServerError =
      isRecord(raw.data) && typeof raw.data.server_error === "string"
        ? raw.data.server_error
        : null;

    if (typeof raw.server_error === "string" && raw.server_error) {
      throw new Error(raw.server_error);
    }

    if (nestedServerError) {
      throw new Error(nestedServerError);
    }

    if (isSportAttendanceTableInvokeResponse(raw.data)) {
      return raw.data;
    }

    if (isRecord(raw.data)) {
      const payload = raw.data.data;

      if (isSportAttendanceTableInvokeResponse(payload)) {
        return payload;
      }
    }
  }

  throw new Error("Unexpected response format for get_sport_attendance_table");
};

const normalizePayrollResponse = (
  raw: unknown
): PayrollInvokeResponse => {
  if (isPayrollInvokeResponse(raw)) {
    return raw;
  }

  if (isRecord(raw)) {
    const nestedServerError =
      isRecord(raw.data) && typeof raw.data.server_error === "string"
        ? raw.data.server_error
        : null;

    if (typeof raw.server_error === "string" && raw.server_error) {
      throw new Error(raw.server_error);
    }

    if (nestedServerError) {
      throw new Error(nestedServerError);
    }

    if (isPayrollInvokeResponse(raw.data)) {
      return raw.data;
    }

    if (isRecord(raw.data)) {
      const payload = raw.data.data;

      if (isPayrollInvokeResponse(payload)) {
        return payload;
      }
    }
  }

  throw new Error("Unexpected response format for get_payroll");
};

const normalizePayrollTableResponse = (
  raw: unknown
): PayrollTableInvokeResponse => {
  if (isPayrollTableInvokeResponse(raw)) {
    return raw;
  }

  if (isRecord(raw)) {
    const nestedServerError =
      isRecord(raw.data) && typeof raw.data.server_error === "string"
        ? raw.data.server_error
        : null;

    if (typeof raw.server_error === "string" && raw.server_error) {
      throw new Error(raw.server_error);
    }

    if (nestedServerError) {
      throw new Error(nestedServerError);
    }

    if (isPayrollTableInvokeResponse(raw.data)) {
      return raw.data;
    }

    if (isRecord(raw.data)) {
      const payload = raw.data.data;

      if (isPayrollTableInvokeResponse(payload)) {
        return payload;
      }
    }
  }

  throw new Error("Unexpected response format for get_payroll_table");
};

const reportsService = {
  getAgeDistribution: async (
    requestData: JsonRecord = {}
  ): Promise<AgeDistributionInvokeResponse> => {
    const hasRequestData = Object.keys(requestData).length > 0;
    const gatewayPayload = hasRequestData
      ? {
          method: GET_AGE_DISTRIBUTION_METHOD,
          data: requestData,
        }
      : {
          method: GET_AGE_DISTRIBUTION_METHOD,
        };

    const response = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
      data: gatewayPayload,
    });

    return normalizeAgeDistributionResponse(response.data);
  },
  getAgeDistributionTable: async (
    requestData: JsonRecord = {},
    pagination: { page?: number; limit?: number } = {}
  ): Promise<AgeDistributionTableInvokeResponse> => {
    const page = Number.isFinite(Number(pagination.page)) ? Number(pagination.page) : 1;
    const limit = Number.isFinite(Number(pagination.limit)) ? Number(pagination.limit) : 20;

    const payloadData = {
      ...requestData,
      page,
      limit,
    };

    const response = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
      data: {
        method: GET_AGE_DISTRIBUTION_TABLE_METHOD,
        data: payloadData,
      },
    });

    return normalizeAgeDistributionTableResponse(response.data);
  },
  getGenderDistribution: async (
    requestData: JsonRecord = {}
  ): Promise<GenderDistributionInvokeResponse> => {
    const response = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
      data: {
        method: GET_GENDER_DISTRIBUTION_METHOD,
        data: requestData,
      },
    });

    return normalizeGenderDistributionResponse(response.data);
  },
  getGenderDistributionTable: async (
    requestData: JsonRecord = {},
    pagination: { page?: number; limit?: number } = {}
  ): Promise<GenderDistributionTableInvokeResponse> => {
    const page = Number.isFinite(Number(pagination.page)) ? Number(pagination.page) : 1;
    const limit = Number.isFinite(Number(pagination.limit)) ? Number(pagination.limit) : 20;

    const payloadData = {
      ...requestData,
      page,
      limit,
    };

    const response = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
      data: {
        method: GET_GENDER_DISTRIBUTION_TABLE_METHOD,
        data: payloadData,
      },
    });

    return normalizeGenderDistributionTableResponse(response.data);
  },
  getStaffCount: async (
    requestData: JsonRecord = {}
  ): Promise<StaffCountInvokeResponse> => {
    const response = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
      data: {
        method: GET_STAFF_COUNT_METHOD,
        data: requestData,
      },
    });

    return normalizeStaffCountResponse(response.data);
  },
  getStaffCountTable: async (
    requestData: JsonRecord = {},
    pagination: { page?: number; limit?: number } = {}
  ): Promise<StaffCountTableInvokeResponse> => {
    const page = Number.isFinite(Number(pagination.page)) ? Number(pagination.page) : 1;
    const limit = Number.isFinite(Number(pagination.limit)) ? Number(pagination.limit) : 20;

    const payloadData = {
      ...requestData,
      page,
      limit,
    };

    const response = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
      data: {
        method: GET_STAFF_COUNT_TABLE_METHOD,
        data: payloadData,
      },
    });

    return normalizeStaffCountTableResponse(response.data);
  },
  getStaffTurnover: async (
    requestData: JsonRecord = {}
  ): Promise<StaffTurnoverInvokeResponse> => {
    const response = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
      data: {
        method: GET_STAFF_TURNOVER_METHOD,
        data: requestData,
      },
    });

    return normalizeStaffTurnoverResponse(response.data);
  },
  getStaffTurnoverTable: async (
    requestData: JsonRecord = {},
    pagination: { page?: number; limit?: number } = {}
  ): Promise<StaffTurnoverTableInvokeResponse> => {
    const page = Number.isFinite(Number(pagination.page)) ? Number(pagination.page) : 1;
    const limit = Number.isFinite(Number(pagination.limit)) ? Number(pagination.limit) : 20;

    const payloadData = {
      ...requestData,
      page,
      limit,
    };

    const response = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
      data: {
        method: GET_STAFF_TURNOVER_TABLE_METHOD,
        data: payloadData,
      },
    });

    return normalizeStaffTurnoverTableResponse(response.data);
  },
  getTenureDistribution: async (
    requestData: JsonRecord = {}
  ): Promise<TenureDistributionInvokeResponse> => {
    const response = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
      data: {
        method: GET_TENURE_DISTRIBUTION_METHOD,
        data: requestData,
      },
    });

    return normalizeTenureDistributionResponse(response.data);
  },
  getTenureDistributionTable: async (
    requestData: JsonRecord = {},
    pagination: { page?: number; limit?: number } = {}
  ): Promise<TenureDistributionTableInvokeResponse> => {
    const page = Number.isFinite(Number(pagination.page)) ? Number(pagination.page) : 1;
    const limit = Number.isFinite(Number(pagination.limit)) ? Number(pagination.limit) : 20;

    const payloadData = {
      ...requestData,
      page,
      limit,
    };

    const response = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
      data: {
        method: GET_TENURE_DISTRIBUTION_TABLE_METHOD,
        data: payloadData,
      },
    });

    return normalizeTenureDistributionTableResponse(response.data);
  },
  getAbsenceBalance: async (
    requestData: JsonRecord = {}
  ): Promise<AbsenceBalanceInvokeResponse> => {
    const response = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
      data: {
        method: GET_ABSENCE_BALANCE_METHOD,
        data: requestData,
      },
    });

    return normalizeAbsenceBalanceResponse(response.data);
  },
  getAbsenceBalanceTable: async (
    requestData: JsonRecord = {},
    pagination: { page?: number; limit?: number } = {}
  ): Promise<AbsenceBalanceTableInvokeResponse> => {
    const page = Number.isFinite(Number(pagination.page)) ? Number(pagination.page) : 1;
    const limit = Number.isFinite(Number(pagination.limit)) ? Number(pagination.limit) : 20;

    const payloadData = {
      ...requestData,
      page,
      limit,
    };

    const response = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
      data: {
        method: GET_ABSENCE_BALANCE_TABLE_METHOD,
        data: payloadData,
      },
    });

    return normalizeAbsenceBalanceTableResponse(response.data);
  },
  getAttendance: async (
    requestData: JsonRecord = {}
  ): Promise<AttendanceInvokeResponse> => {
    const response = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
      data: {
        method: GET_ATTENDANCE_METHOD,
        data: requestData,
      },
    });

    return normalizeAttendanceResponse(response.data);
  },
  getAttendanceTable: async (
    requestData: JsonRecord = {},
    pagination: { page?: number; limit?: number } = {}
  ): Promise<AttendanceTableInvokeResponse> => {
    const page = Number.isFinite(Number(pagination.page)) ? Number(pagination.page) : 1;
    const limit = Number.isFinite(Number(pagination.limit)) ? Number(pagination.limit) : 20;

    const payloadData = {
      ...requestData,
      page,
      limit,
    };

    const response = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
      data: {
        method: GET_ATTENDANCE_TABLE_METHOD,
        data: payloadData,
      },
    });

    return normalizeAttendanceTableResponse(response.data);
  },
  getSportAttendance: async (
    requestData: JsonRecord = {}
  ): Promise<SportAttendanceInvokeResponse> => {
    const response = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
      data: {
        method: GET_SPORT_ATTENDANCE_METHOD,
        data: requestData,
      },
    });

    return normalizeSportAttendanceResponse(response.data);
  },
  getSportAttendanceTable: async (
    requestData: JsonRecord = {},
    pagination: { page?: number; limit?: number } = {}
  ): Promise<SportAttendanceTableInvokeResponse> => {
    const page = Number.isFinite(Number(pagination.page)) ? Number(pagination.page) : 1;
    const limit = Number.isFinite(Number(pagination.limit)) ? Number(pagination.limit) : 20;

    const payloadData = {
      ...requestData,
      page,
      limit,
    };

    const response = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
      data: {
        method: GET_SPORT_ATTENDANCE_TABLE_METHOD,
        data: payloadData,
      },
    });

    return normalizeSportAttendanceTableResponse(response.data);
  },
  getPayroll: async (
    requestData: JsonRecord = {}
  ): Promise<PayrollInvokeResponse> => {
    const response = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
      data: {
        method: GET_PAYROLL_METHOD,
        data: requestData,
      },
    });

    return normalizePayrollResponse(response.data);
  },
  getPayrollTable: async (
    requestData: JsonRecord = {},
    pagination: { page?: number; limit?: number } = {}
  ): Promise<PayrollTableInvokeResponse> => {
    const page = Number.isFinite(Number(pagination.page)) ? Number(pagination.page) : 1;
    const limit = Number.isFinite(Number(pagination.limit)) ? Number(pagination.limit) : 20;

    const payloadData = {
      ...requestData,
      page,
      limit,
    };

    const response = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
      data: {
        method: GET_PAYROLL_TABLE_METHOD,
        data: payloadData,
      },
    });

    return normalizePayrollTableResponse(response.data);
  },
};

export const useAgeDistributionReportQuery = (
  requestData: JsonRecord = {}
) => {
  return useQuery({
    queryKey: ["REPORTS", "AGE_DISTRIBUTION", requestData],
    queryFn: () => reportsService.getAgeDistribution(requestData),
    staleTime: 60_000,
  });
};

export const useAgeDistributionTableQuery = ({
  requestData = {},
  page = 1,
  limit = 20,
}: {
  requestData?: JsonRecord;
  page?: number;
  limit?: number;
} = {}) => {
  return useQuery({
    queryKey: ["REPORTS", "AGE_DISTRIBUTION_TABLE", requestData, page, limit],
    queryFn: () => reportsService.getAgeDistributionTable(requestData, { page, limit }),
    keepPreviousData: true,
    staleTime: 30_000,
  });
};

export const useGenderDistributionReportQuery = (
  requestData: JsonRecord = {}
) => {
  return useQuery({
    queryKey: ["REPORTS", "GENDER_DISTRIBUTION", requestData],
    queryFn: () => reportsService.getGenderDistribution(requestData),
    staleTime: 60_000,
  });
};

export const useGenderDistributionTableQuery = ({
  requestData = {},
  page = 1,
  limit = 20,
}: {
  requestData?: JsonRecord;
  page?: number;
  limit?: number;
} = {}) => {
  return useQuery({
    queryKey: ["REPORTS", "GENDER_DISTRIBUTION_TABLE", requestData, page, limit],
    queryFn: () => reportsService.getGenderDistributionTable(requestData, { page, limit }),
    keepPreviousData: true,
    staleTime: 30_000,
  });
};

export const useStaffCountReportQuery = (
  requestData: JsonRecord = {}
) => {
  return useQuery({
    queryKey: ["REPORTS", "STAFF_COUNT", requestData],
    queryFn: () => reportsService.getStaffCount(requestData),
    staleTime: 60_000,
  });
};

export const useStaffCountTableQuery = ({
  requestData = {},
  page = 1,
  limit = 20,
}: {
  requestData?: JsonRecord;
  page?: number;
  limit?: number;
} = {}) => {
  return useQuery({
    queryKey: ["REPORTS", "STAFF_COUNT_TABLE", requestData, page, limit],
    queryFn: () => reportsService.getStaffCountTable(requestData, { page, limit }),
    keepPreviousData: true,
    staleTime: 30_000,
  });
};

export const useStaffTurnoverReportQuery = (
  requestData: JsonRecord = {}
) => {
  return useQuery({
    queryKey: ["REPORTS", "STAFF_TURNOVER", requestData],
    queryFn: () => reportsService.getStaffTurnover(requestData),
    staleTime: 60_000,
  });
};

export const useStaffTurnoverTableQuery = ({
  requestData = {},
  page = 1,
  limit = 20,
}: {
  requestData?: JsonRecord;
  page?: number;
  limit?: number;
} = {}) => {
  return useQuery({
    queryKey: ["REPORTS", "STAFF_TURNOVER_TABLE", requestData, page, limit],
    queryFn: () => reportsService.getStaffTurnoverTable(requestData, { page, limit }),
    keepPreviousData: true,
    staleTime: 30_000,
  });
};

export const useTenureDistributionReportQuery = (
  requestData: JsonRecord = {}
) => {
  return useQuery({
    queryKey: ["REPORTS", "TENURE_DISTRIBUTION", requestData],
    queryFn: () => reportsService.getTenureDistribution(requestData),
    staleTime: 60_000,
  });
};

export const useTenureDistributionTableQuery = ({
  requestData = {},
  page = 1,
  limit = 20,
}: {
  requestData?: JsonRecord;
  page?: number;
  limit?: number;
} = {}) => {
  return useQuery({
    queryKey: ["REPORTS", "TENURE_DISTRIBUTION_TABLE", requestData, page, limit],
    queryFn: () => reportsService.getTenureDistributionTable(requestData, { page, limit }),
    keepPreviousData: true,
    staleTime: 30_000,
  });
};

export const useAbsenceBalanceReportQuery = (
  requestData: JsonRecord = {}
) => {
  return useQuery({
    queryKey: ["REPORTS", "ABSENCE_BALANCE", requestData],
    queryFn: () => reportsService.getAbsenceBalance(requestData),
    staleTime: 60_000,
  });
};

export const useAbsenceBalanceTableQuery = ({
  requestData = {},
  page = 1,
  limit = 20,
}: {
  requestData?: JsonRecord;
  page?: number;
  limit?: number;
} = {}) => {
  return useQuery({
    queryKey: ["REPORTS", "ABSENCE_BALANCE_TABLE", requestData, page, limit],
    queryFn: () => reportsService.getAbsenceBalanceTable(requestData, { page, limit }),
    keepPreviousData: true,
    staleTime: 30_000,
  });
};

export const useAttendanceReportQuery = (
  requestData: JsonRecord = {}
) => {
  return useQuery({
    queryKey: ["REPORTS", "ATTENDANCE", requestData],
    queryFn: () => reportsService.getAttendance(requestData),
    staleTime: 60_000,
  });
};

export const useAttendanceTableQuery = ({
  requestData = {},
  page = 1,
  limit = 20,
}: {
  requestData?: JsonRecord;
  page?: number;
  limit?: number;
} = {}) => {
  return useQuery({
    queryKey: ["REPORTS", "ATTENDANCE_TABLE", requestData, page, limit],
    queryFn: () => reportsService.getAttendanceTable(requestData, { page, limit }),
    keepPreviousData: true,
    staleTime: 30_000,
  });
};

export const useSportAttendanceReportQuery = (
  requestData: JsonRecord = {}
) => {
  return useQuery({
    queryKey: ["REPORTS", "SPORT_ATTENDANCE", requestData],
    queryFn: () => reportsService.getSportAttendance(requestData),
    staleTime: 60_000,
  });
};

export const useSportAttendanceTableQuery = ({
  requestData = {},
  page = 1,
  limit = 20,
}: {
  requestData?: JsonRecord;
  page?: number;
  limit?: number;
} = {}) => {
  return useQuery({
    queryKey: ["REPORTS", "SPORT_ATTENDANCE_TABLE", requestData, page, limit],
    queryFn: () => reportsService.getSportAttendanceTable(requestData, { page, limit }),
    keepPreviousData: true,
    staleTime: 30_000,
  });
};

export const usePayrollReportQuery = (
  requestData: JsonRecord = {}
) => {
  return useQuery({
    queryKey: ["REPORTS", "PAYROLL", requestData],
    queryFn: () => reportsService.getPayroll(requestData),
    staleTime: 60_000,
  });
};

export const usePayrollTableQuery = ({
  requestData = {},
  page = 1,
  limit = 20,
}: {
  requestData?: JsonRecord;
  page?: number;
  limit?: number;
} = {}) => {
  return useQuery({
    queryKey: ["REPORTS", "PAYROLL_TABLE", requestData, page, limit],
    queryFn: () => reportsService.getPayrollTable(requestData, { page, limit }),
    keepPreviousData: true,
    staleTime: 30_000,
  });
};

export default reportsService;
