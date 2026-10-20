// Test-owned server only: fake runtime, empty history, temporary metadata, loopback.
import { once } from "node:events";
import { writeFile, rename, realpath } from "node:fs/promises";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import WebSocket from "ws";
import { createPiChatServer } from "../../../../src/server/bootstrap/server.js";
import { FakeRuntimeAdapter } from "../../../../test/infra/fake-runtime-adapter.js";
import { ProjectSessionService } from "../../../../src/server/projects/project-session-service.js";
import { ProjectMetadataStore } from "../../../../src/server/projects/project-metadata-store.js";

const directory = await realpath(process.argv[2]!);
let created = 0;
class DemoRuntime extends FakeRuntimeAdapter {
  override snapshot() { return { ...super.snapshot(), projectPath: directory }; }
}
const projects = new ProjectSessionService(
  { listAll: async () => [] }, join(directory, "sessions"),
  { forDirectory: async () => undefined }, new ProjectMetadataStore(join(directory, "projects.json")), directory,
);
const server = createPiChatServer(undefined, undefined, {
  continueProject: async () => { throw new Error("unsupported"); },
  openSession: async () => { throw new Error("unsupported"); },
  newSession: async path => {
    if (path !== directory) throw new Error("Unexpected project path");
    created++;
    return new DemoRuntime("swift-demo");
  },
}, undefined, undefined, undefined, undefined, projects);
server.httpServer.listen(0, "127.0.0.1");
await once(server.httpServer, "listening");
const endpoint = `ws://127.0.0.1:${(server.httpServer.address() as AddressInfo).port}/ws`;
await writeFile(join(directory, "endpoint.tmp"), endpoint);
await rename(join(directory, "endpoint.tmp"), join(directory, "endpoint"));
let stopping = false;
process.on("SIGTERM", () => { void cleanup(); });
async function cleanup() {
  if (stopping) return;
  stopping = true;
  const timeout = setTimeout(() => process.exit(2), 5000);
  const socket = new WebSocket(endpoint);
  const replies = new Map<string, (message: any) => void>();
  socket.on("message", bytes => {
    const message = JSON.parse(bytes.toString());
    if (message.type === "response") replies.get(message.requestId)?.(message);
  });
  await once(socket, "open");
  let counter = 0;
  const request = (method: string, params: object, sessionId?: string): Promise<any> => new Promise(resolve => {
    const requestId = `cleanup-${++counter}`;
    replies.set(requestId, resolve);
    socket.send(JSON.stringify({ version: 2, type: "request", requestId, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const initialized = await request("server.initialize", { client: { name: "test-cleanup", version: "1" }, capabilities: [] });
  const retained = initialized.result.inventory.sessions;
  for (const session of retained) {
    const closed = await request("session.close", {}, session.sessionId);
    if (!closed.ok) throw new Error("Test runtime cleanup failed");
  }
  socket.close();
  await once(socket, "close");
  await server.close();
  await writeFile(join(directory, "cleanup.json"), JSON.stringify({ created, retained: retained.length, closed: retained.length }));
  clearTimeout(timeout);
}
