import { useCallback, useLayoutEffect, useRef } from "react";

/** The app has one composer. Never override an open/exiting dialog's ownership. */
export function focusComposer(element = document.querySelector<HTMLTextAreaElement>("[data-pi-composer]")): boolean {
  if (!element?.isConnected || element.disabled || element.closest('[hidden], [aria-hidden="true"]') || document.querySelector('[role="dialog"]')) return false;
  if (document.activeElement !== element) element.focus({ preventScroll: true });
  return document.activeElement === element;
}

/**
 * Mantine's default returnFocus restores the trigger before its exit animation.
 * Instead restore after exit, once React has removed the closing portal. Keep
 * nested confirmations inside the remaining dialog, not in the composer.
 */
export function useComposerFocusReturn(opened: boolean) {
  const previousFocus = useRef<HTMLElement | null>(null);
  const frame = useRef<number | undefined>(undefined);

  useLayoutEffect(() => {
    if (opened) {
      cancelAnimationFrame(frame.current ?? 0);
      previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
  }, [opened]);

  useLayoutEffect(() => () => cancelAnimationFrame(frame.current ?? 0), []);

  const onExitTransitionEnd = useCallback(() => {
    cancelAnimationFrame(frame.current ?? 0);
    // One post-commit frame, not polling or a delay tied to animation duration.
    frame.current = requestAnimationFrame(() => {
      const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
      const previous = previousFocus.current;
      if (dialogs.length === 0) {
        if (!focusComposer() && previous?.isConnected && !previous.matches(":disabled")) previous.focus({ preventScroll: true });
      } else if (dialogs.length === 1 && !dialogs[0]!.contains(document.activeElement) && previous?.isConnected && dialogs[0]!.contains(previous)) {
        // Only return to a trigger inside the remaining parent. An old exit
        // callback must never pull focus out of a newer or nested dialog.
        previous.focus({ preventScroll: true });
      }
    });
  }, []);

  return { returnFocus: false, onExitTransitionEnd } as const;
}
