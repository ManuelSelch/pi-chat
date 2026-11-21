import { describe, expect, it, vi } from "vitest";
import { editWithPresentation, selectWithPresentation, type PromptPresentation } from "../src/extension-ui.js";
import { promptSchema } from "../src/protocol/v2.js";
import { uiPromptSchema } from "../src/protocol/models.js";

const body = { format: "markdown" as const, text: "**Question**\n\n```ts\nrun();\n```" };

describe("presented prompts", () => {
  it("preserves explicit presentation through both contract validators", () => {
    const prompt = { id: "p", kind: "select", title: "Check", body, options: ["A"], submission: "explicit", submitLabel: "Continue" };

    expect(uiPromptSchema.parse(prompt)).toEqual(prompt);
    expect(promptSchema.parse(prompt)).toEqual(prompt);
  });

  it("rejects missing submission, oversized content and select-only metadata on editors", () => {
    expect(promptSchema.safeParse({ id: "p", kind: "select", title: "Pick", options: ["A"] }).success).toBe(false);
    expect(promptSchema.safeParse({ id: "p", kind: "editor", title: "Explain", submission: "explicit" }).success).toBe(false);
    expect(promptSchema.safeParse({ id: "p", kind: "editor", title: "Explain", body: { ...body, text: "a".repeat(32769) } }).success).toBe(false);
  });

  it("scopes presentation around an ordinary select call", async () => {
    const select = vi.fn(async () => "A");
    const record = vi.fn();
    const withPromptPresentation = async <T,>(presentation: PromptPresentation, run: () => Promise<T>): Promise<T> => { record(presentation); return run(); };
    const context = { mode: "rpc" as const, ui: { select, editor: vi.fn(), withPromptPresentation } };

    expect(await selectWithPresentation(context, { title: "Check", body, options: ["A"], submission: "explicit", submitLabel: "Continue" })).toBe("A");
    expect(select).toHaveBeenCalledWith("Check", ["A"]);
    expect(record.mock.calls[0]?.[0]).toEqual({ body, submission: "explicit", submitLabel: "Continue" });
  });

  it("uses native terminal title text without a host capability", async () => {
    const select = vi.fn(async () => undefined);
    const context = { mode: "tui" as const, ui: { select, editor: vi.fn() } };

    expect(await selectWithPresentation(context, { title: "Check", body, options: ["A"], submission: "explicit" })).toBeUndefined();
    expect(select).toHaveBeenCalledWith(`Check\n\n${body.text}`, ["A"]);
  });

  it("does not silently degrade an unsupported RPC host", async () => {
    const context = { mode: "rpc" as const, ui: { select: vi.fn(), editor: vi.fn() } };

    await expect(selectWithPresentation(context, { title: "Check", body, options: ["A"], submission: "explicit" })).rejects.toThrow("does not support prompt presentation");
    expect(context.ui.select).not.toHaveBeenCalled();
  });

  it("preserves an explicitly submitted empty explanation", async () => {
    const editor = vi.fn(async () => "");
    const context = { mode: "tui" as const, ui: { editor, select: vi.fn() } };

    expect(await editWithPresentation(context, { title: "Explain", body, prefill: "draft" })).toBe("");
    expect(editor).toHaveBeenCalledWith(`Explain\n\n${body.text}`, "draft");
  });
});
