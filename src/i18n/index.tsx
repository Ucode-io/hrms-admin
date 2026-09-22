import { createContext, useCallback, useContext, useState } from "react";
import { messages, type Locale, type MessageKey } from "./messages";

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  ru: "Русский",
  uz: "O'zbek",
  kz: "Qazaqsha",
  zh: "中文",
};
export const LOCALES = Object.keys(LOCALE_NAMES) as Locale[];
const DEFAULT_LOCALE: Locale = "ru";
const STORAGE_KEY = "locale";

const readLocale = (): Locale => {
  const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
  return saved && saved in messages ? saved : DEFAULT_LOCALE;
};

type Vars = Record<string, string | number>;

type I18nContextType = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, vars?: Vars) => string;
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(readLocale);

  const setLocale = useCallback((next: Locale) => {
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next;
    setLocaleState(next);
  }, []);

  const t = useCallback(
    (key: MessageKey, vars?: Vars) => {
      const raw: string = messages[locale][key] ?? messages[DEFAULT_LOCALE][key] ?? key;
      return vars
        ? raw.replace(/\{(\w+)\}/g, (match, name) => String(vars[name] ?? match))
        : raw;
    },
    [locale],
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>
  );
};

// For non-component code (services, utils) that can't call the useTranslation hook.
export const translate = (key: MessageKey, vars?: Vars): string => {
  const locale = readLocale();
  const raw: string = messages[locale][key] ?? messages[DEFAULT_LOCALE][key] ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (match, name) => String(vars[name] ?? match)) : raw;
};

export const useTranslation = () => {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useTranslation must be used within an I18nProvider");
  return context;
};
