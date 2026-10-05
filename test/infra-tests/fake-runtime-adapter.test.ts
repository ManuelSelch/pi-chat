import { describe, expect, it } from "vitest";
import type { RuntimeAdapter } from "../../src/server/runtime/contracts.js";
import { FakeRuntimeAdapter } from "../infra/fake-runtime-adapter.js";

describe("FakeRuntimeAdapter test support", () => {
  it("projects bash without a synthetic model conversation", async () => {
    const adapter = new FakeRuntimeAdapter();
    await adapter.prompt("!!pwd");
    expect(adapter.snapshot().messages).toMatchObject([{ role: "bash", bash: { command: "pwd", excludeFromContext: true } }]);
    await expect(adapter.prompt("!")).rejects.toThrow(/empty/);
  });
  it("keeps UI questions pending until a browser response arrives", async () => {
    const adapter: RuntimeAdapter = new FakeRuntimeAdapter("test-session");
    try {
      expect(adapter.uiContext()).toBe(adapter.uiContext());
      let settled = false;
      const answer = adapter.uiContext().input("Name").then((value) => {
        settled = true;
        return value;
      });
      await Promise.resolve();
      expect(settled).toBe(false);
      const [prompt] = adapter.snapshot().prompts;
      expect(prompt).toMatchObject({ kind: "input", title: "Name" });

      adapter.respondToPrompt(prompt!.id, { cancelled: false, value: "Alice" });
      await expect(answer).resolves.toBe("Alice");
      expect(adapter.snapshot().prompts).toEqual([]);
    } finally {
      await adapter.dispose();
    }
  });

  it("settles pending questions when disposed", async () => {
    const adapter: RuntimeAdapter = new FakeRuntimeAdapter();
    const answer = adapter.uiContext().input("Name");
    expect(adapter.snapshot().prompts).toHaveLength(1);
    await adapter.dispose();
    await expect(answer).resolves.toBeUndefined();
    expect(adapter.snapshot().prompts).toEqual([]);
  });
});
