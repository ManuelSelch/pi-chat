import { homedir } from "node:os";
import { describe, expect, it, vi } from "vitest";
import { ChatApplicationService } from "../../../../src/server/application/chat-application-service.js";
import { createPiChatExtensionRegistry } from "../../../../src/server/extensions/extension-registry.js";
import { FakeRuntimeAdapter } from "../../../infra/fake-runtime-adapter.js";

function service(archiveSpy = vi.fn(async () => {})) {
  const runtime = new FakeRuntimeAdapter();
  const newSessionSpy = vi.fn(async () => new FakeRuntimeAdapter());
  const factory = {
    continueProject: async () => new FakeRuntimeAdapter(),
    openSession: async () => new FakeRuntimeAdapter(),
    newSession: newSessionSpy,
  };
  const projectSessions = { catalogue: async () => ({ projects: [] }), archive: archiveSpy } as any;
  return { chat: new ChatApplicationService(runtime, factory, projectSessions), runtime, archiveSpy, newSessionSpy };
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

describe("archiving closed sessions", () => {
  it("archives a session that no tab holds without closing another tab", async () => {
    const { chat, archiveSpy } = service();
    await chat.archiveSession("/sessions/project/other.jsonl", true);
    expect(archiveSpy).toHaveBeenCalledWith("/sessions/project/other.jsonl", true);
    expect(chat.tabs()).toHaveLength(1);
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
    const reload = vi.spyOn(runtime, "reload");
    const factory = {
      continueProject: async () => new FakeRuntimeAdapter(),
      openSession,
      newSession: async () => new FakeRuntimeAdapter(),
    };
    const projectSessions = { catalogue: async () => ({ projects: [] }), delete: vi.fn() } as any;
    return { chat: new ChatApplicationService(runtime, factory, projectSessions), runtime, replacement, openSession, reload };
  }

  it("uses native reload without reopening or disposing the runtime", async () => {
    const { chat, runtime, openSession } = reloadable();
    const reload = vi.fn(async () => {});
    Object.assign(runtime, { reload });
    const dispose = vi.spyOn(runtime, "dispose");
    await chat.prompt(chat.activeSessionId(), "/reload");
    expect(reload).toHaveBeenCalledOnce();
    expect(openSession).not.toHaveBeenCalled();
    expect(dispose).not.toHaveBeenCalled();
  });

  it("keeps the tab if native reload fails", async () => {
    const { chat, runtime, openSession, reload } = reloadable();
    const disposed = vi.spyOn(runtime, "dispose");
    reload.mockRejectedValueOnce(new Error("Reload failed"));
    await expect(chat.prompt(chat.activeSessionId(), "/reload")).rejects.toThrow("Reload failed");
    expect(openSession).not.toHaveBeenCalled();
    expect(disposed).not.toHaveBeenCalled();
  });

  it("is offered as a command on every session", async () => {
    const { chat } = reloadable();

    const snapshot = await chat.snapshot();

    expect(snapshot.actions.commands.map((command) => command.name)).toContain("reload");
  });

  it("keeps the same runtime and tab", async () => {
    const { chat, runtime, replacement, openSession } = reloadable();
    const sessionId = chat.activeSessionId();
    const disposed = vi.spyOn(runtime, "dispose");
    const notices: string[] = [];
    chat.subscribe((_sessionId, event) => { if (event.type === "notification") notices.push(event.message); });

    await chat.prompt(sessionId, "before reload");
    const messages = runtime.snapshot().messages;
    await chat.prompt(sessionId, "/reload");

    expect(runtime.snapshot().messages).toEqual(messages);
    expect(openSession).not.toHaveBeenCalled();
    expect(disposed).not.toHaveBeenCalled();
    expect(chat.tabs()).toHaveLength(1);
    expect(chat.activeSessionId()).toBe(sessionId);
    expect(notices.some((message) => /reloaded/i.test(message))).toBe(true);

    // Later prompts still reach the existing runtime.
    await chat.prompt(sessionId, "hello");
    expect(runtime.snapshot().messages.some((message) => message.role === "user")).toBe(true);
    expect(replacement.snapshot().messages).toHaveLength(0);
  });

  it("refuses while the session is still running", async () => {
    const { chat, runtime, openSession, reload } = reloadable();
    vi.spyOn(runtime, "snapshot").mockReturnValue({ ...runtime.snapshot(), isStreaming: true });

    await expect(chat.prompt(chat.activeSessionId(), "/reload")).rejects.toThrow(/finish/);
    expect(openSession).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads a session that has no file on disk", async () => {
    const { chat, runtime, reload } = reloadable();
    const { sessionPath: _dropped, ...withoutFile } = runtime.snapshot();
    vi.spyOn(runtime, "snapshot").mockReturnValue(withoutFile as any);

    await chat.prompt(chat.activeSessionId(), "/reload");
    expect(reload).toHaveBeenCalledOnce();
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
