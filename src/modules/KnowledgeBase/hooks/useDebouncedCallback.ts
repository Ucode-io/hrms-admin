import { useCallback, useEffect, useRef } from "react";

/** Returns a debounced version of `fn`; trailing call wins. Flushes on unmount. */
export function useDebouncedCallback<A extends unknown[]>(
  fn: (...args: A) => void,
  delay = 600
) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<A | null>(null);

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (pending.current) {
      fnRef.current(...pending.current);
      pending.current = null;
    }
  }, []);

  const debounced = useCallback(
    (...args: A) => {
      pending.current = args;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        if (pending.current) {
          fnRef.current(...pending.current);
          pending.current = null;
        }
      }, delay);
    },
    [delay]
  );

  useEffect(() => () => flush(), [flush]);

  return debounced;
}
