import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PiClient } from "../src/client.js";
import { SDKError } from "../src/errors.js";
import { capabilitySchema, requestSchema } from "../src/protocol/v2.js";
import { fakeTransport } from "./fake-transport.js";
import { initialized, snap, event } from "./v2-fixtures.js";
import { validExamples } from "./v2-fixture-examples.js";
beforeEach(() => vi.useFakeTimers()); afterEach(() => vi.useRealTimers());
function setup(options: Partial<ConstructorParameters<typeof PiClient>[0]> = {}) {
  const fake = fakeTransport(); const client = new PiClient({ endpoint: "ws://example/ws", transport: fake.factory, ...options }); client.start(); vi.advanceTimersByTime(0); const socket = fake.sockets[0]!; socket.open();
  const requests = () => socket.sent.map(s => JSON.parse(s));
  const reply = (result: unknown, requestId = requests().at(-1).requestId) => socket.message({ version: 2, type: "response", requestId, ok: true, result });
  reply({ ...initialized([snap("runtime")]), capabilities: capabilitySchema.options }); return { ...fake, client, socket, requests, reply };
}
for (const example of validExamples().operations.filter(value => value.method !== "server.initialize")) {
  it(`correlates and validates ${example.method} through the unified request path`, async () => {
    const t = setup(); const parsed = requestSchema.parse(example.request); const pending = t.client.request(example.method, parsed.params, parsed.sessionId);
    expect(t.requests().at(-1)).toMatchObject({ method: example.method, params: parsed.params });
    t.socket.message({ ...example.response, requestId: "unrelated" });
    t.reply(example.response.result); await expect(pending).resolves.toEqual(example.response.result); t.client.dispose(); expect(vi.getTimerCount()).toBe(0);
  });
}
it("routes convenience operations to explicit session IDs and typed method names", async () => {
  const t = setup(); const pending = [t.client.prompt("runtime", "hello"), t.client.abort("runtime"), t.client.selectModel("runtime", "p/m"), t.client.setThinkingLevel("runtime", "off"), t.client.compactSession("runtime"), t.client.runExtensionAction("runtime", "demo"), t.client.respondToPrompt("runtime", "q", { cancelled: true }), t.client.reloadSession("runtime")];
  expect(t.requests().slice(1).map(value => [value.method, value.sessionId])).toEqual(["message.send", "run.abort", "model.select", "thinking.level", "session.compact", "extension.run", "prompt.answer", "session.reload"].map(method => [method, "runtime"]));
  const rejected = Promise.all(pending.map(wait => expect(wait).rejects.toMatchObject({ outcome: "unknown" }))); t.client.dispose(); await rejected;
});
it("matches only pending IDs and fails invalid method result shapes instead of cross-family resolution", async () => {
  const t = setup(); const pending = t.client.browseDirectories({ path: "/" }); const result = expect(pending).rejects.toMatchObject({ code: "invalidMessage", outcome: "unknown" });
  t.reply({ state: "completed" }); await result; expect(t.client.getState().connection.phase).toBe("failed"); t.client.dispose();
});
it("cleans signal listeners and makes pre-abort definitively notSent", async () => {
  const t = setup(); const abort = new AbortController(); abort.abort(); await expect(t.client.pinProject("/p", true, { signal: abort.signal })).rejects.toMatchObject({ code: "cancelled", outcome: "notSent" }); expect(t.requests()).toHaveLength(1);
  const next = new AbortController(); const remove = vi.spyOn(next.signal, "removeEventListener"); const pending = t.client.pinProject("/p", true, { signal: next.signal }); t.reply({ state: "completed" }); await pending; expect(remove).toHaveBeenCalled(); t.client.dispose(); expect(vi.getTimerCount()).toBe(0);
});
for (const action of ["stop", "dispose", "takeControl"] as const) it(`rejects all outstanding operations on ${action} without replay`, async () => {
  const t = setup(); const requests = [t.client.browseDirectories({ path: "/" }), t.client.createSession("/p"), t.client.completeCommandArguments("runtime", "deploy", "st"), t.client.openFile("runtime", "f.pdf"), t.client.pinProject("/p", true)];
  const rejected = Promise.all(requests.map(pending => expect(pending).rejects.toMatchObject({ outcome: "unknown" }))); t.client[action](); await rejected;
  if (action === "takeControl") { vi.advanceTimersByTime(0); t.sockets[1]!.open(); expect(t.sockets[1]!.sent.map(value => JSON.parse(value).method)).toEqual(["server.initialize"]); }
  t.client.dispose(); expect(vi.getTimerCount()).toBe(0);
});
it("cancels only closed-runtime waits and permits the correlated close response", async () => {
  const t = setup(); const file = t.client.openFile("runtime", "f.pdf"); const other = t.client.openFile("background", "f.pdf");
  const cancelled = expect(file).rejects.toMatchObject({ code: "cancelled", outcome: "unknown" }); const close = t.client.closeSession("runtime");
  t.socket.message(event("session.closed", { reason: "requested" }, 1, "runtime")); await cancelled;
  t.reply({ state: "completed" }); await close;
  t.reply({ state: "completed" }, t.requests()[2].requestId); await other; t.client.dispose();
});
for (const known of [false, true]) it(`cleans a synchronous send failure with ${known ? "notSent" : "unknown"} outcome`, async () => {
  const fake = fakeTransport(); const client = new PiClient({ endpoint: "ws://example/ws", transport: (url, events) => { const transport = fake.factory(url, events); return { ...transport, send(text) { if (JSON.parse(text).method !== "server.initialize") throw known ? new SDKError("limitExceeded", "full") : new Error("broken"); transport.send(text); } }; } });
  client.start(); vi.advanceTimersByTime(0); const socket = fake.sockets[0]!; socket.open(); socket.message({ version: 2, type: "response", requestId: "sdk-1", ok: true, result: initialized() });
  await expect(client.prompt("s", "hello")).rejects.toMatchObject({ outcome: known ? "notSent" : "unknown" }); client.dispose(); expect(vi.getTimerCount()).toBe(0);
});
it("validates before allocating requests and rejects operations while offline or unselected", async () => {
  const t = setup(); const count = t.requests().length; await expect(t.client.prompt("runtime", "  ")).rejects.toMatchObject({ code: "invalidRequest", outcome: "notSent" }); expect(t.requests()).toHaveLength(count);
  t.client.stop(); await expect(t.client.createSession("/p")).rejects.toMatchObject({ code: "notConnected", outcome: "notSent" }); t.client.dispose();
});
