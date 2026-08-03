import { useEffect, type ReactNode } from "react";
import {
  FloatingFocusManager,
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  size,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
  type Placement,
} from "@floating-ui/react";

interface TriggerArgs {
  ref: (node: HTMLElement | null) => void;
  open: boolean;
  /** Spread onto the trigger element. */
  props: Record<string, unknown>;
}

interface PopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placement?: Placement;
  /** Panel width in px, or `"trigger"` to match the trigger. */
  width?: number | "trigger";
  children: (args: TriggerArgs) => ReactNode;
  content: (args: { close: () => void }) => ReactNode;
}

/**
 * Anchored popover used by every Tasks field control.
 *
 * Rendered in a portal above the modal layer (the app modal sits at z-99999),
 * flips/shifts to stay on screen, and swallows Escape so closing a picker
 * never closes the modal behind it.
 */
export default function Popover({
  open,
  onOpenChange,
  placement = "bottom-start",
  width,
  children,
  content,
}: PopoverProps) {
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange,
    placement,
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(6),
      flip({ padding: 12 }),
      shift({ padding: 12 }),
      size({
        padding: 12,
        apply({ rects, elements, availableHeight }) {
          Object.assign(elements.floating.style, {
            maxHeight: `${Math.max(180, availableHeight)}px`,
            width:
              width === "trigger"
                ? `${rects.reference.width}px`
                : typeof width === "number"
                  ? `${width}px`
                  : "",
          });
        },
      }),
    ],
  });

  const click = useClick(context);
  // Escape is handled below so it can be stopped before the modal sees it.
  const dismiss = useDismiss(context, { escapeKey: false });
  const role = useRole(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss, role]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onOpenChange(false);
    };
    document.addEventListener("keydown", handleEscape, true);
    return () => document.removeEventListener("keydown", handleEscape, true);
  }, [open, onOpenChange]);

  return (
    <>
      {children({
        ref: refs.setReference,
        open,
        props: getReferenceProps(),
      })}

      {open && (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false} initialFocus={-1}>
            <div
              ref={refs.setFloating}
              style={{ ...floatingStyles, zIndex: 100000 }}
              {...getFloatingProps()}
              className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-lg outline-hidden dark:border-gray-700 dark:bg-gray-900"
            >
              {content({ close: () => onOpenChange(false) })}
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
}
