import authStore from "../../../store/auth.store";
import { DEFAULT_PROJECT_ID } from "../../../api/httpRequest";
import { ensureFreshToken } from "../../../api/unauthorizedHandler";
import type {
  CopilotAttachment,
  CopilotConversationDetail,
  CopilotConversationSummary,
  CopilotStreamEvent,
} from "../types";

const BASE_URL = (
  import.meta.env.VITE_COPILOT_URL || "http://localhost:8099"
).replace(/\/+$/, "");

/**
 * Headers every Copilot call carries.
 *
 * This bypasses the axios interceptors the rest of the app uses, so both the
 * token and the project have to be attached by hand. `Project-Id` is what tells
 * the service which ucode project to read HRMS data from — it used to keep its
 * own copy of the id in an env var, which only had to be right at deploy time
 * and silently pointed at the wrong project when it was not.
 */
const headers = (): Record<string, string> => {
  const token = authStore.token;
  return {
    "Project-Id": DEFAULT_PROJECT_ID,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

/**
 * fetch с токеном. Мимо axios-интерцепторов, поэтому и заголовки, и реакция на
 * протухший токен — руками: обновить и повторить один раз. Access живёт сутки,
 * без этого чат отваливался до перезагрузки страницы.
 */
const authedFetch = async (url: string, init: RequestInit = {}): Promise<Response> => {
  const send = () => fetch(url, { ...init, headers: { ...init.headers, ...headers() } });

  const response = await send();
  if (response.status !== 401) {
    return response;
  }

  return (await ensureFreshToken()) ? send() : response;
};

/**
 * Opens the Copilot stream.
 *
 * Hand-rolled rather than EventSource because EventSource can only issue GET
 * requests, and the message has to go in a body.
 */
const openStream = async (
  endpoint: "/copilot/chat" | "/copilot/confirm",
  body: unknown,
  onEvent: (event: CopilotStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> => {
  const response = await authedFetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok || !response.body) {
    onEvent({
      type: "error",
      message:
        response.status === 401
          ? "Сессия истекла. Войдите заново."
          : "AI чат сейчас недоступен.",
      code: response.status === 401 ? "forbidden" : "internal",
    });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE records are separated by a blank line. Anything after the last
    // separator is an incomplete record — keep it for the next chunk rather than
    // trying to parse half an event.
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      for (const event of parseRecord(part)) onEvent(event);
    }
  }
};

const parseRecord = (record: string): CopilotStreamEvent[] => {
  const events: CopilotStreamEvent[] = [];
  for (const line of record.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload) continue;
    try {
      events.push(JSON.parse(payload) as CopilotStreamEvent);
    } catch {
      // A malformed frame is not worth failing the whole stream over.
    }
  }
  return events;
};

export const streamChat = (
  body: {
    conversationId?: string | null;
    message?: string;
    attachment?: CopilotAttachment;
    context?: { route?: string | null };
  },
  onEvent: (event: CopilotStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> => openStream("/copilot/chat", body, onEvent, signal);

export const streamConfirm = (
  body: {
    conversationId: string;
    actionId: string;
    decision: "approve" | "reject";
  },
  onEvent: (event: CopilotStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> => openStream("/copilot/confirm", body, onEvent, signal);

export const fetchConversation = async (
  id: string,
): Promise<CopilotConversationDetail | null> => {
  const response = await authedFetch(`${BASE_URL}/copilot/conversations/${id}`);
  if (!response.ok) return null;
  return (await response.json()) as CopilotConversationDetail;
};

export const deleteConversation = async (id: string): Promise<boolean> => {
  const response = await authedFetch(`${BASE_URL}/copilot/conversations/${id}`, {
    method: "DELETE",
  });
  return response.ok;
};

export const fetchConversations = async (): Promise<
  CopilotConversationSummary[] | null
> => {
  const response = await authedFetch(`${BASE_URL}/copilot/conversations`);
  // null, not []: an expired session and a service that is down would otherwise
  // render as "you have no history", which is the one answer nobody questions.
  if (!response.ok) return null;
  return (await response.json()) as CopilotConversationSummary[];
};
