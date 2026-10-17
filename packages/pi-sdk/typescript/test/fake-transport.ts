import type { TransportFactory, TransportHandlers } from "../src/transport.js";

export class FakeSocket {
  sent: string[] = [];
  closed = false;
  disposed = false;
  constructor(readonly handlers: TransportHandlers) {}
  open() { this.handlers.open(); }
  message(value: unknown) { this.handlers.message(JSON.stringify(value)); }
  raw(value: string) { this.handlers.message(value); }
  end(code = 1006) { this.handlers.close({ code }); }
}
export function fakeTransport() {
  const sockets: FakeSocket[] = [];
  const endpoints: string[] = [];
  const factory: TransportFactory = (endpoint, handlers) => {
    endpoints.push(endpoint);
    const socket = new FakeSocket(handlers);
    sockets.push(socket);
    return { send: (text) => { socket.sent.push(text); }, close: () => { socket.closed = true; }, dispose: () => { socket.disposed = true; } };
  };
  return { factory, sockets, endpoints };
}
export const snapshot = (sessionId = "s", sequence = 0) => ({ version: 1, type: "snapshot", sessionId, sequence, throughSequence: sequence, projectPath: "/example", messages: [], isStreaming: false });
export const tabs = (...ids: string[]) => ({ version: 1, type: "tabs", activeSessionId: ids[0] ?? "", tabs: ids.map((sessionId) => ({ sessionId, title: sessionId, projectPath: "/example", projectName: "example", status: "idle" })) });
export const catalogue = { version: 1, type: "catalogue", catalogue: { projects: [] } };
