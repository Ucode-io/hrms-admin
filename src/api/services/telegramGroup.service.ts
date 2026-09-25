// Подключение Telegram-групп компании (ADR-0010, ADR-0012).
//
// Группа — это чат, а её охват — филиалы, которые на него указывают, либо вся
// компания. Привязку выполняет бот, когда попадает в группу; здесь выдаётся
// одноразовый пропуск с выбранным охватом, меняется охват уже привязанной
// группы и снимается привязка.

import { invokeTasksMethod } from "./taskDirectories.service";
import { translate } from "../../i18n";

export type TelegramGroupPass = {
  /** Открывает выбор группы в Telegram. Работает, только если бота в группе ещё нет. */
  link: string | null;
  /** Тот же пропуск словами — для группы, где бот уже сидит. */
  token: string;
  expiresInMinutes: number;
};

/** Охват группы: вся компания или набор филиалов. */
export type TelegramGroupScope = { company: boolean; locationsIds: string[] };

/**
 * Как группу видит бот — по ответу Telegram на getChat. `unknown` — Telegram
 * не ответил (сеть, лимит), это не повод перепривязывать.
 */
export type TelegramGroupState = "ok" | "bot_missing" | "migrated" | "unknown";

export type TelegramGroup = {
  chatId: string;
  company: boolean;
  branches: Array<{ locationsId: string; title: string }>;
  /** Название чата от Telegram; null — не ответил или бота там нет. */
  title: string | null;
  state: TelegramGroupState;
};

export type TelegramGroupStatus = {
  /** Есть хоть одна группа. */
  linked: boolean;
  branches: Array<{ locationsId: string; title: string; chatId: string | null }>;
  groups: TelegramGroup[];
};

const str = (value: unknown): string => (typeof value === "string" ? value : "");

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const STATES: TelegramGroupState[] = ["ok", "bot_missing", "migrated", "unknown"];

const REASON_KEYS = {
  branch_taken: "settings_general.telegram.error.branch_taken",
  company_taken: "settings_general.telegram.error.company_taken",
  scope_required: "settings_general.telegram.error.scope_required",
  group_not_found: "settings_general.telegram.error.group_not_found",
  branch_not_found: "settings_general.telegram.error.branch_not_found",
  forbidden: "settings_general.telegram.error.forbidden",
} as const;

/** Отказ бэкенда словами: `branch_taken` называет, какие филиалы заняты. */
const refusal = (result: Record<string, unknown>, fallback: Parameters<typeof translate>[0]): Error => {
  const reason = str(result.reason) as keyof typeof REASON_KEYS;
  const names = list(result.branches).map(str).filter(Boolean).join(", ");
  return new Error(REASON_KEYS[reason] ? translate(REASON_KEYS[reason], { names }) : translate(fallback));
};

const scopeBody = (scope: TelegramGroupScope) =>
  scope.company ? { company: true } : { locations_ids: scope.locationsIds };

export const telegramGroupService = {
  status: async (companiesId: string): Promise<TelegramGroupStatus> => {
    const result = record(
      await invokeTasksMethod("telegram_group_link_status", { companies_id: companiesId })
    );
    const groups = list(result.groups).map((raw) => {
      const group = record(raw);
      const state = str(group.state) as TelegramGroupState;
      return {
        chatId: str(group.chat_id),
        company: group.company === true,
        branches: list(group.branches).map((item) => ({
          locationsId: str(record(item).locations_id),
          title: str(record(item).title),
        })),
        title: str(group.title) || null,
        state: STATES.includes(state) ? state : "unknown",
      };
    });

    return {
      // У старого бэка групп нет — тогда «хоть одна» по его флагам.
      linked: groups.length > 0 || Boolean(result.any_linked ?? result.linked),
      branches: list(result.branches).map((raw) => {
        const branch = record(raw);
        return {
          locationsId: str(branch.locations_id),
          title: str(branch.title),
          chatId: str(branch.chat_id) || null,
        };
      }),
      groups,
    };
  },

  createPass: async (companiesId: string, scope: TelegramGroupScope): Promise<TelegramGroupPass> => {
    const result = record(
      await invokeTasksMethod("telegram_group_link_create", {
        companies_id: companiesId,
        ...scopeBody(scope),
      })
    );

    if (!result.created) {
      throw refusal(result, "telegram_group.code_error");
    }

    return {
      link: str(result.link) || null,
      token: str(result.token),
      expiresInMinutes: Number(result.expires_in_minutes) || 15,
    };
  },

  /** Выбор поменяли после выдачи — прежний код больше ничего не привязывает. */
  cancelPass: async (companiesId: string): Promise<void> => {
    const result = record(
      await invokeTasksMethod("telegram_group_link_cancel", { companies_id: companiesId })
    );

    if (!result.cancelled) {
      throw refusal(result, "settings_general.telegram.error.cancel_failed");
    }
  },

  /** Новый охват привязанной группы — без кода. */
  update: async (companiesId: string, chatId: string, scope: TelegramGroupScope): Promise<void> => {
    const result = record(
      await invokeTasksMethod("telegram_group_update", {
        companies_id: companiesId,
        chat_id: chatId,
        ...scopeBody(scope),
      })
    );

    if (!result.updated) {
      throw refusal(result, "settings_general.telegram.error.update_failed");
    }
  },

  /** Отключить группу целиком: чат снимается и с компании, и со всех филиалов. */
  unlink: async (companiesId: string, chatId: string): Promise<void> => {
    const result = record(
      await invokeTasksMethod("telegram_group_unlink", {
        companies_id: companiesId,
        chat_id: chatId,
      })
    );

    if (!result.unlinked) {
      throw refusal(result, "telegram_group.disconnect_error");
    }
  },
};
