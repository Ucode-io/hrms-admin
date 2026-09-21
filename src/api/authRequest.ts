import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const AUTH_BASE_URL = "https://api.auth.u-code.io";
const PROJECT_ID = "84f1983d-5095-490e-ba9c-d2618b164c99";
const ENVIRONMENT_ID = "2f73835f-3a29-46c8-951e-75119db9bfc0";
const API_KEY = "P-JtJ1lICCMHmhp9JaoxhWh1ZAwoyzFtxw";

const authRequest = axios.create({
  baseURL: AUTH_BASE_URL,
  timeout: 100000,
  params: {
    "project-id": PROJECT_ID,
  },
  headers: {
    "Content-Type": "application/json",
  },
});

authRequest.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  config.headers.Authorization = "API-KEY";
  config.headers["Environment-Id"] = ENVIRONMENT_ID;
  config.headers["x-api-key"] = API_KEY;

  return config;
});

authRequest.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => Promise.reject(error)
);

export interface RefreshedToken {
  access_token: string;
  refresh_token: string;
}

interface RefreshResponse {
  status: string;
  description: string;
  data: { token: RefreshedToken };
}

/**
 * Обновление пары токенов. Access живёт сутки, сессия в auth-сервисе — 30 дней,
 * без этого вызова панель разлогинивает раз в день.
 *
 * Роут открытый (до LoginMiddleware), тело — только refresh_token:
 * role_id/client_type_id/project_id сервис берёт из самой сессии и перетирает
 * только непустыми. В ответе приходят одни токены, user_data не меняется.
 *
 * Живёт здесь, а не в auth.service: тот тянет httpRequest, а httpRequest —
 * unauthorizedHandler, которому нужен этот вызов. Цикл импортов ни к чему.
 */
export const refreshTokens = async (refreshToken: string): Promise<RefreshedToken> => {
  const response = await authRequest.put<RefreshResponse>("/v2/refresh", {
    refresh_token: refreshToken,
  });

  return response.data.data.token;
};

export default authRequest;
