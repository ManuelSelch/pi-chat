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
