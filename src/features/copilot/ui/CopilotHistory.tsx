import { useState } from "react";
import { observer } from "mobx-react-lite";
import { Trash2 } from "lucide-react";
import copilotStore from "../model/copilot.store";

/**
 * The session list, over the transcript rather than beside it.
 *
 * The dock is 320–720px wide, so a permanent sidebar would eat half of it at
 * the narrow end; an overlay is one layout that works at both, and in the
 * fullscreen view too.
 */
const CopilotHistory: React.FC = observer(() => {
  const { conversations, isLoadingHistory, conversationId } = copilotStore;
  /** Which row asked to be deleted — a mis-tap should not drop a transcript. */
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    // No header of its own: the panel header already names this view and its
    // clock button is the way back, so a second title row with a second ✕
    // directly under the first only asked which one closed what.
    <div className="absolute inset-0 z-10 flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="flex-1 overflow-y-auto p-2">
        {isLoadingHistory && conversations.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-gray-400">Загружаю…</p>
        )}

        {!isLoadingHistory && conversations.length === 0 && (
          <p className="px-4 py-6 text-center text-xs text-gray-400 dark:text-gray-500">
            Прошлых диалогов пока нет. Они появятся здесь после первого вопроса.
          </p>
        )}

        {conversations.map((conversation) => {
          const isCurrent = conversation.id === conversationId;
          const isConfirming = confirming === conversation.id;
          return (
            <div
              key={conversation.id}
              className={`group flex items-center gap-1 rounded-lg px-1 ${
                isCurrent ? "bg-brand-50 dark:bg-brand-500/10" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => void copilotStore.openConversation(conversation.id)}
                className="min-w-0 flex-1 rounded-lg px-2 py-2 text-left transition-colors hover:bg-gray-100 dark:hover:bg-white/[0.05]"
              >
                <span className="block truncate text-sm text-gray-700 dark:text-gray-200">
                  {conversation.title ?? "Без названия"}
                </span>
                <span className="block text-[11px] text-gray-400 dark:text-gray-500">
                  {when(conversation.updatedAt)}
                </span>
              </button>

              {isConfirming ? (
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(null);
                    void copilotStore.removeConversation(conversation.id);
                  }}
                  onBlur={() => setConfirming(null)}
                  autoFocus
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-error-600 hover:bg-error-50 dark:hover:bg-error-500/10"
                >
                  Удалить?
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(conversation.id)}
                  title="Удалить диалог"
                  aria-label="Удалить диалог"
                  className="shrink-0 rounded-lg p-2 text-gray-400 opacity-0 transition-opacity hover:text-error-500 focus:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

/** Today is a time, anything older is a date — the year is never the question. */
const when = (iso: string): string => {
  const date = new Date(iso);
  const isToday = date.toDateString() === new Date().toDateString();
  return isToday
    ? date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
};

export default CopilotHistory;
