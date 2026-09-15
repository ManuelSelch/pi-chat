import { useCallback, useEffect, useRef } from "react";
import { useLocalStorage } from "@mantine/hooks";
import type { Tab } from "../../shared/protocol.js";
import { ChimePlayer, chimesFor, statusMap } from "./chime.js";

export const CHIME_STORAGE_KEY = "pi-chat:chimes";

/**
 * Sounds the two moments the screen already reports with a colour: a run that
 * settles (green) and a session waiting on a dialog (red). Driven by the tab
 * list rather than the active session, so a background tab finishing is exactly
 * the case it is useful for.
 */
export function useChimes(tabs: Tab[]): { enabled: boolean; setEnabled: (value: boolean) => void; available: boolean } {
  const [enabled, setEnabled] = useLocalStorage({ key: CHIME_STORAGE_KEY, defaultValue: false, getInitialValueInEffect: false });
  const player = useRef<ChimePlayer>(undefined);
  player.current ??= new ChimePlayer();
  const previous = useRef(statusMap(tabs));

  useEffect(() => {
    const chimes = chimesFor(previous.current, tabs);
    previous.current = statusMap(tabs);
    if (!enabled) return;
    for (const chime of chimes) void player.current?.play(chime);
  }, [tabs, enabled]);

  useEffect(() => () => player.current?.close(), []);

  /**
   * Keeps the audio context openable across a reload.
   *
   * The setting is remembered but the browser's permission to make noise is
   * not: every load starts locked again, and the thing a chime announces — a
   * run ending — is never a gesture, so nothing would ever unlock it. Chimes
   * were then dropped for the whole visit unless the user happened to open the
   * settings and toggle them again, which is why they seemed to work only
   * sometimes.
   *
   * Listening on the window covers any interaction, and `unlock()` costs
   * nothing once the context runs. `visibilitychange` is here for Safari and
   * iOS, which suspend audio in a hidden tab — precisely the tab a background
   * run is finishing in.
   */
  useEffect(() => {
    if (!enabled) return;
    const unlock = () => void player.current?.unlock();
    const onVisible = () => {
      if (document.visibilityState === "visible") unlock();
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled]);

  /**
   * Switching on is a gesture of its own, so the context is opened here too
   * rather than waiting for the next click. The preview doubles as proof that
   * sound works, rather than leaving the user to wonder until a run ends.
   */
  const toggle = useCallback((value: boolean) => {
    setEnabled(value);
    if (!value) return;
    void player.current?.unlock().then(() => player.current?.play("finished"));
  }, [setEnabled]);

  return { enabled, setEnabled: toggle, available: player.current.available };
}
