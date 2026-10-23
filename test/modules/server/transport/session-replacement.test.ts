import { describe, expect, it, vi } from "vitest";
import { eventSchema, type Event } from "@manuelselch/pi-sdk/protocol";
import type { ChatApplicationService } from "../../../../src/server/application/chat-application-service.js";
import type { RuntimeSnapshot } from "../../../../src/server/runtime/contracts.js";
import { ServerPublisher } from "../../../../src/server/transport/server-publisher.js";

const replacement: RuntimeSnapshot = {
  sessionId: "worktree", sessionPath: "worktree.jsonl", projectPath: "/project-worktree", messages: [],
  isStreaming: false, actions: { features: [], commands: [] }, prompts: [], widgets: [], footer: [],
};

/** A switched runtime publishes one atomic replacement, never a preceding close. */
function setup(prepareSnapshot: () => Promise<() => RuntimeSnapshot> = async () => () => replacement) {
  const chat = {
    openSessionIds: () => ["worktree"],
    openSessionSnapshots: () => [replacement],
    captureSnapshot: () => replacement,
    prepareSnapshot,
  } as unknown as ChatApplicationService;
  const events: Event[] = [];
  const publisher = new ServerPublisher(chat, event => events.push(eventSchema.parse(event)));
  return { publisher, events, switch: () => {
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
    const inventory = events.at(-1)!;
    expect(inventory).toMatchObject({ event: "session.list.changed", data: { sessions: [{ sessionId: next }] } });
    expect(JSON.stringify(inventory)).not.toContain(previous);
  });
  it("still publishes a synchronous replacement snapshot when the extension refresh fails", async () => {
    const { events, switch: replace } = setup(async () => { throw new Error("refresh failed"); });
    const { previous, next } = replace();

    await vi.waitFor(() => expect(events.some(event => event.event === "session.replaced")).toBe(true));
    expect(events.find(event => event.event === "session.replaced")).toMatchObject({ data: { previousSessionId: previous, snapshot: { sessionId: next } } });
    expect(events.some(event => event.event === "session.closed")).toBe(false);
  });
});
