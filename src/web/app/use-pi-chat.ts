import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { PiClient, SDKError, type ThinkingLevel, type UiPromptResult, type DirectoryBrowse } from "@manuelselch/pi-sdk";
import { activeSession, initialAppState, reduceAppMessage } from "./state/app-state.js";
import { browserTransport } from "./connection/browser-transport.js";
import { bindPiChat } from "./connection/sdk-binding.js";
import { loadEndpoint } from "../settings/server/index.js";

/** React lifecycle and browser presentation over one UI-independent SDK client. */
export function usePiChat() {
  const [app, dispatch] = useReducer(reduceAppMessage, initialAppState);
  const clientRef = useRef<PiClient | undefined>(undefined);
  const [serverEndpoint] = useState(() => loadEndpoint(window.location));

  useEffect(() => {
    const client = new PiClient({ endpoint: serverEndpoint.endpoint, transport: browserTransport });
    clientRef.current = client;
    const unbind = bindPiChat(client, dispatch);
    const stopErrors = client.onError((error) => {
      if (error.code === "listenerError") console.warn("[pi-chat] SDK subscriber failed", error);
    });
    client.start(); // SDK defers a tick, so StrictMode's probe never opens a socket.
    return () => {
      unbind(); stopErrors();
      if (clientRef.current === client) clientRef.current = undefined;
      client.dispose(); // Disconnecting the UI never closes a server runtime.
    };
  }, [serverEndpoint]);

  const requireClient = useCallback(() => {
    if (!clientRef.current) throw new SDKError("notConnected", "Not connected to the Pi Chat server yet.");
    return clientRef.current;
  }, []);
  const request = useCallback(<T,>(invoke: (client: PiClient) => Promise<T>): Promise<T> => {
    try { return invoke(requireClient()); } catch (error) { return Promise.reject(error); }
  }, [requireClient]);
  const control = useCallback((invoke: (client: PiClient) => unknown, optimistic: { opening?: boolean; closingSessionId?: string } = {}) => {
    const owner = clientRef.current;
    const failed = (error: unknown) => { if (clientRef.current === owner) dispatch({ type: "commandFailed", error: error instanceof Error ? error.message : String(error), ...optimistic }); };
    try { const result = invoke(requireClient()); if (result instanceof Promise) void result.catch(failed); }
    catch (error) { failed(error); }
  }, [requireClient]);

  const browseDirectories = useCallback((query: DirectoryBrowse, signal?: AbortSignal) => request((client) => client.browseDirectories(query, { signal })), [request]);
  const startFolderSession = useCallback(async (path: string, signal?: AbortSignal) => {
    const id = await request((client) => client.createSession(path, { signal })); dispatch({ type: "focusSession", sessionId: id }); return id;
  }, [request]);
  const completeCommandArguments = useCallback((sessionId: string, name: string, prefix: string, signal?: AbortSignal) => request((client) => client.completeCommandArguments(sessionId, name, prefix, { signal })), [request]);
  const openFile = useCallback((sessionId: string, path: string) => request((client) => client.openFile(sessionId, path)), [request]);
  const archiveSession = useCallback((path: string, archived: boolean) => request((client) => client.archiveSession(path, archived)), [request]);
  const pinProject = useCallback((path: string, pinned: boolean) => request((client) => client.pinProject(path, pinned)), [request]);
  const removeProject = useCallback((path: string) => request((client) => client.removeProject(path)), [request]);
  const openRuntime = useCallback((invoke: (client: PiClient) => Promise<string>) => {
    dispatch({ type: "openPending" }); const owner = clientRef.current;
    void request(invoke).then(sessionId => { if (clientRef.current === owner) dispatch({ type: "sessionOpened", sessionId }); }, (error: unknown) => {
      if (clientRef.current !== owner) return;
      const message = error instanceof Error ? error.message : String(error);
      dispatch({ type: "commandFailed", opening: true, error: error instanceof SDKError && error.outcome === "unknown" ? `${message} The server outcome is unknown; no retry was sent.` : message });
    });
  }, [request]);
  const openSession = useCallback((path: string) => openRuntime(client => client.openSession(path)), [openRuntime]);
  const newSession = useCallback((path?: string) => openRuntime(client => client.createSession(path || undefined)), [openRuntime]);
  const openProject = useCallback((path: string) => {
    const history = app.catalogue.projects.find(project => project.path === path)?.sessions.filter(session => session.archivedAt === undefined).toSorted((a, b) => b.modified - a.modified)[0];
    if (history) openSession(history.path); else newSession(path);
  }, [app.catalogue, openSession, newSession]);
  const closeTab = useCallback((sessionId: string) => {
    dispatch({ type: "closePending", sessionId });
    control((client) => client.closeSession(sessionId), { closingSessionId: sessionId });
  }, [control]);
  const takeControl = useCallback(() => control((client) => client.takeControl()), [control]);

  // User-visible focus remains application-owned; the SDK always gets an ID.
  const session = activeSession(app);
  const target = (sessionId?: string) => sessionId ?? app.activeSessionId;
  return {
    app, state: session, serverEndpoint, browseDirectories, startFolderSession, completeCommandArguments,
    openFile, archiveSession, pinProject, removeProject, openSession, openProject, newSession, closeTab, takeControl,
    prompt: (message: string, sessionId?: string) => {
      const id = target(sessionId); dispatch({ type: "clearError", sessionId: id });
      control((client) => client.prompt(id, message));
    },
    abort: (sessionId?: string) => {
      const id = target(sessionId); dispatch({ type: "clearError", sessionId: id });
      control((client) => client.abort(id));
    },
    respondToPrompt: (promptId: string, result: UiPromptResult, sessionId?: string) => request(client => client.respondToPrompt(target(sessionId), promptId, result)).catch((error: unknown) => {
      dispatch({ type: "commandFailed", error: error instanceof Error ? error.message : String(error) });
      throw error;
    }),
    focusTab: (sessionId: string) => dispatch({ type: "focusSession", sessionId }),
    setModel: (model: string) => control((client) => client.selectModel(app.activeSessionId, model)),
    compactSession: () => control((client) => client.compactSession(app.activeSessionId)),
    restartServer: () => control((client) => client.restartServer()),
    setThinkingLevel: (level: ThinkingLevel) => control((client) => client.setThinkingLevel(app.activeSessionId, level)),
    runExtensionAction: (actionId: string, sessionId?: string) => control((client) => client.runExtensionAction(target(sessionId), actionId)),
    dismissError: (sessionId?: string) => dispatch({ type: "clearError", sessionId: target(sessionId) }),
  };
}
