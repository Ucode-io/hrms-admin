import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "react-query";
import httpRequest, { injectCompaniesIdIntoItemsRequest } from "../httpRequest";
import authStore from "../../store/auth.store";
export const COMPANY_ID = "0de6b2b6-0777-4184-a620-aca70c294111";

export interface CompanySettings {
  guid: string;
  name: string;
  logo: string;
  main_color: string;
  company_cover: string;
  employee_cover: string;
  enabled_company_cover: boolean;
  enabled_employee_cover: boolean;
  currencies_id: string;
  languages_id: string;
  date_format: string[];
  name_format: string[];
  timezone: string[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface SettingsOptionItem {
  guid: string;
  slug: string;
  title: string;
  created_at: string;
  updated_at: string;
}

const SETTINGS_PROJECT_ID = "f90c520f-eb6a-496c-9fa0-c38095d4793b";
const SETTINGS_API_KEY = "P-JtJ1lICCMHmhp9JaoxhWh1ZAwoyzFtxw";

const settingsRequest = axios.create({
  baseURL: "https://api.admin.u-code.io",
  params: {
    "project-id": SETTINGS_PROJECT_ID,
  },
  headers: {
    Authorization: "API-KEY",
    "x-api-key": SETTINGS_API_KEY,
  },
});

settingsRequest.interceptors.request.use((config) => injectCompaniesIdIntoItemsRequest(config));

const resolveCompanyId = (): string => {
  const fromAuthStore =
    (typeof authStore.companyId === "string" && authStore.companyId.trim()) ||
    (typeof authStore.user_data?.companies_id === "string" && authStore.user_data.companies_id.trim()) ||
    (typeof authStore.user?.companies_id === "string" && authStore.user.companies_id.trim()) ||
    "";

  return fromAuthStore || COMPANY_ID;
};

const companySettingsService = {
  get: async (): Promise<CompanySettings> => {
    const res = await httpRequest.get(`/v2/items/companies/${resolveCompanyId()}`);

    return res?.response as CompanySettings;
  },

  update: async (data: Partial<CompanySettings>) => {
    const res = await httpRequest.put(`/v2/items/companies/${resolveCompanyId()}`, { data });

    return res?.response as CompanySettings;
  },
};

const settingsOptionsService = {
  getCurrencies: async (): Promise<SettingsOptionItem[]> => {
    const res = await settingsRequest.get("/v2/items/currencies");
    return (res.data?.data?.data?.response || []) as SettingsOptionItem[];
  },

  getLanguages: async (): Promise<SettingsOptionItem[]> => {
    const res = await settingsRequest.get("/v2/items/languages");
    return (res.data?.data?.data?.response || []) as SettingsOptionItem[];
  },
};

export const useCompanySettingsQuery = () =>
  useQuery(["company-settings", resolveCompanyId()], companySettingsService.get);

export const useCurrenciesQuery = () =>
  useQuery(["settings-options", "currencies"], settingsOptionsService.getCurrencies, {
    staleTime: 5 * 60 * 1000,
  });

export const useLanguagesQuery = () =>
  useQuery(["settings-options", "languages"], settingsOptionsService.getLanguages, {
    staleTime: 5 * 60 * 1000,
  });

export const useUpdateCompanySettings = () => {
  const queryClient = useQueryClient();

  return useMutation(companySettingsService.update, {
    onSuccess: () => {
      queryClient.invalidateQueries(["company-settings", resolveCompanyId()]);
    },
  });
};

export default companySettingsService;
