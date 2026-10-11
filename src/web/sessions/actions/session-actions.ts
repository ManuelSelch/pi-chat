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
  restartDescription?: string;
}

export interface SessionActionOperations {
  newSession(path?: string): void;
  closeTab(sessionId: string): void;
  archiveSession(sessionId: string, path: string): void;
  restartServer(): void;
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
      actions.push({ id: "close-tab", name: "Close tab", description: "Close this session's tab", run: () => {
        if (sessionCurrent()) operations.closeTab(state.sessionId);
      } });
      if (state.sessionPath && !state.busy) actions.push({ id: "archive-session", name: "Archive session", description: "Keep this session in Archived and close its tab", run: () => {
        const latest = current();
        if (sessionCurrent() && !latest.busy && latest.sessionPath === state.sessionPath) operations.archiveSession(state.sessionId, state.sessionPath!);
      } });
    }
    if (state.restartDescription !== undefined) actions.push({ id: "restart-server", name: "Restart server", description: state.restartDescription, run: () => {
      if (current().connected && current().restartDescription !== undefined) operations.restartServer();
    } });
  }
  actions.push(
    { id: "open-folder", name: "Open folder…", description: "Choose a folder to start a session", run: operations.openFolder },
    { id: "settings", name: "Open settings", description: "Models, appearance and preferences", run: operations.openSettings },
  );
  return actions;
}
