// Readonly-просмотр переписок сотрудников с копилотом.
//
// Слева — люди, у которых есть хоть одна переписка, справа — все их диалоги
// одной лентой с разделителями. Диалогов у человека много (копилот начинает
// новый после простоя чата и на каждый заход из веба), а телеграмная метафора
// — один человек, один бесконечный ribbon, поэтому склеиваем, но границу
// диалога показываем: без неё вчерашний ответ читается как сегодняшний.
//
// Источник различается только на «Telegram / Веб»: админка и мини-апп на
// бэкенде неотличимы, обе пишут пустой telegram_chat_id.

import { useEffect, useMemo, useState } from "react";
import { Loader2, MessageSquare, Search } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import {
  useChatUsers,
  useCopilotConversations,
  type ChatUser,
  type CopilotConversationRow,
} from "../../api/services/copilotChat.service";
import { lastSaid, projectThread, type ChatMessage } from "./projectThread";

interface Dialog {
  id: string;
  startedAt: string;
  source: "Telegram" | "Веб";
  messages: ChatMessage[];
}

interface Person {
  userId: string;
  name: string;
  photo: string | null;
  dialogs: Dialog[];
  lastActivity: string;
  preview: string;
}

const dateLabel = (iso: string): string => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

/** Сегодняшнее время, всё остальное — датой: так же, как в списке чатов Telegram. */
const activityLabel = (iso: string): string => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  const today = new Date();
  const sameDay =
    parsed.getDate() === today.getDate() &&
    parsed.getMonth() === today.getMonth() &&
    parsed.getFullYear() === today.getFullYear();
  return sameDay
    ? parsed.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : parsed.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });
};

const initials = (name: string): string =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

const buildPeople = (
  rows: CopilotConversationRow[],
  users: Map<string, ChatUser> | undefined
): Person[] => {
  const byUser = new Map<string, CopilotConversationRow[]>();
  for (const row of rows) {
    if (!row?.user_id) continue;
    const list = byUser.get(row.user_id) ?? [];
    list.push(row);
    byUser.set(row.user_id, list);
  }

  const people: Person[] = [];
  byUser.forEach((userRows, userId) => {
    const dialogs = userRows
      .slice()
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
      .map((row) => ({
        id: row.guid,
        startedAt: row.created_at,
        source: row.telegram_chat_id ? ("Telegram" as const) : ("Веб" as const),
        messages: projectThread(row.thread, `${row.guid}-`),
      }))
      // Пустые треды не показываем — сервис в своём списке истории делает так же:
      // строка создаётся до первого ответа и до него ничего не значит.
      .filter((dialog) => dialog.messages.length > 0);

    if (dialogs.length === 0) return;

    // Промах по мапе — уволенный или пользователь другого проекта. Показываем
    // guid, а не пустоту: пустая строка выглядит как баг вёрстки.
    const user = users?.get(userId);
    const lastActivity = userRows
      .map((row) => String(row.updated_at ?? ""))
      .sort()
      .slice(-1)[0] ?? "";

    people.push({
      userId,
      name: user?.name ?? userId,
      photo: user?.photo ?? null,
      dialogs,
      lastActivity,
      preview: lastSaid(dialogs[dialogs.length - 1].messages),
    });
  });

  return people.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
};

export default function ChatsPage() {
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useCopilotConversations();
  const { data: users } = useChatUsers();

  const people = useMemo(
    () => buildPeople(data?.pages.flat() ?? [], users),
    [data, users]
  );

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return people;
    return people.filter((person) => person.name.toLowerCase().includes(query));
  }, [people, search]);

  useEffect(() => {
    if (visible.length === 0) return;
    if (visible.some((person) => person.userId === selectedUserId)) return;
    setSelectedUserId(visible[0].userId);
  }, [visible, selectedUserId]);

  const selected = visible.find((person) => person.userId === selectedUserId) ?? null;

  return (
    <>
      <PageMeta
        title="Чаты | HRMS"
        description="Переписки сотрудников с AI чатом"
      />

      <div className="flex h-[calc(100vh-140px)] overflow-hidden rounded-2xl border border-gray-200 bg-white">
        {/* Левая колонка: люди */}
        <aside className="flex w-[320px] shrink-0 flex-col border-r border-gray-200">
          <div className="border-b border-gray-200 p-3">
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Поиск по сотруднику"
                className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-400"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-gray-400">
                <Loader2 size={20} className="animate-spin" />
              </div>
            ) : visible.length === 0 ? (
              <p className="p-4 text-sm text-gray-400">Переписок пока нет</p>
            ) : (
              visible.map((person) => (
                <button
                  key={person.userId}
                  type="button"
                  onClick={() => setSelectedUserId(person.userId)}
                  className={`flex w-full items-center gap-3 border-b border-gray-100 px-3 py-3 text-left transition-colors ${
                    person.userId === selectedUserId ? "bg-brand-50" : "hover:bg-gray-50"
                  }`}
                >
                  {person.photo ? (
                    <img
                      src={person.photo}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-500">
                      {initials(person.name)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium text-gray-800">
                        {person.name}
                      </span>
                      <span className="shrink-0 text-xs text-gray-400">
                        {activityLabel(person.lastActivity)}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-gray-500">
                      {person.preview}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>

          {hasNextPage ? (
            <button
              type="button"
              onClick={() => void fetchNextPage()}
              disabled={isFetchingNextPage}
              className="border-t border-gray-200 py-2.5 text-sm text-brand-500 hover:bg-gray-50 disabled:text-gray-400"
            >
              {isFetchingNextPage ? "Загрузка…" : "Показать ещё"}
            </button>
          ) : null}
        </aside>

        {/* Правая колонка: лента выбранного человека */}
        <section className="flex min-w-0 flex-1 flex-col">
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-gray-400">
              <MessageSquare size={28} />
              <p className="text-sm">Выберите сотрудника слева</p>
            </div>
          ) : (
            <>
              <header className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
                <h2 className="text-sm font-semibold text-gray-800">{selected.name}</h2>
                <span className="text-xs text-gray-400">
                  {selected.dialogs.length} диалог(ов)
                </span>
              </header>

              <div className="flex-1 space-y-3 overflow-y-auto bg-gray-50 px-5 py-4">
                {selected.dialogs.map((dialog) => (
                  <div key={dialog.id} className="space-y-3">
                    <div className="flex items-center gap-3 py-1">
                      <span className="h-px flex-1 bg-gray-200" />
                      <span className="text-[11px] uppercase tracking-wide text-gray-400">
                        новый диалог · {dateLabel(dialog.startedAt)} · {dialog.source}
                      </span>
                      <span className="h-px flex-1 bg-gray-200" />
                    </div>

                    {dialog.messages.map((message) =>
                      message.role === "tool" ? (
                        <p
                          key={message.id}
                          className="text-center text-[11px] text-gray-400"
                        >
                          🔧 {message.text}
                        </p>
                      ) : (
                        <div
                          key={message.id}
                          className={`flex ${
                            message.role === "user" ? "justify-end" : "justify-start"
                          }`}
                        >
                          <p
                            className={`max-w-[70%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm ${
                              message.role === "user"
                                ? "bg-brand-500 text-white"
                                : "bg-white text-gray-800 shadow-sm"
                            }`}
                          >
                            {message.text}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
