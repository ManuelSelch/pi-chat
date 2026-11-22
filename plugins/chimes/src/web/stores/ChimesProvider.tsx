import { createContext, useContext, type ReactNode } from "react";
import type { PluginUIProviderProps } from "@manuelselch/pi-sdk/plugins";
import { useChimes } from "../hooks/use-chimes.js";

const ChimesContext = createContext<ReturnType<typeof useChimes> | undefined>(undefined);

/** Audio and preferences live with the plugin, independently of Settings mounting. */
export function ChimesProvider({ host, children }: PluginUIProviderProps<ReactNode>) {
  const chimes = useChimes(host.sessions);
  return <ChimesContext.Provider value={chimes}>{children}</ChimesContext.Provider>;
}

export function useChimesSettings() {
  const settings = useContext(ChimesContext);
  if (!settings) throw new Error("Missing chimes provider");
  return settings;
}
