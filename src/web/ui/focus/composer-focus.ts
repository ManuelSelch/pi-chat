import { useCallback, useLayoutEffect, useRef, useState } from "react";

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
  const [exitRevision, setExitRevision] = useState(0);
  const consumedExit = useRef(0);

  useLayoutEffect(() => {
    if (opened) {
      previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
  }, [opened]);

  useLayoutEffect(() => {
    if (consumedExit.current === exitRevision) return;
    // Consume even a skipped exit: reopening or a later render must not replay it.
    consumedExit.current = exitRevision;
    if (opened) return;

    const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
    const previous = previousFocus.current;
    if (dialogs.length === 0) {
      if (!focusComposer()) {
        const pending = document.querySelector<HTMLButtonElement>("[data-pending-prompt-reopen]:not(:disabled)");
        if (pending) pending.focus({ preventScroll: true });
        else if (previous?.isConnected && !previous.matches(":disabled")) previous.focus({ preventScroll: true });
      }
    } else if (dialogs.length === 1 && !dialogs[0]!.contains(document.activeElement) && previous?.isConnected && dialogs[0]!.contains(previous)) {
      // Only return to a trigger inside the remaining parent. An old exit
      // callback must never pull focus out of a newer or nested dialog.
      previous.focus({ preventScroll: true });
    }
  }, [exitRevision, opened]);

  const onExitTransitionEnd = useCallback(() => {
    // Mantine calls this before setting its exited state. Batch the notification
    // with that update, then restore only after the commit removes the dialog.
    setExitRevision(revision => revision + 1);
  }, []);

  return { returnFocus: false, onExitTransitionEnd } as const;
}
