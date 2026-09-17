/**
 * Урезанный проектор Thread'а копилота в реплики, которые видит админ.
 *
 * В `copilot_conversations.thread` лежит сырьё Anthropic: thinking-блоки,
 * tool_use с инпутами и tool_result, завёрнутые в баннер «untrusted data».
 * Рисовать это как есть нельзя — тул-аутпут с баннером не должен выглядеть как
 * текст ассистента.
 *
 * Полный рендер (чипы действий со статусом, артефакты, чарты, deep-links) живёт
 * в udevs_hrms_copilot/src/copilot/replay.ts и сюда сознательно НЕ переносится.
 *
 * ponytail: берём только text-блоки, tool_use схлопываем в одну служебную
 * строку, thinking и tool_result выбрасываем целиком, колонку artifacts
 * игнорируем. Понадобятся чарты в readonly-просмотре — тогда и порт replay.ts.
 */

export type ChatMessageRole = "user" | "assistant" | "tool";

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  /** Для роли `tool` — имя инструмента, не текст. */
  text: string;
}

interface ThreadEntry {
  role?: unknown;
  content?: unknown;
}

interface Block {
  type?: unknown;
  text?: unknown;
  name?: unknown;
}

const safeParse = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/** ucode отдаёт jsonb то строкой, то уже разобранным значением. */
export const parseThread = (raw: unknown): ThreadEntry[] => {
  const value = typeof raw === "string" ? safeParse(raw) : raw;
  return Array.isArray(value) ? (value as ThreadEntry[]) : [];
};

const blocksOf = (content: unknown): Block[] => {
  if (typeof content === "string") return [{ type: "text", text: content }];
  if (!Array.isArray(content)) return [];
  return content.filter(
    (block): block is Block => typeof block === "object" && block !== null
  );
};

const textOf = (blocks: Block[]): string =>
  blocks
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => (block.text as string).trim())
    .filter((text) => text !== "")
    .join("\n\n");

export const projectThread = (raw: unknown, idPrefix = ""): ChatMessage[] => {
  const messages: ChatMessage[] = [];

  parseThread(raw).forEach((entry, index) => {
    const blocks = blocksOf(entry.content);

    // Сообщение с tool_result — это модель разговаривает сама с собой. Роль у
    // него `user`, но человек его не писал; блоки, едущие рядом (документ,
    // картинка, которые API принимает только здесь), — тоже её.
    if (blocks.some((block) => block.type === "tool_result")) return;

    const assistant = entry.role === "assistant";
    const text = textOf(blocks);
    if (text !== "") {
      messages.push({
        id: `${idPrefix}${index}`,
        role: assistant ? "assistant" : "user",
        text,
      });
    }

    if (!assistant) return;
    blocks
      .filter((block) => block.type === "tool_use")
      .forEach((block, toolIndex) => {
        messages.push({
          id: `${idPrefix}${index}-t${toolIndex}`,
          role: "tool",
          text: typeof block.name === "string" ? block.name : "инструмент",
        });
      });
  });

  return messages;
};

/** Последняя реплика человека или копилота — для превью в списке слева. */
export const lastSaid = (messages: ChatMessage[]): string => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role !== "tool") return messages[i].text;
  }
  return "";
};
