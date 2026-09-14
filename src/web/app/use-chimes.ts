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
   * Switching on is the only user gesture this feature gets, so the audio
   * context is opened here. The preview doubles as proof that sound works,
   * rather than leaving the user to wonder until the next run ends.
   */
  const toggle = useCallback((value: boolean) => {
    setEnabled(value);
    if (!value) return;
    void player.current?.unlock().then(() => player.current?.play("finished"));
  }, [setEnabled]);

  return { enabled, setEnabled: toggle, available: player.current.available };
}
