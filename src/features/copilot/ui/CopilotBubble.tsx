import { useMemo } from "react";
import { Paperclip } from "lucide-react";
import { FilePreviewButton } from "../../../modules/Documents/components/DocumentPreviewModal";
import { useSmoothText } from "../model/useSmoothText";
import type { CopilotMessage } from "../types";

/**
 * Minimal markdown for assistant replies.
 *
 * ponytail: covers bullets, numbered lists, bold and inline code, which is
 * everything the Copilot's system prompt actually asks it to produce. Swap in a
 * real markdown renderer if replies ever need tables or links inline — the
 * dependency isn't worth it for four constructs.
 */
const renderInline = (text: string, keyPrefix: string): React.ReactNode[] =>
  text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={key}
          className="rounded bg-gray-100 px-1 py-0.5 text-[0.85em] dark:bg-white/10"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={key}>{part}</span>;
  });

const renderBlocks = (content: string): React.ReactNode[] => {
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flush = (): void => {
    if (bullets.length === 0) return;
    const items = bullets;
    bullets = [];
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="list-disc space-y-0.5 pl-4">
        {items.map((item, i) => (
          <li key={i}>{renderInline(item, `li-${blocks.length}-${i}`)}</li>
        ))}
      </ul>,
    );
  };

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trimEnd();
    const bullet = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)$/);
    if (bullet) {
      bullets.push(bullet[1]);
      continue;
    }
    flush();
    if (line.trim().length === 0) continue;
    blocks.push(
      <p key={`p-${blocks.length}`}>{renderInline(line, `p-${blocks.length}`)}</p>,
    );
  }
  flush();
  return blocks;
};

const CopilotBubble: React.FC<{ message: CopilotMessage }> = ({ message }) => {
  const streaming = message.status === "streaming";
  // Tokens land in bursts; this drains them at a steady pace so the text reads
  // as writing rather than as a stuttering connection.
  const visible = useSmoothText(message.content, streaming);
  const blocks = useMemo(() => renderBlocks(visible), [visible]);

  if (message.role === "user") {
    return (
      <div className="copilot-enter flex justify-end">
        <div className="max-w-[85%] space-y-1 rounded-2xl rounded-br-sm bg-brand-500 px-3 py-2 text-sm text-white shadow-theme-xs">
          {/* The file is part of what was said, so it stays with the message
              rather than appearing as a separate event above it. */}
          {message.file && (
            <div className="flex items-center gap-1.5 text-xs text-white/90">
              <Paperclip size={12} className="shrink-0" />
              <span className="truncate">{message.file.name}</span>
              {message.file.url && (
                <FilePreviewButton
                  fileUrl={message.file.url}
                  fileName={message.file.name}
                  size={13}
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-white/80 transition hover:bg-white/20 hover:text-white"
                />
              )}
            </div>
          )}
          {message.content && (
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}
        </div>
      </div>
    );
  }

  // Nothing revealed yet: the thinking indicator is already saying the copilot
  // is working, so an empty bubble would just push it around.
  if (visible.trim().length === 0) return null;

  return (
    <div className="copilot-enter space-y-2 text-sm leading-relaxed text-gray-700 dark:text-gray-200">
      {blocks}
      {streaming && <span className="copilot-caret" aria-hidden />}
      {message.truncated && (
        <p className="text-xs text-warning-600 dark:text-warning-400">
          Ответ обрезан по лимиту длины — попросите продолжить.
        </p>
      )}
    </div>
  );
};

export default CopilotBubble;
