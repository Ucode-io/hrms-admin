import { useCallback, useEffect, useRef } from "react";
import { observer } from "mobx-react-lite";
import copilotStore from "../model/copilot.store";
import CopilotPanel from "./CopilotPanel";

/**
 * The dock.
 *
 * Three surfaces render the same panel: a docked column, a fullscreen view and a
 * mobile overlay. They are separate mounts, so anything that must survive
 * switching between them — the transcript, the draft, the in-flight stream —
 * lives in the store rather than in the panel's own state.
 */
const CopilotDock: React.FC = observer(() => {
  const dragging = useRef(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent): void => {
      if (!dragging.current) return;
      // The dock is pinned right, so the width is the distance from the cursor
      // to the right edge.
      copilotStore.setWidth(window.innerWidth - e.clientX);
    };
    const onUp = (): void => {
      dragging.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // Escape steps back one layer — history, then fullscreen — rather than
  // closing outright: losing the whole panel on a stray keypress is worse than
  // one extra press.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      if (copilotStore.isHistoryOpen) copilotStore.closeHistory();
      else if (copilotStore.isExpanded) copilotStore.setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!copilotStore.isOpen) return null;

  if (copilotStore.isExpanded) {
    return (
      <div className="fixed inset-0 z-[60] bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto h-full max-w-3xl">
          <CopilotPanel />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Mobile: an overlay, because there is no room to shrink anything. */}
      <div className="fixed inset-0 z-[60] xl:hidden">
        <CopilotPanel />
      </div>

      {/* Desktop: a real column that shrinks the page rather than covering it,
          so the person can keep reading what they asked about. */}
      {/* sticky + h-screen, not h-full: the aside is a flex item of a
          min-h-screen container, so stretching would make it as tall as the
          whole scrolling page and push the composer far below the fold. */}
      <aside
        className="relative z-50 hidden h-screen shrink-0 self-start border-l border-gray-200 bg-gray-50 xl:sticky xl:top-0 xl:block dark:border-gray-800 dark:bg-gray-900"
        style={{ width: copilotStore.width }}
      >
        <div
          role="separator"
          aria-orientation="vertical"
          onMouseDown={onMouseDown}
          className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-brand-300"
        />
        <div className="h-full">
          <CopilotPanel />
        </div>
      </aside>
    </>
  );
});

export default CopilotDock;
