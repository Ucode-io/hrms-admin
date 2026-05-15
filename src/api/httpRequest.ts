import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import authStore from "../store/auth.store";
import { handleUnauthorizedError } from "./unauthorizedHandler";

const API_BASE_URL = "https://api.admin.u-code.io/";
const DEFAULT_PROJECT_ID = "9a462573-ce11-4288-928a-a6ba754b6998";
const ENVIRONMENT_ID = "2f73835f-3a29-46c8-951e-75119db9bfc0";
const API_KEY = "P-bta3QjePSLS84na33QXCvxUEv3vB4iMU";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isItemsRequest = (url?: string): boolean => typeof url === "string" && url.includes("/v2/items/");
const isInvokeFunctionRequest = (url?: string): boolean =>
  typeof url === "string" && url.includes("/v2/invoke_function/");

const getCompaniesId = (): string | null => {
  if (typeof authStore.companyId === "string" && authStore.companyId.length > 0) {
    return authStore.companyId;
  }

  const userCompanyId = authStore.user_data?.companies_id ?? authStore.user?.companies_id;
  return typeof userCompanyId === "string" && userCompanyId.length > 0 ? userCompanyId : null;
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

const withCompaniesId = (data: Record<string, unknown>, companiesId: string) =>
  data.companies_id ? data : { ...data, companies_id: companiesId };

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
    const dataParam = parseDataQueryParam(params.data);
    params.data = encodeURIComponent(JSON.stringify(withCompaniesId(dataParam, companiesId)));
    config.params = params;
    return config;
  }

  if (isRecord(config.data)) {
    const requestBody = { ...config.data };

    if (isRecord(requestBody.data)) {
      requestBody.data = withCompaniesId(requestBody.data, companiesId);
    } else {
      requestBody.data = withCompaniesId({}, companiesId);
    }

    config.data = requestBody;
    return config;
  }

  config.data = { data: { companies_id: companiesId } };
  return config;
};

const injectCompaniesIdIntoInvokeFunctionRequest = (
  config: InternalAxiosRequestConfig
): InternalAxiosRequestConfig => {
  const companiesId = getCompaniesId();
  if (!companiesId || !isInvokeFunctionRequest(config.url) || !isRecord(config.data)) {
    return config;
  }

  const requestBody = { ...config.data };
  const gatewayPayload = isRecord(requestBody.data) ? { ...requestBody.data } : {};

  gatewayPayload.companies_id =
    typeof gatewayPayload.companies_id === "string" && gatewayPayload.companies_id.trim()
      ? gatewayPayload.companies_id
      : companiesId;

  if (isRecord(gatewayPayload.data)) {
    gatewayPayload.data =
      typeof gatewayPayload.data.companies_id === "string" && gatewayPayload.data.companies_id.trim()
        ? gatewayPayload.data
        : { ...gatewayPayload.data, companies_id: companiesId };
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
  (error: AxiosError) => {
    handleUnauthorizedError(error);

    return Promise.reject(error);
  }
);

export default httpRequest;
