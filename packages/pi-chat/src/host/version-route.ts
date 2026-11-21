import type { Server } from "node:http";

/** Capture the runtime version once; later npm installs must not change it. */
export function installVersionRoute(server: Server, version: string): void {
  const handlers = server.listeners("request");
  server.removeAllListeners("request");
  server.on("request", (request, response) => {
    if (request.method === "GET" && request.url?.split("?")[0] === "/api/pi-chat/version") {
      response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      response.end(JSON.stringify({ server: version }));
      return;
    }
    for (const handler of handlers) handler.call(server, request, response);
  });
}
