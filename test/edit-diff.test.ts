import { describe, expect, it } from "vitest";
import { projectEditDiff } from "../src/shared/edit-diff.js";
import { toChatMessages, MessageIdentity } from "../src/server/pi-runtime-adapter.js";

describe("edit diff projection", () => {
  it("prefers the patch and excludes errors and other tools", () => {
    const details = { patch: "@@ -1 +1 @@\n-a\n+b\n", diff: "-1 a\n+1 b" };
    expect(projectEditDiff("edit", false, details)?.format).toBe("unified");
    expect(projectEditDiff("edit", true, details)).toBeUndefined();
    expect(projectEditDiff("bash", false, details)).toBeUndefined();
    expect(projectEditDiff("edit", false, { diff: 1 })).toBeUndefined();
  });
  it("supports old display diffs and bounds large results", () => {
    expect(projectEditDiff("edit", false, { diff: "-1 a\n+1 b" })?.format).toBe("pi-display");
    expect(projectEditDiff("edit", false, { diff: "x".repeat(110000) })?.truncated).toBe(true);
  });
  it("preserves details in historical tool results", () => {
    const messages = toChatMessages({ role: "toolResult", toolCallId: "e", toolName: "edit", content: [], details: { diff: "-1 a\n+1 b" } }, new MessageIdentity());
    expect(messages[0]).toMatchObject({ role: "tool", tool: { editDiff: { text: "-1 a\n+1 b" } } });
  });
});
