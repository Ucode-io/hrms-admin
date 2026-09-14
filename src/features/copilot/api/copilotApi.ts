import authStore from "../../../store/auth.store";
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
 * Opens the Copilot stream.
 *
 * Hand-rolled rather than EventSource because EventSource can only issue GET
 * requests, and the message has to go in a body. That also means this bypasses
 * the axios interceptors the rest of the app relies on, so the auth header is
 * attached here explicitly.
 */
const openStream = async (
  endpoint: "/copilot/chat" | "/copilot/confirm",
  body: unknown,
  onEvent: (event: CopilotStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> => {
  const token = authStore.token;
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
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
  const token = authStore.token;
  const response = await fetch(`${BASE_URL}/copilot/conversations/${id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) return null;
  return (await response.json()) as CopilotConversationDetail;
};

export const deleteConversation = async (id: string): Promise<boolean> => {
  const token = authStore.token;
  const response = await fetch(`${BASE_URL}/copilot/conversations/${id}`, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.ok;
};

export const fetchConversations = async (): Promise<
  CopilotConversationSummary[] | null
> => {
  const token = authStore.token;
  const response = await fetch(`${BASE_URL}/copilot/conversations`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  // null, not []: an expired session and a service that is down would otherwise
  // render as "you have no history", which is the one answer nobody questions.
  if (!response.ok) return null;
  return (await response.json()) as CopilotConversationSummary[];
};
