import { useLayoutEffect, useRef } from "react";
import { useAppController } from "../AppControllerContext.js";
import { useOverlays } from "../overlays/OverlayController.js";
import { escapeIntent } from "./shortcuts.js";

export function GlobalKeyboardController() {
  const chat = useAppController();
  const overlays = useOverlays();
  const state = useRef({ overlayOpen: false, menuOpen: false, busy: false, abort: chat.abort });
  state.current = {
    overlayOpen: overlays.anyOpen || chat.state.prompts.length > 0,
    menuOpen: false,
    busy: chat.state.status === "running" || chat.state.status === "aborting",
    abort: chat.abort,
  };

  useLayoutEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent): void {
      if (event.key !== "Escape") return;
      const current = state.current;
      const overlayOpen = current.overlayOpen || document.querySelector("[role='dialog']") !== null;
      const menuOpen = document.querySelector("[data-command-menu]") !== null;
      if (escapeIntent({ ...current, overlayOpen, menuOpen }) === "abort") current.abort();
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  return null;
}
