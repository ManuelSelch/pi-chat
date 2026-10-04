/** Run with: npm run test:spike
 * Uses the commit-pinned GitHub fork; see docs/integration-tests/SPIKE.md.
 */
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { AgentSessionRuntime, type AgentSession, type AgentSessionServices } from "@earendil-works/pi-coding-agent";
import { createTestSession, says, when } from "@marcfargas/pi-test-harness";
import WebSocket from "ws";
import { createPiChatServer } from "../../src/server/bootstrap/server.js";
import { PiRuntimeAdapter } from "../../src/server/runtime/pi/pi-runtime-adapter.js";
import { PROTOCOL_VERSION, serverMessageSchema, type ServerMessage } from "../../src/shared/protocol.js";

const t = await createTestSession();
const session: AgentSession = t.session;
const services: AgentSessionServices = {
  cwd: t.cwd, agentDir: t.cwd,
  modelRuntime: session.modelRuntime,
  settingsManager: session.settingsManager,
  resourceLoader: session.resourceLoader,
  diagnostics: [],
};
// The spike does not support runtime replacement; fail rather than falling back
// to the user's production runtime/settings.
const runtime = new AgentSessionRuntime(session, services, async () => {
  throw new Error("Runtime replacement is outside this spike");
});
let server: ReturnType<typeof createPiChatServer> | undefined;
const sockets: WebSocket[] = [];

function observe(socket: WebSocket) {
  const messages: ServerMessage[] = [];
  const waiters = new Set<() => void>();
  let failure: unknown;
  const notify = () => { for (const waiter of [...waiters]) waiter(); };
  socket.on("message", data => {
    try { messages.push(serverMessageSchema.parse(JSON.parse(data.toString()))); }
    catch (error) { failure = error; }
    notify();
  });
  socket.on("error", error => { failure = error; notify(); });
  socket.on("close", () => { failure ??= new Error("Socket closed before matching message"); notify(); });
  return (predicate: (m: ServerMessage) => boolean): Promise<ServerMessage> => new Promise((resolve, reject) => {
    const finish = (error?: unknown, message?: ServerMessage) => {
      clearTimeout(timer);
      waiters.delete(check);
      if (error) reject(error); else resolve(message!);
    };
    const check = () => {
      if (failure) return finish(failure);
      const found = messages.find(predicate);
      if (found) finish(undefined, found);
    };
    const timer = setTimeout(() => finish(new Error(`Timed out. Recent messages: ${JSON.stringify(messages.slice(-10))}`)), 5000);
    waiters.add(check);
    check();
  });
}

try {
  t.prepare(when("Hello", [says("Hello from the real Pi runtime.")]));
  const adapter = PiRuntimeAdapter.fromRuntime(runtime);
  server = createPiChatServer(adapter);
  await new Promise<void>(resolve => server!.httpServer.listen(0, "127.0.0.1", resolve));
  const url = `ws://127.0.0.1:${(server.httpServer.address() as AddressInfo).port}/ws`;
  const socket = new WebSocket(url);
  sockets.push(socket);
  const waitFor = observe(socket);
  const initial = await waitFor(m => m.type === "snapshot");
  assert.equal(initial.type, "snapshot");
  socket.send(JSON.stringify({ version: PROTOCOL_VERSION, sessionId: session.sessionId, type: "prompt", message: "Hello" }));
  const final = await waitFor(m => m.type === "messageFinal" && m.message.role === "assistant");
  assert.equal(final.type, "messageFinal");
  if (final.type === "messageFinal" && final.message.role === "assistant") assert.equal(final.message.text, "Hello from the real Pi runtime.");
  await waitFor(m => m.type === "runtimeStatus" && m.status === "idle");
  assert.deepEqual(t.playbook, { consumed: 1, remaining: 0 });
  const expected = [{ role: "user", text: "Hello" }, { role: "assistant", text: "Hello from the real Pi runtime." }];
  assert.deepEqual(adapter.snapshot().messages.map(m => ({ role: m.role, text: "text" in m ? m.text : undefined })), expected);
  socket.close();
  await new Promise<void>(resolve => socket.once("close", () => resolve()));
  const reloaded = new WebSocket(url);
  sockets.push(reloaded);
  const restored = await observe(reloaded)(m => m.type === "snapshot");
  if (restored.type === "snapshot") {
    assert.deepEqual(restored.messages.map(m => ({ role: m.role, text: "text" in m ? m.text : undefined })), expected);
  }
  console.log("PASS: fork → real Pi session → PiRuntimeAdapter → Pi Chat WebSocket prompt/reply and reconnect");
} finally {
  for (const socket of sockets) socket.terminate();
  if (server) await server.close(); else await runtime.dispose();
  t.dispose();
}
