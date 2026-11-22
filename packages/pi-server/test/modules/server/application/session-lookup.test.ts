import { describe, expect, it, vi } from "vitest";
import { ChatApplicationService } from "../../../../src/application/chat-application-service.js";
import { FakeRuntimeAdapter } from "../../../infra/fake-runtime-adapter.js";

function fixture() {
  const first = new FakeRuntimeAdapter("first");
  const second = new FakeRuntimeAdapter("second");
  vi.spyOn(first, "snapshot").mockReturnValue({ ...first.snapshot(), projectPath: "/first-project", isStreaming: true });
  vi.spyOn(second, "snapshot").mockReturnValue({ ...second.snapshot(), projectPath: "/second-project" });
  const catalogue = vi.fn(async () => ({ projects: [] }));
  const projects = { catalogue } as any;
  const chat = new ChatApplicationService(first, { continueProject: vi.fn(), newSession: vi.fn(), openSession: async () => second }, projects);
  return { chat, first, second, catalogue };
}

describe("generic session lookup", () => {
  it("reads the named streaming session without runtime effects or catalogue access", async () => {
    const { chat, first, second, catalogue } = fixture();
    await chat.openSession("second.jsonl");
    const prompt = vi.spyOn(first, "prompt");
    const abort = vi.spyOn(first, "abort");
    const secondPrompt = vi.spyOn(second, "prompt");
    const events = vi.fn();
    chat.subscribe(events);
    const before = first.snapshot();

    expect(chat.getSession("first")).toEqual({ projectPath: "/first-project" });
    expect(chat.getSession("second")).toEqual({ projectPath: "/second-project" });
    expect(first.snapshot()).toBe(before);
    for (const spy of [prompt, abort, secondPrompt, events, catalogue]) expect(spy).not.toHaveBeenCalled();
    await chat.dispose();
  });

  it("does not fabricate context for missing, closed or unreadable sessions", async () => {
    const { chat, first } = fixture();

    expect(() => chat.getSession("unknown")).toThrow();
    vi.mocked(first.snapshot).mockImplementationOnce(() => { throw new Error("private runtime details"); });
    expect(() => chat.getSession("first")).toThrow();
    await chat.closeTab("first");
    expect(() => chat.getSession("first")).toThrow();
    await chat.dispose();
  });
});
