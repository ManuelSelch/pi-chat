import { describe, expect, it, vi } from "vitest";
import { ChatApplicationService } from "../../../../src/server/application/chat-application-service.js";
import { FakeRuntimeAdapter } from "../../../infra/fake-runtime-adapter.js";
import { FileService } from "../../../../src/server/files/file-service.js";

function fixture() {
  const first = new FakeRuntimeAdapter("first");
  const second = new FakeRuntimeAdapter("second");
  vi.spyOn(first, "snapshot").mockReturnValue({ ...first.snapshot(), projectPath: "/first-project", isStreaming: true });
  vi.spyOn(second, "snapshot").mockReturnValue({ ...second.snapshot(), projectPath: "/second-project" });
  const files = new FileService({ open: vi.fn() });
  const open = vi.spyOn(files, "open").mockResolvedValue({ ok: true });
  const catalogue = vi.fn(async () => ({ projects: [] }));
  const projects = { catalogue, delete: vi.fn() } as any;
  const chat = new ChatApplicationService(first, { continueProject: vi.fn(), newSession: vi.fn(), openSession: async () => second }, projects, undefined, undefined, undefined, files);
  return { chat, first, second, open, catalogue };
}

describe("session-owned file opening", () => {
  it("uses the requested streaming session's project, not the focused tab, without runtime effects", async () => {
    const { chat, first, second, open, catalogue } = fixture();
    await chat.openSession("second.jsonl");
    const prompt = vi.spyOn(first, "prompt");
    const abort = vi.spyOn(first, "abort");
    const secondPrompt = vi.spyOn(second, "prompt");
    const events = vi.fn();
    chat.subscribe(events);
    const before = first.snapshot();
    expect(await chat.openFile("first", "report.pdf")).toEqual({ ok: true });
    expect(open).toHaveBeenCalledWith("/first-project", "report.pdf");
    expect(chat.activeSessionId()).toBe("second");
    expect(first.snapshot()).toBe(before);
    for (const spy of [prompt, abort, secondPrompt, events, catalogue]) expect(spy).not.toHaveBeenCalled();
    await chat.dispose();
  });

  it("returns correlated-compatible failures for unknown/closed sessions and snapshot failures", async () => {
    const { chat, first, open } = fixture();
    expect(await chat.openFile("unknown", "report.pdf")).toMatchObject({ ok: false, error: { code: "sessionUnavailable" } });
    vi.mocked(first.snapshot).mockImplementationOnce(() => { throw new Error("private runtime details"); });
    expect(await chat.openFile("first", "report.pdf")).toMatchObject({ ok: false, error: { code: "sessionUnavailable" } });
    await chat.closeTab("first");
    expect(await chat.openFile("first", "report.pdf")).toMatchObject({ ok: false, error: { code: "sessionUnavailable" } });
    expect(open).not.toHaveBeenCalled();
    await chat.dispose();
  });
});
