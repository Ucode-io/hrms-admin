import type { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from "axios";
import authStore from "../store/auth.store";
import { refreshTokens } from "./authRequest";

type MaybeAxiosLikeError = {
  response?: {
    status?: number;
  };
};

export const isUnauthorizedError = (error: unknown): boolean => {
  const status = (error as MaybeAxiosLikeError | undefined)?.response?.status;
  return status === 401;
};

// Один общий запрос на все параллельные 401: на загрузке страницы их прилетает
// пачка, и каждый не должен дёргать /v2/refresh отдельно.
let refreshing: Promise<string | null> | null = null;

const refreshAccessToken = (): Promise<string | null> => {
  if (!refreshing) {
    refreshing = (async () => {
      const refreshToken = authStore.refreshToken;
      if (!refreshToken) return null;

      try {
        const token = await refreshTokens(refreshToken);
        authStore.setToken(token.access_token);
        authStore.setRefreshToken(token.refresh_token);
        return token.access_token;
      } catch {
        return null;
      }
    })().finally(() => {
      refreshing = null;
    });
  }

  return refreshing;
};

/**
 * Последний рубеж: сюда приходят 401 из react-query (queryCache/mutationCache)
 * и из инстансов без своего ответного интерцептора. Повторить запрос отсюда
 * нечем, поэтому только обновляем токен — следующий запрос уйдёт уже с новым.
 * Разлогиниваем, лишь когда обновить не вышло: истёкшая сессия или её нет.
 */
export const handleUnauthorizedError = (error: unknown): void => {
  if (!isUnauthorizedError(error)) {
    return;
  }

  void refreshAccessToken().then((token) => {
    if (!token) {
      authStore.logout();
    }
  });
};

/**
 * Для вызовов мимо axios (fetch): обновить токен перед повтором запроса.
 * `false` — обновить нечем, сессия мертва, пользователь разлогинен.
 */
export const ensureFreshToken = async (): Promise<boolean> => {
  const token = await refreshAccessToken();
  if (!token) {
    authStore.logout();
  }

  return Boolean(token);
};

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

/**
 * Ответный интерцептор для инстансов axios с Bearer-токеном: на 401 обновляет
 * токен и повторяет запрос, и только если обновить нечем — разлогинивает.
 *
 * Инстансу с API-KEY не нужен: его 401 про права, а не про токен.
 */
export const retryWithFreshToken =
  (instance: AxiosInstance) =>
  async (error: AxiosError): Promise<unknown> => {
    const config = error.config as RetriableConfig | undefined;

    if (isUnauthorizedError(error) && config && !config._retried) {
      config._retried = true;

      // Пачка запросов (месяц смен — 31 create разом) приходит волнами, а не
      // одновременно: общего in-flight мало, каждая следующая волна дёргала бы
      // /v2/refresh заново. Если токен в сторе уже не тот, с которым запрос
      // ушёл, — сосед по пачке его обновил, просто повторяем с актуальным.
      const current = authStore.token;
      const refreshedByNeighbour =
        Boolean(current) && config.headers?.Authorization !== `Bearer ${current}`;
      const token = refreshedByNeighbour ? current : await refreshAccessToken();

      if (token) {
        // Тело здесь уже сериализовано в строку, а интерцептор запроса
        // дописывает companies_id только в объект — иначе payload потеряется.
        if (typeof config.data === "string") {
          try {
            config.data = JSON.parse(config.data);
          } catch {
            // Не JSON (FormData и прочее) — отправляем как есть.
          }
        }

        // У инстансов Authorization выставит их интерцептор запроса, но не у
        // всех он есть — подставляем сами, чтобы повтор не ушёл со старым.
        config.headers.Authorization = `Bearer ${token}`;

        return instance(config);
      }

      authStore.logout();
    }

    throw error;
  };
