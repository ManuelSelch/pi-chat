import { describe, expect, it, vi } from "vitest";
import { ChatApplicationService } from "../../../../src/application/chat-application-service.js";

import type { ProjectSessionService } from "../../../../src/projects/project-session-service.js";
import type { ProjectCatalogue } from "@manuelselch/pi-sdk/protocol";
import type { RuntimeSnapshot } from "../../../../src/runtime/contracts.js";
import { ServerPublisher } from "../../../../src/transport/server-publisher.js";
import { eventSchema, type Event, type Result } from "@manuelselch/pi-sdk/protocol";
import { FakeRuntimeAdapter } from "../../../infra/fake-runtime-adapter.js";

function deferred() {
  let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve };
}
function setup() {
  const runtime = new FakeRuntimeAdapter("s1"); let state = runtime.snapshot();
  vi.spyOn(runtime, "snapshot").mockImplementation(() => state);
  const replacement = new FakeRuntimeAdapter("s1");
  const catalogue = vi.fn(async (): Promise<ProjectCatalogue> => ({ projects: [] }));
  const chat = new ChatApplicationService(runtime, { continueProject: async () => replacement, openSession: async () => replacement, newSession: async () => replacement }, { catalogue } as unknown as ProjectSessionService);
  const messages: Event[] = []; const publisher = new ServerPublisher(chat, event => messages.push(eventSchema.parse(event)));
  const addUser = (id: string, text: string) => {
    const user = { id, role: "user" as const, text }; state = { ...state, messages: [...state.messages, user], isStreaming: true };
    publisher.publish("s1", { type: "messageFinal", runId: "run", message: user });
  };
  return { chat, catalogue, publisher, messages, addUser,
    setState: (next: Partial<RuntimeSnapshot>) => { state = { ...state, ...next }; },
    snapshots: () => messages.flatMap(message => message.event === "session.snapshot" ? [message.data] : []),
  };
}
function prepareWith(chat: ChatApplicationService, wait: () => Promise<void>) {
  const prepare = chat.prepareSnapshot.bind(chat);
  return vi.spyOn(chat, "prepareSnapshot").mockImplementation(async sessionId => {
    const capture = await prepare(sessionId);
    await wait();
    return capture;
  });
}
describe("v2 atomic snapshot publication", () => {
  it.each([false, true])("initializes from cached projects without waiting for refresh (warm=%s)", async warm => {
    const context = setup(); const gate = deferred();
    if (warm) await context.publisher.refreshProjects();
    const cached = context.publisher.projects();
    const refreshed: ProjectCatalogue = { projects: [{ path: "/new", displayPath: "/new", name: "New", exists: true, modified: 1, sessionCount: 0, sessions: [] }] };
    context.messages.length = 0;
    context.catalogue.mockImplementation(async () => { await gate.promise; return refreshed; });
    let initial: Result<"server.initialize"> | undefined;
    const pending = context.publisher.prepareInitial("connection", []).then(capture => { initial = capture(); });
    try {
      await vi.waitFor(() => expect(initial).toBeDefined());
      expect(initial!.projects).toEqual(cached);
      expect(initial!.snapshots).toHaveLength(1);
      expect(context.messages).toEqual([]);
      gate.resolve(); await pending;
      await vi.waitFor(() => expect(context.publisher.projects().catalogue).toEqual(refreshed));
      expect(context.messages).toMatchObject([{ event: "project.list.changed", data: { revision: cached.revision! + 1, catalogue: refreshed } }]);
    } finally { gate.resolve(); await pending; await context.chat.dispose(); }
  });

  it("includes refreshes completed during snapshot preparation without losing fresh watermarks", async () => {
    const context = setup(); const gate = deferred(); const entered = deferred();
    prepareWith(context.chat, async () => { entered.resolve(); await gate.promise; });
    const pending = context.publisher.prepareInitial("connection", []);
    try {
      await entered.promise;
      await vi.waitFor(() => expect(context.publisher.projects().revision).toBe(1));
      context.addUser("u1", "During initialization");
      gate.resolve(); const capture = await pending; const initial = capture();
      expect(initial.projects.revision).toBe(1);
      expect(initial.snapshots).toMatchObject([{ throughSequence: 1, messages: [{ id: "u1" }] }]);
    } finally { gate.resolve(); await pending; await context.chat.dispose(); }
  });

  it("keeps cached projects usable if the background initialization refresh fails", async () => {
    const context = setup(); await context.publisher.refreshProjects();
    const cached = context.publisher.projects(); context.messages.length = 0;
    context.catalogue.mockRejectedValue(new Error("Scan failed"));
    const capture = await context.publisher.prepareInitial("connection", []);
    expect(capture().projects).toEqual(cached);
    expect(context.messages).toEqual([]);
    await context.chat.dispose();
  });

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
  it("captures fresh state and watermark after asynchronous preparation", async () => {
    const context = setup(); const gate = deferred(); const entered = deferred();
    prepareWith(context.chat, async () => { entered.resolve(); await gate.promise; });
    const pending = context.publisher.sendSnapshot("s1"); await entered.promise;
    context.addUser("u1", "During preparation"); context.publisher.publish("s1", { type: "runtimeStatus", status: "running" });
    gate.resolve(); await pending;
    expect(context.snapshots()).toMatchObject([{ throughSequence: 2, runtime: { status: "running" }, messages: [{ id: "u1" }] }]);
    await context.chat.dispose();
  });
  it("keeps overlapping preparations fresh when completed in reverse order", async () => {
    const context = setup(); const first = deferred(); const second = deferred();
    const hook = vi.fn().mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
    prepareWith(context.chat, hook);
    const older = context.publisher.sendSnapshot("s1"); await vi.waitFor(() => expect(hook).toHaveBeenCalledTimes(1));
    context.addUser("u1", "First"); const newer = context.publisher.sendSnapshot("s1"); await vi.waitFor(() => expect(hook).toHaveBeenCalledTimes(2));
    second.resolve(); await newer; context.addUser("u2", "Second"); first.resolve(); await older;
    expect(context.snapshots().map(snapshot => snapshot.throughSequence)).toEqual([1, 2]);
    expect(context.snapshots().at(-1)?.messages).toMatchObject([{ id: "u1" }, { id: "u2" }]); await context.chat.dispose();
  });
  it.each([false, true])("discards preparation after closing or reopening (reopen=%s)", async reopen => {
    const context = setup(); const gate = deferred(); const entered = deferred();
    prepareWith(context.chat, async () => { entered.resolve(); await gate.promise; });
    const pending = context.publisher.sendSnapshot("s1"); await entered.promise;
    await context.chat.closeTab("s1"); if (reopen) await context.chat.openSession("s1.jsonl");
    gate.resolve(); await pending; expect(context.snapshots()).toEqual([]); await context.chat.dispose();
  });


  it("increments presentation revision when native widgets change", async () => {
    const context = setup();
    await context.publisher.sendSnapshot("s1");
    const initial = context.snapshots()[0]!.presentation!.revision;
    context.setState({ widgets: [{ key: "native", placement: "aboveEditor", lines: ["Updated"] }] });
    await context.publisher.sendSnapshot("s1");
    expect(context.snapshots()[1]!.presentation!.revision).toBeGreaterThan(initial);
    expect(context.snapshots()[1]!.presentation!.widgets).toHaveLength(1);
    expect(context.snapshots()[1]!.presentation).not.toHaveProperty("extensions");
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
