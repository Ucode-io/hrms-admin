// Readonly-доступ к перепискам сотрудников с копилотом.
//
// Читаем таблицу `copilot_conversations` напрямую из ucode, а не через
// udevs_hrms_copilot: его эндпоинты отдают тред только владельцу
// (ConversationStore.owns), а здесь админ смотрит чужие. Бэкенд копилота ради
// этого раздела не трогаем — цена решения в том, что полный рендер (replay.ts)
// сюда не переезжает, тред проецируется урезанно (см. modules/Chats/projectThread.ts).
//
// ⚠️ Права здесь проверяет только ucode. Пункт меню гейтится ModuleKey, но это
// навигация, а не авторизация: у кого есть read на таблицу — прочитает её
// curl'ом мимо админки. Принято осознанно.

import { useInfiniteQuery, useQuery } from "react-query";
import httpRequest from "../httpRequest";

const CONVERSATIONS_SLUG = "copilot_conversations";
const USERS_SLUG = "user_base";

/** Строк за раз. Каждая тащит весь thread, поэтому страница небольшая. */
export const CONVERSATIONS_PAGE_SIZE = 50;

/** Одним запросом, без пагинации: мапа нужна целиком, чтобы подписать автора. */
const USERS_LIMIT = 500;

export interface CopilotConversationRow {
  guid: string;
  user_id: string;
  /** Не пустой → переписка велась в Telegram, пустой → в вебе (админка/мини-апп). */
  telegram_chat_id: string | null;
  title: string | null;
  /** Сырой Thread Anthropic: ucode отдаёт его то строкой, то разобранным. */
  thread: unknown;
  created_at: string;
  updated_at: string;
}

export interface ChatUser {
  guid: string;
  name: string;
  photo: string | null;
}

const rowsOf = <T>(res: unknown): T[] => {
  const response = (res as { response?: unknown } | null)?.response;
  return Array.isArray(response) ? (response as T[]) : [];
};

const fetchConversations = async (
  offset: number
): Promise<CopilotConversationRow[]> => {
  const res = await httpRequest.get(`/v2/items/${CONVERSATIONS_SLUG}`, {
    params: {
      data: JSON.stringify({
        limit: CONVERSATIONS_PAGE_SIZE,
        offset,
        order: { updated_at: -1 },
      }),
    },
  });
  return rowsOf<CopilotConversationRow>(res);
};

/**
 * Переписки компании, страницами по убыванию активности.
 *
 * `companies_id` в запрос подставляет интерцептор — ровно так же, как во всех
 * остальных списках админки.
 */
export const useCopilotConversations = () =>
  useInfiniteQuery(
    ["copilot-conversations"],
    ({ pageParam = 0 }) => fetchConversations(pageParam as number),
    {
      getNextPageParam: (lastPage, pages) =>
        lastPage.length < CONVERSATIONS_PAGE_SIZE
          ? undefined
          : pages.reduce((sum, page) => sum + page.length, 0),
    }
  );

/**
 * Мапа `user_id → человек`, чтобы подписать переписку именем.
 *
 * Читаем `user_base` без фильтра по роли: писать копилоту может и админ, и
 * рядовой сотрудник, а промах по мапе оставит в списке голый guid.
 */
export const useChatUsers = () =>
  useQuery(["copilot-chat-users"], async () => {
    const res = await httpRequest.get(`/v2/items/${USERS_SLUG}`, {
      params: { data: JSON.stringify({ limit: USERS_LIMIT, offset: 0 }) },
    });

    const users = new Map<string, ChatUser>();
    for (const row of rowsOf<Record<string, unknown>>(res)) {
      const guid = typeof row.guid === "string" ? row.guid : null;
      if (!guid) continue;
      const name = [row.second_name, row.first_name, row.middle_name]
        .filter((part): part is string => typeof part === "string" && part.trim() !== "")
        .join(" ")
        .trim();
      const photo = typeof row.photo === "string" && row.photo !== "" ? row.photo : null;
      users.set(guid, { guid, name: name || guid, photo });
    }
    return users;
  });
