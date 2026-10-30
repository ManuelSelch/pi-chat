// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePromptPresentation } from "../../../../../src/web/extensions/prompts/app/use-prompt-presentation.js";
import type { UiPrompt } from "../../../../../src/shared/protocol.js";

afterEach(cleanup);
const editor = (id = "p"): UiPrompt => ({ id, title: "Reasoning", kind: "editor", prefill: "Start" });
const select = (id: string, submission: "explicit" | "immediate" = "explicit"): UiPrompt => ({ id, kind: "select", title: "Choose", options: ["A", "B"], submission });
type Input = Parameters<typeof usePromptPresentation>[0];
function setup(overrides: Partial<Input> = {}) {
  let input: Input = { serverInstanceId: "server", activeSessionId: "one", connection: "open", sessions: { one: { prompts: [editor()] } }, respond: vi.fn(async () => {}), ...overrides };
  const view = renderHook(() => usePromptPresentation(input));
  return { ...view, update(patch: Partial<Input>) { input = { ...input, ...patch }; view.rerender(); }, get respond() { return input.respond; } };
}

describe("browser prompt presentation", () => {
  it("retains text and minimization through same-ID snapshots and tab switches", () => {
    const app = setup({ sessions: { one: { prompts: [editor()] }, two: { prompts: [editor()] } } });
    act(() => { app.result.current.update({ value: "My π reasoning" }); app.result.current.minimize(); });
    app.update({ sessions: { one: { prompts: [{ ...editor(), prefill: "Changed server prefill" }] }, two: { prompts: [editor()] } } });
    expect(app.result.current.draft).toMatchObject({ value: "My π reasoning", minimized: true });
    app.update({ activeSessionId: "two" });
    expect(app.result.current.draft).toMatchObject({ value: "Start", minimized: false });
    act(() => app.result.current.update({ value: "Other tab" }));
    app.update({ activeSessionId: "one" });
    expect(app.result.current.draft).toMatchObject({ value: "My π reasoning", minimized: true });
  });

  it("keeps underlying selection but opens a new stacked prompt normally", () => {
    const first = select("first");
    const app = setup({ sessions: { one: { prompts: [first] } } });
    act(() => { app.result.current.update({ selectedOption: "B" }); app.result.current.minimize(); });
    app.update({ sessions: { one: { prompts: [first, editor("second")] } } });
    expect(app.result.current.draft).toMatchObject({ value: "Start", minimized: false });
    app.result.current.respond("first", { cancelled: true });
    expect(app.respond).not.toHaveBeenCalled();
    app.update({ sessions: { one: { prompts: [first] } } });
    expect(app.result.current.draft).toMatchObject({ selectedOption: "B", minimized: true });
  });

  it("keeps drafts during reconnect and supersession, but disables responses", () => {
    const app = setup();
    act(() => { app.result.current.update({ value: "Keep" }); app.result.current.minimize(); });
    app.update({ connection: "connecting", sessions: {} });
    app.update({ connection: "superseded", sessions: { one: { prompts: [editor()] } } });
    app.result.current.respond("p", { cancelled: false, value: "Keep" });
    expect(app.respond).not.toHaveBeenCalled();
    expect(app.result.current.disabled).toBe(true);
    act(() => app.result.current.reopen());
    expect(app.result.current.minimized).toBe(false);
    app.update({ connection: "open" });
    expect(app.result.current.draft?.value).toBe("Keep");
    expect(app.result.current.disabled).toBe(false);
  });

  it.each(["removal", "disposal", "replacement", "server"])("cleans obsolete drafts on authoritative %s", reason => {
    const app = setup();
    act(() => { app.result.current.update({ value: "Obsolete" }); app.result.current.minimize(); });
    if (reason === "removal") app.update({ sessions: { one: { prompts: [] } } });
    if (reason === "disposal") app.update({ sessions: {} });
    if (reason === "replacement") app.update({ activeSessionId: "new", sessions: { new: { prompts: [editor()] } } });
    if (reason === "server") app.update({ serverInstanceId: "new-server" });
    app.update({ activeSessionId: "one", sessions: { one: { prompts: [editor()] } } });
    expect(app.result.current.draft).toMatchObject({ value: "Start", minimized: false, submitting: false });
  });

  it("guards duplicate responses and retains a failed answer for retry", async () => {
    let reject!: (error: Error) => void;
    const respond = vi.fn(() => new Promise<void>((_resolve, fail) => { reject = fail; }));
    const app = setup({ respond });
    act(() => {
      app.result.current.update({ value: "Verbatim answer" });
      app.result.current.respond("p", { cancelled: false, value: "Verbatim answer" });
      app.result.current.respond("p", { cancelled: false, value: "Verbatim answer" });
    });
    expect(respond).toHaveBeenCalledExactlyOnceWith("p", { cancelled: false, value: "Verbatim answer" }, "one");
    expect(app.result.current.disabled).toBe(true);
    await act(async () => reject(new Error("Disconnected")));
    expect(app.result.current.draft).toMatchObject({ value: "Verbatim answer", submitting: false });
    expect(app.result.current.disabled).toBe(false);
    act(() => app.result.current.respond("p", { cancelled: false, value: "Verbatim answer" }));
    expect(respond).toHaveBeenCalledTimes(2);
    await act(async () => reject(new Error("Again")));
  });

  it("ignores stale response closures after tab switches and top-prompt changes", () => {
    const app = setup();
    const stale = app.result.current.respond;
    app.update({ activeSessionId: "two", sessions: { one: { prompts: [editor()] }, two: { prompts: [editor()] } } });
    stale("p", { cancelled: true });
    expect(app.respond).not.toHaveBeenCalled();
    const secondStale = app.result.current.respond;
    app.update({ sessions: { one: { prompts: [editor()] }, two: { prompts: [editor(), editor("top")] } } });
    secondStale("p", { cancelled: true });
    expect(app.respond).not.toHaveBeenCalled();
  });

  it("does not resurrect an expired draft when a failed response arrives late", async () => {
    let reject!: (error: Error) => void;
    const app = setup({ respond: () => new Promise<void>((_resolve, fail) => { reject = fail; }) });
    act(() => { app.result.current.update({ value: "Old" }); app.result.current.respond("p", { cancelled: true }); });
    app.update({ sessions: { one: { prompts: [] } } });
    await act(async () => reject(new Error("Expired")));
    app.update({ sessions: { one: { prompts: [editor()] } } });
    expect(app.result.current.draft?.value).toBe("Start");
  });

  it("preserves immediate-menu filtering across redraws but not explicit questions", () => {
    const app = setup({ sessions: { one: { prompts: [select("old", "immediate")] } } });
    act(() => app.result.current.update({ query: "B", activeOption: 1 }));
    app.update({ sessions: { one: { prompts: [] } } });
    app.update({ sessions: { one: { prompts: [select("redrawn", "immediate")] } } });
    expect(app.result.current.draft).toMatchObject({ query: "B", activeOption: 1 });
    act(() => app.result.current.minimize());
    app.update({ sessions: { one: { prompts: [select("question")] } } });
    expect(app.result.current.draft).toMatchObject({ query: "", selectedOption: undefined, minimized: false });
  });
});
