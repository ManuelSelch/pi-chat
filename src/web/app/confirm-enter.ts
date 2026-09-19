import { useEffect } from "react";

interface ConfirmOnEnterOptions {
  enabled: boolean;
  disabled?: boolean;
  onConfirm: () => void;
}

export function isMultilineEditor(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLTextAreaElement) return true;
  const editable = target.closest("[contenteditable]");
  return editable instanceof HTMLElement && editable.getAttribute("contenteditable") !== "false";
}

export function shouldConfirmOnEnter(event: KeyboardEvent, disabled = false): boolean {
  if (disabled) return false;
  if (event.key !== "Enter") return false;
  if (event.isComposing || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return false;
  return !isMultilineEditor(event.target);
}

export function useConfirmOnEnter({ enabled, disabled = false, onConfirm }: ConfirmOnEnterOptions): void {
  useEffect(() => {
    if (!enabled) return undefined;
    function onKeyDown(event: KeyboardEvent): void {
      if (!shouldConfirmOnEnter(event, disabled)) return;
      event.preventDefault();
      event.stopPropagation();
      onConfirm();
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [disabled, enabled, onConfirm]);
}
