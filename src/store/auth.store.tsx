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
  avatar?: string;
  photo?: string;
  [key: string]: unknown;
}

class Store {
  constructor() {
    makeAutoObservable(this);

    makePersistable(this, {
      name: "ayva-auth",
      properties: ["isAuth", "token", "user", "user_data"],
      storage: window.localStorage,
    });
  }

  isAuth = false;
  token: string | null = null;
  user: UserData | null = null;
  user_data: UserData | null = null;

  setIsAuth(value: boolean) {
    this.isAuth = value;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  setUser(user: UserData | null) {
    this.user = user;
    this.user_data = user;
  }

  login(token: string, user: UserData) {
    this.isAuth = true;
    this.token = token;
    this.user = user;
    this.user_data = user;
  }

  logout() {
    this.isAuth = false;
    this.token = null;
    this.user = null;
    this.user_data = null;
    localStorage.removeItem("auth_token");
  }
}

const authStore = new Store();

export default authStore;
