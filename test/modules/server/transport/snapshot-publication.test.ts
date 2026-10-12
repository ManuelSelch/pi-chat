import { describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";
import { ChatApplicationService } from "../../../../src/server/application/chat-application-service.js";
import { createPiChatExtensionRegistry } from "../../../../src/server/extensions/extension-registry.js";
import type { ProjectSessionService } from "../../../../src/server/projects/project-session-service.js";
import type { ProjectCatalogue } from "../../../../src/shared/protocol.js";
import type { RuntimeSnapshot } from "../../../../src/server/runtime/contracts.js";
import { ServerPublisher } from "../../../../src/server/transport/server-publisher.js";
import { initialChatState, reduceServerMessage } from "../../../../src/web/app/state/chat-state.js";
import type { ServerMessage } from "../../../../src/shared/protocol.js";
import { FakeRuntimeAdapter } from "../../../infra/fake-runtime-adapter.js";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

function setup() {
  const runtime = new FakeRuntimeAdapter("s1");
  let state = runtime.snapshot();
  vi.spyOn(runtime, "snapshot").mockImplementation(() => state);
  const replacement = new FakeRuntimeAdapter("s1");
  const extensions = createPiChatExtensionRegistry();
  const catalogue = vi.fn(async (): Promise<ProjectCatalogue> => ({ projects: [] }));
  const chat = new ChatApplicationService(runtime, {
    continueProject: async () => replacement,
    openSession: async () => replacement,
    newSession: async () => replacement,
  }, { catalogue } as unknown as ProjectSessionService, undefined, extensions);
  const messages: ServerMessage[] = [];
  const socket = { readyState: WebSocket.OPEN, send: vi.fn((json: string) => messages.push(JSON.parse(json))) } as unknown as WebSocket;
  let controller: WebSocket | undefined = socket;
  const publisher = new ServerPublisher(chat, () => controller);
  const addUser = (id: string, text: string) => {
    const user = { id, role: "user" as const, text };
    state = { ...state, messages: [...state.messages, user], isStreaming: true };
    publisher.publish("s1", { type: "messageFinal", runId: "run", message: user });
  };
  return {
    runtime, chat, extensions, catalogue, publisher, socket, messages, addUser,
    setState: (next: Partial<RuntimeSnapshot>) => { state = { ...state, ...next }; },
    setController: (next: WebSocket | undefined) => { controller = next; },
    snapshots: () => messages.filter(message => message.type === "snapshot"),
  };
}

describe("atomic snapshot publication", () => {
  it("captures current messages and status after catalogue preparation, without rewinding the reducer", async () => {
    const context = setup();
    const gate = deferred();
    context.catalogue.mockImplementationOnce(async () => { await gate.promise; return { projects: [] }; });
    const pending = context.publisher.sendSnapshot("s1");
    await vi.waitFor(() => expect(context.catalogue).toHaveBeenCalledOnce());
    context.addUser("u1", "Quick message after bash");
    context.publisher.publish("s1", { type: "runtimeStatus", status: "running" });
    gate.resolve();
    await pending;
    expect(context.snapshots()).toMatchObject([{
      throughSequence: 2, isStreaming: true,
      messages: [{ id: "u1", text: "Quick message after bash" }],
    }]);
    const state = context.messages.filter(message => "sequence" in message)
      .reduce((state, message) => reduceServerMessage(state, message as Parameters<typeof reduceServerMessage>[1]), initialChatState);
    expect(state.sequence).toBe(2);
    expect(state.status).toBe("running");
    expect(state.messages).toMatchObject([{ id: "u1" }]);
    await context.chat.dispose();
  });

  it("includes messages produced while a snapshot extension hook is awaiting", async () => {
    const context = setup();
    const gate = deferred();
    const entered = deferred();
    context.extensions.on("session.snapshot", async () => { entered.resolve(); await gate.promise; });
    const pending = context.publisher.sendSnapshot("s1");
    await entered.promise;
    context.addUser("u1", "During hook");
    gate.resolve();
    await pending;
    expect(context.snapshots()).toMatchObject([{ throughSequence: 1, messages: [{ id: "u1" }] }]);
    await context.chat.dispose();
  });

  it("publishes fresh state when overlapping preparations complete in reverse order", async () => {
    const context = setup();
    const first = deferred();
    const second = deferred();
    context.catalogue
      .mockImplementationOnce(async () => { await first.promise; return { projects: [] }; })
      .mockImplementationOnce(async () => { await second.promise; return { projects: [] }; });
    const older = context.publisher.sendSnapshot("s1");
    await vi.waitFor(() => expect(context.catalogue).toHaveBeenCalledTimes(1));
    context.addUser("u1", "First");
    const newer = context.publisher.sendSnapshot("s1");
    await vi.waitFor(() => expect(context.catalogue).toHaveBeenCalledTimes(2));
    second.resolve();
    await newer;
    context.addUser("u2", "Second");
    first.resolve();
    await older;
    expect(context.snapshots().map(snapshot => snapshot.throughSequence)).toEqual([1, 2]);
    expect(context.snapshots().at(-1)?.messages).toMatchObject([{ id: "u1" }, { id: "u2" }]);
    const sequences = context.messages.filter(message => "sequence" in message).map(message => "sequence" in message ? message.sequence : -1);
    expect(sequences).toEqual([1, 1, 2, 2]);
    await context.chat.dispose();
  });

  it.each([false, true])("discards preparation after closing the session (reopen=%s)", async reopen => {
    const context = setup();
    const gate = deferred();
    context.catalogue.mockImplementationOnce(async () => { await gate.promise; return { projects: [] }; });
    const pending = context.publisher.sendSnapshot("s1");
    await vi.waitFor(() => expect(context.catalogue).toHaveBeenCalledOnce());
    await context.chat.closeTab("s1");
    if (reopen) await context.chat.openSession("s1.jsonl");
    gate.resolve();
    await pending;
    expect(context.snapshots()).toEqual([]);
    await context.chat.dispose();
  });

  it.each(["closed", "replaced"] as const)("does not publish to a %s connection after preparation", async invalidation => {
    const context = setup();
    const gate = deferred();
    context.catalogue.mockImplementationOnce(async () => { await gate.promise; return { projects: [] }; });
    const pending = context.publisher.sendAll(context.socket);
    await vi.waitFor(() => expect(context.catalogue).toHaveBeenCalledOnce());
    if (invalidation === "closed") Object.assign(context.socket, { readyState: WebSocket.CLOSED });
    else context.setController({ readyState: WebSocket.OPEN, send: vi.fn() } as unknown as WebSocket);
    gate.resolve();
    await pending;
    expect(context.socket.send).not.toHaveBeenCalled();
    await context.chat.dispose();
  });

  it("drops a delayed catalogue for an obsolete connection", async () => {
    const context = setup();
    const gate = deferred();
    context.catalogue.mockImplementationOnce(async () => { await gate.promise; return { projects: [] }; });
    const pending = context.publisher.sendCatalogue();
    await vi.waitFor(() => expect(context.catalogue).toHaveBeenCalledOnce());
    context.setController(undefined);
    gate.resolve();
    await pending;
    expect(context.socket.send).not.toHaveBeenCalled();
    await context.chat.dispose();
  });
});
