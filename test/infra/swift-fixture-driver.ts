import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { expect } from "vitest";

interface Ready { directory: string; endpoint: string }

/** Owns the subprocess, readiness deadline and isolated artifacts, including on failure. */
export class SwiftFixtureDriver {
  private readonly child;
  private readonly exited;
  private output = "";
  private finished = false;
  private ready?: Ready;

  private constructor(private readonly root: string, callerDirectory: boolean) {
    this.child = spawn(process.execPath, ["--import", "tsx", "test/swift-integration/fixtures/loopback-server.ts", ...(callerDirectory ? [join(root, "caller")] : [])], {
      env: { ...process.env, TMPDIR: root, TMP: root, TEMP: root },
      stdio: "pipe",
    });
    this.child.stdin.end();
    this.child.stdout.setEncoding("utf8").on("data", (chunk: string) => { this.output += chunk; });
    this.child.stderr.setEncoding("utf8").on("data", (chunk: string) => { this.output += chunk; });
    this.exited = new Promise<number | null>((resolve, reject) => {
      this.child.once("error", reject);
      this.child.once("close", (code) => { this.finished = true; resolve(code); });
    });
  }

  static async launch(callerDirectory = false) {
    const root = await mkdtemp(join(tmpdir(), "pi-fixture-test-"));
    if (callerDirectory) await mkdir(join(root, "caller"));
    return new SwiftFixtureDriver(root, callerDirectory);
  }

  private async waitForExit() {
    const deadline = Date.now() + 7_000;
    while (!this.finished && Date.now() < deadline) await delay(20);
    if (!this.finished) throw new Error(`Fixture did not exit: ${this.output}`);
    return this.exited;
  }

  private async waitForReady(): Promise<Ready> {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const line = this.output.split("\n").slice(0, -1).find(line => line.startsWith("PI_FIXTURE_READY "));
      if (line) {
        this.ready = JSON.parse(line.slice("PI_FIXTURE_READY ".length)) as Ready;
        return this.ready;
      }
      if (this.finished) throw new Error(`Fixture exited before readiness: ${this.output}`);
      await delay(20);
    }
    throw new Error(`Fixture readiness timed out: ${this.output}`);
  }

  async shouldRejectCallerDirectory() {
    expect(await this.waitForExit()).not.toBe(0);
    expect(this.output).toContain("does not accept arguments");
    expect(await readdir(join(this.root, "caller"))).toEqual([]);
  }

  async shouldOwnPrivateWorkspace() {
    const ready = await this.waitForReady();
    expect(ready.directory).toBe(await realpath(ready.directory));
    expect(ready.directory.startsWith(`${await realpath(this.root)}/`)).toBe(true);
    expect((await stat(ready.directory)).mode & 0o777).toBe(0o700);
    expect(new URL(ready.endpoint).hostname).toBe("127.0.0.1");
    expect(await readdir(ready.directory)).not.toContain("endpoint");
    this.child.kill("SIGTERM");
    expect(await this.waitForExit()).toBe(0);
    expect(JSON.parse(await readFile(join(ready.directory, "cleanup.json"), "utf8"))).toEqual({ created: 0, retained: 0, closed: 0 });
  }

  async shouldNotOverwriteCleanup(kind: "file" | "symlink") {
    const ready = await this.waitForReady();
    const target = join(this.root, "untouched.txt");
    const report = join(ready.directory, "cleanup.json");
    await writeFile(target, "original");
    if (kind === "symlink") await symlink(target, report);
    else await writeFile(report, "original");
    this.child.kill("SIGTERM");
    expect(await this.waitForExit()).not.toBe(0);
    expect(await readFile(report, "utf8")).toBe("original");
    expect(await readFile(target, "utf8")).toBe("original");
  }

  async dispose() {
    if (!this.finished) {
      this.child.kill("SIGKILL");
      await this.waitForExit();
    }
    // TMPDIR is test-owned: even a failed readiness handoff cannot leak artifacts.
    await rm(this.root, { recursive: true, force: true });
  }
}
