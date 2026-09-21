// Career-site settings API.
//
// One config row per company. Goes through the udevs-hrms-reports
// career_site_* cloud functions (PG-direct, transactional) because the
// subdomain must be globally unique across companies — that constraint is
// enforced server-side, not in the ucode items API. Mirrors
// trainingGateway.service.ts.

import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { injectCompaniesIdIntoInvokeFunctionRequest } from "../httpRequest";
import authStore from "../../store/auth.store";
import { retryWithFreshToken } from "../unauthorizedHandler";

const REPORTS_BASE_URL = "https://api.admin.u-code.io";
const REPORTS_FUNCTION_PATH =
  "/v2/invoke_function/udevs-hrms-reports?project-id=9a462573-ce11-4288-928a-a6ba754b6998";

const GET_METHOD = "career_site_get";
const SAVE_METHOD = "career_site_save";

// The subdomain is the dynamic part of <subdomain>.hrms.udevs.io
export const CAREER_SITE_DOMAIN = "hrms.udevs.io";

export interface CareerSiteConfig {
  guid: string;
  companies_id: string;
  enabled: boolean;
  subdomain: string;
  title: string;
  description: string;
  main_color: string;
  accent_color: string;
  logo_url: string;
  favicon_url: string;
  bg_image_url: string;
  hero_headline: string;
  hero_subtitle: string;
  about_text: string;
  contact_email: string;
  website_url: string;
  updated_at: string | null;
}

export type CareerSiteConfigInput = Omit<
  CareerSiteConfig,
  "guid" | "companies_id" | "updated_at"
>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const reportsRequest = axios.create({
  baseURL: REPORTS_BASE_URL,
  timeout: 100_000,
  headers: { "Content-Type": "application/json" },
});

reportsRequest.interceptors.request.use((config) => {
  const token = authStore.token ?? localStorage.getItem("auth_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return injectCompaniesIdIntoInvokeFunctionRequest(config);
});

reportsRequest.interceptors.response.use(
  (response) => response,
  retryWithFreshToken(reportsRequest)
);

// The invoke_function response nests the gateway result under a few envelopes;
// walk down until we find the node carrying our method's result. A server-side
// validation error (e.g. duplicate subdomain) arrives as `server_error`.
const findGatewayResult = (
  raw: unknown,
  method: string,
  depth = 0
): Record<string, unknown> | null => {
  if (depth > 6 || !isRecord(raw)) return null;
  if (typeof raw.server_error === "string" && raw.server_error) {
    throw new Error(raw.server_error);
  }
  if (raw.method === method && isRecord(raw.result)) {
    return raw.result as Record<string, unknown>;
  }
  for (const key of ["data", "result", "response"]) {
    const found = findGatewayResult(raw[key], method, depth + 1);
    if (found) return found;
  }
  return null;
};

const invoke = async (
  method: string,
  data: Record<string, unknown>
): Promise<Record<string, unknown> | null> => {
  const res = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
    data: { method, data },
  });
  return findGatewayResult(res.data, method);
};

const str = (value: unknown): string => (typeof value === "string" ? value : "");

const mapConfig = (raw: unknown): CareerSiteConfig | null => {
  if (!isRecord(raw)) return null;
  return {
    guid: str(raw.guid),
    companies_id: str(raw.companies_id),
    enabled: Boolean(raw.enabled),
    subdomain: str(raw.subdomain),
    title: str(raw.title),
    description: str(raw.description),
    main_color: str(raw.main_color),
    accent_color: str(raw.accent_color),
    logo_url: str(raw.logo_url),
    favicon_url: str(raw.favicon_url),
    bg_image_url: str(raw.bg_image_url),
    hero_headline: str(raw.hero_headline),
    hero_subtitle: str(raw.hero_subtitle),
    about_text: str(raw.about_text),
    contact_email: str(raw.contact_email),
    website_url: str(raw.website_url),
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : null,
  };
};

const careerSiteService = {
  get: async (): Promise<CareerSiteConfig | null> => {
    const result = await invoke(GET_METHOD, {});
    return mapConfig(result?.config);
  },

  save: async (input: CareerSiteConfigInput): Promise<CareerSiteConfig | null> => {
    const result = await invoke(SAVE_METHOD, { ...input });
    return mapConfig(result?.config);
  },
};

export const useCareerSiteConfigQuery = (querySettings: object = {}) =>
  useQuery({
    queryKey: ["career-site-config"],
    queryFn: careerSiteService.get,
    ...querySettings,
  });

export const useSaveCareerSiteConfig = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CareerSiteConfigInput) => careerSiteService.save(input),
    onSuccess: (config) => {
      queryClient.setQueryData(["career-site-config"], config);
      queryClient.invalidateQueries(["career-site-config"]);
    },
  });
};

export default careerSiteService;
