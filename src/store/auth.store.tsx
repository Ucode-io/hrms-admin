import { makeAutoObservable } from "mobx";
import { makePersistable } from "mobx-persist-store";

interface UserData {
  guid?: string;
  login?: string;
  first_name?: string;
  second_name?: string;
  phone?: string;
  email?: string;
  role_id?: string;
  client_type_id?: string;
  user_id_auth?: string;
  avatar?: string;
  [key: string]: any;
}

class Store {
  constructor() {
    makeAutoObservable(this);

    makePersistable(this, {
      name: "ayva-auth",
      properties: ["isAuth", "token", "user"],
      storage: window.localStorage,
    });
  }

  isAuth = false;
  token: string | null = null;
  user: UserData | null = null;

  setIsAuth(value: boolean) {
    this.isAuth = value;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  setUser(user: UserData | null) {
    this.user = user;
  }

  login(token: string, user: UserData) {
    this.isAuth = true;
    this.token = token;
    this.user = user;
  }

  logout() {
    this.isAuth = false;
    this.token = null;
    this.user = null;
  }
}

const authStore = new Store();

export default authStore;
