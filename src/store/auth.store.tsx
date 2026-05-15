import { makeAutoObservable } from "mobx";
import { makePersistable } from "mobx-persist-store";

interface UserData {
  guid?: string;
  login?: string;
  first_name?: string;
  second_name?: string;
  middle_name?: string;
  phone?: string;
  work_phone?: string;
  email?: string;
  role_id?: string;
  client_type_id?: string;
  user_id_auth?: string;
  companies_id?: string | null;
  avatar?: string;
  photo?: string;
  [key: string]: unknown;
}

class Store {
  constructor() {
    makeAutoObservable(this);

    void makePersistable(this, {
      name: "ayva-auth",
      properties: ["isAuth", "token", "refreshToken", "user", "user_data", "companyId"],
      storage: window.localStorage,
    }).then(() => {
      this.hydrateTokensFromStorage();
    });
  }

  isAuth = false;
  token: string | null = null;
  refreshToken: string | null = null;
  user: UserData | null = null;
  user_data: UserData | null = null;
  companyId: string | null = null;

  private getCompanyIdFromUser(user: UserData | null): string | null {
    if (!user) return null;
    return typeof user.companies_id === "string" && user.companies_id.length > 0
      ? user.companies_id
      : null;
  }

  private normalizeCompanyId(companyId: string | null | undefined): string | null {
    return typeof companyId === "string" && companyId.trim().length > 0
      ? companyId.trim()
      : null;
  }

  setIsAuth(value: boolean) {
    this.isAuth = value;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  setRefreshToken(refreshToken: string | null) {
    this.refreshToken = refreshToken;
  }

  setUser(user: UserData | null) {
    this.user = user;
    this.user_data = user;
    const companyId = this.getCompanyIdFromUser(user);
    if (companyId) {
      this.companyId = companyId;
    }
  }

  login(token: string, user: UserData, refreshToken?: string | null, companyId?: string | null) {
    this.isAuth = true;
    this.token = token;
    if (typeof refreshToken !== "undefined") {
      this.refreshToken = refreshToken;
    }
    this.user = user;
    this.user_data = user;
    this.companyId = this.normalizeCompanyId(companyId) ?? this.getCompanyIdFromUser(user);
  }

  logout() {
    this.isAuth = false;
    this.token = null;
    this.refreshToken = null;
    this.user = null;
    this.user_data = null;
    this.companyId = null;
    localStorage.removeItem("auth_token");
    localStorage.removeItem("refresh_token");
  }

  private hydrateTokensFromStorage() {
    const storageToken = localStorage.getItem("auth_token");
    const storageRefreshToken = localStorage.getItem("refresh_token");

    if (storageToken && !this.token) {
      this.token = storageToken;
      this.isAuth = true;
    }

    if (storageRefreshToken && !this.refreshToken) {
      this.refreshToken = storageRefreshToken;
    }
  }
}

const authStore = new Store();

export default authStore;
