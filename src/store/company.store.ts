import { makeAutoObservable, runInAction } from "mobx";
import { makePersistable } from "mobx-persist-store";
import axios from "axios";

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
  [key: string]: any;
}

const COMPANY_API_URL =
  "https://api.admin.u-code.io/v2/items/companies/0de6b2b6-0777-4184-a620-aca70c294111";
const PROJECT_ID = "f90c520f-eb6a-496c-9fa0-c38095d4793b";
const API_KEY = "P-JtJ1lICCMHmhp9JaoxhWh1ZAwoyzFtxw";

class CompanyStore {
  company: CompanyData | null = null;
  isLoading = false;
  isLoaded = false;
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

  async fetchCompany() {
    if (this.isLoading) return;

    this.isLoading = true;
    this.error = null;

    try {
      const response = await axios.get(COMPANY_API_URL, {
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
        }
        this.isLoading = false;
      });
    } catch (err: any) {
      runInAction(() => {
        this.error = err.message || "Failed to fetch company";
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
