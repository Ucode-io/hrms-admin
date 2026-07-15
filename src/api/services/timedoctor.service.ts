import { useMutation, useQuery, useQueryClient } from "react-query";
import axios from "axios";
import authStore from "../../store/auth.store";
import { handleUnauthorizedError } from "../unauthorizedHandler";

// --- Time Doctor (TD2) integration gateway -------------------------------
// All 16 handlers share one u-code invoke_function endpoint. The handler is
// selected with `data.method`; its payload lives in `data.object_data`.
// Response shape from the function: { status: "success" | "error", data: ... }.
const API_BASE_URL = "https://api.admin.u-code.io";
const PROJECT_ID = "9a462573-ce11-4288-928a-a6ba754b6998";
const ENVIRONMENT_ID = "2f73835f-3a29-46c8-951e-75119db9bfc0";
// app_id — u-code API key (P-… format), also used to arm the background re-sync.
const APP_ID = "P-aUAOU0KNOuRctMIRJDjVb5kElKgxkYpI";
// NOTE: confirm the deployed function slug. Service name is
// `workload-timedoctor-integration`.
const TIMEDOCTOR_FUNCTION_PATH = `/v2/invoke_function/workload-timedoctor-integration?project-id=${PROJECT_ID}`;

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const timedoctorRequest = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120_000,
  headers: {
    "Content-Type": "application/json",
  },
});

timedoctorRequest.interceptors.request.use((config) => {
  const token = authStore.token ?? localStorage.getItem("auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

timedoctorRequest.interceptors.response.use(
  (response) => response,
  (error) => {
    handleUnauthorizedError(error);
    return Promise.reject(error);
  }
);

/**
 * Peel the u-code gateway wrapper(s) until we reach the function's own
 * `{ status, data }` envelope, then enforce it. Throws on `status !== success`.
 */
const unwrapTd2Response = <T,>(raw: unknown): T => {
  let node: unknown = raw;
  for (let depth = 0; depth < 5; depth += 1) {
    if (isRecord(node) && typeof node.status === "string") {
      break;
    }
    if (isRecord(node) && "data" in node) {
      node = node.data;
      continue;
    }
    break;
  }

  if (!isRecord(node) || typeof node.status !== "string") {
    throw new Error("Неожиданный формат ответа Time Doctor.");
  }

  if (node.status !== "success") {
    const payload = isRecord(node.data) ? node.data : {};
    const message =
      (typeof payload.message === "string" && payload.message) ||
      (typeof payload.error === "string" && payload.error) ||
      "Запрос к Time Doctor не выполнен.";
    throw new Error(message);
  }

  return node.data as T;
};

const callTd2 = async <T,>(
  method: string,
  objectData: JsonRecord = {}
): Promise<T> => {
  const response = await timedoctorRequest.post(TIMEDOCTOR_FUNCTION_PATH, {
    data: {
      app_id: APP_ID,
      environment_id: ENVIRONMENT_ID,
      project_id: PROJECT_ID,
      user_id: authStore.user?.guid ?? authStore.user_data?.guid ?? undefined,
      method,
      object_data: objectData,
    },
  });

  return unwrapTd2Response<T>(response.data);
};

// --- Types ----------------------------------------------------------------

export interface Td2Config {
  guid: string;
  time_doctor_company_id?: string | null;
  time_doctor_company_name?: string | null;
  email?: string | null;
  password?: string | null;
  api_token?: string | null;
  token_expires_at?: string | null;
  is_active?: boolean | null;
  last_sync_at?: string | null;
}

export interface Td2ConfigTestResult {
  connected: boolean;
  company_id?: string;
  company_name?: string;
  user_email?: string;
  user_name?: string;
  error?: string;
}

export interface Td2Mapping {
  guid: string;
  td2_config_id: string;
  td2_user_id: string;
  td2_email?: string | null;
  td2_user_name?: string | null;
  user_base_id: string;
  user_base_name?: string | null;
  user_base_login?: string | null;
  user_base_email?: string | null;
  is_active?: boolean | null;
}

export interface Td2MappingListResult {
  total: number;
  list: Td2Mapping[];
}

export interface Td2AutoMatchResult {
  td2_config_id: string;
  created_count: number;
  unmatched_count: number;
  skipped_inactive: number;
  already_mapped: number;
  created: Array<{
    guid: string;
    td2_user_id: string;
    td2_email?: string | null;
    td2_user_name?: string | null;
    user_base_id: string;
    user_base_name?: string | null;
    user_base_login?: string | null;
  }>;
  unmatched: Array<{
    td2_user_id: string;
    td2_email?: string | null;
    td2_user_name?: string | null;
  }>;
}

export interface Td2SyncResult {
  status: string;
  from_date: string;
  to_date: string;
  worklogs_synced: number;
}

export interface Td2TeamStatsUser {
  td2_user_mapping_id: string;
  user_base_id?: string | null;
  user_name?: string | null;
  td2_email?: string | null;
  total_seconds: number;
  total_hours: number;
  productivity_pct: number;
  days_tracked: number;
}

export interface Td2TeamStatsResult {
  from_date: string;
  to_date: string;
  total: number;
  users: Td2TeamStatsUser[];
}

export interface Td2UserDailyStat {
  work_date: string;
  first_start_time?: string | null;
  last_end_time?: string | null;
  total_seconds: number;
  total_hours: number;
  break_seconds: number;
  break_count: number;
  leave_seconds: number;
  productive_secs: number;
  unproductive_secs: number;
  productivity_pct: number;
  worklog_count: number;
}

export interface Td2UserStatsResult {
  user_name?: string | null;
  user_email?: string | null;
  from_date: string;
  to_date: string;
  summary: {
    total_seconds: number;
    total_hours: number;
    total_break_seconds: number;
    productive_secs: number;
    unproductive_secs: number;
    productivity_pct: number;
    total_worklog_count: number;
    days_tracked: number;
  };
  daily: Td2UserDailyStat[];
}

// --- Service methods ------------------------------------------------------

const timedoctorService = {
  // Config
  configGet: () => callTd2<{ data: Td2Config } | Td2Config>("td2_config_get"),
  configCreate: (payload: { email: string; password: string; company_id?: string }) =>
    callTd2<Td2Config>("td2_config_create", payload),
  configUpdate: (payload: {
    guid: string;
    email?: string;
    password?: string;
    is_active?: boolean;
  }) => callTd2<{ status: string }>("td2_config_update", payload),
  configTest: () => callTd2<Td2ConfigTestResult>("td2_config_test"),
  refreshToken: () =>
    callTd2<{ status: string; token_expires_at: string }>("td2_refresh_token"),

  // Mapping
  mappingList: (td2_config_id?: string) =>
    callTd2<Td2MappingListResult>(
      "td2_user_mapping_list",
      td2_config_id ? { td2_config_id } : {}
    ),
  mappingCreate: (payload: {
    td2_config_id: string;
    user_base_id: string;
    td2_user_id: string;
    td2_email?: string;
    td2_user_name?: string;
  }) => callTd2<Td2Mapping>("td2_user_mapping_create", payload),
  mappingDelete: (guid: string) =>
    callTd2<{ status: string }>("td2_user_mapping_delete", { guid }),
  mappingAutoMatch: () =>
    callTd2<Td2AutoMatchResult>("td2_user_mapping_auto_match"),

  // Sync
  fullSync: () => callTd2<JsonRecord>("td2_full_sync"),
  syncAllUsers: (payload?: { from_date?: string; to_date?: string }) =>
    callTd2<Td2SyncResult>("td2_sync_all_users_stats", payload ?? {}),
  syncUser: (payload: {
    td2_user_mapping_id: string;
    from_date?: string;
    to_date?: string;
  }) => callTd2<Td2SyncResult>("td2_sync_user_stats", payload),
  syncProjectsTasks: () =>
    callTd2<{ status: string; projects: number; tasks: number }>(
      "td2_sync_projects_tasks"
    ),

  // Views
  teamStats: (payload: { from_date: string; to_date: string }) =>
    callTd2<Td2TeamStatsResult>("td2_team_stats", payload),
  userStats: (payload: {
    td2_user_mapping_id: string;
    from_date: string;
    to_date: string;
  }) => callTd2<Td2UserStatsResult>("td2_user_stats", payload),
};

export default timedoctorService;

// --- React Query hooks ----------------------------------------------------

const normalizeConfig = (
  value: { data: Td2Config } | Td2Config | null | undefined
): Td2Config | null => {
  if (!value) return null;
  if (isRecord(value) && "data" in value && isRecord(value.data)) {
    return value.data as Td2Config;
  }
  return value as Td2Config;
};

export const useTd2Config = () =>
  useQuery(
    ["td2", "config"],
    async () => {
      try {
        const raw = await timedoctorService.configGet();
        return normalizeConfig(raw);
      } catch (error) {
        // "no active TD2 config found" is an expected empty state, not an error.
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        if (message.includes("no active") || message.includes("config found")) {
          return null;
        }
        throw error;
      }
    },
    { retry: false }
  );

export const useTd2ConfigTest = () =>
  useMutation(() => timedoctorService.configTest());

export const useTd2ConfigCreate = () => {
  const qc = useQueryClient();
  return useMutation(
    (payload: { email: string; password: string; company_id?: string }) =>
      timedoctorService.configCreate(payload),
    {
      onSuccess: () => {
        qc.invalidateQueries(["td2", "config"]);
      },
    }
  );
};

export const useTd2ConfigUpdate = () => {
  const qc = useQueryClient();
  return useMutation(
    (payload: { guid: string; email?: string; password?: string; is_active?: boolean }) =>
      timedoctorService.configUpdate(payload),
    {
      onSuccess: () => {
        qc.invalidateQueries(["td2", "config"]);
      },
    }
  );
};

export const useTd2RefreshToken = () => {
  const qc = useQueryClient();
  return useMutation(() => timedoctorService.refreshToken(), {
    onSuccess: () => {
      qc.invalidateQueries(["td2", "config"]);
    },
  });
};

export const useTd2MappingList = (td2_config_id?: string, enabled = true) =>
  useQuery(
    ["td2", "mappings", td2_config_id ?? "all"],
    () => timedoctorService.mappingList(td2_config_id),
    { enabled, keepPreviousData: true }
  );

export const useTd2AutoMatch = () => {
  const qc = useQueryClient();
  return useMutation(() => timedoctorService.mappingAutoMatch(), {
    onSuccess: () => {
      qc.invalidateQueries(["td2", "mappings"]);
    },
  });
};

export const useTd2MappingCreate = () => {
  const qc = useQueryClient();
  return useMutation(
    (payload: {
      td2_config_id: string;
      user_base_id: string;
      td2_user_id: string;
      td2_email?: string;
      td2_user_name?: string;
    }) => timedoctorService.mappingCreate(payload),
    {
      onSuccess: () => {
        qc.invalidateQueries(["td2", "mappings"]);
      },
    }
  );
};

export const useTd2MappingDelete = () => {
  const qc = useQueryClient();
  return useMutation((guid: string) => timedoctorService.mappingDelete(guid), {
    onSuccess: () => {
      qc.invalidateQueries(["td2", "mappings"]);
    },
  });
};

export const useTd2SyncAllUsers = () => {
  const qc = useQueryClient();
  return useMutation(
    (payload?: { from_date?: string; to_date?: string }) =>
      timedoctorService.syncAllUsers(payload),
    {
      onSuccess: () => {
        qc.invalidateQueries(["td2", "team-stats"]);
        qc.invalidateQueries(["td2", "user-stats"]);
      },
    }
  );
};

export const useTd2TeamStats = (
  params: { from_date: string; to_date: string },
  enabled = true
) =>
  useQuery(
    ["td2", "team-stats", params.from_date, params.to_date],
    () => timedoctorService.teamStats(params),
    { enabled: enabled && Boolean(params.from_date && params.to_date), keepPreviousData: true }
  );

export const useTd2UserStats = (
  params: { td2_user_mapping_id: string; from_date: string; to_date: string },
  enabled = true
) =>
  useQuery(
    ["td2", "user-stats", params.td2_user_mapping_id, params.from_date, params.to_date],
    () => timedoctorService.userStats(params),
    {
      enabled:
        enabled &&
        Boolean(params.td2_user_mapping_id && params.from_date && params.to_date),
      keepPreviousData: true,
    }
  );
