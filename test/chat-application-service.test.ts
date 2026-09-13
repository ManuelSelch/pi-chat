import { describe, expect, it, vi } from "vitest";
import { ChatApplicationService } from "../src/server/chat-application-service.js";
import { FakeRuntimeAdapter } from "../src/server/runtime-adapter.js";

function service(deleteSpy = vi.fn(async () => {})) {
  const runtime = new FakeRuntimeAdapter();
  const factory = {
    continueProject: async () => new FakeRuntimeAdapter(),
    openSession: async () => new FakeRuntimeAdapter(),
    newSession: async () => new FakeRuntimeAdapter(),
  };
  const projectSessions = { catalogue: async () => ({ projects: [] }), delete: deleteSpy } as any;
  return { chat: new ChatApplicationService(runtime, factory, projectSessions), runtime, deleteSpy };
}

describe("deleting sessions", () => {
  it("refuses to delete a session that is still open in a tab", async () => {
    const { chat, runtime, deleteSpy } = service();
    const openPath = runtime.snapshot().sessionPath!;

    await expect(chat.deleteSession(openPath)).rejects.toThrow(/Close its tab/);
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it("deletes a session that no tab holds", async () => {
    const { chat, deleteSpy } = service();

    await chat.deleteSession("/sessions/project/other.jsonl");

    expect(deleteSpy).toHaveBeenCalledWith("/sessions/project/other.jsonl");
  });
});
