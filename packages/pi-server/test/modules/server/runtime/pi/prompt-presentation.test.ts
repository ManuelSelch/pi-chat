import { describe, expect, it, vi } from "vitest";
import { editWithPresentation, selectWithPresentation } from "@manuelselch/pi-sdk/extension-ui";
import type { UiPrompt } from "@manuelselch/pi-sdk/protocol";
import { createWebUiContext } from "../../../../../src/runtime/pi/web-ui-context.js";

function setup() {
  const requests: Omit<UiPrompt, "id">[] = [];
  const ui = createWebUiContext({ onNotify: vi.fn(), onPrompt: async request => { requests.push(request); return { cancelled: false, value: "A" }; } });
  return { ui, requests, mode: "rpc" };
}
const body = { format: "markdown" as const, text: "**Question**" };

describe("call-scoped prompt presentation", () => {
  it("decorates ordinary select and editor requests without leaking into other dialogs", async () => {
    const ctx = setup();

    await selectWithPresentation(ctx, { title: "Check", body, options: ["A"], submission: "explicit" });
    await editWithPresentation(ctx, { title: "Explain", body, submitLabel: "Submit answer" });
    await ctx.ui.select("Menu", ["A"]);

    expect(ctx.requests).toEqual([
      { kind: "select", title: "Check", options: ["A"], body, submission: "explicit" },
      { kind: "editor", title: "Explain", body, submitLabel: "Submit answer" },
      { kind: "select", title: "Menu", options: ["A"], submission: "immediate" },
    ]);
  });

  it("isolates concurrent and nested asynchronous scopes", async () => {
    const ctx = setup();
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const first = ctx.ui.withPromptPresentation({ body }, async () => {
      await pending;
      await ctx.ui.editor("First");
      await ctx.ui.withPromptPresentation({ body: { format: "plain", text: "Nested" } }, () => ctx.ui.editor("Nested"));
      await ctx.ui.editor("First again");
    });

    await editWithPresentation(ctx, { title: "Second", body: { format: "plain", text: "Other" } });
    release();
    await first;
    await ctx.ui.editor("Plain");

    expect(ctx.requests.map(request => [request.title, request.body?.text])).toEqual([
      ["Second", "Other"], ["First", "**Question**"], ["Nested", "Nested"], ["First again", "**Question**"], ["Plain", undefined],
    ]);
  });

  it("restores the outer context after rejection and rejects select metadata on an editor", async () => {
    const ctx = setup();

    await expect(ctx.ui.withPromptPresentation({ body }, async () => { throw new Error("failed"); })).rejects.toThrow("failed");
    await ctx.ui.editor("Plain");
    await expect(ctx.ui.withPromptPresentation({ submission: "explicit" }, () => ctx.ui.editor("Invalid"))).rejects.toThrow();

    expect(ctx.requests).toEqual([{ kind: "editor", title: "Plain" }]);
  });
});
