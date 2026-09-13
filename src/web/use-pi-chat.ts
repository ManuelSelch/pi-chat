import { useCallback, useEffect, useReducer, useRef } from "react";
import { PROTOCOL_VERSION, serverMessageSchema, type ClientMessage } from "../shared/protocol.js";
import { initialChatState, reduceServerMessage } from "./chat-state.js";

export function usePiChat() {
  const [state, dispatch] = useReducer(reduceServerMessage, initialChatState);
  const socketRef = useRef<WebSocket | undefined>(undefined);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(`${protocol}://${window.location.host}/ws`);
    socketRef.current = socket;
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
      socketRef.current = undefined;
    });
    return () => socket.close();
  }, []);

  const send = useCallback((message: ClientMessage) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) throw new Error("Pi Chat is not connected");
    socket.send(JSON.stringify(message));
  }, []);

  return {
    state,
    prompt: (message: string) => send({ version: PROTOCOL_VERSION, type: "prompt", message }),
    abort: () => send({ version: PROTOCOL_VERSION, type: "abort" }),
  };
}
