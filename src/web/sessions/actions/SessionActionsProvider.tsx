import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { useAppController } from "../../app/AppControllerContext.js";
import { atHome } from "../../app/state/app-state.js";
import { useOverlays } from "../../app/overlays/OverlayController.js";
import { useConfirmDialog } from "../../ui/confirm/ConfirmDialogProvider.js";
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
  const { confirm } = useConfirmDialog();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const restartFeature = [...chat.state.actions.features, ...chat.app.appFeatures].find(feature => feature.id === "app.restart");
  const state: SessionActionState = {
    sessionId: atHome(chat.app) ? "" : chat.app.activeSessionId,
    projectPath: chat.state.projectPath || undefined,
    sessionPath: chat.state.sessionPath,
    connected: chat.app.connection === "open",
    busy: chat.state.status === "running" || chat.state.status === "aborting",
    restartDescription: restartFeature ? restartFeature.description ?? "Restart the Pi Chat server" : undefined,
  };
  const latest = useRef(state);
  latest.current = state;
  const latestChat = useRef(chat);
  latestChat.current = chat;
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
    restartServer: () => {
      void confirm({ title: "Restart server?", body: "The client is rebuilt and the server restarts. Open sessions close and the page reconnects on its own.", confirmLabel: "Restart" }).then(yes => {
        if (yes && latest.current.connected && latest.current.restartDescription !== undefined) latestChat.current.restartServer();
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
