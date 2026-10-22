// Test-owned server only: fake runtime, empty history, temporary metadata, loopback.
import { once } from "node:events";
import { chmod, mkdtemp, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import WebSocket from "ws";
import type { RuntimeEvent } from "../../../../src/server/runtime/contracts.js";
import type { ChatMessage } from "../../../../src/shared/protocol.js";
import { createPiChatServer } from "../../../../src/server/bootstrap/server.js";
import { FakeRuntimeAdapter } from "../../../../test/infra/fake-runtime-adapter.js";
import { ProjectSessionService } from "../../../../src/server/projects/project-session-service.js";
import { ProjectMetadataStore } from "../../../../src/server/projects/project-metadata-store.js";

if (process.argv.length !== 2) throw new Error("The loopback fixture does not accept arguments.");
const directory = await realpath(await mkdtemp(join(tmpdir(), "pi-swift-fixture-")));
await chmod(directory, 0o700);
let created = 0;
class DemoRuntime extends FakeRuntimeAdapter {
  private readonly observers = new Set<(event: RuntimeEvent) => void>();
  private transcript: ChatMessage[] = [];
  private active = false;
  private cancelled = false;
  private turn = 0;
  private completion?: Promise<void>;
  override snapshot() { return { ...super.snapshot(), projectPath: directory, messages: [...this.transcript], isStreaming: this.active }; }
  override subscribe(listener: (event: RuntimeEvent) => void) { this.observers.add(listener); return () => { this.observers.delete(listener); }; }
  private publish(event: RuntimeEvent) { for (const listener of this.observers) listener(event); }
  override async prompt(message: string) {
    this.active = true; this.cancelled = false;
    const runId = `turn-${++this.turn}`;
    const user = { id: `${runId}-user`, role: "user" as const, text: message };
    this.transcript.push(user);
    this.publish({ type: "messageFinal", runId, message: user });
    this.publish({ type: "runtimeStatus", status: "running" });
    this.completion = (async () => {
      let text = "";
      for (const chunk of ["Hello ", "from ", "the ", "isolated ", "Swift ", "demo."]) {
        await new Promise(resolve => setTimeout(resolve, 80));
        if (this.cancelled) break;
        text += chunk;
        this.publish({ type: "assistantDelta", runId, delta: chunk });
      }
      if (!this.cancelled) {
        const assistant = { id: `${runId}-assistant`, role: "assistant" as const, text };
        this.transcript.push(assistant);
        this.publish({ type: "messageFinal", runId, message: assistant });
      }
      this.active = false;
      this.publish({ type: "runtimeStatus", status: "idle" });
    })();
    await this.completion;
  }
  override async abort() {
    if (!this.active) return;
    this.cancelled = true;
    this.publish({ type: "runtimeStatus", status: "aborting" });
    await this.completion;
  }
  override dispose() { this.cancelled = true; this.observers.clear(); super.dispose(); }
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
let stopping = false;
process.on("SIGTERM", () => {
  void cleanup().catch(error => { console.error(error); process.exit(1); });
});
// Readiness is a stdout record, never a write into a caller-selected directory.
console.log(`PI_FIXTURE_READY ${JSON.stringify({ directory, endpoint })}`);
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
  await writeFile(join(directory, "cleanup.json"), JSON.stringify({ created, retained: retained.length, closed: retained.length }), {
    flag: "wx", mode: 0o600,
  });
  clearTimeout(timeout);
}
