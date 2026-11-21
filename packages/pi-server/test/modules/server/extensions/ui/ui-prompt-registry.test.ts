import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UiPromptRegistry } from "../../../../../src/extensions/ui/ui-prompt-registry.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function registry(timeoutMs = 1_000) {
  const changes: number[] = [];
  const instance = new UiPromptRegistry((prompts) => changes.push(prompts.length), timeoutMs);
  return { instance, changes };
}

describe("UiPromptRegistry", () => {
  it("publishes a pending prompt and resolves it with the answer", async () => {
    const { instance, changes } = registry();

    const answer = instance.ask({ kind: "confirm", title: "Delete?" });
    const [prompt] = instance.list();
    expect(prompt).toMatchObject({ kind: "confirm", title: "Delete?" });

    instance.respond(prompt!.id, { cancelled: false, value: true });

    await expect(answer).resolves.toEqual({ cancelled: false, value: true });
    expect(instance.list()).toEqual([]);
    expect(changes).toEqual([1, 0]);
  });

  it("settles once, so a late or duplicate answer is ignored", async () => {
    const { instance } = registry();
    const answer = instance.ask({ kind: "input", title: "Name" });
    const id = instance.list()[0]!.id;

    instance.respond(id, { cancelled: false, value: "first" });
    instance.respond(id, { cancelled: false, value: "second" });
    instance.respond("unknown", { cancelled: false, value: "other" });

    await expect(answer).resolves.toEqual({ cancelled: false, value: "first" });
  });

  it("keeps nested prompts as a stack", () => {
    const { instance } = registry();
    void instance.ask({ kind: "confirm", title: "Outer" });
    void instance.ask({ kind: "input", title: "Inner" });

    expect(instance.list().map((prompt) => prompt.title)).toEqual(["Outer", "Inner"]);
  });

  it("cancels a forgotten prompt after the timeout", async () => {
    const { instance } = registry(1_000);
    const answer = instance.ask({ kind: "confirm", title: "Still there?" });

    vi.advanceTimersByTime(1_000);

    await expect(answer).resolves.toEqual({ cancelled: true });
    expect(instance.list()).toEqual([]);
  });

  it("defaults to a five-minute lifetime from creation", async () => {
    const instance = new UiPromptRegistry(() => {});
    const answer = instance.ask({ kind: "confirm", title: "Allow?" });

    vi.advanceTimersByTime(299_999);
    expect(instance.list()).toHaveLength(1);
    vi.advanceTimersByTime(1);

    await expect(answer).resolves.toEqual({ cancelled: true });
    expect(instance.list()).toEqual([]);
  });

  it("cancels everything on dispose so no extension stays blocked", async () => {
    const { instance } = registry();
    const first = instance.ask({ kind: "confirm", title: "One" });
    const second = instance.ask({ kind: "input", title: "Two" });

    instance.dispose();

    await expect(first).resolves.toEqual({ cancelled: true });
    await expect(second).resolves.toEqual({ cancelled: true });
  });
});
