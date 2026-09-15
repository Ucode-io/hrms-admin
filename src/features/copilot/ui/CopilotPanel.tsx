import { useCallback, useEffect, useRef } from "react";
import { observer } from "mobx-react-lite";
import { useLocation } from "react-router";
import {
  ArrowUp,
  History,
  Maximize2,
  Minimize2,
  Paperclip,
  Plus,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import { FilePreviewButton } from "../../../modules/Documents/components/DocumentPreviewModal";
import companyStore from "../../../store/company.store";
import copilotStore from "../model/copilot.store";
import CopilotBubble from "./CopilotBubble";
import CopilotChartView from "./CopilotChart";
import CopilotTableView from "./CopilotTable";
import CopilotKpis from "./CopilotKpis";
import CopilotLinkButton from "./CopilotLinkButton";
import CopilotActionCard from "./CopilotActionCard";
import CopilotThinking from "./CopilotThinking";
import CopilotHistory from "./CopilotHistory";
import "./copilot.css";

const SUGGESTIONS = [
  "Дай сотрудников младше 22 и старше 19 лет",
  "Дай статистику посещаемости за прошлый месяц",
  "Сколько сотрудников по отделам?",
];

/** What the service can actually read; anything else comes back as "not supported". */
const ACCEPT = ".xlsx,.xlsm,.csv,.tsv,.txt,.md,.json,.pdf,.png,.jpg,.jpeg,.webp,.gif";

/** One builder rather than two class constants: an `active ? "text-brand-600"`
 *  tacked onto a string that already says `text-gray-500` is a coin flip —
 *  which one wins is stylesheet order, not the order they appear here. */
const iconButton = (active = false): string =>
  `inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
    active
      ? "bg-brand-50 text-brand-600 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-300"
      : "text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/[0.05]"
  }`;

const CopilotPanel: React.FC = observer(() => {
  const location = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { messages, isStreaming, steps, error, draft, attachment } =
    copilotStore;

  /**
   * Whether the view is following the tail.
   *
   * Scrolling back to re-read something and being yanked to the bottom on every
   * token is the fastest way to make a streaming panel unusable, so following
   * stops the moment the person scrolls away and resumes when they come back.
   */
  const pinned = useRef(true);

  const onScroll = useCallback((): void => {
    const el = scrollRef.current;
    if (!el) return;
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }, []);

  useEffect(() => {
    if (!pinned.current) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [
    messages.length,
    messages[messages.length - 1]?.content,
    steps.length,
    isStreaming,
  ]);

  const resize = useCallback((): void => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  useEffect(resize, [draft, resize]);

  const submit = (text: string): void => {
    if ((!text.trim() && !copilotStore.attachment) || isStreaming) return;
    void copilotStore.send(text, location.pathname);
  };

  return (
    <div className="flex h-full flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header. h-16 + border-b mirrors AppHeader so the two line up across
          the seam; the hint that used to live here moved into the empty state,
          which is where someone with nothing to read actually looks. */}
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-900">
        {/* Same mark as the button in the app header that opens this panel, so
            the two read as one thing. */}
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
          <Sparkles size={16} />
        </span>
        {/* The title says which of the two views you are looking at: the
            history list covers the transcript and used to announce itself with
            a second header row and a second ✕ right under this one. */}
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800 dark:text-white/90">
          {copilotStore.isHistoryOpen ? "История" : "AI чат"}
        </h2>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => copilotStore.toggleHistory()}
            title={
              copilotStore.isHistoryOpen
                ? "Закрыть историю"
                : "История диалогов"
            }
            aria-label="История диалогов"
            aria-pressed={copilotStore.isHistoryOpen}
            className={iconButton(copilotStore.isHistoryOpen)}
          >
            <History size={17} />
          </button>
          <button
            type="button"
            onClick={() => copilotStore.reset()}
            title="Новый диалог"
            aria-label="Новый диалог"
            className={iconButton()}
          >
            <Plus size={18} />
          </button>
          <button
            type="button"
            onClick={() => copilotStore.setExpanded(!copilotStore.isExpanded)}
            title={copilotStore.isExpanded ? "Свернуть" : "Развернуть"}
            aria-label={copilotStore.isExpanded ? "Свернуть" : "Развернуть"}
            className={iconButton()}
          >
            {copilotStore.isExpanded ? (
              <Minimize2 size={17} />
            ) : (
              <Maximize2 size={17} />
            )}
          </button>
          <button
            type="button"
            onClick={() => copilotStore.close()}
            title="Закрыть"
            aria-label="Закрыть"
            className={iconButton()}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Messages. `relative` so the history list can cover them: at 320px
          there is no room for a sidebar beside the transcript. */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        {copilotStore.isHistoryOpen && <CopilotHistory />}
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4"
        >
          {messages.length === 0 && (
            <div className="space-y-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Спросите про сотрудников, посещаемость и отчёты — или прикрепите
                файл со списком, чтобы загрузить его. Например:
              </p>
              {SUGGESTIONS.map((suggestion, i) => (
                <button
                  key={suggestion}
                  type="button"
                  style={{ animationDelay: `${60 + i * 70}ms` }}
                  onClick={() => submit(suggestion)}
                  className="copilot-enter block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm text-gray-600 transition-all hover:-translate-y-px hover:border-brand-300 hover:bg-brand-50 hover:shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.06]"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {messages.map((message, index) => {
            const isLast = index === messages.length - 1;
            return (
              <div key={message.id} className="space-y-2">
                <CopilotBubble message={message} />

                {message.kpis && (
                  <div className="copilot-artifact-enter">
                    <CopilotKpis kpis={message.kpis} />
                  </div>
                )}

                {message.tables?.map((table) => (
                  <div key={table.id} className="copilot-artifact-enter">
                    <CopilotTableView table={table} />
                  </div>
                ))}

                {message.charts?.map((chart) => (
                  <div key={chart.id} className="copilot-artifact-enter">
                    <CopilotChartView chart={chart} />
                  </div>
                ))}

                {message.actions?.map((action) => (
                  <CopilotActionCard
                    key={action.actionId}
                    action={action}
                    disabled={isStreaming}
                    onApprove={(id) => void copilotStore.confirm(id, "approve")}
                    onReject={(id) => void copilotStore.confirm(id, "reject")}
                  />
                ))}

                {/* Links point at where to continue, so they only make sense on
                    the newest message — an old one would send the person back.
                    A file is the exception: it was handed over, not pointed at,
                    and it stays downloadable however far up the thread it is. */}
                {message.links
                  ?.filter((link) => isLast || link.kind === "file")
                  .map((link) => (
                    <div key={link.id} className="copilot-artifact-enter flex items-center gap-1.5">
                      <div className="min-w-0 flex-1">
                        <CopilotLinkButton link={link} />
                      </div>
                      {link.kind === "file" && (
                        <FilePreviewButton
                          fileUrl={link.href}
                          fileName={link.label}
                          size={16}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand-200 text-brand-600 transition hover:bg-brand-50 dark:border-brand-500/30 dark:text-brand-400"
                        />
                      )}
                    </div>
                  ))}
              </div>
            );
          })}

          {isStreaming && <CopilotThinking steps={steps} />}

          {error && (
            <p className="copilot-enter rounded-lg bg-error-50 px-3 py-2 text-xs text-error-600 dark:bg-error-500/10 dark:text-error-400">
              {error}
            </p>
          )}
        </div>
      </div>

      {/* Composer.
          An island rather than a bar with a rule above it: a hard border across
          the panel cuts the conversation in two, while a soft fade lets the last
          message run under the edge and keeps the eye on the thread. The card
          borrows the app's own field styling — same radius, same focus ring — so
          it reads as part of the product and not as a chat widget bolted on. */}
      <div className="shrink-0 px-3 pb-3 pt-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-md transition-colors focus-within:border-brand-300 focus-within:ring-3 focus-within:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900">
          {attachment && (
            <div className="mb-2 flex items-center gap-2 rounded-lg bg-gray-100 px-2 py-1.5 text-xs text-gray-700 dark:bg-white/[0.06] dark:text-gray-200">
              <Paperclip size={13} className="shrink-0" />
              <span className="truncate">{attachment.name}</span>
              <span className="shrink-0 text-gray-400">
                {Math.max(1, Math.round(attachment.size / 1024))} КБ
              </span>
              <FilePreviewButton
                fileUrl={attachment.url}
                fileName={attachment.name}
                size={14}
                className="ml-auto inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-400 transition hover:text-gray-600 dark:hover:text-gray-200"
              />
              <button
                type="button"
                onClick={() => copilotStore.clearAttachment()}
                title="Убрать файл"
                aria-label="Убрать файл"
                className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <div className="flex items-end gap-2">
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void copilotStore.attachFile(file);
                // Cleared so picking the same file twice still fires onChange.
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={isStreaming}
              title="Прикрепить файл"
              aria-label="Прикрепить файл"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40 dark:hover:bg-white/[0.05] dark:hover:text-gray-200"
            >
              <Paperclip size={16} />
            </button>
            <textarea
              ref={inputRef}
              rows={1}
              value={draft}
              onChange={(e) => copilotStore.setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit(draft);
                }
              }}
              placeholder="Спросите про данные HRMS…"
              className="max-h-40 flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-sm leading-relaxed text-gray-800 outline-none placeholder:text-gray-400 dark:text-white/90 dark:placeholder:text-white/30"
            />
            {isStreaming ? (
              <button
                type="button"
                onClick={() => copilotStore.cancel()}
                title="Остановить"
                aria-label="Остановить"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/[0.05]"
              >
                <Square size={14} fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => submit(draft)}
                disabled={!draft.trim() && !attachment}
                title="Отправить"
                aria-label="Отправить"
                // The company's own brand colour, the same one the primary
                // actions across HRMS already use — a hardcoded blue would be the
                // one button in the app that ignores the tenant's palette.
                style={{ backgroundColor: companyStore.mainColor }}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white transition-opacity hover:opacity-90 disabled:opacity-30"
              >
                <ArrowUp size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default CopilotPanel;
