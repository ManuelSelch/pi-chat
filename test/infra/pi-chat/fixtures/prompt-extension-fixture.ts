import assert from "node:assert/strict";
import type { ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { selectWithPresentation, editWithPresentation } from "@manuelselch/pi-sdk/extension-ui";

/** Standard Pi runner + public helper integration; no model or browser-owned lifecycle. */
export class PromptExtensionFixture {
  private answers: { selected: string; reasoning: string }[] = [];
  readonly extension: ExtensionFactory = pi => {
    pi.registerCommand("prompt-checks", { handler: async (_args, ctx) => {
      for (let check = 1; check <= 2; check++) {
        const selected = await selectWithPresentation(ctx, {
          title: `Check ${check}`,
          body: { format: "markdown", text: "**Powers** of two — π\n\nWhat does this expression produce?\n\n\x60\x60\x60python\n2 ** 3\n\x60\x60\x60\n\n$$2^3$$\n\n![No remote images](https://example.invalid/prompt.png)\n\n<script>window.promptInjected = true</script>" },
          options: ["6", "8", "I don't know"], submission: "explicit", submitLabel: "Continue to reasoning",
        });
        if (selected === undefined) return;
        const reasoning = await editWithPresentation(ctx, {
          title: `Reasoning ${check}`, body: { format: "plain", text: `Selected answer: ${selected}\n\nExplain your reasoning.` }, submitLabel: "Submit answer",
        });
        if (reasoning === undefined) return;
        this.answers.push({ selected, reasoning });
        ctx.ui.notify(`Feedback ${check}: vary the next example and explain why.`, "info");
      }
    } });
    pi.registerCommand("prompt-literal", { handler: async (_args, ctx) => {
      const selected = await ctx.ui.select("**Literal menu**", ["First", "Second"]);
      if (selected) ctx.ui.notify(`Literal selection: ${selected}`, "info");
    } });
  };
  ShouldHaveAnswers(expected: { selected: string; reasoning: string }[]): void {
    assert.deepEqual(this.answers, expected);
  }
}
