import { existsSync } from "node:fs";
import { basename, dirname } from "node:path";
import { expect, it } from "vitest";
import { TestWorld } from "../infra/pi-chat/test-world.js";

it("supports readable fixture project names and removes their owning temporary directory", async () => {
  const world = new TestWorld([], false, "pi-chat-demo");
  const ownedRoot = dirname(world.projectPath);
  try {
    expect(basename(world.projectPath)).toBe("pi-chat-demo");
    expect(basename(ownedRoot)).toMatch(/^pi-chat-driver-/);
    expect(existsSync(world.projectPath)).toBe(true);
    const session = await world.create([], undefined, { projectName: "retry-review" });
    expect(basename(session.snapshot().projectPath)).toBe("retry-review");
  } finally {
    await world.dispose();
  }
  expect(existsSync(ownedRoot)).toBe(false);
});

it("rejects fixture names that escape their temporary directory", async () => {
  expect(() => new TestWorld([], false, "../escape")).toThrow(/safe directory/);
  const world = new TestWorld();
  try {
    await expect(world.create([], undefined, { projectName: "../escape" })).rejects.toThrow(/safe directory/);
  } finally {
    await world.dispose();
  }
});
