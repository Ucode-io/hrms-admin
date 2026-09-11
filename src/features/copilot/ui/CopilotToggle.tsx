import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { Sparkles } from "lucide-react";
import copilotStore from "../model/copilot.store";

/**
 * Opens and closes the dock, and owns the Cmd/Ctrl+K shortcut.
 *
 * Lives in the app header rather than floating over the page: a FAB sits on top
 * of whatever the person is reading, and the header is where every other global
 * action in this app already is.
 */
const CopilotToggle: React.FC = observer(() => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        copilotStore.toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isOpen = copilotStore.isOpen;

  return (
    <button
      type="button"
      onClick={() => copilotStore.toggle()}
      aria-pressed={isOpen}
      title="Копилот (⌘/Ctrl + K)"
      aria-label="Копилот"
      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border shadow-sm transition-colors ${
        isOpen
          ? "border-brand-200 bg-brand-50 text-brand-600 hover:bg-brand-100"
          : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700"
      }`}
    >
      <Sparkles size={18} />
    </button>
  );
});

export default CopilotToggle;
