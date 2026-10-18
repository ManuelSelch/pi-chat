import { describe, expect, it, vi } from "vitest";
import { ChatApplicationService } from "../../../../src/server/application/chat-application-service.js";
import { createPiChatExtensionRegistry } from "../../../../src/server/extensions/extension-registry.js";
import type { ProjectSessionService } from "../../../../src/server/projects/project-session-service.js";
import type { ProjectCatalogue } from "../../../../src/shared/protocol.js";
import type { RuntimeSnapshot } from "../../../../src/server/runtime/contracts.js";
import { ServerPublisher } from "../../../../src/server/transport/server-publisher.js";
import { eventSchema, type Event } from "@manuelselch/pi-sdk/contract";
import { FakeRuntimeAdapter } from "../../../infra/fake-runtime-adapter.js";

function deferred() {
  let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve };
}
function setup() {
  const runtime = new FakeRuntimeAdapter("s1"); let state = runtime.snapshot();
  vi.spyOn(runtime, "snapshot").mockImplementation(() => state);
  const replacement = new FakeRuntimeAdapter("s1"); const extensions = createPiChatExtensionRegistry();
  const catalogue = vi.fn(async (): Promise<ProjectCatalogue> => ({ projects: [] }));
  const chat = new ChatApplicationService(runtime, { continueProject: async () => replacement, openSession: async () => replacement, newSession: async () => replacement }, { catalogue } as unknown as ProjectSessionService, undefined, extensions);
  const messages: Event[] = []; const publisher = new ServerPublisher(chat, event => messages.push(eventSchema.parse(event)));
  const addUser = (id: string, text: string) => {
    const user = { id, role: "user" as const, text }; state = { ...state, messages: [...state.messages, user], isStreaming: true };
    publisher.publish("s1", { type: "messageFinal", runId: "run", message: user });
  };
  return { chat, extensions, catalogue, publisher, messages, addUser,
    setState: (next: Partial<RuntimeSnapshot>) => { state = { ...state, ...next }; },
    snapshots: () => messages.flatMap(message => message.event === "session.snapshot" ? [message.data] : []),
  };
}
describe("v2 atomic snapshot publication", () => {
  it("publishes transcripts independently of failed catalogue scans", async () => {
    const context = setup(); context.catalogue.mockRejectedValue(new Error("Catalogue unavailable"));
    await context.publisher.sendSnapshot("s1");
    expect(context.snapshots()).toHaveLength(1); expect(context.catalogue).not.toHaveBeenCalled();
    expect(context.snapshots()[0]).not.toHaveProperty("catalogue"); await context.chat.dispose();
  });
  it("publishes snapshots while a project refresh is blocked", async () => {
    const context = setup(); const gate = deferred();
    context.catalogue.mockImplementation(async () => { await gate.promise; return { projects: [] }; });
    const refresh = context.publisher.refreshProjects(); await vi.waitFor(() => expect(context.catalogue).toHaveBeenCalledOnce());
    try { await context.publisher.sendSnapshot("s1"); expect(context.snapshots()).toHaveLength(1); }
    finally { gate.resolve(); await refresh; await context.chat.dispose(); }
  });
  it("captures fresh state and watermark after asynchronous extension preparation", async () => {
    const context = setup(); const gate = deferred(); const entered = deferred();
    context.extensions.on("session.snapshot", async () => { entered.resolve(); await gate.promise; });
    const pending = context.publisher.sendSnapshot("s1"); await entered.promise;
    context.addUser("u1", "During hook"); context.publisher.publish("s1", { type: "runtimeStatus", status: "running" });
    gate.resolve(); await pending;
    expect(context.snapshots()).toMatchObject([{ throughSequence: 2, runtime: { status: "running" }, messages: [{ id: "u1" }] }]);
    await context.chat.dispose();
  });
  it("keeps overlapping preparations fresh when completed in reverse order", async () => {
    const context = setup(); const first = deferred(); const second = deferred();
    const hook = vi.fn().mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
    context.extensions.on("session.snapshot", hook);
    const older = context.publisher.sendSnapshot("s1"); await vi.waitFor(() => expect(hook).toHaveBeenCalledTimes(1));
    context.addUser("u1", "First"); const newer = context.publisher.sendSnapshot("s1"); await vi.waitFor(() => expect(hook).toHaveBeenCalledTimes(2));
    second.resolve(); await newer; context.addUser("u2", "Second"); first.resolve(); await older;
    expect(context.snapshots().map(snapshot => snapshot.throughSequence)).toEqual([1, 2]);
    expect(context.snapshots().at(-1)?.messages).toMatchObject([{ id: "u1" }, { id: "u2" }]); await context.chat.dispose();
  });
  it.each([false, true])("discards preparation after closing or reopening (reopen=%s)", async reopen => {
    const context = setup(); const gate = deferred(); const entered = deferred();
    context.extensions.on("session.snapshot", async () => { entered.resolve(); await gate.promise; });
    const pending = context.publisher.sendSnapshot("s1"); await entered.promise;
    await context.chat.closeTab("s1"); if (reopen) await context.chat.openSession("s1.jsonl");
    gate.resolve(); await pending; expect(context.snapshots()).toEqual([]); await context.chat.dispose();
  });
  it("does not reject an already successful open when a snapshot hook fails", async () => {
    const context = setup();
    context.extensions.on("session.snapshot", async () => { throw new Error("refresh failed"); });
    await expect(context.publisher.opened("s1")).resolves.toMatchObject({ snapshot: { sessionId: context.publisher.wireId("s1"), throughSequence: 0 }, summary: { sessionId: context.publisher.wireId("s1") } });
    await context.chat.dispose();
  });

  it("increments presentation revision when extension snapshot content changes", async () => {
    const context = setup();
    await context.publisher.sendSnapshot("s1");
    const initial = context.snapshots()[0]!.presentation!.revision;
    context.extensions.registerButton({ id: "demo", slot: "composer.right", label: "Demo", actionId: "demo.run" });
    await context.publisher.sendSnapshot("s1");
    expect(context.snapshots()[1]!.presentation!.revision).toBeGreaterThan(initial);
    expect(context.snapshots()[1]!.presentation!.extensions.buttons).toHaveLength(1);
    await context.chat.dispose();
  });

  it("does not rewind independently revisioned projects when an older scan completes last", async () => {
    const context = setup(); const gate = deferred();
    context.catalogue.mockImplementationOnce(async () => { await gate.promise; return { projects: [] }; });
    const older = context.publisher.refreshProjects(); await vi.waitFor(() => expect(context.catalogue).toHaveBeenCalledOnce());
    await context.publisher.refreshProjects(); const revision = context.publisher.projects().revision;
    gate.resolve(); await older; expect(context.publisher.projects().revision).toBe(revision);
    expect(context.messages.filter(message => message.event === "project.list.changed")).toHaveLength(1); await context.chat.dispose();
  });
});
