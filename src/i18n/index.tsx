import { createContext, useCallback, useContext, useState } from "react";
import { enUS, kk, ru, uz, zhCN, type Locale as DateFnsLocale } from "date-fns/locale";
import { messages, type Locale, type MessageKey } from "./messages";

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  ru: "Русский",
  uz: "O'zbek",
  kz: "Qazaqsha",
  zh: "中文",
};
export const LOCALES = Object.keys(LOCALE_NAMES) as Locale[];

/** Наши коды локалей — не BCP 47 (kz вместо kk), для Intl и date-fns их надо переводить. */
export const BCP47: Record<Locale, string> = { ru: "ru-RU", en: "en-GB", uz: "uz-UZ", kz: "kk-KZ", zh: "zh-CN" };
export const DATE_FNS_LOCALES: Record<Locale, DateFnsLocale> = { ru, en: enUS, uz, kz: kk, zh: zhCN };

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** Названия месяцев берём у Intl — держать по 12 ключей на язык незачем. */
export const monthNames = (locale: Locale, month: "long" | "short" = "long"): string[] =>
  Array.from({ length: 12 }, (_, index) =>
    capitalize(new Intl.DateTimeFormat(BCP47[locale], { month }).format(new Date(2024, index, 1, 12)))
  );

/** Дни недели с понедельника: 1 января 2024 — понедельник. */
export const weekdayNames = (
  locale: Locale,
  weekday: "long" | "short" | "narrow" = "short"
): string[] =>
  Array.from({ length: 7 }, (_, index) =>
    capitalize(
      new Intl.DateTimeFormat(BCP47[locale], { weekday }).format(new Date(2024, 0, 1 + index, 12))
    )
  );

/**
 * Форма слова для числа. Русский различает one/few/many; в остальных языках
 * админки хватает «одно / много», поэтому у них ключи `_few` и `_many` совпадают.
 */
export const pluralForm = (locale: Locale, count: number): "one" | "few" | "many" => {
  const abs = Math.abs(count);
  if (locale !== "ru") return abs === 1 ? "one" : "many";
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return "one";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "few";
  return "many";
};
const DEFAULT_LOCALE: Locale = "ru";
const STORAGE_KEY = "locale";

const readLocale = (): Locale => {
  // Вне браузера (selfCheck под node) хранилища нет — тогда язык по умолчанию.
  const saved = (globalThis.localStorage?.getItem(STORAGE_KEY) ?? null) as Locale | null;
  return saved && saved in messages ? saved : DEFAULT_LOCALE;
};

/** Текущая локаль для кода вне компонентов (форматтеры, сервисы). */
export const getLocale = readLocale;

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
