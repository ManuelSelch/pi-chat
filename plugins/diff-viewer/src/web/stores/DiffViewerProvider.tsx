import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { PluginUIHost, PluginUIProviderProps } from "@manuelselch/pi-sdk/plugins";
import { emptyReview, type ReviewState } from "./review-state.js";

export type Mode = "uncommitted" | "branch" | "commit";
export interface Preferences { mode: Mode; branch: string | null; commit: string | null; commitSubject: string }
interface State { host: PluginUIHost; preferences: Preferences; update(patch: Partial<Preferences>): void; reviews:Record<string,ReviewState>; updateReview(key:string,change:(state:ReviewState)=>ReviewState):void }
const Context = createContext<State | null>(null);
const defaults: Preferences = {mode:"branch",branch:null,commit:null,commitSubject:""};

export function DiffViewerProvider({host,children}:PluginUIProviderProps<ReactNode>) {
  const [projects,setProjects] = useState<Record<string,Preferences>>({});
  const [reviews,setReviews] = useState<Record<string,ReviewState>>({});
  const key = host.projectPath ?? "";
  const updateReview = useCallback((scope:string,change:(state:ReviewState)=>ReviewState)=>setReviews(current=>({...current,[scope]:change(current[scope] ?? emptyReview)})),[]);
  return <Context.Provider value={{host,preferences:projects[key] ?? defaults,
    update:patch=>setProjects(current=>({...current,[key]:{...(current[key] ?? defaults),...patch}})),reviews,
    updateReview,
  }}>{children}</Context.Provider>;
}
export function useDiffViewer() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing diff-viewer provider");
  return value;
}
