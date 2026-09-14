import { makeAutoObservable, runInAction } from "mobx";
import { makePersistable } from "mobx-persist-store";
import queryClient from "../../../api/queryClient";
import {
  deleteConversation,
  fetchConversation,
  fetchConversations,
  streamChat,
  streamConfirm,
} from "../api/copilotApi";
import type {
  CopilotAttachment,
  CopilotConversationSummary,
  CopilotErrorCode,
  CopilotMessage,
  CopilotMessageAction,
  CopilotStreamEvent,
} from "../types";

/** Matches MAX_ATTACHMENT_BYTES in the service, so the refusal happens here. */
const MAX_FILE_BYTES = 4 * 1024 * 1024;

/** One tool call, as shown in the thinking trace. */
export interface CopilotStep {
  id: string;
  tool: string;
  done: boolean;
}

/**
 * Russian copy per error code.
 *
 * The service answers in English because its logs and its API are English; this
 * panel is Russian. Keying off the stable `code` rather than translating the
 * server's sentence means the wording can change upstream without this drifting
 * out of sync — and the server's message is still the fallback when a new code
 * arrives that this build has not learned yet.
 */
const ERROR_TEXT: Record<CopilotErrorCode, string> = {
  forbidden: "Нет доступа к этим данным.",
  permission_denied: "Недостаточно прав для этого действия.",
  not_found: "Не удалось найти запрошенное.",
  rate_limited: "Слишком много запросов. Подождите немного и повторите.",
  invalid_action: "Это действие больше недоступно.",
  action_expired: "Действие устарело. Повторите запрос.",
  timeout: "AI чат слишком долго отвечал, запрос остановлен.",
  unavailable: "AI чат недоступен. Сообщите администратору.",
  internal: "Что-то пошло не так. Попробуйте ещё раз.",
};

/**
 * Chat state for the Copilot dock.
 *
 * Deliberately NOT persisted: the service owns the Conversation, so mirroring
 * the transcript in localStorage would only create a second copy that can drift.
 * Only the dock's own shape and which Conversation is open are remembered.
 */
class CopilotStore {
  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });

    void makePersistable(this, {
      name: "hrms-copilot-ui",
      properties: ["isOpen", "width", "isExpanded", "conversationId"],
      storage: window.localStorage,
    }).then(() => {
      // The id outlives a reload and now the transcript does too, so a reload
      // lands back in the conversation it left rather than staring at an empty
      // panel while the model remembers a table nobody can see.
      if (this.conversationId && this.messages.length === 0) {
        void this.openConversation(this.conversationId);
      }
    });
  }

  // ─── Persisted dock state ───────────────────────────────────────────────

  isOpen = false;
  isExpanded = false;
  width = 400;
  conversationId: string | null = null;

  // ─── Ephemeral chat state ───────────────────────────────────────────────

  messages: CopilotMessage[] = [];
  /**
   * The unsent message.
   *
   * Lives here rather than in the panel because the dock, the fullscreen view
   * and the mobile overlay are separate mounts of the same panel: a local
   * useState would be thrown away the moment someone expanded the dock, losing
   * a half-typed question.
   */
  draft = "";
  /** The file staged for the next message, already base64-encoded. */
  attachment: (CopilotAttachment & { size: number }) | null = null;
  isStreaming = false;
  /**
   * What the copilot has done so far this turn, in order.
   *
   * Replaces a single "working…" line: an answer can take three or four tool
   * calls, and a spinner that says nothing for fifteen seconds reads as a hang.
   * Showing the steps tick off turns the wait into visible progress — and it is
   * honest, because each entry is a tool that actually ran.
   *
   * Transient by design: it is cleared when the turn ends, so the finished
   * conversation is the answer, not a log of how it was produced.
   */
  steps: CopilotStep[] = [];
  error: string | null = null;

  /** Recent conversations, newest first. Loaded when the list is opened. */
  conversations: CopilotConversationSummary[] = [];
  isHistoryOpen = false;
  isLoadingHistory = false;

  /**
   * One controller for the whole feature rather than one per component. The dock
   * and the fullscreen view are the same store, and a per-instance controller
   * would leave Stop wired to a stream a different instance started.
   */
  private controller: AbortController | null = null;

  /** Code of the last error event, for deciding whether a retry can help. */
  private lastErrorCode: CopilotErrorCode | null = null;

  // ─── Dock ────────────────────────────────────────────────────────────────

  open(): void {
    this.isOpen = true;
  }

  close(): void {
    this.isOpen = false;
    this.isExpanded = false;
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  setExpanded(expanded: boolean): void {
    this.isExpanded = expanded;
  }

  setWidth(width: number): void {
    this.width = Math.min(720, Math.max(320, Math.round(width)));
  }

  setDraft(draft: string): void {
    this.draft = draft;
  }

  reset(): void {
    this.cancel();
    // The list is about which conversation you are in, so starting a new one
    // answers it. Leaving it open makes the next click on the clock read as
    // "the button did nothing" when it in fact closed a list nobody could see.
    this.isHistoryOpen = false;
    this.conversationId = null;
    this.messages = [];
    this.draft = "";
    this.attachment = null;
    this.error = null;
  }

  // ─── Attaching ───────────────────────────────────────────────────────────

  /**
   * Stages a file for the next message.
   *
   * Read here rather than posted as multipart because the chat endpoint is one
   * SSE stream over a JSON body, and one encoded field is a smaller change than
   * a second transport. The size ceiling is the service's own — refusing here
   * saves a 4 MB upload that would only be refused there.
   */
  async attachFile(file: File): Promise<void> {
    if (file.size > MAX_FILE_BYTES) {
      runInAction(() => {
        this.error = `Файл больше ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} МБ — уменьшите его или выгрузите частями.`;
      });
      return;
    }
    const data = await readBase64(file);
    runInAction(() => {
      this.attachment = {
        name: file.name,
        mediaType: file.type || "application/octet-stream",
        data,
        size: file.size,
      };
      this.error = null;
    });
  }

  clearAttachment(): void {
    this.attachment = null;
  }

  // ─── History ─────────────────────────────────────────────────────────────

  /**
   * Opens the list and refreshes it.
   *
   * Refetched on every open rather than cached: the titles and their order come
   * from the service, and a list that silently lags behind the conversation you
   * just had is worse than a short wait.
   */
  async openHistory(): Promise<void> {
    this.isHistoryOpen = true;
    this.isLoadingHistory = true;
    const conversations = await fetchConversations();
    runInAction(() => {
      if (conversations) this.conversations = conversations;
      else this.error = "Не удалось загрузить историю диалогов.";
      this.isLoadingHistory = false;
    });
  }

  closeHistory(): void {
    this.isHistoryOpen = false;
  }

  toggleHistory(): void {
    if (this.isHistoryOpen) this.closeHistory();
    else void this.openHistory();
  }

  /** Replaces what is on screen with a stored conversation. */
  async openConversation(id: string): Promise<void> {
    this.cancel();
    const detail = await fetchConversation(id);
    runInAction(() => {
      this.isHistoryOpen = false;
      if (!detail) {
        // The service no longer knows it — a cleaned-up row, or someone else's
        // id in a stale localStorage. Start clean instead of failing forever.
        if (this.conversationId === id) this.conversationId = null;
        this.conversations = this.conversations.filter((c) => c.id !== id);
        return;
      }
      this.conversationId = detail.id;
      this.messages = detail.messages;
      this.draft = "";
      this.attachment = null;
      this.error = null;
    });
  }

  async removeConversation(id: string): Promise<void> {
    const ok = await deleteConversation(id);
    if (!ok) return;
    runInAction(() => {
      this.conversations = this.conversations.filter((c) => c.id !== id);
      // Deleting the conversation you are reading leaves the panel showing a
      // transcript that no longer exists anywhere.
      if (this.conversationId === id) {
        this.conversationId = null;
        this.messages = [];
      }
    });
  }

  // ─── Sending ─────────────────────────────────────────────────────────────

  async send(text: string, route?: string | null): Promise<void> {
    const message = text.trim();
    // A file on its own is a complete request: "вот они" with a spreadsheet
    // attached says everything the model needs.
    if ((!message && !this.attachment) || this.isStreaming) return;

    const attachment = this.attachment;
    this.draft = "";
    this.attachment = null;

    this.push({
      id: `local-${Date.now()}`,
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
      status: "complete",
      ...(attachment
        ? { file: { name: attachment.name, size: attachment.size } }
        : {}),
    });

    await this.deliver(message, route, attachment);

    // The conversation id is persisted, so a server that no longer knows it —
    // after a restart, or once an old conversation is cleaned up — would
    // otherwise fail every future message too, with no way out but "Новый".
    // It is a recoverable state, so recover from it instead of reporting it.
    if (this.lastErrorCode === "not_found" && this.conversationId) {
      runInAction(() => {
        this.conversationId = null;
        this.error = null;
      });
      await this.deliver(message, route, attachment);
    }
  }

  private deliver(
    message: string,
    route?: string | null,
    attachment?: (CopilotAttachment & { size: number }) | null,
  ): Promise<void> {
    return this.run((onEvent, signal) =>
      streamChat(
        {
          conversationId: this.conversationId,
          // The service takes either, but not neither — an empty string here
          // would fail validation instead of meaning "just the file".
          ...(message ? { message } : {}),
          ...(attachment
            ? {
                attachment: {
                  name: attachment.name,
                  mediaType: attachment.mediaType,
                  data: attachment.data,
                },
              }
            : {}),
          context: { route },
        },
        onEvent,
        signal,
      ),
    );
  }

  async confirm(actionId: string, decision: "approve" | "reject"): Promise<void> {
    if (!this.conversationId || this.isStreaming) return;

    // Reflect the decision immediately: the round trip runs a real action, and
    // a card that still says "Approve?" invites a second click.
    this.updateAction(actionId, {
      state: decision === "approve" ? "approved" : "rejected",
    });

    await this.run((onEvent, signal) =>
      streamConfirm(
        { conversationId: this.conversationId!, actionId, decision },
        onEvent,
        signal,
      ),
    );
  }

  cancel(): void {
    this.controller?.abort();
    this.controller = null;
    this.isStreaming = false;
    this.steps = [];
    this.finishLastMessage();
  }

  private async run(
    start: (
      onEvent: (event: CopilotStreamEvent) => void,
      signal: AbortSignal,
    ) => Promise<void>,
  ): Promise<void> {
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    this.isStreaming = true;
    this.error = null;
    this.lastErrorCode = null;
    this.steps = [];

    try {
      await start((event) => runInAction(() => this.apply(event)), controller.signal);
    } catch {
      if (!controller.signal.aborted) {
        runInAction(() => {
          this.error = "Соединение с AI чатом прервалось.";
        });
      }
    } finally {
      runInAction(() => {
        // Only the run that still owns the controller may clear these. An
        // aborted run's finally lands while its replacement is mid-stream, and
        // clearing the flags there killed the live run's thinking trace, marked
        // its message complete, and reopened the isStreaming guard that stops a
        // third request being fired into the same message list.
        if (this.controller !== controller) return;
        this.controller = null;
        this.isStreaming = false;
        this.steps = [];
        this.finishLastMessage();
      });
    }
  }

  /** Closes the bubble still marked as streaming, whoever stopped it. */
  private finishLastMessage(): void {
    const last = this.messages[this.messages.length - 1];
    if (last?.role === "assistant" && last.status === "streaming") {
      last.status = "complete";
    }
  }

  // ─── Event handling ──────────────────────────────────────────────────────

  private apply(event: CopilotStreamEvent): void {
    switch (event.type) {
      case "message_start":
        this.conversationId = event.conversationId;
        this.push({
          id: event.messageId,
          role: "assistant",
          content: "",
          createdAt: new Date().toISOString(),
          status: "streaming",
        });
        return;

      case "text_delta":
        this.assistant().content += event.text;
        return;

      case "tool_call":
        // The previous step is finished the moment the next one starts — the
        // loop runs one tool at a time.
        this.steps = [
          ...this.steps.map((step) => ({ ...step, done: true })),
          { id: event.toolUseId, tool: event.toolName, done: false },
        ];
        return;

      case "chart":
        this.attach((m) => {
          m.charts = [...(m.charts ?? []), event.chart];
        });
        return;

      case "table":
        this.attach((m) => {
          m.tables = [...(m.tables ?? []), event.table];
        });
        return;

      case "kpis":
        this.attach((m) => {
          m.kpis = event.kpis;
        });
        return;

      case "link":
        this.attach((m) => {
          m.links = [...(m.links ?? []), event.link];
        });
        return;

      case "action_proposed":
        this.attach((m) => {
          m.actions = [
            ...(m.actions ?? []),
            { ...event.action, state: "proposed" as const },
          ];
        });
        return;

      case "action_executed": {
        // The copilot just changed a record the page behind it is showing. The
        // whole cache goes stale rather than a mapped-out list of keys: the
        // event says which tool ran, not which table, and a table→queryKey map
        // maintained over here would be wrong the first time someone adds a
        // page and forgets it. Only active queries refetch, and this only fires
        // on a write a person approved a second ago.
        if (event.action.ok) void queryClient.invalidateQueries();

        const existing = this.findAction(event.action.actionId);
        if (existing) {
          existing.state = event.action.ok ? "executed" : "failed";
          existing.summary = event.action.summary;
          existing.error = event.action.error;
          return;
        }
        this.attach((m) => {
          m.actions = [
            ...(m.actions ?? []),
            {
              actionId: event.action.actionId,
              toolName: event.action.toolName,
              title: event.action.summary,
              description: "",
              risk: "write",
              state: event.action.ok ? "executed" : "failed",
              summary: event.action.summary,
              error: event.action.error,
            },
          ];
        });
        return;
      }

      case "message_complete": {
        const message = this.messages.find((m) => m.id === event.messageId);
        if (message) {
          message.status = "complete";
          message.truncated = event.stopReason === "max_tokens";
        }
        // Running out of tool turns ends the stream with nothing written: no
        // answer, no error, a panel that simply stopped. Say it, or the person
        // is left guessing whether it is still thinking.
        if (event.stopReason === "max_turns" && !message?.content) {
          this.error =
            "AI чат не смог собрать ответ за отведённые шаги. Переспросите или сузьте вопрос.";
        }
        this.steps = this.steps.map((step) => ({ ...step, done: true }));
        return;
      }

      case "error":
        this.error =
          (event.code && ERROR_TEXT[event.code]) || event.message;
        this.lastErrorCode = event.code ?? null;
        this.steps = [];
        return;

      case "usage":
        return;
    }
  }

  private push(message: CopilotMessage): void {
    this.messages = [...this.messages, message];
  }

  /** The assistant message currently being written into. */
  private assistant(): CopilotMessage {
    const last = this.messages[this.messages.length - 1];
    if (last?.role === "assistant") return last;
    const created: CopilotMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
      status: "streaming",
    };
    this.push(created);
    return this.messages[this.messages.length - 1];
  }

  /**
   * Attaches an artifact to the current assistant message.
   *
   * A confirmed action's artifacts arrive after that turn's message already
   * finished, so a completed bubble gets a fresh one rather than being reopened
   * — otherwise a chart would appear under text written before it existed.
   */
  private attach(mutate: (message: CopilotMessage) => void): void {
    const last = this.messages[this.messages.length - 1];
    if (last?.role === "assistant" && last.status === "streaming") {
      mutate(last);
      return;
    }
    const created: CopilotMessage = {
      id: `artifact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
      status: "complete",
    };
    mutate(created);
    this.push(created);
  }

  private findAction(actionId: string): CopilotMessageAction | undefined {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const found = this.messages[i].actions?.find((a) => a.actionId === actionId);
      if (found) return found;
    }
    return undefined;
  }

  private updateAction(
    actionId: string,
    patch: Partial<CopilotMessageAction>,
  ): void {
    const action = this.findAction(actionId);
    if (action) Object.assign(action, patch);
  }
}

/** base64 of a file, without the data: prefix FileReader puts in front of it. */
const readBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () =>
      resolve(String(reader.result ?? "").split(",", 2)[1] ?? "");
    reader.readAsDataURL(file);
  });

const copilotStore = new CopilotStore();

export default copilotStore;
