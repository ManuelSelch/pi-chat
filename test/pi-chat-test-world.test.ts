import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { afterEach, expect, it, vi } from "vitest";
import { AgentSessionRuntime } from "@earendil-works/pi-coding-agent";
import { TestWorld } from "./support/pi-chat/test-world.js";

let world: TestWorld | undefined;
afterEach(async () => {
  try { await world?.dispose(); }
  finally { world = undefined; vi.restoreAllMocks(); }
});

it("creates distinct real sessions in its isolated project and disposes each once", async () => {
  world = new TestWorld();
  const dispose = vi.spyOn(AgentSessionRuntime.prototype, "dispose");
  const first = await world.create([{ prompt: "Hello", reply: "First." }]);
  const release = world.reserveSession([{ prompt: "Hello", reply: "Second." }]);
  const second = await world.factory.newSession(world.projectPath);
  release();
  expect(first.snapshot().sessionId).not.toBe(second.snapshot().sessionId);
  expect(first.snapshot().projectPath).toBe(world.projectPath);
  expect(second.snapshot().projectPath).toBe(world.projectPath);
  await first.prompt("Hello");
  await second.prompt("Hello");
  expect(first.snapshot().messages.some(m => m.role === "assistant" && m.text === "First.")).toBe(true);
  expect(second.snapshot().messages.some(m => m.role === "assistant" && m.text === "Second.")).toBe(true);
  await first.dispose(); // Simulate the server closing a tab before world disposal.
  await world.dispose();
  await world.dispose();
  expect(dispose).toHaveBeenCalledTimes(2);
  expect(existsSync(world.projectPath)).toBe(false);
});

it("never falls back to real project/session loading outside the test world", async () => {
  world = new TestWorld();
  const release = world.reserveSession([]);
  await expect(world.factory.newSession(tmpdir())).rejects.toThrow(/Only the isolated test project/);
  release();
  await expect(world.factory.newSession(world.projectPath)).rejects.toThrow(/No response script reserved/);
  await expect(world.factory.continueProject(tmpdir())).rejects.toThrow(/not supported/);
  await expect(world.factory.openSession("outside.jsonl")).rejects.toThrow(/not supported/);
});

it("waits for an in-flight creation to clean up before deleting the project", async () => {
  world = new TestWorld();
  const pending = world.create([]);
  const result = expect(pending).rejects.toThrow(/disposed during session creation/);
  await world.dispose();
  await result;
  expect(existsSync(world.projectPath)).toBe(false);
});

it("rejects concurrent reservations and duplicate use of a reservation", async () => {
  world = new TestWorld();
  const release = world.reserveSession([]);
  expect(() => world!.reserveSession([])).toThrow(/Await Tabs.Create/);
  await world.factory.newSession(world.projectPath);
  await expect(world.factory.newSession(world.projectPath)).rejects.toThrow(/already in progress/);
  release();
  const nextRelease = world.reserveSession([]);
  await world.factory.newSession(world.projectPath);
  nextRelease();
});
