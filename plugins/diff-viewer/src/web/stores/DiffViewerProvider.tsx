import { createContext, useContext, useState, type ReactNode } from "react";
import type { PluginUIHost, PluginUIProviderProps } from "@manuelselch/pi-sdk/plugins";

export type Mode = "uncommitted" | "branch" | "commit";
export interface Preferences { mode: Mode; branch: string | null; commit: string | null; commitSubject: string }
interface State { host: PluginUIHost; preferences: Preferences; update(patch: Partial<Preferences>): void }
const Context = createContext<State | null>(null);
const defaults: Preferences = {mode:"branch",branch:null,commit:null,commitSubject:""};

export function DiffViewerProvider({host,children}:PluginUIProviderProps<ReactNode>) {
  const [projects,setProjects] = useState<Record<string,Preferences>>({});
  const key = host.projectPath ?? "";
  return <Context.Provider value={{host,preferences:projects[key] ?? defaults,update:patch=>setProjects(current=>({...current,[key]:{...(current[key] ?? defaults),...patch}}))}}>{children}</Context.Provider>;
}
export function useDiffViewer() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing diff-viewer provider");
  return value;
}
