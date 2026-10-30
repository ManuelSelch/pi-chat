import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from "react";

interface DraftState { values: Record<string, string>; paths: Record<string, string> }
const DraftContext = createContext<{ state: DraftState; set: React.Dispatch<React.SetStateAction<DraftState>> } | undefined>(undefined);

/** Page-lifetime ownership above the composer; parking never deletes a draft. */
export function SessionDraftProvider({ children }: { children: ReactNode }) {
  const [state, set] = useState<DraftState>({ values: {}, paths: {} });
  return <DraftContext.Provider value={{ state, set }}>{children}</DraftContext.Provider>;
}

export function useSessionDrafts(sessionId: string, path?: string) {
  const store = useContext(DraftContext);
  if (!store) throw new Error("Session drafts require SessionDraftProvider");
  const { state, set } = store;
  const key = path ? `path:${path}` : state.paths[sessionId] ?? `runtime:${sessionId}`;
  const input = state.values[key] ?? state.values[`runtime:${sessionId}`] ?? "";
  useLayoutEffect(() => {
    if (!path || !sessionId) return;
    set(previous => {
      if (previous.paths[sessionId] === key) return previous;
      const runtimeKey = `runtime:${sessionId}`;
      const values = { ...previous.values };
      values[key] ??= values[runtimeKey] ?? "";
      delete values[runtimeKey];
      return { values, paths: { ...previous.paths, [sessionId]: key } };
    });
  }, [path, sessionId, key, set]);
  return {
    input,
    setInput: (value: string) => set(previous => ({ ...previous, values: { ...previous.values, [key]: value } })),
  };
}
