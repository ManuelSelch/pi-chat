import { PiClient, type TransportHandlers, type ServerMessage, type ReadonlyDeep } from "@manuelselch/pi-sdk";
import { reduceAppMessage, type AppState, type AppAction } from "../../../../../src/web/app/state/app-state.js";

/** Feed fixtures through the real SDK, then compose the browser view. No second reducer. */
export function createAppReducer() {
  let handlers!: TransportHandlers;
  let connect!: () => void;
  let received: ReadonlyDeep<ServerMessage> | undefined;
  const client = new PiClient({ endpoint: "ws://example/ws", transport: (_url, events) => {
    handlers = events; return { send() {}, close() {}, dispose() {} };
  }, scheduler: { setTimeout(callback) { connect = callback; return 0; }, clearTimeout() {} } });
  client.onMessage((message) => { received = message; });
  client.start(); connect(); handlers.open();
  return {
    client,
    reduce(state: AppState, action: AppAction | ServerMessage | { type: "connectionLost"; error?: string }): AppState {
      if ("version" in action) {
        if (client.getState().connection.phase === "reconnecting") { connect(); handlers.open(); }
        received = undefined; handlers.message(JSON.stringify(action));
        if (!received) throw new Error("Invalid fixture was rejected by SDK");
        return reduceAppMessage(state, { type: "sdkState", state: client.getState(), message: received });
      }
      if (action.type === "connectionLost") {
        handlers.close({ code: 1006, reason: action.error });
        return reduceAppMessage(state, { type: "sdkState", state: client.getState() });
      }
      return reduceAppMessage(state, action);
    },
  };
}
