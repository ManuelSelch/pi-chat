import { homedir } from "node:os";
import { describe, expect, it, vi } from "vitest";
import { ChatApplicationService } from "../src/server/chat-application-service.js";
import { FakeRuntimeAdapter } from "../src/server/runtime-adapter.js";

function service(deleteSpy = vi.fn(async () => {})) {
  const runtime = new FakeRuntimeAdapter();
  const newSessionSpy = vi.fn(async () => new FakeRuntimeAdapter());
  const factory = {
    continueProject: async () => new FakeRuntimeAdapter(),
    openSession: async () => new FakeRuntimeAdapter(),
    newSession: newSessionSpy,
  };
  const projectSessions = { catalogue: async () => ({ projects: [] }), delete: deleteSpy } as any;
  return { chat: new ChatApplicationService(runtime, factory, projectSessions), runtime, deleteSpy, newSessionSpy };
}

describe("deleting sessions", () => {
  it("closes the tab of an idle session before deleting it", async () => {
    const { chat, runtime, deleteSpy } = service();
    const openPath = runtime.snapshot().sessionPath!;

    await chat.deleteSession(openPath);

    expect(deleteSpy).toHaveBeenCalledWith(openPath);
    // The tab must be gone: it would otherwise point at a deleted file.
    expect(chat.tabs()).toHaveLength(0);
  });

  it("refuses to delete a session that is still running", async () => {
    const { chat, runtime, deleteSpy } = service();
    const openPath = runtime.snapshot().sessionPath!;
    // The fake finishes a prompt synchronously, so streaming is staged directly.
    vi.spyOn(runtime, "snapshot").mockReturnValue({ ...runtime.snapshot(), isStreaming: true });

    await expect(chat.deleteSession(openPath)).rejects.toThrow(/still running/);
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(chat.tabs()).toHaveLength(1);
  });

  it("deletes a session that no tab holds", async () => {
    const { chat, deleteSpy } = service();

    await chat.deleteSession("/sessions/project/other.jsonl");

    expect(deleteSpy).toHaveBeenCalledWith("/sessions/project/other.jsonl");
  });
});

describe("closing the last tab", () => {
  it("leaves no session open", async () => {
    const { chat } = service();
    const only = chat.activeSessionId();

    await chat.closeTab(only);

    expect(chat.tabs()).toEqual([]);
    expect(chat.activeSessionId()).toBe("");
  });

  it("still serves a catalogue with nothing open, for the home screen", async () => {
    const { chat } = service();
    await chat.closeTab(chat.activeSessionId());

    await expect(chat.currentCatalogue()).resolves.toEqual({ projects: [] });
  });

  it("opens a default home-directory session when none is open", async () => {
    const { chat, newSessionSpy } = service();
    await chat.closeTab(chat.activeSessionId());

    await chat.newSession();

    expect(newSessionSpy).toHaveBeenCalledWith(homedir());
    expect(chat.tabs()).toHaveLength(1);
  });

  it("opens a session from the home screen", async () => {
    const { chat } = service();
    await chat.closeTab(chat.activeSessionId());

    await chat.openSession("/sessions/project/other.jsonl");

    expect(chat.tabs()).toHaveLength(1);
  });
});
