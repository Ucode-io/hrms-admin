// Подключение Telegram-группы компании.
//
// Привязку выполняет бот, когда попадает в группу; здесь только выдаётся
// одноразовый пропуск с выбранной компанией и снимается текущая привязка.

import { invokeTasksMethod } from "./taskDirectories.service";
import { translate } from "../../i18n";

export type TelegramGroupPass = {
  /** Открывает выбор группы в Telegram. Работает, только если бота в группе ещё нет. */
  link: string | null;
  /** Тот же пропуск словами — для группы, где бот уже сидит. */
  token: string;
  expiresInMinutes: number;
};

const str = (value: unknown): string => (typeof value === "string" ? value : "");

export const telegramGroupService = {
  status: async (companiesId: string): Promise<boolean> => {
    const result = await invokeTasksMethod("telegram_group_link_status", {
      companies_id: companiesId,
    });
    return Boolean(result?.linked);
  },

  createPass: async (companiesId: string): Promise<TelegramGroupPass> => {
    const result = await invokeTasksMethod("telegram_group_link_create", {
      companies_id: companiesId,
    });

    if (!result?.created) {
      throw new Error(str(result?.reason) || translate("telegram_group.code_error"));
    }

    return {
      link: str(result.link) || null,
      token: str(result.token),
      expiresInMinutes: Number(result.expires_in_minutes) || 15,
    };
  },

  unlink: async (companiesId: string): Promise<void> => {
    const result = await invokeTasksMethod("telegram_group_unlink", {
      companies_id: companiesId,
    });

    if (!result?.unlinked) {
      throw new Error(str(result?.reason) || translate("telegram_group.disconnect_error"));
    }
  },
};
