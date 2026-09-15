import { useMemo } from "react";
import { Link } from "react-router";
import { Paperclip } from "lucide-react";
import { useSmoothText } from "../model/useSmoothText";
import type { CopilotMessage } from "../types";

/**
 * Minimal markdown for assistant replies.
 *
 * ponytail: covers bullets, numbered lists, bold, inline code and links, which
 * is everything the Copilot's system prompt actually asks it to produce. Swap
 * in a real markdown renderer if replies ever need tables — the dependency
 * isn't worth it for five constructs.
 */
/**
 * `kb:<guid>` is how the Copilot names an article it is citing — not a path,
 * because the mini-app files the same article under a different route and the
 * model should not be the place that knows which client is reading.
 */
const hrefFor = (target: string): string =>
  target.startsWith("kb:")
    ? `/knowledge-base/articles/${encodeURIComponent(target.slice(3))}`
    : target;

const renderInline = (text: string, keyPrefix: string): React.ReactNode[] =>
  text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    // Recurses: the Copilot writes **[Аллерайз](kb:…)** often enough, and the
    // bold alternative wins the split, so a link inside one would otherwise be
    // printed as its own brackets and guid. The inner text cannot contain `**`
    // — the pattern that captured it forbids it — so this cannot run away.
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={key}>{renderInline(part.slice(2, -2), key)}</strong>;
    }
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      const href = hrefFor(link[2]);
      // Anything absolute leaves the panel; everything else is a route inside
      // it, and a full page load would throw away the conversation.
      return /^https?:\/\//.test(href) ? (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-brand-600 underline underline-offset-2 hover:text-brand-700 dark:text-brand-400"
        >
          {renderInline(link[1], key)}
        </a>
      ) : (
        <Link
          key={key}
          to={href}
          className="font-medium text-brand-600 underline underline-offset-2 hover:text-brand-700 dark:text-brand-400"
        >
          {renderInline(link[1], key)}
        </Link>
      );
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
