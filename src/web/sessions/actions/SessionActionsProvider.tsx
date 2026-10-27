import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { useAppController } from "../../app/AppControllerContext.js";
import { atHome } from "../../app/state/app-state.js";
import { useOverlays } from "../../app/overlays/OverlayController.js";
import { buildSessionActions, type SessionAction, type SessionActionState } from "./session-actions.js";

interface SessionActionsValue {
  actions: SessionAction[];
  error?: string;
  clearError(): void;
}
const SessionActionsContext = createContext<SessionActionsValue | undefined>(undefined);

/** A single error owner lets palette failures use the existing composer display. */
export function SessionActionsProvider({ children }: { children: ReactNode }) {
  const chat = useAppController();
  const overlays = useOverlays();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const state: SessionActionState = {
    sessionId: atHome(chat.app) ? "" : chat.app.activeSessionId,
    projectPath: chat.state.projectPath || undefined,
    sessionPath: chat.state.sessionPath,
    connected: chat.app.connection === "open",
    busy: chat.state.status === "running" || chat.state.status === "aborting",
  };
  const latest = useRef(state);
  latest.current = state;
  function clearError(sessionId = state.sessionId) {
    setErrors(current => { const next = { ...current }; delete next[sessionId]; return next; });
  }
  const actions = buildSessionActions(state, {
    newSession: chat.newSession,
    closeTab: chat.closeTab,
    archiveSession: (sessionId, path) => {
      clearError(sessionId);
      void chat.archiveSession(path, true).catch((error: unknown) => {
        setErrors(current => ({ ...current, [sessionId]: error instanceof Error ? error.message : String(error) }));
      });
    },
    openFolder: () => overlays.open("folderPicker"),
    openSettings: () => overlays.open("settings"),
  }, () => latest.current);
  return <SessionActionsContext.Provider value={{ actions, error: errors[state.sessionId], clearError }}>{children}</SessionActionsContext.Provider>;
}

export function useSessionActions(): SessionActionsValue {
  const value = useContext(SessionActionsContext);
  if (!value) throw new Error("useSessionActions must be used inside SessionActionsProvider");
  return value;
}
