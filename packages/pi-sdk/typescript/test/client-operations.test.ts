import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PiClient } from "../src/client.js";
import { SDKError } from "../src/errors.js";
import { fakeTransport, snapshot, tabs, catalogue } from "./fake-transport.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
function setup(options: Partial<ConstructorParameters<typeof PiClient>[0]> = {}) {
  const fake = fakeTransport();
  const client = new PiClient({ endpoint: "ws://example/ws", transport: fake.factory, ...options });
  client.start(); vi.advanceTimersByTime(0); const socket = fake.sockets[0]!;
  socket.open(); socket.message(snapshot()); socket.message(tabs("s")); socket.message(catalogue);
  return { client, socket, ...fake, sent: () => socket.sent.map((text) => JSON.parse(text)) };
}

describe("typed v1 client operations", () => {
  it("routes explicit session controls without inventing admission receipts", () => {
    const { client, sent } = setup();
    client.prompt("background", "hello"); client.abort("background");
    client.respondToPrompt("s", "question", { cancelled: false, value: true });
    client.selectModel("s", "provider/model"); client.setThinkingLevel("s", "high");
    client.compactSession("s"); client.runExtensionAction("s", "demo.run");
    client.focusSession("s"); client.openSession("/history"); client.openProject("/project"); client.restartServer();
    expect(sent()).toEqual([
      { version: 1, type: "prompt", sessionId: "background", message: "hello" },
      { version: 1, type: "abort", sessionId: "background" },
      { version: 1, type: "uiPromptResponse", sessionId: "s", promptId: "question", result: { cancelled: false, value: true } },
      { version: 1, type: "runFeature", sessionId: "s", featureId: "model.select", input: { model: "provider/model" } },
      { version: 1, type: "runFeature", sessionId: "s", featureId: "thinking.level", input: { level: "high" } },
      { version: 1, type: "runFeature", sessionId: "s", featureId: "session.compact", input: {} },
      { version: 1, type: "runExtensionAction", sessionId: "s", actionId: "demo.run" },
      { version: 1, type: "focusTab", sessionId: "s" }, { version: 1, type: "openSession", path: "/history" },
      { version: 1, type: "openProject", path: "/project" },
      { version: 1, type: "runFeature", sessionId: "app", featureId: "app.restart", input: {} },
    ]);
    expect(() => client.prompt("s", "  ")).toThrow(/Invalid/);
    client.dispose();
  });

  it("correlates all request families and ignores mismatched family/session replies", async () => {
    const { client, socket, sent } = setup();
    const browse = client.browseDirectories({ path: "/example" });
    const create = client.createSession("/example");
    const complete = client.completeCommandArguments("s", "demo", "a");
    const file = client.openFile("s", "/example/file");
    const archive = client.archiveSession("/history", true);
    const pin = client.pinProject("/example", false);
    const remove = client.removeProject("/example");
    const commands = sent();
    expect(new Set(commands.map((command) => command.requestId)).size).toBe(7);
    let completed = false; void complete.then(() => { completed = true; });
    socket.message({ version: 1, type: "commandArgumentCompletions", sessionId: "wrong", requestId: commands[2].requestId, items: [] });
    await Promise.resolve(); expect(completed).toBe(false);
    socket.message({ version: 1, type: "sessionOpened", requestId: commands[0].requestId, sessionId: "wrong-family" });
    socket.message({ version: 1, type: "directoryListing", requestId: commands[0].requestId, listing: { path: "/example", breadcrumbs: [], entries: [] } });
    socket.message({ version: 1, type: "sessionOpened", requestId: commands[1].requestId, sessionId: "new" });
    socket.message({ version: 1, type: "commandArgumentCompletions", sessionId: "s", requestId: commands[2].requestId, items: [{ value: "a", label: "A" }] });
    socket.message({ version: 1, type: "fileOpenResult", sessionId: "s", requestId: commands[3].requestId, result: { ok: true } });
    for (const command of commands.slice(4)) socket.message({ version: 1, type: "projectMutationResult", requestId: command.requestId });
    await expect(browse).resolves.toMatchObject({ path: "/example" });
    await expect(create).resolves.toBe("new"); await expect(complete).resolves.toEqual([{ value: "a", label: "A" }]);
    await Promise.all([file, archive, pin, remove]);
    expect(client.getState().sessions).not.toHaveProperty("wrong-family");
    client.dispose(); expect(vi.getTimerCount()).toBe(0);
  });

  it("bounds aggregate pending requests and times out mutations as uncertain without replay", async () => {
    const { client, socket, sockets, sent } = setup({ maxPendingRequests: 1, requestTimeoutMs: 20 });
    const first = client.createSession();
    const timeout = expect(first).rejects.toMatchObject({ code: "timeout", outcome: "unknown" });
    await expect(client.pinProject("/project", true)).rejects.toMatchObject({ code: "limitExceeded", outcome: "notSent" });
    expect(sent()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(20); await timeout;
    socket.end(); vi.advanceTimersByTime(250); sockets[1]!.open(); sockets[1]!.message(tabs()); sockets[1]!.message(catalogue);
    expect(sockets[1]!.sent).toEqual([]);
    const second = client.pinProject("/project", true); const error = expect(second).rejects.toMatchObject({ code: "serverError", outcome: "rejected" });
    const command = JSON.parse(sockets[1]!.sent[0]!); sockets[1]!.message({ version: 1, type: "projectMutationResult", requestId: command.requestId, error: "disk full" });
    await error; client.dispose(); expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels only local waits, handles pre-abort, and removes abort listeners", async () => {
    const { client, sent } = setup(); const abort = new AbortController();
    const remove = vi.spyOn(abort.signal, "removeEventListener");
    const pending = client.createSession("/example", { signal: abort.signal });
    const rejected = expect(pending).rejects.toMatchObject({ code: "cancelled", outcome: "unknown" });
    abort.abort(); await rejected; expect(remove).toHaveBeenCalledOnce(); expect(sent()).toHaveLength(1);
    await expect(client.browseDirectories({ path: "/example" }, { signal: abort.signal })).rejects.toMatchObject({ code: "cancelled", outcome: "notSent" });
    expect(sent()).toHaveLength(1); client.dispose(); expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["stop", "dispose", "takeControl"] as const)("rejects outstanding waits on %s", async (action) => {
    const { client } = setup(); const pending = client.createSession(); const rejected = expect(pending).rejects.toMatchObject({ outcome: "unknown" });
    client[action](); await rejected; client.dispose(); expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects all outstanding families on disconnect and suppresses stale replies", async () => {
    const { client, socket, sockets, sent } = setup();
    const pending = [client.createSession(), client.completeCommandArguments("s", "demo", ""), client.pinProject("/project", true), client.openFile("s", "/file")];
    const rejected = pending.map((promise) => expect(promise).rejects.toMatchObject({ code: "disconnected", outcome: "unknown" }));
    const commands = sent(); socket.end(); await Promise.all(rejected);
    vi.advanceTimersByTime(250); sockets[1]!.open();
    const next = client.createSession(); const id = JSON.parse(sockets[1]!.sent[0]!).requestId;
    expect(id).not.toBe(commands[0].requestId);
    socket.message({ version: 1, type: "sessionOpened", requestId: id, sessionId: "obsolete" });
    sockets[1]!.message({ version: 1, type: "sessionOpened", requestId: id, sessionId: "fresh" });
    await expect(next).resolves.toBe("fresh"); client.dispose(); expect(vi.getTimerCount()).toBe(0);
  });

  it("deduplicates file opens and cancels session-scoped requests when closed", async () => {
    const { client, socket, sent } = setup();
    const file = client.openFile("s", "/file"); expect(client.openFile("s", "/file")).toBe(file);
    const completion = client.completeCommandArguments("s", "demo", "");
    const rejected = [file, completion].map((promise) => expect(promise).rejects.toMatchObject({ code: "cancelled", outcome: "unknown" }));
    client.closeSession("s"); await Promise.all(rejected);
    expect(sent().map((command) => command.type)).toEqual(["openFile", "completeCommandArguments", "closeTab"]);
    const next = client.openFile("s", "/other"); const reject = expect(next).rejects.toMatchObject({ code: "cancelled" });
    socket.message(tabs()); await reject; client.dispose(); expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["unknown", "notSent"] as const)("cleans a synchronous send failure with %s outcome", async (outcome) => {
    const fake = fakeTransport();
    const client = new PiClient({ endpoint: "ws://example/ws", transport: (endpoint, handlers) => {
      const transport = fake.factory(endpoint, handlers);
      return { ...transport, send() { throw outcome === "unknown" ? new Error("socket failed") : new SDKError("limitExceeded", "buffer full"); } };
    } });
    client.start(); vi.advanceTimersByTime(0);
    const socket = fake.sockets[0]!; socket.open(); socket.message(tabs()); socket.message(catalogue);
    await expect(client.createSession()).rejects.toMatchObject({ outcome, requestId: expect.any(String) });
    client.dispose(); expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps separately cancellable file-open waits independent", async () => {
    const { client, socket, sent } = setup();
    const abort = new AbortController();
    const first = client.openFile("s", "/file", { signal: abort.signal });
    const second = client.openFile("s", "/file", { signal: new AbortController().signal });
    const rejected = expect(first).rejects.toMatchObject({ code: "cancelled" });
    abort.abort(); await rejected;
    expect(sent()).toHaveLength(2);
    socket.message({ version: 1, type: "fileOpenResult", sessionId: "s", requestId: sent()[1].requestId, result: { ok: true } });
    await second; client.dispose(); expect(vi.getTimerCount()).toBe(0);
  });

  it("reports not-sent requests while offline and validates before allocating", async () => {
    const { client, socket } = setup();
    await expect(client.openFile("s", "https://example.com")).rejects.toMatchObject({ code: "invalidRequest", outcome: "notSent" });
    socket.end();
    await expect(client.createSession()).rejects.toMatchObject({ code: "notConnected", outcome: "notSent" });
    client.dispose(); expect(vi.getTimerCount()).toBe(0);
  });
});
