import en from "./locales/en.json";
import ru from "./locales/ru.json";
import uz from "./locales/uz.json";
import kz from "./locales/kz.json";
import zh from "./locales/zh.json";

// ponytail: ru.json is the source of truth for keys — other files may be partial, t() falls back to ru.
export const messages: Record<Locale, Partial<Record<MessageKey, string>>> = {
  en,
  ru,
  uz,
  kz,
  zh,
};

export type Locale = "en" | "ru" | "uz" | "kz" | "zh";
export type MessageKey = keyof typeof ru;
