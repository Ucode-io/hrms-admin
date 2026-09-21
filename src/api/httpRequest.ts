import axios, { InternalAxiosRequestConfig } from "axios";
import authStore from "../store/auth.store";
import { retryWithFreshToken } from "./unauthorizedHandler";

const API_BASE_URL = "https://api.admin.u-code.io/";
/**
 * The ucode project this panel's data lives in. Exported because the Copilot
 * service now takes it from here instead of keeping its own copy: two
 * hardcoded ids that must agree is one id that will eventually not.
 */
export const DEFAULT_PROJECT_ID = "9a462573-ce11-4288-928a-a6ba754b6998";
const ENVIRONMENT_ID = "2f73835f-3a29-46c8-951e-75119db9bfc0";
const API_KEY = "P-aUAOU0KNOuRctMIRJDjVb5kElKgxkYpI";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isItemsRequest = (url?: string): boolean => typeof url === "string" && url.includes("/v2/items/");
const isInvokeFunctionRequest = (url?: string): boolean =>
  typeof url === "string" && url.includes("/v2/invoke_function/");

const normalizeCompanyId = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

export const getCompaniesId = (): string | null => {
  if (typeof authStore.companyId === "string" && authStore.companyId.length > 0) {
    return normalizeCompanyId(authStore.companyId);
  }

  const userCompanyId =
    normalizeCompanyId(authStore.user_data?.companies_id) ??
    normalizeCompanyId(authStore.user?.companies_id);

  return userCompanyId;
};

const parseDataQueryParam = (value: unknown): Record<string, unknown> => {
  if (isRecord(value)) {
    return value;
  }

  if (typeof value !== "string" || value.length === 0) {
    return {};
  }

  const candidates = [value];
  try {
    candidates.push(decodeURIComponent(value));
  } catch {
    // Keep original candidate.
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (isRecord(parsed)) return parsed;
    } catch {
      // Try next candidate.
    }
  }

  return {};
};

const withCompaniesId = (data: Record<string, unknown>, companiesId: string) => ({
  ...data,
  companies_id: companiesId,
});

export const injectCompaniesIdIntoItemsRequest = (
  config: InternalAxiosRequestConfig
): InternalAxiosRequestConfig => {
  const companiesId = getCompaniesId();
  if (!companiesId || !isItemsRequest(config.url)) {
    return config;
  }

  const method = (config.method || "get").toLowerCase();

  if (method === "get") {
    const params = isRecord(config.params) ? { ...config.params } : {};
    params.companies_id = companiesId;
    const dataParam = parseDataQueryParam(params.data);
    params.data = encodeURIComponent(JSON.stringify(withCompaniesId(dataParam, companiesId)));
    config.params = params;
    return config;
  }

  if (isRecord(config.data)) {
    const requestBody = { ...config.data };
    requestBody.companies_id = companiesId;

    if (isRecord(requestBody.data)) {
      requestBody.data = withCompaniesId(requestBody.data, companiesId);
    }

    if (Array.isArray(requestBody.items)) {
      requestBody.items = requestBody.items.map((item) =>
        isRecord(item) ? withCompaniesId(item, companiesId) : item
      );
    }

    config.data = requestBody;
    return config;
  }

  config.data = { companies_id: companiesId, data: { companies_id: companiesId } };
  return config;
};

export const injectCompaniesIdIntoInvokeFunctionRequest = (
  config: InternalAxiosRequestConfig
): InternalAxiosRequestConfig => {
  const companiesId = getCompaniesId();
  if (!companiesId || !isInvokeFunctionRequest(config.url)) {
    return config;
  }

  const requestBody = isRecord(config.data) ? { ...config.data } : {};
  const gatewayPayload = isRecord(requestBody.data) ? { ...requestBody.data } : {};

  if (isRecord(gatewayPayload.data)) {
    gatewayPayload.data = withCompaniesId(gatewayPayload.data, companiesId);
  } else if (Array.isArray(gatewayPayload.data)) {
    gatewayPayload.data = gatewayPayload.data.map((item) =>
      isRecord(item) ? withCompaniesId(item, companiesId) : item
    );
  } else {
    gatewayPayload.data = { companies_id: companiesId };
  }

  requestBody.data = gatewayPayload;
  config.data = requestBody;
  return config;
};

const httpRequest = axios.create({
  baseURL: API_BASE_URL,
  timeout: 100000,
  params: {
    "project-id": DEFAULT_PROJECT_ID,
  },
  headers: {
    "Content-Type": "application/json",
  },
});

httpRequest.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = authStore.token;

  config.headers["Environment-Id"] = ENVIRONMENT_ID;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    config.headers.Authorization = "API-KEY";
    config.headers["X-Api-Key"] = API_KEY;
  }

  const withItemsCompany = injectCompaniesIdIntoItemsRequest(config);
  return injectCompaniesIdIntoInvokeFunctionRequest(withItemsCompany);
});

httpRequest.interceptors.response.use(
  (response) => response?.data?.data?.data ?? response?.data?.data ?? response?.data,
  retryWithFreshToken(httpRequest)
);

export default httpRequest;
