import { describe, expect, it, vi } from "vitest";
import type { ChatApplicationService } from "../../../../src/server/application/chat-application-service.js";
import type { ServerPublisher } from "../../../../src/server/transport/server-publisher.js";
import { executeOperation } from "../../../../src/server/transport/command-handler.js";

function fixture(inventory?: unknown) {
  const pinProject = vi.fn(async () => {});
  const inventoryChanged = vi.fn();
  const refreshProjects = vi.fn(async () => {});
  // Deliberately narrow unit doubles; no runtime, storage or sockets are needed.
  const chat = { pinProject } as unknown as ChatApplicationService;
  const publisher = { inventory: () => inventory, inventoryChanged, refreshProjects } as unknown as ServerPublisher;
  return { chat, publisher, pinProject, inventoryChanged, refreshProjects };
}

const ping = { version: 2, type: "request", requestId: "ping", method: "server.ping", params: {} } as const;
const list = { version: 2, type: "request", requestId: "list", method: "session.list", params: {} } as const;

describe("command completion defaults", () => {
  it("returns a fresh completed payload for each omitted result", async () => {
    const { chat, publisher } = fixture();
    const first = await executeOperation(ping, chat, publisher);
    const second = await executeOperation(ping, chat, publisher);
    expect(first).toEqual({ kind: "completed", result: { state: "completed" }, afterResponse: undefined });
    expect(second).toEqual(first);
    if (first.kind !== "completed" || second.kind !== "completed") throw new Error("Expected synchronous completion");
    expect(first.result).not.toBe(second.result);
  });

  it("defaults an explicitly undefined result", async () => {
    const { chat, publisher } = fixture(undefined);
    expect(await executeOperation(list, chat, publisher)).toMatchObject({ kind: "completed", result: { state: "completed" } });
  });

  // These values exercise the helper's undefined-only contract, not the list wire schema.
  it.each([null, false, 0, ""])("preserves an explicit %j result", async (result) => {
    const { chat, publisher } = fixture(result);
    const execution = await executeOperation(list, chat, publisher);
    expect(execution).toMatchObject({ kind: "completed", result });
    if (execution.kind !== "completed") throw new Error("Expected synchronous completion");
    expect(execution.result).toBe(result);
  });

  it("preserves a supplied result object's identity", async () => {
    const result = { sessions: [] };
    const { chat, publisher } = fixture(result);
    const execution = await executeOperation(list, chat, publisher);
    if (execution.kind !== "completed") throw new Error("Expected synchronous completion");
    expect(execution.result).toBe(result);
  });

  it("keeps explicit-undefined mutation completion and defers its refresh callback", async () => {
    const { chat, publisher, pinProject, inventoryChanged, refreshProjects } = fixture();
    const execution = await executeOperation({ version: 2, type: "request", requestId: "pin", method: "project.pin", params: { path: "/project", pinned: true } }, chat, publisher);
    expect(pinProject).toHaveBeenCalledExactlyOnceWith("/project", true);
    expect(execution).toMatchObject({ kind: "completed", result: { state: "completed" }, afterResponse: expect.any(Function) });
    expect(inventoryChanged).not.toHaveBeenCalled();
    expect(refreshProjects).not.toHaveBeenCalled();
    if (execution.kind !== "completed") throw new Error("Expected synchronous completion");
    await execution.afterResponse?.();
    expect(inventoryChanged).toHaveBeenCalledOnce();
    expect(refreshProjects).toHaveBeenCalledExactlyOnceWith(true);
  });
});
