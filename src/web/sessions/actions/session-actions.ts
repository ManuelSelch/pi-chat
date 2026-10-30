export interface SessionAction {
  id: string;
  name: string;
  description: string;
  run(): void;
}

export interface SessionActionState {
  sessionId: string;
  projectPath?: string;
  sessionPath?: string;
  connected: boolean;
  busy: boolean;
  navigation: "tabs" | "inbox";
}

export interface SessionActionOperations {
  newSession(path?: string): void;
  closeTab(sessionId: string): void;
  archiveSession(sessionId: string, path: string): void;
  openFolder(): void;
  openSettings(): void;
}

/** Local UI operations only: extension commands keep their native Pi path. */
export function buildSessionActions(state: SessionActionState, operations: SessionActionOperations, current = () => state): SessionAction[] {
  const actions: SessionAction[] = [];
  const sessionCurrent = () => current().connected && current().sessionId === state.sessionId;
  if (state.connected) {
    actions.push({ id: "new-session", name: "New session", description: "Open a new session in this project", run: () => {
      if (sessionCurrent()) operations.newSession(state.sessionId ? state.projectPath : undefined);
    } });
    if (state.sessionId) {
      if (state.navigation === "tabs" || (!state.busy && state.sessionPath)) actions.push({
        id: "close-tab", name: state.navigation === "inbox" ? "Move to Later" : "Close tab",
        description: state.navigation === "inbox" ? "Park this idle conversation for later" : "Close this session's tab", run: () => {
          const latest = current();
          if (sessionCurrent() && latest.navigation === state.navigation && (state.navigation === "tabs" || (!latest.busy && latest.sessionPath === state.sessionPath))) operations.closeTab(state.sessionId);
        },
      });
      if (state.sessionPath && !state.busy) actions.push({ id: "archive-session", name: "Archive session", description: "Keep this session in Archived and close its tab", run: () => {
        const latest = current();
        if (sessionCurrent() && !latest.busy && latest.sessionPath === state.sessionPath) operations.archiveSession(state.sessionId, state.sessionPath!);
      } });
    }
  }
  actions.push(
    { id: "open-folder", name: "Open folder…", description: "Choose a folder to start a session", run: operations.openFolder },
    { id: "settings", name: "Settings", description: "Models, appearance and preferences", run: operations.openSettings },
  );
  return actions;
}
