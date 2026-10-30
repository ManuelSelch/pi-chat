import { describe, expect, it } from "vitest";
import { createPromptDraft, promptDraftKey, reconcilePromptDrafts } from "../../../../../src/web/extensions/prompts/domain/prompt-drafts.js";

describe("prompt drafts", () => {
  it("keys ownership by server, runtime and prompt, without ambiguous separators", () => {
    expect(promptDraftKey("a:b", "c", "d")).not.toBe(promptDraftKey("a", "b:c", "d"));
    expect(promptDraftKey("server", "s1", "p")).not.toBe(promptDraftKey("server", "s2", "p"));
  });

  it("starts explicit selection unanswered and preserves an empty editor prefill", () => {
    expect(createPromptDraft({ prefill: "" })).toMatchObject({ value: "", selectedOption: undefined, minimized: false, submitting: false });
  });

  it("preserves drafts still present in an authoritative prompt list and removes settled prompts", () => {
    const current = { live: { ...createPromptDraft({}), value: "My reasoning", minimized: true }, stale: createPromptDraft({}) };

    const next = reconcilePromptDrafts(current, new Set(["live"]));

    expect(next.live).toBe(current.live);
    expect(next.stale).toBeUndefined();
    expect(reconcilePromptDrafts(next, new Set(["live"]))).toBe(next);
  });
});
