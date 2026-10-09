import { describe, expect, it, vi } from "vitest";
import { ChatApplicationService } from "../../../../src/server/application/chat-application-service.js";
import { FakeRuntimeAdapter } from "../../../infra/fake-runtime-adapter.js";
function setup() {
  const runtime = new FakeRuntimeAdapter();
  const archive = vi.fn(async () => {}), restoreIfArchived = vi.fn(async () => {}), pin = vi.fn(async () => {});
  const projects = { catalogue: async () => ({ projects: [] }), archive, restoreIfArchived, pin, delete: vi.fn() } as any;
  const factory = { continueProject: async () => new FakeRuntimeAdapter(), newSession: async () => new FakeRuntimeAdapter(), openSession: async () => runtime };
  const chat = new ChatApplicationService(runtime, factory, projects);
  return { chat, runtime, archive, restoreIfArchived, pin };
}
describe("archive lifecycle", () => {
  it("archives and closes only the target idle tab; restore does not open a runtime", async () => {
    const { chat, runtime, archive } = setup();
    const path = runtime.snapshot().sessionPath!;
    await chat.archiveSession(path, true);
    expect(archive).toHaveBeenCalledWith(path, true);
    expect(chat.tabs()).toHaveLength(0);
    await chat.archiveSession(path, false);
    expect(archive).toHaveBeenLastCalledWith(path, false);
    expect(chat.tabs()).toHaveLength(0);
  });
  it("does not close the tab when metadata persistence fails", async () => {
    const { chat, runtime, archive } = setup();
    archive.mockRejectedValueOnce(new Error("disk full"));
    await expect(chat.archiveSession(runtime.snapshot().sessionPath!, true)).rejects.toThrow("disk full");
    expect(chat.tabs()).toHaveLength(1);
  });
  it("rejects archive of a running session without mutating metadata", async () => {
    const { chat, runtime, archive } = setup();
    vi.spyOn(runtime, "snapshot").mockReturnValue({ ...runtime.snapshot(), isStreaming: true });
    await expect(chat.archiveSession(runtime.snapshot().sessionPath!, true)).rejects.toThrow(/running/);
    expect(archive).not.toHaveBeenCalled();
  });
  it("rejects archive during async prompt preflight, before runtime reports running", async () => {
    const { chat, runtime, archive } = setup();
    let complete!: () => void;
    vi.spyOn(runtime, "prompt").mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const work = chat.prompt(runtime.snapshot().sessionId, "hello");
    await expect(chat.archiveSession(runtime.snapshot().sessionPath!, true)).rejects.toThrow(/running/);
    expect(archive).not.toHaveBeenCalled();
    complete(); await work;
  });
  it("restores accepted new work but not failed prompts or informational slash commands", async () => {
    const { chat, runtime, restoreIfArchived } = setup();
    const id = runtime.snapshot().sessionId;
    await chat.prompt(id, "!echo hello");
    expect(restoreIfArchived).toHaveBeenCalledWith(runtime.snapshot().sessionPath);
    restoreIfArchived.mockClear();
    await chat.prompt(id, "/help");
    expect(restoreIfArchived).not.toHaveBeenCalled();
    vi.spyOn(runtime, "prompt").mockRejectedValueOnce(new Error("refused"));
    await expect(chat.prompt(id, "work")).rejects.toThrow("refused");
    expect(restoreIfArchived).not.toHaveBeenCalled();
  });
  it("opening or closing a session alone never restores it", async () => {
    const { chat, runtime, restoreIfArchived } = setup();
    await chat.openSession(runtime.snapshot().sessionPath!);
    await chat.closeTab(runtime.snapshot().sessionId);
    expect(restoreIfArchived).not.toHaveBeenCalled();
  });
  it("pins a validated project through the application boundary", async () => {
    const { chat, pin } = setup();
    await chat.pinProject(process.cwd(), true);
    expect(pin).toHaveBeenCalledWith(process.cwd(), true);
  });
});
