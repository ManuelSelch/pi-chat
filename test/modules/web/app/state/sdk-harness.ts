import { PiClient, type TransportHandlers, type ServerMessage, type ReadonlyDeep, type SessionSnapshot } from "@manuelselch/pi-sdk";
import { reduceAppMessage, type AppState, type AppAction } from "../../../../../src/web/app/state/app-state.js";
import { initializeResult } from "../../../../infra/v2-fixtures.js";
export function createAppReducer() {
  let handlers!: TransportHandlers; let received: ReadonlyDeep<ServerMessage> | undefined;
  const scheduled: (() => void)[] = []; const sent: { requestId: string; method: string }[] = [];
  const client = new PiClient({ endpoint: "ws://example/ws", transport: (_url, events) => { handlers = events; return { send(text) { sent.push(JSON.parse(text)); }, close() {}, dispose() {} }; },
    scheduler: { setTimeout(callback) { scheduled.push(callback); return callback; }, clearTimeout(callback) { const index = scheduled.indexOf(callback as () => void); if (index >= 0) scheduled.splice(index, 1); } } });
  client.onMessage(message => { received = message; }); client.start(); scheduled.shift()!(); handlers.open();
  const reduce = (state: AppState, action: AppAction | ServerMessage | { type: "connectionLost"; error?: string }): AppState => {
    if ("version" in action) { received = undefined; const previous = client.getState(); handlers.message(JSON.stringify(action)); return received || previous !== client.getState() ? reduceAppMessage(state, { type: "sdkState", state: client.getState(), message: received }) : state; }
    if (action.type === "connectionLost") { handlers.close({ code: 1006, reason: action.error }); return reduceAppMessage(state, { type: "sdkState", state: client.getState() }); }
    return reduceAppMessage(state, action);
  };
  return { client, reduce, initialize(state: AppState, snapshots: SessionSnapshot[] = [], catalogue = { projects: [] } as ReturnType<typeof initializeResult>["projects"]["catalogue"]): AppState {
    if (client.getState().connection.phase === "reconnecting") { scheduled.shift()!(); handlers.open(); }
    const request = sent.findLast(request => request.method === "server.initialize")!;
    return reduce(state, { version: 2, type: "response", requestId: request.requestId, ok: true, result: initializeResult(snapshots, catalogue) });
  } };
}
