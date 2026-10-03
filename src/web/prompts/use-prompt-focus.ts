import { useCallback, useEffect, useRef, type RefCallback } from "react";

/** Focuses the current prompt control after portal content has been mounted. */
export function usePromptFocus<T extends HTMLElement>(key: string | undefined, enabled: boolean): RefCallback<T> {
  const nodeRef = useRef<T | null>(null);
  const ref = useCallback<RefCallback<T>>((node) => {
    nodeRef.current = node;
  }, []);

  useEffect(() => {
    if (!key || !enabled) return;
    const frame = requestAnimationFrame(() => nodeRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [key, enabled]);

  return ref;
}
