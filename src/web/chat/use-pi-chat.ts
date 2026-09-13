import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  CONTROLLER_REPLACED_CODE,
  PROTOCOL_VERSION,
  serverMessageSchema,
  type ClientMessage,
  type ThinkingLevel,
  type UiPromptResult,
} from "../../shared/protocol.js";
import { activeSession, initialAppState, reduceAppMessage } from "./app-state.js";

const FIRST_RETRY_MS = 250;
const MAX_RETRY_MS = 5_000;

/**
 * The Pi runtime needs several seconds to start, while the dev server is ready
 * almost immediately, so the first connection attempt is normally refused.
 * Reconnecting with backoff is what makes the app usable from a cold start.
 */
export function usePiChat() {
  const [app, dispatch] = useReducer(reduceAppMessage, initialAppState);
  const socketRef = useRef<WebSocket | undefined>(undefined);
  // Bumping this re-runs the effect, which is how a superseded tab takes the
  // controller slot back on an explicit user action.
  const [claim, setClaim] = useState(0);

  useEffect(() => {
    let disposed = false;
    let retryMs = FIRST_RETRY_MS;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    function connect(): void {
      if (disposed) return;
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const socket = new WebSocket(`${protocol}://${window.location.host}/ws`);
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        retryMs = FIRST_RETRY_MS;
      });

      socket.addEventListener("message", (event) => {
        let value: unknown;
        try {
          value = JSON.parse(String(event.data));
        } catch {
          return;
        }
        const parsed = serverMessageSchema.safeParse(value);
        if (parsed.success) dispatch(parsed.data);
      });

      // A refused connection fires error and then close on its own, so close is
      // the single place that schedules a retry. Calling close() from the error
      // handler would only abort a still-connecting socket and log
      // "closed before the connection is established".
      socket.addEventListener("close", (event) => {
        if (socketRef.current === socket) socketRef.current = undefined;
        if (disposed) return;
        if (event.code === CONTROLLER_REPLACED_CODE) {
          dispatch({ type: "superseded" });
          return;
        }
        dispatch({ type: "connectionLost", error: "Waiting for the Pi Chat server…" });
        retryTimer = setTimeout(connect, retryMs);
        retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
      });
    }

    // Deferred by a tick so React StrictMode's throwaway first mount is cancelled
    // before a socket exists. Connecting immediately would open a socket that the
    // probe's cleanup closes mid-handshake, which the browser reports as
    // "WebSocket is closed before the connection is established".
    retryTimer = setTimeout(connect, 0);

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      socketRef.current?.close();
      socketRef.current = undefined;
    };
  }, [claim]);

  const send = useCallback((message: ClientMessage) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      dispatch({ type: "connectionLost", error: "Not connected to the Pi Chat server yet." });
      return;
    }
    dispatch({ type: "clearError" });
    socket.send(JSON.stringify(message));
  }, []);

  // Commands act on the tab the user is looking at unless one is named.
  const session = activeSession(app);
  const target = (sessionId?: string) => sessionId ?? app.activeSessionId;

  return {
    app,
    state: session,
    prompt: (message: string, sessionId?: string) =>
      send({ version: PROTOCOL_VERSION, sessionId: target(sessionId), type: "prompt", message }),
    abort: (sessionId?: string) => send({ version: PROTOCOL_VERSION, sessionId: target(sessionId), type: "abort" }),
    respondToPrompt: (promptId: string, result: UiPromptResult, sessionId?: string) =>
      send({ version: PROTOCOL_VERSION, sessionId: target(sessionId), type: "uiPromptResponse", promptId, result }),
    openProject: (path: string) => send({ version: PROTOCOL_VERSION, type: "openProject", path }),
    openSession: (path: string) => send({ version: PROTOCOL_VERSION, type: "openSession", path }),
    newSession: (path?: string) => send({ version: PROTOCOL_VERSION, type: "newSession", ...(path ? { path } : {}) }),
    focusTab: (sessionId: string) => send({ version: PROTOCOL_VERSION, type: "focusTab", sessionId }),
    deleteSession: (path: string) => send({ version: PROTOCOL_VERSION, type: "deleteSession", path }),
    closeTab: (sessionId: string) => send({ version: PROTOCOL_VERSION, type: "closeTab", sessionId }),
    renameSession: (name: string) =>
      send({ version: PROTOCOL_VERSION, sessionId: app.activeSessionId, type: "runFeature", featureId: "session.rename", input: { name } }),
    setModel: (model: string) =>
      send({ version: PROTOCOL_VERSION, sessionId: app.activeSessionId, type: "runFeature", featureId: "model.select", input: { model } }),
    compactSession: () =>
      send({ version: PROTOCOL_VERSION, sessionId: app.activeSessionId, type: "runFeature", featureId: "session.compact", input: {} }),
    setThinkingLevel: (level: ThinkingLevel) =>
      send({ version: PROTOCOL_VERSION, sessionId: app.activeSessionId, type: "runFeature", featureId: "thinking.level", input: { level } }),
    takeControl: () => setClaim((value) => value + 1),
  };
}
