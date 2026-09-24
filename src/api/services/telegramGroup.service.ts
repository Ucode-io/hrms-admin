// Подключение Telegram-групп компании и её филиалов (ADR-0010).
//
// Привязку выполняет бот, когда попадает в группу; здесь только выдаётся
// одноразовый пропуск с выбранным охватом и снимается текущая привязка.
// Охват — `locationsId`: null значит группа всей компании.

import { invokeTasksMethod } from "./taskDirectories.service";
import { translate } from "../../i18n";

export type TelegramGroupPass = {
  /** Открывает выбор группы в Telegram. Работает, только если бота в группе ещё нет. */
  link: string | null;
  /** Тот же пропуск словами — для группы, где бот уже сидит. */
  token: string;
  expiresInMinutes: number;
};

export type TelegramGroupStatus = {
  /** Есть хоть одна группа — по нему открывается колонка «В группу». */
  linked: boolean;
  companyLinked: boolean;
  branches: Array<{ locationsId: string; title: string; linked: boolean }>;
};

const str = (value: unknown): string => (typeof value === "string" ? value : "");

export const telegramGroupService = {
  status: async (companiesId: string): Promise<TelegramGroupStatus> => {
    const result = await invokeTasksMethod("telegram_group_link_status", {
      companies_id: companiesId,
    });
    const branches: unknown[] = Array.isArray(result?.branches) ? result?.branches : [];
    return {
      // `linked` у бэка — группа компании (так его читала админка до групп
      // филиалов), «хоть одна группа» — `any_linked`; у старого бэка его нет.
      linked: Boolean(result?.any_linked ?? result?.linked),
      companyLinked: Boolean(result?.linked),
      branches: branches.map((row) => {
        const branch = (row ?? {}) as Record<string, unknown>;
        return { locationsId: str(branch.locations_id), title: str(branch.title), linked: Boolean(branch.linked) };
      }),
    };
  },

  createPass: async (companiesId: string, locationsId: string | null): Promise<TelegramGroupPass> => {
    const result = await invokeTasksMethod("telegram_group_link_create", {
      companies_id: companiesId,
      locations_id: locationsId,
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

  unlink: async (companiesId: string, locationsId: string | null): Promise<void> => {
    const result = await invokeTasksMethod("telegram_group_unlink", {
      companies_id: companiesId,
      locations_id: locationsId,
    });

    if (!result?.unlinked) {
      throw new Error(str(result?.reason) || translate("telegram_group.disconnect_error"));
    }
  },
};
