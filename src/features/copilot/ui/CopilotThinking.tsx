import { Check, Loader2 } from "lucide-react";
import { observer } from "mobx-react-lite";
import type { CopilotStep } from "../model/copilot.store";

/**
 * What each tool is doing, in the first person, in the user's language.
 *
 * Tool names are an implementation detail — "aggregate_items" tells a person
 * nothing. These are deliberately about the work, not the mechanism.
 */
const TOOL_LABEL: Record<string, string> = {
  list_tables: "смотрю, какие есть данные",
  describe_table: "уточняю структуру таблицы",
  list_items: "выбираю записи",
  aggregate_items: "считаю по группам",
  run_report: "собираю отчёт",
  create_item: "готовлю создание записи",
  update_item: "готовлю изменение",
  delete_item: "готовлю удаление",
  open_page: "ищу нужную страницу",
};

const label = (tool: string): string => TOOL_LABEL[tool] ?? "работаю";

/**
 * The waiting state.
 *
 * Before any tool runs there is nothing truthful to name, so it says it is
 * thinking. Once tools start, each one is listed and ticked off as the next
 * begins — the wait becomes visible progress instead of an unexplained pause,
 * and every line corresponds to something that actually happened.
 */
const CopilotThinking: React.FC<{ steps: CopilotStep[] }> = observer(
  ({ steps }) => {
    if (steps.length === 0) {
      return (
        <div className="copilot-enter flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <span className="copilot-shimmer font-medium">Копилот думает</span>
          <span className="flex items-center gap-1 text-gray-400">
            <i className="copilot-dot" />
            <i className="copilot-dot" />
            <i className="copilot-dot" />
          </span>
        </div>
      );
    }

    return (
      <div className="copilot-enter space-y-1.5">
        {steps.map((step) => (
          <div
            key={step.id}
            className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400"
          >
            {step.done ? (
              <Check
                size={14}
                className="copilot-step-done shrink-0 text-success-500"
              />
            ) : (
              <Loader2 size={14} className="shrink-0 animate-spin text-gray-400" />
            )}
            {step.done ? (
              <span>{label(step.tool)}</span>
            ) : (
              <span className="copilot-shimmer font-medium">
                {label(step.tool)}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  },
);

export default CopilotThinking;
