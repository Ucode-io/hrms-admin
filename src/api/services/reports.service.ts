import axios from "axios";
import { useQuery } from "react-query";
import authStore from "../../store/auth.store";
import { injectCompaniesIdIntoInvokeFunctionRequest } from "../httpRequest";
import { handleUnauthorizedError } from "../unauthorizedHandler";

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
const GET_BONUS_DEDUCTIONS_METHOD = "get_bonus_deductions";
const GET_BONUS_DEDUCTIONS_TABLE_METHOD = "get_bonus_deductions_table";
const GET_BONUS_DEDUCTIONS_EXCEL_METHOD = "get_bonus_deductions_excel";
const GET_ORG_STRUCTURE_METHOD = "get_org_structure";
const GET_SALARY_EXCEL_TEMPLATE_METHOD = "get_salary_excel_template";
const IMPORT_SALARY_EXCEL_METHOD = "import_salary_excel";
const GET_KPI_METHOD = "get_kpi";
const GET_KPI_TABLE_METHOD = "get_kpi_table";
const SAVE_KPI_METHOD = "save_kpi";
const DELETE_KPI_METHOD = "delete_kpi";
const UPDATE_KPI_VALUE_METHOD = "update_kpi_value";
const APPROVE_ABSENCE_METHOD = "approve_absence";
const DELETE_ABSENCE_METHOD = "delete_absence";
const GET_RECRUITING_FUNNEL_METHOD = "get_recruiting_funnel";
const GET_RECRUITING_SOURCES_METHOD = "get_recruiting_sources";
const GET_RECRUITING_CLOSURE_TIMES_METHOD = "get_recruiting_closure_times";

export type ApproveAbsenceResult = {
  absences_id: string;
  status: string[];
  created_attendance_count: number;
  created_attendance_dates: string[];
};

export type ApproveAbsenceInvokeResponse = {
  method: typeof APPROVE_ABSENCE_METHOD;
  result: ApproveAbsenceResult;
};

export type DeleteAbsenceResult = {
  absences_id: string;
  deleted_attendance_count: number;
};

export type DeleteAbsenceInvokeResponse = {
  method: typeof DELETE_ABSENCE_METHOD;
  result: DeleteAbsenceResult;
};

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
    paid_absence_days?: number;
    unpaid_absence_days?: number;
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
  paid_absence_days: number;
  unpaid_absence_days: number;
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
  paid_absence_days?: number;
  unpaid_absence_days?: number;
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

export type BonusDeductionsFilterOption = {
  value: string | number;
  label: string;
};

export type BonusDeductionsFiltersResult = {
  years?: BonusDeductionsFilterOption[];
  months?: BonusDeductionsFilterOption[];
  employees?: BonusDeductionsFilterOption[];
  departments?: BonusDeductionsFilterOption[];
  defaults?: {
    year?: number;
    month?: number;
  };
};

export type BonusDeductionsInvokeResponse = {
  method: typeof GET_BONUS_DEDUCTIONS_METHOD;
  result: {
    filters?: BonusDeductionsFiltersResult;
    filters_applied?: JsonRecord;
  };
};

export type BonusDeductionsMetricType = {
  key: string;
  label: string;
};

export type BonusDeductionsPeriod = {
  key: string;
  year: number;
  month: number;
  label: string;
};

export type BonusDeductionsTableItem = {
  guid: string;
  first_name: string;
  second_name: string;
  full_name: string;
  department: string;
  base_salary: number | null;
  accruals: Record<string, number | null>;
  deductions: Record<string, number | null>;
  total_accrued: number | null;
  total_deducted: number | null;
  net_payable: number | null;
};

export type BonusDeductionsTableTotals = {
  base_salary: number | null;
  accruals: Record<string, number | null>;
  deductions: Record<string, number | null>;
  total_accrued: number | null;
  total_deducted: number | null;
  net_payable: number | null;
};

export type BonusDeductionsTablePagination = {
  page: number;
  limit: number;
  total_count: number;
  total_pages: number;
  from: number;
  to: number;
  has_previous_page: boolean;
  has_next_page: boolean;
};

export type BonusDeductionsTableResult = {
  period?: BonusDeductionsPeriod;
  accrual_types?: BonusDeductionsMetricType[];
  deduction_types?: BonusDeductionsMetricType[];
  items: BonusDeductionsTableItem[];
  totals?: BonusDeductionsTableTotals;
  pagination: BonusDeductionsTablePagination;
  filters_applied?: JsonRecord;
};

export type BonusDeductionsTableInvokeResponse = {
  method: typeof GET_BONUS_DEDUCTIONS_TABLE_METHOD;
  result: BonusDeductionsTableResult;
};

export type BonusDeductionsExcelInvokeResponse = {
  method: typeof GET_BONUS_DEDUCTIONS_EXCEL_METHOD;
  result: {
    period_key?: string;
    period_label?: string | null;
    file_name: string;
    mime_type: string;
    file_base64: string;
    metadata?: {
      employees_count?: number;
      accrual_types?: Array<{ key: string; label: string }>;
      deduction_types?: Array<{ key: string; label: string }>;
    };
  };
};

export type OrgStructureManagerInfo = {
  guid: string | null;
  full_name: string;
  first_name: string | null;
  second_name: string | null;
  middle_name: string | null;
  email: string | null;
  phone: string | null;
  photo: string | null;
  initials: string;
  position_title: string;
};

export type OrgStructureNode = {
  id: string;
  department_guid: string;
  title: string;
  parent_id: string | null;
  hierarchy_level: number;
  direct_employees_count: number;
  total_employees_count: number;
  children_count: number;
  manager: OrgStructureManagerInfo;
};

export type OrgStructureEdge = {
  source: string;
  target: string;
};

export type OrgStructureDepartmentFilterItem = {
  guid: string;
  title: string;
  hierarchy_level: number;
  parent_id: string | null;
};

export type OrgStructureLevelFilterItem = {
  value: number;
  label: string;
};

export type OrgStructureResult = {
  cards?: {
    total_employees?: number;
    departments_count?: number;
    managers_count?: number;
    hierarchy_levels?: number;
  };
  chart?: {
    nodes?: OrgStructureNode[];
    edges?: OrgStructureEdge[];
    root_ids?: string[];
  };
  filters?: {
    departments?: OrgStructureDepartmentFilterItem[];
    levels?: OrgStructureLevelFilterItem[];
  };
  filters_applied?: JsonRecord;
};

export type OrgStructureInvokeResponse = {
  method: typeof GET_ORG_STRUCTURE_METHOD;
  result: OrgStructureResult;
};

export type RecruitingFunnelCycleOption = {
  value: string;
  label: string;
};

export type RecruitingFunnelStage = {
  id: string;
  name: string;
  color: string | null;
  order: number;
};

export type RecruitingFunnelStep = {
  stage_id: string;
  label: string;
  color: string | null;
  count: number;
  percentage: number;
};

export type RecruitingFunnelRejectionItem = {
  label: string;
  count: number;
  percentage: number;
};

export type RecruitingFunnelTableStage = {
  id: string;
  label: string;
};

export type RecruitingFunnelTableRow = {
  vacancy_guid: string;
  vacancy_title: string;
  counts: Record<string, number>;
  total: number;
};

export type RecruitingFunnelTableTotals = {
  counts: Record<string, number>;
  total: number;
};

export type RecruitingFunnelSummary = {
  total_candidates: number;
  active: number;
  hired: number;
  rejected: number;
  reserve: number;
  conversion_rate: number;
};

export type RecruitingFunnelResult = {
  filters?: {
    cycles?: RecruitingFunnelCycleOption[];
  };
  summary?: RecruitingFunnelSummary;
  filters_applied?: {
    stage_template_id?: string | null;
  };
  cycle?: {
    stage_template_id: string;
    name: string;
  } | null;
  stages?: RecruitingFunnelStage[];
  funnel?: RecruitingFunnelStep[];
  rejection_reasons?: RecruitingFunnelRejectionItem[];
  table?: {
    stages: RecruitingFunnelTableStage[];
    rows: RecruitingFunnelTableRow[];
    totals: RecruitingFunnelTableTotals;
  };
};

export type RecruitingFunnelInvokeResponse = {
  method: typeof GET_RECRUITING_FUNNEL_METHOD;
  result: RecruitingFunnelResult;
};

export type RecruitingSourceOption = {
  value: string;
  label: string;
};

export type RecruitingSourcesByDateItem = {
  date: string;
  label: string;
  counts: Record<string, number>;
};

export type RecruitingSourcesShareItem = {
  label: string;
  count: number;
  percentage: number;
};

export type RecruitingSourcesResult = {
  filters?: {
    sources?: RecruitingSourceOption[];
  };
  filters_applied?: {
    date_from?: string | null;
    date_to?: string | null;
  };
  summary?: {
    total_candidates: number;
  };
  sources?: string[];
  by_date?: RecruitingSourcesByDateItem[];
  by_source?: RecruitingSourcesShareItem[];
};

export type RecruitingSourcesInvokeResponse = {
  method: typeof GET_RECRUITING_SOURCES_METHOD;
  result: RecruitingSourcesResult;
};

export type RecruitingClosureTimesDimension =
  | "vacancies"
  | "positions"
  | "departments"
  | "locations";

export type RecruitingClosureTimesOption = {
  value: string;
  label: string;
};

export type RecruitingClosureTimesRow = {
  id: string | null;
  title: string;
  opened_at: string | null;
  vacancies_count: number;
  candidates_count: number;
  hired_count: number;
  hired_percentage: number;
  min_days_to_fill: number | null;
  max_days_to_fill: number | null;
  avg_days_to_fill: number | null;
};

export type RecruitingClosureTimesSummary = {
  total_vacancies: number;
  total_candidates: number;
  hired_count: number;
  hired_percentage: number;
  avg_days_to_fill: number | null;
};

export type RecruitingClosureTimesResult = {
  filters?: {
    dimensions?: RecruitingClosureTimesOption[];
    levels?: RecruitingClosureTimesOption[];
  };
  filters_applied?: {
    dimension?: RecruitingClosureTimesDimension;
    date_from?: string | null;
    date_to?: string | null;
    level?: string | null;
  };
  summary?: RecruitingClosureTimesSummary;
  rows?: RecruitingClosureTimesRow[];
};

export type RecruitingClosureTimesInvokeResponse = {
  method: typeof GET_RECRUITING_CLOSURE_TIMES_METHOD;
  result: RecruitingClosureTimesResult;
};

export type SalaryExcelTemplateTypeItem = {
  guid: string;
  title: string;
};

export type SalaryExcelTemplateInvokeResponse = {
  method: typeof GET_SALARY_EXCEL_TEMPLATE_METHOD;
  result: {
    month: string;
    period_label: string;
    file_name: string;
    mime_type: string;
    file_base64: string;
    metadata?: {
      employees_count?: number;
      income_types?: SalaryExcelTemplateTypeItem[];
      deduction_types?: SalaryExcelTemplateTypeItem[];
    };
  };
};

export type ImportSalaryExcelInvokeResponse = {
  method: typeof IMPORT_SALARY_EXCEL_METHOD;
  result: {
    month: string;
    parsed_rows_count: number;
    valid_rows_count: number;
    inserted_count: number;
    skipped?: {
      invalid_user?: number;
      non_positive_amount?: number;
      unknown_user?: number;
      missing_type_columns?: number;
    };
  };
};

export type KpiPeriodType = "daily" | "monthly" | "weekly" | "quarterly" | "yearly";

export type KpiFilterOption = {
  value: string;
  label: string;
};

export type KpiParentOption = {
  value: string;
  label: string;
  period_type?: KpiPeriodType | string;
  start_date?: string;
  end_date?: string;
};

export type KpiFiltersResult = {
  filters?: {
    period_types?: KpiFilterOption[];
    value_symbol_positions?: KpiFilterOption[];
    positions?: KpiFilterOption[];
    sources?: KpiFilterOption[];
    parents?: KpiParentOption[];
    defaults?: {
      period_type?: KpiPeriodType;
      date_from?: string;
      date_to?: string;
      value_symbol_position?: "prefix" | "suffix";
    };
  };
  filters_applied?: JsonRecord;
};

export type KpiGetInvokeResponse = {
  method: typeof GET_KPI_METHOD;
  result: KpiFiltersResult;
};

export type KpiTableItem = {
  guid: string;
  parent_id: string | null;
  positions_id: string | null;
  position: string;
  title: string;
  description: string;
  source: string;
  value_symbol?: string;
  value_symbol_position?: "prefix" | "suffix" | string;
  period_type: KpiPeriodType | string;
  start_date: string;
  end_date: string;
  start_date_label?: string;
  end_date_label?: string;
  own_plan_total: number;
  own_actual_total: number;
  plan_total: number;
  actual_total: number;
  percent_total: number;
  has_children: boolean;
  children: KpiTableItem[];
};

export type KpiTableGroup = {
  position: string;
  items: KpiTableItem[];
};

export type KpiTableResult = {
  count: number;
  period_type: KpiPeriodType | string;
  period?: {
    from: string;
    to: string;
    label: string;
  };
  groups: KpiTableGroup[];
  items: KpiTableItem[];
  filters_applied?: JsonRecord;
};

export type KpiTableInvokeResponse = {
  method: typeof GET_KPI_TABLE_METHOD;
  result: KpiTableResult;
};

export type SaveKpiInvokeResponse = {
  method: typeof SAVE_KPI_METHOD;
  result: {
    guid: string;
    parent_id: string | null;
    positions_id?: string | null;
    period_type: KpiPeriodType | string;
    value_symbol?: string;
    value_symbol_position?: "prefix" | "suffix" | string;
    plan_total: number;
    actual_total: number;
    percent_total: number;
    has_children: boolean;
    child_ids: string[];
  };
};

export type DeleteKpiInvokeResponse = {
  method: typeof DELETE_KPI_METHOD;
  result: {
    guid: string;
    deleted_count: number;
    deleted_ids: string[];
  };
};

export type UpdateKpiValueInvokeResponse = {
  method: typeof UPDATE_KPI_VALUE_METHOD;
  result: {
    guid: string;
    parent_id: string | null;
    plan_total: number;
    actual_total: number;
    percent_total: number;
    root?: {
      guid: string;
      plan_total: number;
      actual_total: number;
      percent_total: number;
    } | null;
  };
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

reportsRequest.interceptors.request.use((config) => {
  const token = authStore.token ?? localStorage.getItem("auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return injectCompaniesIdIntoInvokeFunctionRequest(config);
});

reportsRequest.interceptors.response.use(
  (response) => response,
  (error) => {
    handleUnauthorizedError(error);
    return Promise.reject(error);
  }
);

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

const isBonusDeductionsInvokeResponse = (
  value: unknown
): value is BonusDeductionsInvokeResponse => {
  if (!isRecord(value)) return false;
  return value.method === GET_BONUS_DEDUCTIONS_METHOD && isRecord(value.result);
};

const isBonusDeductionsTableInvokeResponse = (
  value: unknown
): value is BonusDeductionsTableInvokeResponse => {
  if (!isRecord(value)) return false;
  return value.method === GET_BONUS_DEDUCTIONS_TABLE_METHOD && isRecord(value.result);
};

const isBonusDeductionsExcelInvokeResponse = (
  value: unknown
): value is BonusDeductionsExcelInvokeResponse => {
  if (!isRecord(value)) return false;
  return value.method === GET_BONUS_DEDUCTIONS_EXCEL_METHOD && isRecord(value.result);
};

const isOrgStructureInvokeResponse = (
  value: unknown
): value is OrgStructureInvokeResponse => {
  if (!isRecord(value)) return false;
  return value.method === GET_ORG_STRUCTURE_METHOD && isRecord(value.result);
};

const isSalaryExcelTemplateInvokeResponse = (
  value: unknown
): value is SalaryExcelTemplateInvokeResponse => {
  if (!isRecord(value)) return false;
  return value.method === GET_SALARY_EXCEL_TEMPLATE_METHOD && isRecord(value.result);
};

const isImportSalaryExcelInvokeResponse = (
  value: unknown
): value is ImportSalaryExcelInvokeResponse => {
  if (!isRecord(value)) return false;
  return value.method === IMPORT_SALARY_EXCEL_METHOD && isRecord(value.result);
};

const isKpiGetInvokeResponse = (
  value: unknown
): value is KpiGetInvokeResponse => {
  if (!isRecord(value)) return false;
  return value.method === GET_KPI_METHOD && isRecord(value.result);
};

const isKpiTableInvokeResponse = (
  value: unknown
): value is KpiTableInvokeResponse => {
  if (!isRecord(value)) return false;
  return value.method === GET_KPI_TABLE_METHOD && isRecord(value.result);
};

const isSaveKpiInvokeResponse = (
  value: unknown
): value is SaveKpiInvokeResponse => {
  if (!isRecord(value)) return false;
  return value.method === SAVE_KPI_METHOD && isRecord(value.result);
};

const isDeleteKpiInvokeResponse = (
  value: unknown
): value is DeleteKpiInvokeResponse => {
  if (!isRecord(value)) return false;
  return value.method === DELETE_KPI_METHOD && isRecord(value.result);
};

const isUpdateKpiValueInvokeResponse = (
  value: unknown
): value is UpdateKpiValueInvokeResponse => {
  if (!isRecord(value)) return false;
  return value.method === UPDATE_KPI_VALUE_METHOD && isRecord(value.result);
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

const normalizeBonusDeductionsResponse = (
  raw: unknown
): BonusDeductionsInvokeResponse => {
  if (isBonusDeductionsInvokeResponse(raw)) {
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

    if (isBonusDeductionsInvokeResponse(raw.data)) {
      return raw.data;
    }

    if (isRecord(raw.data)) {
      const payload = raw.data.data;

      if (isBonusDeductionsInvokeResponse(payload)) {
        return payload;
      }
    }
  }

  throw new Error("Unexpected response format for get_bonus_deductions");
};

const normalizeBonusDeductionsTableResponse = (
  raw: unknown
): BonusDeductionsTableInvokeResponse => {
  if (isBonusDeductionsTableInvokeResponse(raw)) {
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

    if (isBonusDeductionsTableInvokeResponse(raw.data)) {
      return raw.data;
    }

    if (isRecord(raw.data)) {
      const payload = raw.data.data;

      if (isBonusDeductionsTableInvokeResponse(payload)) {
        return payload;
      }
    }
  }

  throw new Error("Unexpected response format for get_bonus_deductions_table");
};

const normalizeBonusDeductionsExcelResponse = (
  raw: unknown
): BonusDeductionsExcelInvokeResponse => {
  if (isBonusDeductionsExcelInvokeResponse(raw)) {
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

    if (isBonusDeductionsExcelInvokeResponse(raw.data)) {
      return raw.data;
    }

    if (isRecord(raw.data)) {
      const payload = raw.data.data;

      if (isBonusDeductionsExcelInvokeResponse(payload)) {
        return payload;
      }
    }
  }

  throw new Error("Unexpected response format for get_bonus_deductions_excel");
};

const normalizeOrgStructureResponse = (
  raw: unknown
): OrgStructureInvokeResponse => {
  if (isOrgStructureInvokeResponse(raw)) {
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

    if (isOrgStructureInvokeResponse(raw.data)) {
      return raw.data;
    }

    if (isRecord(raw.data)) {
      const payload = raw.data.data;

      if (isOrgStructureInvokeResponse(payload)) {
        return payload;
      }
    }
  }

  throw new Error("Unexpected response format for get_org_structure");
};

const normalizeSalaryExcelTemplateResponse = (
  raw: unknown
): SalaryExcelTemplateInvokeResponse => {
  if (isSalaryExcelTemplateInvokeResponse(raw)) {
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

    if (isSalaryExcelTemplateInvokeResponse(raw.data)) {
      return raw.data;
    }

    if (isRecord(raw.data)) {
      const payload = raw.data.data;

      if (isSalaryExcelTemplateInvokeResponse(payload)) {
        return payload;
      }
    }
  }

  throw new Error("Unexpected response format for get_salary_excel_template");
};

const normalizeImportSalaryExcelResponse = (
  raw: unknown
): ImportSalaryExcelInvokeResponse => {
  if (isImportSalaryExcelInvokeResponse(raw)) {
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

    if (isImportSalaryExcelInvokeResponse(raw.data)) {
      return raw.data;
    }

    if (isRecord(raw.data)) {
      const payload = raw.data.data;

      if (isImportSalaryExcelInvokeResponse(payload)) {
        return payload;
      }
    }
  }

  throw new Error("Unexpected response format for import_salary_excel");
};

const normalizeKpiGetResponse = (
  raw: unknown
): KpiGetInvokeResponse => {
  if (isKpiGetInvokeResponse(raw)) {
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

    if (isKpiGetInvokeResponse(raw.data)) {
      return raw.data;
    }

    if (isRecord(raw.data)) {
      const payload = raw.data.data;

      if (isKpiGetInvokeResponse(payload)) {
        return payload;
      }
    }
  }

  throw new Error("Unexpected response format for get_kpi");
};

const normalizeKpiTableResponse = (
  raw: unknown
): KpiTableInvokeResponse => {
  if (isKpiTableInvokeResponse(raw)) {
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

    if (isKpiTableInvokeResponse(raw.data)) {
      return raw.data;
    }

    if (isRecord(raw.data)) {
      const payload = raw.data.data;

      if (isKpiTableInvokeResponse(payload)) {
        return payload;
      }
    }
  }

  throw new Error("Unexpected response format for get_kpi_table");
};

const normalizeSaveKpiResponse = (
  raw: unknown
): SaveKpiInvokeResponse => {
  if (isSaveKpiInvokeResponse(raw)) {
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

    if (isSaveKpiInvokeResponse(raw.data)) {
      return raw.data;
    }

    if (isRecord(raw.data)) {
      const payload = raw.data.data;

      if (isSaveKpiInvokeResponse(payload)) {
        return payload;
      }
    }
  }

  throw new Error("Unexpected response format for save_kpi");
};

const normalizeDeleteKpiResponse = (
  raw: unknown
): DeleteKpiInvokeResponse => {
  if (isDeleteKpiInvokeResponse(raw)) {
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

    if (isDeleteKpiInvokeResponse(raw.data)) {
      return raw.data;
    }

    if (isRecord(raw.data)) {
      const payload = raw.data.data;

      if (isDeleteKpiInvokeResponse(payload)) {
        return payload;
      }
    }
  }

  throw new Error("Unexpected response format for delete_kpi");
};

const normalizeUpdateKpiValueResponse = (
  raw: unknown
): UpdateKpiValueInvokeResponse => {
  if (isUpdateKpiValueInvokeResponse(raw)) {
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

    if (isUpdateKpiValueInvokeResponse(raw.data)) {
      return raw.data;
    }

    if (isRecord(raw.data)) {
      const payload = raw.data.data;

      if (isUpdateKpiValueInvokeResponse(payload)) {
        return payload;
      }
    }
  }

  throw new Error("Unexpected response format for update_kpi_value");
};

const normalizeGatewayResponse = <T extends { method: string; result: unknown }>(
  raw: unknown,
  expectedMethod: string
): T => {
  const matches = (value: unknown): value is T =>
    isRecord(value) &&
    value.method === expectedMethod &&
    isRecord(value.result);

  const visited = new Set<unknown>();
  const queue: unknown[] = [raw];
  while (queue.length > 0) {
    const node = queue.shift();
    if (!isRecord(node) || visited.has(node)) continue;
    visited.add(node);

    if (typeof node.server_error === "string" && node.server_error) {
      throw new Error(node.server_error);
    }

    if (matches(node)) {
      return node;
    }

    if (isRecord(node.data)) queue.push(node.data);
    if (isRecord(node.result)) queue.push(node.result);
    if (isRecord(node.response)) queue.push(node.response);
  }

  throw new Error(`Unexpected response format for ${expectedMethod}`);
};

const reportsService = {
  getKpi: async (
    requestData: JsonRecord = {}
  ): Promise<KpiGetInvokeResponse> => {
    const response = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
      data: {
        method: GET_KPI_METHOD,
        data: requestData,
      },
    });

    return normalizeKpiGetResponse(response.data);
  },
  getKpiTable: async (
    requestData: JsonRecord = {}
  ): Promise<KpiTableInvokeResponse> => {
    const response = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
      data: {
        method: GET_KPI_TABLE_METHOD,
        data: requestData,
      },
    });

    return normalizeKpiTableResponse(response.data);
  },
  saveKpi: async (
    requestData: JsonRecord = {}
  ): Promise<SaveKpiInvokeResponse> => {
    const response = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
      data: {
        method: SAVE_KPI_METHOD,
        data: requestData,
      },
    });

    return normalizeSaveKpiResponse(response.data);
  },
  deleteKpi: async (
    requestData: JsonRecord = {}
  ): Promise<DeleteKpiInvokeResponse> => {
    const response = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
      data: {
        method: DELETE_KPI_METHOD,
        data: requestData,
      },
    });

    return normalizeDeleteKpiResponse(response.data);
  },
  updateKpiValue: async (
    requestData: JsonRecord = {}
  ): Promise<UpdateKpiValueInvokeResponse> => {
    const response = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
      data: {
        method: UPDATE_KPI_VALUE_METHOD,
        data: requestData,
      },
    });

    return normalizeUpdateKpiValueResponse(response.data);
  },
  approveAbsence: async (
    requestData: { absences_id: string; reviewed_by?: string | null }
  ): Promise<ApproveAbsenceInvokeResponse> => {
    const response = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
      data: {
        method: APPROVE_ABSENCE_METHOD,
        data: requestData,
      },
    });

    return normalizeGatewayResponse<ApproveAbsenceInvokeResponse>(
      response.data,
      APPROVE_ABSENCE_METHOD
    );
  },
  deleteAbsence: async (
    requestData: { absences_id: string }
  ): Promise<DeleteAbsenceInvokeResponse> => {
    const response = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
      data: {
        method: DELETE_ABSENCE_METHOD,
        data: requestData,
      },
    });

    return normalizeGatewayResponse<DeleteAbsenceInvokeResponse>(
      response.data,
      DELETE_ABSENCE_METHOD
    );
  },
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
  getBonusDeductions: async (
    requestData: JsonRecord = {}
  ): Promise<BonusDeductionsInvokeResponse> => {
    const response = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
      data: {
        method: GET_BONUS_DEDUCTIONS_METHOD,
        data: requestData,
      },
    });

    return normalizeBonusDeductionsResponse(response.data);
  },
  getBonusDeductionsTable: async (
    requestData: JsonRecord = {},
    pagination: { page?: number; limit?: number } = {}
  ): Promise<BonusDeductionsTableInvokeResponse> => {
    const page = Number.isFinite(Number(pagination.page)) ? Number(pagination.page) : 1;
    const limit = Number.isFinite(Number(pagination.limit)) ? Number(pagination.limit) : 200;

    const payloadData = {
      ...requestData,
      page,
      limit,
    };

    const response = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
      data: {
        method: GET_BONUS_DEDUCTIONS_TABLE_METHOD,
        data: payloadData,
      },
    });

    return normalizeBonusDeductionsTableResponse(response.data);
  },
  getBonusDeductionsExcel: async (
    requestData: JsonRecord = {}
  ): Promise<BonusDeductionsExcelInvokeResponse> => {
    const response = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
      data: {
        method: GET_BONUS_DEDUCTIONS_EXCEL_METHOD,
        data: requestData,
      },
    });

    return normalizeBonusDeductionsExcelResponse(response.data);
  },
  getOrgStructure: async (
    requestData: JsonRecord = {}
  ): Promise<OrgStructureInvokeResponse> => {
    const response = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
      data: {
        method: GET_ORG_STRUCTURE_METHOD,
        data: requestData,
      },
    });

    return normalizeOrgStructureResponse(response.data);
  },
  getRecruitingFunnel: async (
    requestData: JsonRecord = {}
  ): Promise<RecruitingFunnelInvokeResponse> => {
    const response = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
      data: {
        method: GET_RECRUITING_FUNNEL_METHOD,
        data: requestData,
      },
    });

    return normalizeGatewayResponse<RecruitingFunnelInvokeResponse>(
      response.data,
      GET_RECRUITING_FUNNEL_METHOD
    );
  },
  getRecruitingSources: async (
    requestData: JsonRecord = {}
  ): Promise<RecruitingSourcesInvokeResponse> => {
    const response = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
      data: {
        method: GET_RECRUITING_SOURCES_METHOD,
        data: requestData,
      },
    });

    return normalizeGatewayResponse<RecruitingSourcesInvokeResponse>(
      response.data,
      GET_RECRUITING_SOURCES_METHOD
    );
  },
  getRecruitingClosureTimes: async (
    requestData: JsonRecord = {}
  ): Promise<RecruitingClosureTimesInvokeResponse> => {
    const response = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
      data: {
        method: GET_RECRUITING_CLOSURE_TIMES_METHOD,
        data: requestData,
      },
    });

    return normalizeGatewayResponse<RecruitingClosureTimesInvokeResponse>(
      response.data,
      GET_RECRUITING_CLOSURE_TIMES_METHOD
    );
  },
  getSalaryExcelTemplate: async (
    requestData: JsonRecord = {}
  ): Promise<SalaryExcelTemplateInvokeResponse> => {
    const response = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
      data: {
        method: GET_SALARY_EXCEL_TEMPLATE_METHOD,
        data: requestData,
      },
    });

    return normalizeSalaryExcelTemplateResponse(response.data);
  },
  importSalaryExcel: async (
    requestData: JsonRecord = {}
  ): Promise<ImportSalaryExcelInvokeResponse> => {
    const response = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
      data: {
        method: IMPORT_SALARY_EXCEL_METHOD,
        data: requestData,
      },
    });

    return normalizeImportSalaryExcelResponse(response.data);
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

export const useBonusDeductionsReportQuery = (
  requestData: JsonRecord = {}
) => {
  return useQuery({
    queryKey: ["REPORTS", "BONUS_DEDUCTIONS", requestData],
    queryFn: () => reportsService.getBonusDeductions(requestData),
    staleTime: 60_000,
  });
};

export const useBonusDeductionsTableQuery = ({
  requestData = {},
  page = 1,
  limit = 200,
}: {
  requestData?: JsonRecord;
  page?: number;
  limit?: number;
} = {}) => {
  return useQuery({
    queryKey: ["REPORTS", "BONUS_DEDUCTIONS_TABLE", requestData, page, limit],
    queryFn: () => reportsService.getBonusDeductionsTable(requestData, { page, limit }),
    keepPreviousData: true,
    staleTime: 30_000,
  });
};

export const useOrgStructureReportQuery = (
  requestData: JsonRecord = {}
) => {
  return useQuery({
    queryKey: ["REPORTS", "ORG_STRUCTURE", requestData],
    queryFn: () => reportsService.getOrgStructure(requestData),
    staleTime: 60_000,
  });
};

export const useRecruitingFunnelReportQuery = (
  requestData: JsonRecord = {}
) => {
  return useQuery({
    queryKey: ["REPORTS", "RECRUITING_FUNNEL", requestData],
    queryFn: () => reportsService.getRecruitingFunnel(requestData),
    staleTime: 60_000,
  });
};

export const useRecruitingSourcesReportQuery = (
  requestData: JsonRecord = {}
) => {
  return useQuery({
    queryKey: ["REPORTS", "RECRUITING_SOURCES", requestData],
    queryFn: () => reportsService.getRecruitingSources(requestData),
    staleTime: 60_000,
  });
};

export const useRecruitingClosureTimesReportQuery = (
  requestData: JsonRecord = {}
) => {
  return useQuery({
    queryKey: ["REPORTS", "RECRUITING_CLOSURE_TIMES", requestData],
    queryFn: () => reportsService.getRecruitingClosureTimes(requestData),
    staleTime: 60_000,
  });
};

export default reportsService;
