import type { CopilotMessageAction } from "../types";

/**
 * The confirmation card, and afterwards the result chip for the same action.
 *
 * Nothing the Copilot writes happens without one of these. The before/after list
 * is the point of the card: approving "update this employee" means nothing
 * unless you can see which field moved and to what.
 */
const CopilotActionCard: React.FC<{
  action: CopilotMessageAction;
  disabled?: boolean;
  onApprove: (actionId: string) => void;
  onReject: (actionId: string) => void;
}> = ({ action, disabled, onApprove, onReject }) => {
  if (action.state !== "proposed") {
    const failed = action.state === "failed";
    const rejected = action.state === "rejected";
    // "approved" is set the moment the button is clicked, before the server has
    // run anything. Reading it as success put a green ✓ on a deletion that had
    // not happened — and left it there for good if the stream dropped before
    // the result came back. In flight is its own state and looks like one.
    const running = action.state === "approved";

    return (
      <div
        className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
          failed
            ? "border-error-200 bg-error-50 text-error-600 dark:border-error-500/30 dark:bg-error-500/10"
            : rejected
              ? "border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400"
              : running
                ? "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300"
                : "border-success-200 bg-success-50 text-success-600 dark:border-success-500/30 dark:bg-success-500/10"
        }`}
      >
        <span className={running ? "animate-pulse" : undefined}>
          {failed ? "✕" : rejected ? "—" : running ? "⏳" : "✓"}
        </span>
        <span>
          {running
            ? action.title
            : (action.error ?? action.summary ?? action.title)}
        </span>
      </div>
    );
  }

  // Every write carries `risk: "destructive"` — it means "needs a person to
  // approve", not "destroys something". Colouring by it painted a card that
  // adds three employees in the same red as one that erases someone, and a
  // warning that fires every time stops being read. Red is for the action that
  // cannot be undone.
  const removes = action.toolName.startsWith("delete");

  return (
    <div
      className={`rounded-xl border p-3 ${
        removes
          ? "border-error-200 bg-error-50 dark:border-error-500/30 dark:bg-error-500/10"
          : "border-brand-200 bg-brand-50 dark:border-brand-500/30 dark:bg-brand-500/10"
      }`}
    >
      <p className="text-sm font-medium text-gray-800 dark:text-white/90">
        {action.title}
      </p>
      {action.description && (
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
          {action.description}
        </p>
      )}

      {action.changes && action.changes.length > 0 && (
        <dl className="mt-2 space-y-1">
          {action.changes.map((change) => (
            <div key={change.field} className="flex flex-wrap items-baseline gap-1 text-xs">
              <dt className="text-gray-500 dark:text-gray-400">
                {change.label ?? change.field}:
              </dt>
              <dd className="text-gray-700 dark:text-gray-200">
                {change.before !== null && (
                  <>
                    <span className="line-through opacity-60">{change.before}</span>
                    <span className="mx-1">→</span>
                  </>
                )}
                <span className="font-medium">{change.after ?? "—"}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onApprove(action.actionId)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 ${
            removes
              ? "bg-error-500 hover:bg-error-600"
              : "bg-brand-500 hover:bg-brand-600"
          }`}
        >
          Подтвердить
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onReject(action.actionId)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
        >
          Отменить
        </button>
      </div>
    </div>
  );
};

export default CopilotActionCard;
