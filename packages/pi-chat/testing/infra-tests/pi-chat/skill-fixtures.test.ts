import { afterEach, expect, it } from "vitest";
import { TestWorld } from "../../infra/pi-chat/test-world.js";

let world: TestWorld | undefined;
afterEach(async () => { await world?.dispose(); });

it("gives sessions independent skill fixtures and discovery settings", async () => {
  world = new TestWorld();
  const first = await world.create([], undefined, { skills: [{ name: "first", instructions: "First instructions" }] });
  const second = await world.create([], undefined, { skills: [{ name: "second", instructions: "Second instructions" }], enableSkillCommands: false });
  expect(first.snapshot().actions.commands).toContainEqual({ name: "skill:first", description: "first browser fixture", source: "skill" });
  expect(first.snapshot().actions.commands.some(command => command.name === "skill:second")).toBe(false);
  expect(second.snapshot().actions.commands.some(command => command.source === "skill")).toBe(false);
  expect(first.snapshot().projectPath).not.toBe(second.snapshot().projectPath);
});

it("scripts an actual SDK read of a temporary skill file", async () => {
  world = new TestWorld();
  const adapter = await world.create([{ prompt: "Read the fixture", readSkill: "reader", reply: "Read complete" }], undefined, {
    skills: [{ name: "reader", instructions: "Real fixture read instructions" }],
  });
  await adapter.prompt("Read the fixture");
  expect(adapter.snapshot().messages).toContainEqual(expect.objectContaining({
    role: "tool", tool: expect.objectContaining({ name: "read", status: "success", outputText: expect.stringContaining("Real fixture read instructions") }),
  }));
});
