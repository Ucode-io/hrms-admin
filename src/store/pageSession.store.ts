import { makeAutoObservable } from "mobx";
import { makePersistable } from "mobx-persist-store";

type PageState = object;

const getSessionStorage = () => {
  if (typeof window === "undefined") return undefined;
  return window.sessionStorage;
};

class PageSessionStore {
  pages: Record<string, PageState> = {};
  isHydrated = false;

  constructor() {
    makeAutoObservable(this);

    const storage = getSessionStorage();
    if (!storage) {
      this.isHydrated = true;
      return;
    }

    void makePersistable(this, {
      name: "ayva-page-session-state",
      properties: ["pages"],
      storage,
    }).then(() => {
      this.isHydrated = true;
    });
  }

  getState<T extends PageState>(key: string, defaults: T): T {
    return {
      ...defaults,
      ...(this.pages[key] as Partial<T> | undefined),
    };
  }

  setState<T extends PageState>(key: string, state: T) {
    this.pages = {
      ...this.pages,
      [key]: state,
    };
  }

  patchState<T extends PageState>(key: string, defaults: T, patch: Partial<T>) {
    this.setState(key, {
      ...this.getState(key, defaults),
      ...patch,
    });
  }

  resetState(key: string) {
    const pages = { ...this.pages };
    delete pages[key];
    this.pages = pages;
  }
}

const pageSessionStore = new PageSessionStore();

export default pageSessionStore;
