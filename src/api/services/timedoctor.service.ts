import { useMutation, useQuery, useQueryClient } from "react-query";
import axios from "axios";
import authStore from "../../store/auth.store";
import companyStore from "../../store/company.store";
import { getCompaniesId } from "../httpRequest";
import { retryWithFreshToken } from "../unauthorizedHandler";
import { translate } from "../../i18n";

// --- Time Doctor (TD2) integration gateway -------------------------------
// Все обработчики живут в одной cloud-функции u-code. Обработчик выбирается
// полем `data.method`, его аргументы — в `data.object_data`.
//
// `company_id` в object_data — это companies_id HRMS: одна установка функции
// обслуживает несколько компаний, и без него методы конфигурации и синка не
// знают, чей аккаунт Time Doctor трогать.
const API_BASE_URL = "https://api.admin.u-code.io";
const PROJECT_ID = "9a462573-ce11-4288-928a-a6ba754b6998";
const ENVIRONMENT_ID = "2f73835f-3a29-46c8-951e-75119db9bfc0";
// app_id — u-code API key (P-… format), also used to arm the background re-sync.
const APP_ID = "P-aUAOU0KNOuRctMIRJDjVb5kElKgxkYpI";
// Слаг задеплоенной функции. Прежнее значение (`workload-timedoctor-integration`,
// без префикса) в шлюзе не существует — вызовы падали с «no rows in result set».
const TIMEDOCTOR_FUNCTION_PATH = `/v2/invoke_function/udevs-hrms-workload-timedoctor-integration?project-id=${PROJECT_ID}`;

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
  retryWithFreshToken(timedoctorRequest)
);

/**
 * Спуск сквозь конверты шлюза до собственного ответа функции `{status, data}`.
 *
 * Идти «пока не встретим поле status» нельзя: внешний конверт u-code сам имеет
 * `status: "CREATED"`, и обход останавливался на нём, после чего любой успешный
 * ответ читался как ошибка. Ищем именно `success`/`error` — статусы функции.
 */
const unwrapTd2Response = <T,>(raw: unknown): T => {
  const findEnvelope = (node: unknown, depth = 0): JsonRecord | null => {
    if (depth > 6 || !isRecord(node)) return null;
    if (node.status === "success" || node.status === "error") return node;
    for (const key of ["data", "result", "response"]) {
      const found = findEnvelope(node[key], depth + 1);
      if (found) return found;
    }
    return null;
  };

  const envelope = findEnvelope(raw);
  if (!envelope) {
    const outer = isRecord(raw) ? raw : {};
    // Ошибки шлюза (неизвестный метод, провал валидации) до конверта функции
    // не доходят — их текст лежит в `data` внешнего ответа.
    const gatewayError =
      typeof outer.data === "string" && outer.data
        ? outer.data
        : typeof outer.description === "string"
          ? outer.description
          : "";
    throw new Error(gatewayError || translate("timedoctor.unexpected_format"));
  }

  if (envelope.status !== "success") {
    const payload = isRecord(envelope.data) ? envelope.data : {};
    const message =
      (typeof payload.message === "string" && payload.message) ||
      (typeof payload.error === "string" && payload.error) ||
      (typeof envelope.server_error === "string" && envelope.server_error) ||
      translate("timedoctor.request_failed");
    throw new Error(message);
  }

  return envelope.data as T;
};

/** companies_id текущей компании — его ждёт каждый метод функции. */
const resolveCompanyId = (): string =>
  getCompaniesId() || companyStore.company?.guid || "";

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
      object_data: { company_id: resolveCompanyId(), ...objectData },
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

/**
 * Состояние фоновой синхронизации.
 *
 * `td2_full_sync_async` только ставит задачу и сразу отвечает; ход выполнения
 * читается отдельным `td2_sync_status`. Пустые строки в `finished_at`/`error`
 * функция отдаёт вместо null — трактуем их как «нет значения».
 */
export interface Td2SyncStatus {
  running: boolean;
  phase?: string;
  trigger?: string;
  from_date?: string;
  to_date?: string;
  started_at?: string;
  finished_at?: string;
  last_sync_at?: string;
  worklogs_synced?: number;
  error?: string;
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
  /** Ставит фоновую синхронизацию за период и сразу возвращается. */
  fullSyncAsync: (payload: { from_date: string; to_date: string }) =>
    callTd2<JsonRecord>("td2_full_sync_async", payload),
  syncStatus: () => callTd2<Td2SyncStatus>("td2_sync_status"),
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

/**
 * Статус фоновой синхронизации.
 *
 * Пока задача выполняется, опрашиваем раз в 3 секунды; как только `running`
 * гаснет — опрос прекращается. Интервал задаётся функцией, поэтому одна и та же
 * подписка сама переходит из «тикающей» в «спящую» без перемонтирования.
 */
export const useTd2SyncStatus = (enabled = true) =>
  useQuery(["td2", "sync-status"], () => timedoctorService.syncStatus(), {
    enabled,
    retry: false,
    refetchInterval: (data) => (data?.running ? 3000 : false),
  });

export const useTd2FullSyncAsync = () => {
  const qc = useQueryClient();
  return useMutation(
    (payload: { from_date: string; to_date: string }) =>
      timedoctorService.fullSyncAsync(payload),
    {
      onSuccess: () => {
        // Статус нужен сразу: кнопка должна уйти в «Синхронизация…» ещё до
        // первого тика опроса.
        qc.invalidateQueries(["td2", "sync-status"]);
      },
    }
  );
};
