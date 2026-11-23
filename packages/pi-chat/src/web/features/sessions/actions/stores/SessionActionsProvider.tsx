import { createContext, useContext, useRef, type ReactNode } from "react";
import { useAppController } from "../../../../app/AppControllerContext.js";
import { atHome } from "../../../../app/stores/app-state.js";
import { usePluginCommands } from "../../../../app/plugins/PluginProvider.js";
import { useOverlays } from "../../../../app/overlays/OverlayController.js";
import { hasSavedSession } from "../../inbox/utils/inbox-model.js";
import { buildSessionActions, type SessionAction, type SessionActionState } from "../utils/session-actions.js";

const SessionActionsContext = createContext<{ actions: SessionAction[] } | undefined>(undefined);

/** Composer and Quick Switcher share actions; Inbox owns lifecycle errors. */
export function SessionActionsProvider({ children }: { children: ReactNode }) {
  const chat = useAppController();
  const overlays = useOverlays();
  const commands = usePluginCommands("menus");
  const state: SessionActionState = {
    sessionId: atHome(chat.app) ? "" : chat.app.activeSessionId,
    projectPath: chat.state.projectPath || undefined,
    sessionPath: hasSavedSession(chat.app.catalogue, chat.state.sessionPath) ? chat.state.sessionPath : undefined,
    connected: chat.app.connection === "open",
    busy: chat.state.status !== "idle",
  };
  const latest = useRef(state);
  latest.current = state;
  const actions = buildSessionActions(state, {
    newSession: chat.newSession,
    closeSession: chat.closeView,
    parkSession: id => { void chat.inbox.park(id); },
    archiveSession: (_sessionId, path) => { void chat.inbox.archive(path); },
    openSettings: () => { if (overlays.projectsPresentation === "drawer") overlays.close("projects"); overlays.open("settings"); },
  }, () => latest.current, commands);
  return <SessionActionsContext.Provider value={{ actions }}>{children}</SessionActionsContext.Provider>;
}

export function useSessionActions() {
  const value = useContext(SessionActionsContext);
  if (!value) throw new Error("useSessionActions must be used inside SessionActionsProvider");
  return value;
}
