import { useEffect, useRef, useState } from "react";

/** Most characters revealed in a single frame, so a burst never flashes in. */
const MAX_STEP = 10;
/**
 * How aggressively the reveal chases the backlog. Higher divisor = calmer
 * typing; the step is proportional to how far behind we are, so a long pause
 * followed by a big chunk catches up quickly instead of trickling for seconds.
 */
const CATCH_UP_DIVISOR = 6;

const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/**
 * Reveals streamed text character by character on a rAF loop.
 *
 * Tokens arrive from the model in uneven bursts — a few words, a pause, a whole
 * sentence. Rendering each delta as it lands makes the text jump, which reads as
 * a stuttering connection rather than as writing. This decouples the two: the
 * network fills a buffer, the animation drains it at a steady pace.
 *
 * The reveal only applies while the message is still streaming. Completed
 * messages — and replayed history — return in full immediately, because
 * re-animating text the person has already read would be theatre.
 */
export const useSmoothText = (text: string, streaming: boolean): string => {
  const [visibleCount, setVisibleCount] = useState(() =>
    streaming ? 0 : text.length,
  );
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (!streaming || prefersReducedMotion()) {
      setVisibleCount(text.length);
      return;
    }

    const tick = (): void => {
      setVisibleCount((current) => {
        if (current >= text.length) return current;
        const backlog = text.length - current;
        const step = Math.min(
          MAX_STEP,
          Math.max(1, Math.ceil(backlog / CATCH_UP_DIVISOR)),
        );
        return current + step;
      });
      frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [text, streaming]);

  // A new message resets the buffer; without this, switching messages would
  // carry the previous one's position and truncate the new text.
  useEffect(() => {
    if (!streaming) setVisibleCount(text.length);
  }, [streaming, text.length]);

  return text.slice(0, Math.min(visibleCount, text.length));
};
