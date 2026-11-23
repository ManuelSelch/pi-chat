export interface SessionAction {
  id: string;
  name: string;
  description: string;
  /** Listed but not runnable while the underlying session state forbids it. */
  disabled?: boolean;
  run(): void;
}

export interface SessionActionState {
  sessionId: string;
  projectPath?: string;
  sessionPath?: string;
  connected: boolean;
  busy: boolean;
}

export interface SessionActionOperations {
  newSession(path?: string): void;
  closeSession(sessionId: string): void;
  parkSession(sessionId: string): void;
  archiveSession(sessionId: string, path: string): void;
  openSettings(): void;
}

/** Local UI operations only: extension commands keep their native Pi path. */
export function buildSessionActions(state: SessionActionState, operations: SessionActionOperations, current = () => state, contributions: readonly SessionAction[] = []): SessionAction[] {
  const actions: SessionAction[] = [];
  const sessionCurrent = () => current().connected && current().sessionId === state.sessionId;
  if (state.connected) {
    actions.push({ id: "new-session", name: "New session", description: "Open a new session in this project", run: () => {
      if (sessionCurrent()) operations.newSession(state.sessionId ? state.projectPath : undefined);
    } });
    if (state.sessionId) {
      actions.push({
        id: "close-session", name: "Close Session",
        description: "Return Home, keeping non-empty sessions open", run: () => {
          if (sessionCurrent()) operations.closeSession(state.sessionId);
        },
      });
      actions.push({
        id: "later-session", name: "Later",
        description: "Park this idle conversation for later",
        disabled: state.busy || !state.sessionPath,
        run: () => {
          const latest = current();
          if (sessionCurrent() && !latest.busy && latest.sessionPath === state.sessionPath) operations.parkSession(state.sessionId);
        },
      });
      actions.push({
        id: "archive-session", name: "Archive Session", description: "Archive this session and close its runtime",
        disabled: state.busy || !state.sessionPath,
        run: () => {
          const latest = current();
          if (sessionCurrent() && !latest.busy && latest.sessionPath === state.sessionPath) operations.archiveSession(state.sessionId, state.sessionPath!);
        },
      });
    }
  }
  actions.push(
    ...contributions,
    { id: "settings", name: "Settings", description: "Models, appearance and preferences", run: operations.openSettings },
  );
  return actions;
}
