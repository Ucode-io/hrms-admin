// Маршрутизация уведомлений бота: какое событие в какой канал уходит.
//
// Каталог событий целиком на стороне reports — здесь ни один `event_type` по
// имени не known. Добавили событие на бэкенде, оно появилось в таблице; фронт
// деплоить не надо.

import { invokeTasksMethod } from "./taskDirectories.service";
import { translate } from "../../i18n";

export type NotificationEvent = {
  event_type: string;
  /** Подзаголовок, под которым событие показывается в таблице. */
  section: string;
  title: string;
  hint: string | null;
  /** false — канал событию неприменим, вместо чекбокса прочерк. */
  employee_applicable: boolean;
  group_applicable: boolean;
  to_employee: boolean;
  to_group: boolean;
  /** Свой текст компании сотруднику; пусто — бот шлёт стандартный. */
  template: string;
  /** Свой текст в группу компании; пусто — стандартный. */
  group_template: string;
  /** Стандартный текст теми же переменными — с него начинает редактор. */
  default_template: string;
  /** false — в группу событие не уходит, своего текста для неё нет. */
  group_text_applicable: boolean;
  /** Что можно подставить в `{{key}}`. Пусто — своего текста у события нет. */
  variables: { key: string; label: string }[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const str = (value: unknown): string => (typeof value === "string" ? value : "");

const mapEvent = (raw: unknown): NotificationEvent | null => {
  if (!isRecord(raw) || !str(raw.event_type)) return null;

  return {
    event_type: str(raw.event_type),
    section: str(raw.section) || translate("notifications.fallback.other_section"),
    title: str(raw.title) || str(raw.event_type),
    hint: str(raw.hint) || null,
    employee_applicable: raw.employee_applicable !== false,
    group_applicable: raw.group_applicable !== false,
    to_employee: Boolean(raw.to_employee),
    to_group: Boolean(raw.to_group),
    template: str(raw.template),
    group_template: str(raw.group_template),
    default_template: str(raw.default_template),
    group_text_applicable: raw.group_text_applicable === true,
    variables: Array.isArray(raw.variables)
      ? raw.variables
          .filter(isRecord)
          .map((item) => ({ key: str(item.key), label: str(item.label) }))
          .filter((item) => item.key)
      : [],
  };
};

export const notificationSettingsService = {
  get: async (companiesId: string): Promise<NotificationEvent[]> => {
    const result = await invokeTasksMethod("notification_settings_get", {
      companies_id: companiesId,
    });

    const events = isRecord(result) && Array.isArray(result.events) ? result.events : [];
    return events.map(mapEvent).filter((item): item is NotificationEvent => item !== null);
  },

  save: async (companiesId: string, events: NotificationEvent[]): Promise<void> => {
    const result = await invokeTasksMethod("notification_settings_save", {
      companies_id: companiesId,
      events: events.map((event) => ({
        event_type: event.event_type,
        to_employee: event.to_employee,
        to_group: event.to_group,
        template: event.template,
        group_template: event.group_template,
      })),
    });

    if (!isRecord(result) || !result.saved) {
      throw new Error(
        str(isRecord(result) ? result.reason : "") === "forbidden"
          ? translate("notifications.settings.forbidden")
          : translate("notifications.settings.save_error")
      );
    }
  },
};
