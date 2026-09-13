import { useCallback, useEffect, useReducer, useRef } from "react";
import { PROTOCOL_VERSION, serverMessageSchema, type ClientMessage } from "../shared/protocol.js";
import { initialChatState, reduceServerMessage } from "./chat-state.js";

const FIRST_RETRY_MS = 250;
const MAX_RETRY_MS = 5_000;

/**
 * The Pi runtime needs several seconds to start, while the dev server is ready
 * almost immediately, so the first connection attempt is normally refused.
 * Reconnecting with backoff is what makes the app usable from a cold start.
 */
export function usePiChat() {
  const [state, dispatch] = useReducer(reduceServerMessage, initialChatState);
  const socketRef = useRef<WebSocket | undefined>(undefined);

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

      socket.addEventListener("close", () => {
        if (socketRef.current === socket) socketRef.current = undefined;
        if (disposed) return;
        dispatch({ type: "connectionLost", error: "Waiting for the Pi Chat server…" });
        retryTimer = setTimeout(connect, retryMs);
        retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
      });

      // A refused connection fires error then close; close owns the retry.
      socket.addEventListener("error", () => socket.close());
    }

    connect();

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      socketRef.current?.close();
      socketRef.current = undefined;
    };
  }, []);

  const send = useCallback((message: ClientMessage) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      dispatch({ type: "connectionLost", error: "Not connected to the Pi Chat server yet." });
      return;
    }
    socket.send(JSON.stringify(message));
  }, []);

  return {
    state,
    prompt: (message: string) => send({ version: PROTOCOL_VERSION, type: "prompt", message }),
    abort: () => send({ version: PROTOCOL_VERSION, type: "abort" }),
  };
}
