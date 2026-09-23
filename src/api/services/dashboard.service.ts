import { useQuery } from "react-query";
import httpRequest from "../httpRequest";
import { translate } from "../../i18n";

type DashboardAgendaParams = {
  userBaseId: string;
  dateFrom: string;
  dateTo: string;
};

type DashboardVacationParams = {
  userBaseId: string;
};

type AggregationResponseRow = Record<string, unknown>;

interface DashboardHolidayAggregationRow extends AggregationResponseRow {
  holiday_guid?: string;
  holiday_title?: string;
  holiday_date?: string;
  holiday_policy_guid?: string;
  holiday_policy_title?: string;
  is_working_holiday?: boolean;
  is_weekend_transfer?: boolean;
  is_workday_transfer?: boolean;
}

interface DashboardAbsencePolicyRow extends AggregationResponseRow {
  guid?: string;
  title?: string;
  value?: number | string;
  type?: string[] | string;
  period?: string[] | string;
  icon?: string;
  color?: string;
}

interface DashboardBalanceTransactionRow extends AggregationResponseRow {
  absence_policies_id?: string;
  amount?: number | string;
  tx_date?: string | null;
  tx_created_at?: string;
}

export interface DashboardHolidayEvent {
  guid: string;
  title: string;
  date: string;
  holidayPolicyGuid: string;
  holidayPolicyTitle: string;
  isWorkingHoliday: boolean;
  isWeekendTransfer: boolean;
  isWorkdayTransfer: boolean;
}

export interface DashboardVacationPolicySummary {
  policyGuid: string;
  policyTitle: string;
  totalDays: number;
  usedDays: number;
  availableDays: number;
  icon: string;
  color: string;
}

const escapeSqlValue = (value: string): string => value.replace(/'/g, "''");

const extractRows = <T>(res: unknown): T[] => {
  if (Array.isArray(res)) return res as T[];

  const obj = (res && typeof res === "object") ? (res as Record<string, unknown>) : {};
  const directRows = Array.isArray(obj.response)
    ? obj.response
    : Array.isArray(obj.data)
      ? obj.data
      : [];

  return Array.isArray(directRows) ? (directRows as T[]) : [];
};

const extractDatePart = (value: unknown): string => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  const matched = trimmed.match(/\d{4}-\d{2}-\d{2}/);
  return matched ? matched[0] : "";
};

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const parseStringList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim().toLowerCase() : ""))
      .filter(Boolean);
  }

  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => (typeof item === "string" ? item.trim().toLowerCase() : ""))
        .filter(Boolean);
    }
  } catch {
    // noop
  }

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed
      .slice(1, -1)
      .split(",")
      .map((item) => item.replace(/["']/g, "").trim().toLowerCase())
      .filter(Boolean);
  }

  return [trimmed.replace(/["']/g, "").toLowerCase()];
};

const toIsoDate = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getWeekStartMonday = (value: Date): Date => {
  const base = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const dayOfWeek = base.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  base.setDate(base.getDate() + diff);
  return base;
};

const getPeriodRangeBySlug = (periodSlug: string, now: Date): { from: string; to: string } => {
  const normalized = periodSlug.toLowerCase();

  if (normalized === "week") {
    const fromDate = getWeekStartMonday(now);
    const toDate = new Date(fromDate);
    toDate.setDate(fromDate.getDate() + 6);
    return { from: toIsoDate(fromDate), to: toIsoDate(toDate) };
  }

  if (normalized === "month") {
    const fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: toIsoDate(fromDate), to: toIsoDate(toDate) };
  }

  const fromDate = new Date(now.getFullYear(), 0, 1);
  const toDate = new Date(now.getFullYear(), 11, 31);
  return { from: toIsoDate(fromDate), to: toIsoDate(toDate) };
};

const getPrimaryPeriodSlug = (value: unknown): "week" | "month" | "year" => {
  const list = parseStringList(value);
  const first = list[0] || "";
  if (first === "week" || first === "month" || first === "year") {
    return first;
  }
  return "year";
};

const extractSourceDate = (row: DashboardBalanceTransactionRow): string => {
  const candidates = [row.tx_date, row.tx_created_at];
  for (const candidate of candidates) {
    const extracted = extractDatePart(candidate);
    if (extracted) return extracted;
  }
  return "";
};

const dashboardService = {
  getAgendaHolidays: async ({
    userBaseId,
    dateFrom,
    dateTo,
  }: DashboardAgendaParams): Promise<DashboardHolidayEvent[]> => {
    const normalizedUserBaseId = userBaseId.trim();
    const normalizedDateFrom = dateFrom.trim();
    const normalizedDateTo = dateTo.trim();

    if (!normalizedUserBaseId || !normalizedDateFrom || !normalizedDateTo) {
      return [];
    }

    const where = [
      `ub.guid = '${escapeSqlValue(normalizedUserBaseId)}'`,
      `hpd.date >= '${escapeSqlValue(normalizedDateFrom)}'`,
      `hpd.date <= '${escapeSqlValue(normalizedDateTo)}'`,
    ].join(" AND ");

    const res = await httpRequest.post("/v2/items/holiday_policy_days/aggregation", {
      data: {
        operation: "SELECT",
        table:
          "holiday_policy_days hpd LEFT JOIN holiday_policies hp ON hp.guid = hpd.holiday_policies_id LEFT JOIN regions r ON r.holiday_policies_id = hp.guid LEFT JOIN locations l ON l.regions_id = r.guid LEFT JOIN user_base ub ON ub.locations_id = l.guid",
        columns: [
          "hpd.guid AS holiday_guid",
          "hpd.title AS holiday_title",
          "hpd.date AS holiday_date",
          "hpd.is_working_holiday AS is_working_holiday",
          "hpd.is_weekend_transfer AS is_weekend_transfer",
          "hpd.is_workday_transfer AS is_workday_transfer",
          "hp.guid AS holiday_policy_guid",
          "hp.title AS holiday_policy_title",
        ],
        where,
        order_by: ["hpd.date ASC", "hpd.created_at ASC"],
        limit: 500,
        offset: 0,
      },
      is_cached: true,
    });

    const rows = extractRows<DashboardHolidayAggregationRow>(res);
    const unique = new Map<string, DashboardHolidayEvent>();

    for (const row of rows) {
      const date = extractDatePart(row.holiday_date);
      const title = typeof row.holiday_title === "string" ? row.holiday_title.trim() : "";
      const guid = typeof row.holiday_guid === "string" ? row.holiday_guid : "";

      if (!date || !title) continue;

      const key = guid || `${date}-${title}`;
      if (unique.has(key)) continue;

      unique.set(key, {
        guid: guid || key,
        title,
        date,
        holidayPolicyGuid:
          typeof row.holiday_policy_guid === "string" ? row.holiday_policy_guid : "",
        holidayPolicyTitle:
          typeof row.holiday_policy_title === "string" ? row.holiday_policy_title : "",
        isWorkingHoliday: Boolean(row.is_working_holiday),
        isWeekendTransfer: Boolean(row.is_weekend_transfer),
        isWorkdayTransfer: Boolean(row.is_workday_transfer),
      });
    }

    return Array.from(unique.values()).sort((a, b) => {
      if (a.date === b.date) return a.title.localeCompare(b.title, "ru");
      return a.date.localeCompare(b.date);
    });
  },

  getVacationSummaries: async ({
    userBaseId,
  }: DashboardVacationParams): Promise<DashboardVacationPolicySummary[]> => {
    const normalizedUserBaseId = userBaseId.trim();

    if (!normalizedUserBaseId) {
      return [];
    }

    const policiesResponse = await httpRequest.post("/v2/items/absence_policies/aggregation", {
      data: {
        operation: "SELECT",
        table: "absence_policies",
        columns: ["guid", "title", "value", "type", "period", "icon", "color"],
        where: "deleted_at IS NULL",
        order_by: ["title ASC", "created_at DESC"],
        limit: 300,
        offset: 0,
      },
      is_cached: true,
    });

    const policyRows = extractRows<DashboardAbsencePolicyRow>(policiesResponse);
    const policies = policyRows
      .map((item) => {
        const guid = typeof item.guid === "string" ? item.guid : "";
        const title = typeof item.title === "string" ? item.title : "";
        const value = toNumber(item.value, 0);
        const typeList = parseStringList(item.type);
        const period = getPrimaryPeriodSlug(item.period);
        const icon = typeof item.icon === "string" && item.icon ? item.icon : "mdi:airplane";
        const color = typeof item.color === "string" && item.color ? item.color : "#4F46E5";
        return {
          guid,
          title,
          value,
          typeList,
          period,
          icon,
          color,
        };
      })
      .filter((item) => Boolean(item.guid));

    const limit = 500;
    const maxRequests = 100;
    let offset = 0;
    const balanceRows: DashboardBalanceTransactionRow[] = [];

    for (let requestIndex = 0; requestIndex < maxRequests; requestIndex += 1) {
      const txResponse = await httpRequest.post("/v2/items/absence_balance_transactions/aggregation", {
        data: {
          operation: "SELECT",
          table: "absence_balance_transactions",
          columns: [
            "absence_policies_id",
            "amount",
            "date AS tx_date",
            "created_at AS tx_created_at",
          ],
          where: `user_base_id = '${escapeSqlValue(normalizedUserBaseId)}' AND deleted_at IS NULL`,
          order_by: ["created_at DESC"],
          limit,
          offset,
        },
        is_cached: true,
      });

      const chunk = extractRows<DashboardBalanceTransactionRow>(txResponse);
      if (chunk.length === 0) break;
      balanceRows.push(...chunk);
      offset += chunk.length;
      if (chunk.length < limit) break;
    }

    const now = new Date();

    return policies.map((policy) => {
      const periodRange = getPeriodRangeBySlug(policy.period, now);
      const periodBalance = balanceRows.reduce((sum, row) => {
        const policyId = typeof row.absence_policies_id === "string" ? row.absence_policies_id : "";
        if (policyId !== policy.guid) return sum;

        const sourceDate = extractSourceDate(row);
        if (!sourceDate) return sum;
        if (sourceDate < periodRange.from || sourceDate > periodRange.to) return sum;

        return sum + toNumber(row.amount, 0);
      }, 0);

      const totalDays = Math.max(0, policy.value);
      const availableDays = Math.max(0, totalDays + periodBalance);
      const usedDays = Math.max(0, totalDays - availableDays);

      return {
        policyGuid: policy.guid,
        policyTitle: policy.title || translate("dashboard.fallback.absence"),
        totalDays,
        usedDays,
        availableDays,
        icon: policy.icon,
        color: policy.color,
      };
    });
  },
};

export const useDashboardAgendaHolidaysQuery = ({
  params,
  querySettings = {},
}: {
  params: DashboardAgendaParams;
  querySettings?: Record<string, unknown>;
}) =>
  useQuery({
    queryKey: ["dashboard-agenda-holidays", params.userBaseId, params.dateFrom, params.dateTo],
    queryFn: () => dashboardService.getAgendaHolidays(params),
    enabled: Boolean(params.userBaseId && params.dateFrom && params.dateTo),
    ...querySettings,
  });

export const useDashboardVacationSummariesQuery = ({
  params,
  querySettings = {},
}: {
  params: DashboardVacationParams;
  querySettings?: Record<string, unknown>;
}) =>
  useQuery({
    queryKey: ["dashboard-vacation-summaries", params.userBaseId],
    queryFn: () => dashboardService.getVacationSummaries(params),
    enabled: Boolean(params.userBaseId),
    ...querySettings,
  });

export default dashboardService;
