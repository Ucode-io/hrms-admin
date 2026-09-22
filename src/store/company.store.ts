import { makeAutoObservable, runInAction } from "mobx";
import { makePersistable } from "mobx-persist-store";
import axios from "axios";
import authStore from "./auth.store";
import { DEFAULT_TIMEZONE } from "../utils/timezones";

interface CompanyData {
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
  [key: string]: any;
}

const COMPANY_API_URL = "https://api.admin.u-code.io/v2/items/companies";
const PROJECT_ID = "f90c520f-eb6a-496c-9fa0-c38095d4793b";
const API_KEY = "P-JtJ1lICCMHmhp9JaoxhWh1ZAwoyzFtxw";

const STATIC_LOGIN_COMPANY_CONFIG: CompanyData = {
  company_cover:
    "https://cdn.u-code.io/9a462573-ce11-4288-928a-a6ba754b6998/Media/70e4a9dc-0a5d-4f1b-8b7b-c047eaa6abc4_Снимокэкрана2026-03-01в21.49.01.PHOTO",
  created_at: "2026-03-01T16:48:46.663995Z",
  currencies_id: "c2c5f603-22b6-4396-b504-dd8725550307",
  date_format: ["dd.MM.yyyy"],
  deleted_at: null,
  employee_cover:
    "https://cdn.u-code.io/9a462573-ce11-4288-928a-a6ba754b6998/Media/3016f1e7-bf82-4331-b13a-957aeedb0636_Снимокэкрана2026-03-01в21.49.32.PHOTO",
  enabled_company_cover: true,
  enabled_employee_cover: true,
  guid: "0de6b2b6-0777-4184-a620-aca70c294111",
  languages_id: "bbdd108c-b6d7-4d1b-a88e-557e09fe26fa",
  logo:
    "https://cdn.u-code.io/9a462573-ce11-4288-928a-a6ba754b6998/Media/ab938b36-8fea-497e-8c8c-cd8e6d47f2f6_udevs.PHOTO",
  main_color: "#1D57E3",
  name: "Udevs",
  name_format: ["lf"],
  timezone: [DEFAULT_TIMEZONE],
  updated_at: "2026-03-03T08:36:24.181411Z",
};

const normalizeCompanyId = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

class CompanyStore {
  company: CompanyData | null = STATIC_LOGIN_COMPANY_CONFIG;
  isLoading = false;
  isLoaded = true;
  isStaticLoginConfig = true;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);

    makePersistable(this, {
      name: "company-settings",
      properties: ["company", "isLoaded"],
      storage: window.localStorage,
    });
  }

  get logo(): string {
    return this.company?.logo || "/images/logo/logo.svg";
  }

  get logoFull(): string {
    return this.company?.logo || "/images/logo/auth-logo.svg";
  }

  get mainColor(): string {
    return this.company?.main_color || "#2980B9";
  }

  get companyName(): string {
    return this.company?.name || "NSTEX";
  }

  setStaticLoginCompanyConfig() {
    this.company = STATIC_LOGIN_COMPANY_CONFIG;
    this.isLoaded = true;
    this.isStaticLoginConfig = true;
    this.error = null;
  }

  private resolveCompanyId(candidate?: string | null): string | null {
    return (
      normalizeCompanyId(candidate) ||
      normalizeCompanyId(authStore.companyId) ||
      normalizeCompanyId(authStore.user_data?.companies_id) ||
      normalizeCompanyId(authStore.user?.companies_id)
    );
  }

  async fetchCompany(companyId?: string | null) {
    if (this.isLoading) return;
    const resolvedCompanyId = this.resolveCompanyId(companyId);

    if (!resolvedCompanyId) {
      runInAction(() => {
        this.setStaticLoginCompanyConfig();
      });
      return;
    }

    if (this.isLoaded && !this.isStaticLoginConfig && this.company?.guid === resolvedCompanyId) {
      return;
    }

    this.isLoading = true;
    this.error = null;

    try {
      const response = await axios.get(`${COMPANY_API_URL}/${resolvedCompanyId}`, {
        params: { "project-id": PROJECT_ID },
        headers: {
          Authorization: "API-KEY",
          "x-api-key": API_KEY,
        },
      });

      const companyData = response?.data?.data?.data?.response;

      runInAction(() => {
        if (companyData) {
          this.company = companyData;
          this.isLoaded = true;
          this.isStaticLoginConfig = false;
        }
        this.isLoading = false;
      });
    } catch (err: any) {
      runInAction(() => {
        this.error = err.message || "Failed to fetch company";
        if (!this.company) {
          this.company = STATIC_LOGIN_COMPANY_CONFIG;
          this.isLoaded = true;
        }
        this.isLoading = false;
      });
      console.error("Company fetch error:", err);
    }
  }

  async refreshCompany() {
    await this.fetchCompany();
  }
}

const companyStore = new CompanyStore();
export default companyStore;
