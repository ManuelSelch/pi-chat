import { describe, expect, it, vi } from "vitest";
import { eventSchema, type Event, type ProjectCatalogue } from "@manuelselch/pi-sdk/protocol";
import type { ChatApplicationService } from "../../../../src/application/chat-application-service.js";
import type { RuntimeSnapshot } from "../../../../src/runtime/contracts.js";
import { ServerPublisher } from "../../../../src/transport/server-publisher.js";

const replacement: RuntimeSnapshot = {
  sessionId: "worktree", sessionPath: "worktree.jsonl", projectPath: "/project-worktree", messages: [],
  isStreaming: false, actions: { features: [], commands: [] }, prompts: [], widgets: [], footer: [],
};

/** A switched runtime publishes one atomic replacement, never a preceding close. */
function setup(prepareSnapshot: () => Promise<() => RuntimeSnapshot> = async () => () => replacement) {
  const currentCatalogue = vi.fn<ChatApplicationService["currentCatalogue"]>(async () => ({ projects: [] }));
  const chat = {
    openSessionIds: () => ["worktree"],
    openSessionSnapshots: () => [replacement],
    captureSnapshot: () => replacement,
    prepareSnapshot,
    currentCatalogue,
  } as unknown as ChatApplicationService;
  const events: Event[] = [];
  const publisher = new ServerPublisher(chat, event => events.push(eventSchema.parse(event)));
  return { publisher, events, currentCatalogue, switch: () => {
    const previous = publisher.wireId("old-project"); const next = publisher.wireId("worktree");
    publisher.publish("worktree", { type: "sessionSwitch", previousSessionId: "old-project", sessionId: "worktree" });
    return { previous, next };
  } };
}

describe("v2 session replacement publication", () => {
  it("publishes one atomic replacement without closing the previous identity first", async () => {
    const { events, switch: replace } = setup();
    const { previous, next } = replace();

    await vi.waitFor(() => expect(events.filter(event => event.event === "session.replaced")).toHaveLength(1));
    expect(events.some(event => event.event === "session.closed")).toBe(false);
    expect(events.find(event => event.event === "session.replaced")).toMatchObject({ data: { previousSessionId: previous, snapshot: { sessionId: next, projectPath: "/project-worktree" } } });
    await vi.waitFor(() => expect(events.some(event => event.event === "project.list.changed")).toBe(true));
    const inventory = events.find(event => event.event === "session.list.changed")!;
    expect(inventory).toMatchObject({ event: "session.list.changed", data: { sessions: [{ sessionId: next }] } });
    expect(JSON.stringify(inventory)).not.toContain(previous);
  });
  it("publishes worktree labels before replacement snapshot preparation or global history completes", async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const context = setup(async () => { await gate; return () => replacement; });
    const fresh: ProjectCatalogue = { projects: [{ path: replacement.projectPath, name: "checkout", displayPath: replacement.projectPath, exists: true, modified: 0, sessionCount: 0, sessions: [], repositoryName: "project", worktree: { primary: false, detached: false, branch: "feature/new" } }] };
    context.currentCatalogue.mockImplementation(async options => {
      if (options?.checkoutPaths) return fresh;
      await gate;
      return fresh;
    });

    context.switch();

    try {
      await vi.waitFor(() => expect(context.publisher.projects().catalogue).toEqual(fresh));
      expect(context.events.some(event => event.event === "session.replaced")).toBe(false);
      expect(context.currentCatalogue).toHaveBeenCalledWith({ checkoutPaths: [replacement.projectPath] });
    } finally { release(); }
    await vi.waitFor(() => expect(context.events.some(event => event.event === "session.replaced")).toBe(true));
    await context.publisher.refreshProjects();
  });

  it("still publishes a synchronous replacement snapshot when the extension refresh fails", async () => {
    const { events, switch: replace } = setup(async () => { throw new Error("refresh failed"); });
    const { previous, next } = replace();

    await vi.waitFor(() => expect(events.some(event => event.event === "session.replaced")).toBe(true));
    expect(events.find(event => event.event === "session.replaced")).toMatchObject({ data: { previousSessionId: previous, snapshot: { sessionId: next } } });
    expect(events.some(event => event.event === "session.closed")).toBe(false);
    await vi.waitFor(() => expect(events.some(event => event.event === "project.list.changed")).toBe(true));
  });
});
