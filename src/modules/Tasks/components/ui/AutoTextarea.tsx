import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useRef,
  type TextareaHTMLAttributes,
} from "react";

interface AutoTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  /** Height floor, in px. */
  minHeight?: number;
  maxHeight?: number;
}

/** Textarea that grows with its content instead of scrolling inside a fixed box. */
const AutoTextarea = forwardRef<HTMLTextAreaElement, AutoTextareaProps>(function AutoTextarea(
  { value, minHeight = 72, maxHeight = 320, className = "", ...rest },
  forwardedRef
) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);
  const lastWidth = useRef(0);

  const resize = useCallback(() => {
    const node = innerRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(Math.max(node.scrollHeight, minHeight), maxHeight)}px`;
  }, [minHeight, maxHeight]);

  useLayoutEffect(resize, [value, resize]);

  // A measurement taken before layout settles (modal mount, hidden parent) reads
  // a wrapped, far-too-tall scrollHeight — re-measure whenever the width moves.
  useLayoutEffect(() => {
    const node = innerRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    lastWidth.current = node.clientWidth;
    const observer = new ResizeObserver(() => {
      const current = innerRef.current;
      if (!current || current.clientWidth === lastWidth.current) return;
      lastWidth.current = current.clientWidth;
      resize();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [resize]);

  return (
    <textarea
      ref={(node) => {
        innerRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      }}
      value={value}
      // With the default rows=2, the `height:auto` measurement never reads
      // below two lines and short text keeps a phantom second line.
      rows={1}
      style={{ minHeight }}
      className={`w-full resize-none overflow-y-auto ${className}`}
      {...rest}
    />
  );
});

export default AutoTextarea;
