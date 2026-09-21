import axios from "axios";
import authStore from "../../store/auth.store";
import { injectCompaniesIdIntoInvokeFunctionRequest } from "../httpRequest";
import { retryWithFreshToken } from "../unauthorizedHandler";

// Recruiting workflow mutations + nested reads live in the udevs-hrms-reports
// cloud function (same gateway, routed by `method`). Plain CRUD stays on the
// items API — see candidate.service.ts.
const FUNCTION_BASE_URL = "https://api.admin.u-code.io";
const FUNCTION_PATH =
  "/v2/invoke_function/udevs-hrms-reports?project-id=9a462573-ce11-4288-928a-a6ba754b6998";

const recruitingRequest = axios.create({
  baseURL: FUNCTION_BASE_URL,
  timeout: 60_000,
  headers: { "Content-Type": "application/json" },
});

recruitingRequest.interceptors.request.use((config) => {
  const token = authStore.token ?? localStorage.getItem("auth_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return injectCompaniesIdIntoInvokeFunctionRequest(config);
});

recruitingRequest.interceptors.response.use(
  (response) => response,
  retryWithFreshToken(recruitingRequest)
);

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

/** Walk the (possibly multiply-wrapped) invoke envelope to the `result`. */
const unwrapResult = (raw: unknown, expectedMethod: string): unknown => {
  let node: unknown = raw;
  for (let depth = 0; depth < 6 && isRecord(node); depth += 1) {
    if (typeof node.server_error === "string" && node.server_error) {
      throw new Error(node.server_error);
    }
    if (node.method === expectedMethod && "result" in node) {
      return node.result;
    }
    node = node.data;
  }
  throw new Error(`Unexpected response format for ${expectedMethod}`);
};

/** Invoke a recruiting gateway method. companies_id is injected by the interceptor. */
export async function invokeRecruiting<T>(
  method: string,
  data: Record<string, unknown> = {}
): Promise<T> {
  const response = await recruitingRequest.post(FUNCTION_PATH, {
    data: { method, data },
  });
  return unwrapResult(response.data, method) as T;
}
