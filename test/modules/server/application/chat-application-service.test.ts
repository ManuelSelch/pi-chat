import { homedir } from "node:os";
import { describe, expect, it, vi } from "vitest";
import { ChatApplicationService } from "../../../../src/server/application/chat-application-service.js";
import { createPiChatExtensionRegistry } from "../../../../src/server/extensions/extension-registry.js";
import { FakeRuntimeAdapter } from "../../../infra/fake-runtime-adapter.js";

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

describe("command argument completion", () => {
  it("uses the named session even when another tab is focused", async () => {
    const first = new FakeRuntimeAdapter("first");
    const second = new FakeRuntimeAdapter("second");
    const completeFirst = vi.spyOn(first, "completeCommandArguments").mockResolvedValue([{ value: "first-value", label: "First" }]);
    const completeSecond = vi.spyOn(second, "completeCommandArguments");
    const chat = new ChatApplicationService(first, {
      continueProject: async () => second, openSession: async () => second, newSession: async () => second,
    });
    await chat.openSession("second.jsonl");
    expect(chat.activeSessionId()).toBe("second");
    expect(await chat.completeCommandArguments("first", "deploy", "st")).toEqual([{ value: "first-value", label: "First" }]);
    expect(completeFirst).toHaveBeenCalledWith("deploy", "st");
    expect(completeSecond).not.toHaveBeenCalled();
    await chat.dispose();
  });
});

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

describe("startup home", () => {
  it("can start without a visible session tab", async () => {
    const factory = {
      continueProject: async () => new FakeRuntimeAdapter(),
      openSession: async () => new FakeRuntimeAdapter(),
      newSession: async () => new FakeRuntimeAdapter(),
    };
    const projectSessions = { catalogue: async () => ({ projects: [] }), delete: vi.fn() } as any;
    const chat = new ChatApplicationService(undefined, factory, projectSessions);

    expect(chat.tabs()).toEqual([]);
    expect(chat.activeSessionId()).toBe("");
    await expect(chat.currentCatalogue()).resolves.toEqual({ projects: [] });
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

describe("Pi Chat extension registry integration", () => {
  it("adds extension buttons to snapshots and runs extension actions", async () => {
    const runtime = new FakeRuntimeAdapter();
    const extensions = createPiChatExtensionRegistry();
    extensions.registerButton({ id: "demo", slot: "composer.right", label: "Demo", actionId: "demo.sayHello" });
    extensions.registerAction({ id: "demo.sayHello", title: "Say hello", run: (ctx) => ctx.notify("Demo action clicked") });
    const projectSessions = { catalogue: async () => ({ projects: [] }), delete: vi.fn() } as any;
    const chat = new ChatApplicationService(runtime, {
      continueProject: async () => new FakeRuntimeAdapter(),
      openSession: async () => new FakeRuntimeAdapter(),
      newSession: async () => new FakeRuntimeAdapter(),
    }, projectSessions, undefined, extensions);
    const notifications: string[] = [];
    chat.subscribe((_sessionId, event) => { if (event.type === "notification") notifications.push(event.message); });

    await expect(chat.snapshot()).resolves.toMatchObject({ extensions: { buttons: [{ id: "demo" }] } });
    await chat.runFeature({ version: 1, type: "runExtensionAction", sessionId: chat.activeSessionId(), actionId: "demo.sayHello" });

    expect(notifications).toEqual(["Demo action clicked"]);
  });

  // Without this an extension had to capture `ctx.ui` from `session_start` and
  // keep it, which with several sessions open meant asking in whichever session
  // started last — or in a closed one.
  it("gives an action the dialog surface of the session it was run from", async () => {
    const runtime = new FakeRuntimeAdapter();
    const second = new FakeRuntimeAdapter("second-session");
    const extensions = createPiChatExtensionRegistry();
    const surfaces: unknown[] = [];
    extensions.registerAction({ id: "demo.ask", title: "Ask", run: (ctx) => void surfaces.push(ctx.ui) });
    const projectSessions = { catalogue: async () => ({ projects: [] }), delete: vi.fn() } as any;
    const chat = new ChatApplicationService(runtime, {
      continueProject: async () => new FakeRuntimeAdapter(),
      openSession: async () => second,
      newSession: async () => second,
    }, projectSessions, undefined, extensions);

    const openedId = await chat.openSession("second-session.jsonl");
    expect(openedId).not.toBe(runtime.snapshot().sessionId);

    await chat.runFeature({ version: 1, type: "runExtensionAction", sessionId: openedId, actionId: "demo.ask" });
    await chat.runFeature({ version: 1, type: "runExtensionAction", sessionId: "no-such-session", actionId: "demo.ask" });

    expect(surfaces[0]).toBe(second.uiContext());
    // The home screen has no session to open a modal in.
    expect(surfaces[1]).toBeUndefined();
  });
});

describe("/reload", () => {
  function reloadable() {
    const runtime = new FakeRuntimeAdapter();
    const replacement = new FakeRuntimeAdapter();
    const openSession = vi.fn(async () => replacement);
    const invalidateExtensionCache = vi.fn(async () => {});
    const factory = {
      continueProject: async () => new FakeRuntimeAdapter(),
      openSession,
      newSession: async () => new FakeRuntimeAdapter(),
      invalidateExtensionCache,
    };
    const projectSessions = { catalogue: async () => ({ projects: [] }), delete: vi.fn() } as any;
    return { chat: new ChatApplicationService(runtime, factory, projectSessions), runtime, replacement, openSession, invalidateExtensionCache };
  }

  it("invalidates cached extension factories before opening the replacement", async () => {
    const { chat, openSession, invalidateExtensionCache } = reloadable();
    await chat.prompt(chat.activeSessionId(), "/reload");
    expect(invalidateExtensionCache).toHaveBeenCalledOnce();
    expect(invalidateExtensionCache.mock.invocationCallOrder[0]).toBeLessThan(openSession.mock.invocationCallOrder[0]!);
  });

  it("keeps the existing runtime if cache invalidation fails", async () => {
    const { chat, runtime, openSession, invalidateExtensionCache } = reloadable();
    const disposed = vi.spyOn(runtime, "dispose");
    invalidateExtensionCache.mockRejectedValueOnce(new Error("Cache invalidation failed"));
    await expect(chat.prompt(chat.activeSessionId(), "/reload")).rejects.toThrow("Cache invalidation failed");
    expect(openSession).not.toHaveBeenCalled();
    expect(disposed).not.toHaveBeenCalled();
  });

  it("is offered as a command on every session", async () => {
    const { chat } = reloadable();

    const snapshot = await chat.snapshot();

    expect(snapshot.actions.commands.map((command) => command.name)).toContain("reload");
  });

  it("rebuilds the session's runtime from its file and keeps the tab", async () => {
    const { chat, runtime, replacement, openSession } = reloadable();
    const sessionId = chat.activeSessionId();
    const disposed = vi.spyOn(runtime, "dispose");
    const notices: string[] = [];
    chat.subscribe((_sessionId, event) => { if (event.type === "notification") notices.push(event.message); });

    await chat.prompt(sessionId, "/reload");

    expect(openSession).toHaveBeenCalledWith(runtime.snapshot().sessionPath);
    expect(disposed).toHaveBeenCalled();
    expect(chat.tabs()).toHaveLength(1);
    expect(chat.activeSessionId()).toBe(sessionId);
    expect(notices.some((message) => /reloaded/i.test(message))).toBe(true);

    // Later prompts must reach the replacement, not the runtime it replaced.
    await chat.prompt(sessionId, "hello");
    expect(replacement.snapshot().messages.some((message) => message.role === "user")).toBe(true);
    expect(runtime.snapshot().messages).toHaveLength(0);
  });

  it("refuses while the session is still running", async () => {
    const { chat, runtime, openSession, invalidateExtensionCache } = reloadable();
    vi.spyOn(runtime, "snapshot").mockReturnValue({ ...runtime.snapshot(), isStreaming: true });

    await expect(chat.prompt(chat.activeSessionId(), "/reload")).rejects.toThrow(/finish/);
    expect(openSession).not.toHaveBeenCalled();
    expect(invalidateExtensionCache).not.toHaveBeenCalled();
  });

  it("refuses a session that has no file to reopen", async () => {
    const { chat, runtime } = reloadable();
    const { sessionPath: _dropped, ...withoutFile } = runtime.snapshot();
    vi.spyOn(runtime, "snapshot").mockReturnValue(withoutFile as any);

    await expect(chat.prompt(chat.activeSessionId(), "/reload")).rejects.toThrow(/no file on disk/);
  });

  it("leaves an extension's own /reload to the session", async () => {
    const { chat, runtime, openSession } = reloadable();
    const base = runtime.snapshot();
    vi.spyOn(runtime, "snapshot").mockReturnValue({
      ...base,
      actions: { ...base.actions, commands: [{ name: "reload", description: "An extension's own" }] },
    });
    const prompted = vi.spyOn(runtime, "prompt");

    await chat.prompt(chat.activeSessionId(), "/reload");

    expect(prompted).toHaveBeenCalledWith("/reload");
    expect(openSession).not.toHaveBeenCalled();
  });
});
