import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, it, vi } from "vitest";
import { AgentSessionRuntime, SessionManager } from "@earendil-works/pi-coding-agent";
import { TestWorld } from "../../infra/pi-chat/test-world.js";
import { worktreeCommandFixture } from "../../infra/pi-chat/fixtures/worktree-command-fixture.js";

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

it("keeps worktree-command session files inside the disposable test world", async () => {
  world = new TestWorld([worktreeCommandFixture], false, "command-repository");
  execFileSync("git", ["init", "-b", "main", world.projectPath], { stdio: "ignore" });
  execFileSync("git", ["-C", world.projectPath, "-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "--allow-empty", "-m", "Fixture"], { stdio: "ignore" });
  const create = SessionManager.create;
  // Fail before a regression can write into the user's real session folder.
  vi.spyOn(SessionManager, "create").mockImplementation((cwd, sessionDir) => {
    if (sessionDir !== world!.sessionDir) throw new Error("Test session escaped its isolated storage");
    return create(cwd, sessionDir);
  });
  const adapter = await world.create([]);

  await adapter.prompt("/worktree create feature/new-checkout");

  const path = adapter.snapshot().sessionPath!;
  expect(adapter.snapshot().projectPath).toBe(join(world.projectPath, "new-checkout"));
  expect(path.startsWith(`${world.sessionDir}/`)).toBe(true);
  expect(existsSync(path)).toBe(true);

  await world.dispose();

  expect(existsSync(path)).toBe(false);
});

it("never falls back to real project/session loading outside the test world", async () => {
  world = new TestWorld();
  const release = world.reserveSession([]);
  await expect(world.factory.newSession(tmpdir())).rejects.toThrow(/Only the isolated test project/);
  release();
  await expect(world.factory.newSession(world.projectPath)).rejects.toThrow(/No response script reserved/);
  await expect(world.factory.continueProject(tmpdir())).rejects.toThrow(/not supported/);
  await expect(world.factory.openSession("outside.jsonl")).rejects.toThrow(/Only isolated test sessions/);
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
