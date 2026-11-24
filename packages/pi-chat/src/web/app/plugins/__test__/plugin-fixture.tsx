import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { vi } from "vitest";
import type { CommandPlacement, PluginUI, PluginUIHost } from "@manuelselch/pi-sdk/plugins";

export const host: PluginUIHost = {
  sessions: [], activeSessionId: null, connected: true, projectPath: "/project", request: vi.fn(), createSession: vi.fn(),
  useOverlayFocus: () => ({ returnFocus: false, onExitTransitionEnd: vi.fn() }),
};

export function examplePlugin(id = "example", placements: readonly CommandPlacement[] = ["menus", "projects"]) {
  const run = vi.fn();
  const dispose = vi.fn();
  const State = createContext<{ opened: boolean; connected: boolean; open(): void } | undefined>(undefined);
  function useStateContext() {
    const value = useContext(State);
    if (!value) throw new Error("Missing example provider");
    return value;
  }
  const ui: PluginUI<ReactNode> = {
    Provider({ host, children }) {
      const [opened, setOpened] = useState(false);
      useEffect(() => dispose, []);
      return <State.Provider value={{ opened, connected: host.connected, open: () => { run(); setOpened(true); } }}>{children}</State.Provider>;
    },
    commands: [{ id: `${id}.open`, name: "Open example", description: "Example", placements,
      useAction() {
        const state = useStateContext();
        return { disabled: !state.connected, run: state.open };
      },
    }],
    Overlay() { return useStateContext().opened ? <div>{id} overlay</div> : null; },
    useOverlayOpen() { return useStateContext().opened; },
  };
  return { plugin: { id, ui }, run, dispose };
}
