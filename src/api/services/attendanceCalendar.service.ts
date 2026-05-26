import { useQuery } from "react-query";
import httpRequest from "../httpRequest";

const ATTENDANCE_COLLECTION = "attendance";

export type CalendarAttendanceParams = {
  employeeIds: string[];
  dateFrom: string;
  dateTo: string;
};

export type CalendarAttendanceRow = {
  guid: string;
  user_base_id: string;
  date: string;
  check_in_time?: string | null;
  check_out_time?: string | null;
  delay_time?: string | null;
  action_status?: string[] | string | null;
  status?: string[] | string | null;
  source_type?: string[] | string | null;
  absences_id?: string | null;
  created_at?: string | null;
};

type AttendanceListResponse = {
  count: number;
  response: CalendarAttendanceRow[];
};

const escapeSqlValue = (value: string): string => value.replace(/'/g, "''");

const buildWhereClause = ({
  employeeIds,
  dateFrom,
  dateTo,
  userBaseColumn = "user_base_id",
  dateColumn = "date",
}: CalendarAttendanceParams & {
  userBaseColumn?: string;
  dateColumn?: string;
}): string => {
  const sanitizedIds = employeeIds
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => `'${escapeSqlValue(id)}'`);

  if (sanitizedIds.length === 0) return "1 = 0";

  const safeDateFrom = escapeSqlValue(dateFrom);
  const safeDateTo = escapeSqlValue(dateTo);

  return [
    "deleted_at IS NULL",
    `${userBaseColumn} IN (${sanitizedIds.join(",")})`,
    `${dateColumn} >= '${safeDateFrom}'`,
    `${dateColumn} <= '${safeDateTo}'`,
  ].join(" AND ");
};

const extractRows = (res: unknown): CalendarAttendanceRow[] => {
  if (Array.isArray(res)) return res as CalendarAttendanceRow[];
  const obj = (res && typeof res === "object") ? (res as Record<string, unknown>) : {};
  if (Array.isArray(obj.response)) return obj.response as CalendarAttendanceRow[];
  if (Array.isArray(obj.data)) return obj.data as CalendarAttendanceRow[];
  const nestedData = obj.data;
  if (nestedData && typeof nestedData === "object") {
    const nested = nestedData as Record<string, unknown>;
    if (Array.isArray(nested.data)) return nested.data as CalendarAttendanceRow[];
  }
  return [];
};

const normalizeListResponse = (res: unknown): AttendanceListResponse => {
  const obj = (res && typeof res === "object") ? (res as Record<string, unknown>) : {};
  const rows = extractRows(res);
  const safeCount = Number(obj.count || 0);
  return {
    count: Number.isFinite(safeCount) && safeCount > 0 ? safeCount : rows.length,
    response: rows,
  };
};

const fetchCalendarAttendance = async (
  params: CalendarAttendanceParams
): Promise<AttendanceListResponse> => {
  const normalizedIds = Array.from(
    new Set(params.employeeIds.map((id) => id.trim()).filter(Boolean))
  );

  if (normalizedIds.length === 0 || !params.dateFrom || !params.dateTo) {
    return { count: 0, response: [] };
  }

  const limit = 500;
  const maxRequests = 100;
  let offset = 0;
  let totalCount = 0;
  const response: CalendarAttendanceRow[] = [];

  const where = buildWhereClause({
    employeeIds: normalizedIds,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  });

  for (let requestIndex = 0; requestIndex < maxRequests; requestIndex += 1) {
    const res = await httpRequest.post(
      `/v2/items/${ATTENDANCE_COLLECTION}/aggregation`,
      {
        data: {
          operation: "SELECT",
          table: ATTENDANCE_COLLECTION,
          columns: [
            "guid",
            "user_base_id",
            "date",
            "check_in_time",
            "check_out_time",
            "delay_time",
            "action_status",
            "status",
            "source_type",
            "absences_id",
            "created_at",
          ],
          where,
          order_by: ["user_base_id ASC", "date ASC", "created_at DESC"],
          limit,
          offset,
        },
        is_cached: true,
      }
    );

    const chunk = normalizeListResponse(res);
    if (chunk.count > 0) {
      totalCount = chunk.count;
    }

    if (chunk.response.length === 0) break;
    response.push(...chunk.response);
    offset += chunk.response.length;
    if (totalCount > 0 && response.length >= totalCount) break;
    if (chunk.response.length < limit) break;
  }

  return { count: totalCount || response.length, response };
};

export const useCalendarAttendanceQuery = ({
  params,
  querySettings = {},
}: {
  params: CalendarAttendanceParams;
  querySettings?: Record<string, unknown>;
}) => {
  const normalizedEmployeeIds = Array.from(
    new Set((params.employeeIds || []).map((id) => id.trim()).filter(Boolean))
  ).sort();

  return useQuery({
    queryKey: [
      "calendar-attendance",
      normalizedEmployeeIds,
      params.dateFrom,
      params.dateTo,
    ],
    queryFn: () =>
      fetchCalendarAttendance({
        employeeIds: normalizedEmployeeIds,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
      }),
    enabled:
      normalizedEmployeeIds.length > 0 &&
      Boolean(params.dateFrom) &&
      Boolean(params.dateTo),
    ...querySettings,
  });
};
