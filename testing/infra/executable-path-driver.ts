import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { expect } from "vitest";

const exec = promisify(execFile);
const resolverUrl = pathToFileURL(resolve("src/shared/node/npm-command.ts")).href;

/** Isolated fake installations and harmless poisoned tools; every child has a deadline. */
export class ExecutablePathDriver {
  private constructor(private readonly root: string) {}

  static async create() {
    const root = await mkdtemp(join(tmpdir(), "pi-executable-path-"));
    const driver = new ExecutablePathDriver(root);
    try {
      await mkdir(join(root, "poison"));
      for (const name of ["npm", "ps", "vmmap"]) {
        await writeFile(join(root, "poison", name), `#!/bin/sh\nprintf 'POISON_${name}\\n'\n`, { mode: 0o700 });
      }
      return driver;
    } catch (error) { await driver.dispose(); throw error; }
  }

  private environment() {
    return { ...process.env, PATH: join(this.root, "poison"), npm_execpath: join(this.root, "poison/npm") };
  }

  private async install(external = false) {
    const node = join(this.root, "node/bin/node");
    const packageRoot = join(this.root, external ? "shared/lib/node_modules/npm" : "node/lib/node_modules/npm");
    const cli = join(packageRoot, "bin/npm-cli.js");
    await mkdir(dirname(node), { recursive: true });
    await mkdir(dirname(cli), { recursive: true });
    await writeFile(node, "trusted installation placeholder");
    await writeFile(join(packageRoot, "package.json"), JSON.stringify({ name: "npm", bin: { npm: "bin/npm-cli.js" } }));
    await writeFile(cli, 'console.log(JSON.stringify({ kind: "installed", args: process.argv.slice(2) }));');
    await symlink(cli, join(dirname(node), "npm"));
    return { node, cli, packageRoot };
  }

  private async resolveCli(node?: string) {
    const code = `import { resolveNpmCli } from ${JSON.stringify(resolverUrl)}; console.log(resolveNpmCli(${node === undefined ? "" : JSON.stringify(node)}));`;
    const { stdout } = await exec(process.execPath, ["--input-type=module", "-e", code], { env: this.environment(), timeout: 10_000 });
    return stdout.trim();
  }

  async shouldResolveInstalledCli(external: boolean) {
    const { node, cli } = await this.install(external);
    expect(await this.resolveCli(node)).toBe(await realpath(cli));
  }

  async shouldIgnorePoisonedLookup() {
    const { node, cli } = await this.install(true);
    // Characterize the old lookup's vulnerability using a harmless fake npm.
    const old = await exec("npm", [], { env: this.environment(), timeout: 10_000 });
    expect(old.stdout.trim()).toBe("POISON_npm");
    const resolved = await this.resolveCli(node);
    expect(resolved).toBe(await realpath(cli));
    const { stdout } = await exec(process.execPath, [resolved, "pack", "--pack-destination", "directory with spaces"], { env: this.environment(), timeout: 10_000 });
    expect(JSON.parse(stdout)).toEqual({ kind: "installed", args: ["pack", "--pack-destination", "directory with spaces"] });
  }

  async shouldRejectInvalidInstallation(kind: "missing" | "metadata" | "bin" | "json" | "filename" | "directory" | "relative") {
    const { node, cli, packageRoot } = await this.install();
    switch (kind) {
      case "missing": await rm(join(dirname(node), "npm")); break;
      case "metadata": await writeFile(join(packageRoot, "package.json"), JSON.stringify({ name: "not-npm", bin: { npm: "bin/npm-cli.js" } })); break;
      case "bin": await writeFile(join(packageRoot, "package.json"), JSON.stringify({ name: "npm", bin: { npm: "other.js" } })); break;
      case "json": await writeFile(join(packageRoot, "package.json"), "invalid json"); break;
      case "filename": {
        const other = join(packageRoot, "bin/other.js"); await writeFile(other, "");
        await rm(join(dirname(node), "npm")); await symlink(other, join(dirname(node), "npm")); break;
      }
      case "directory": await rm(cli); await mkdir(cli); break;
      case "relative": break;
    }
    await expect(this.resolveCli(kind === "relative" ? "node" : node)).rejects.toThrow(/Cannot resolve installed npm CLI/);
  }

  async shouldRunRealNpmWithoutPathLookup() {
    const cli = await this.resolveCli();
    expect(cli.endsWith("/bin/npm-cli.js")).toBe(true);
    const { stdout } = await exec(process.execPath, [cli, "--version"], { env: this.environment(), timeout: 10_000 });
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  }

  async shouldUseRealSystemTools() {
    const { stdout } = await exec("/bin/ps", ["-p", String(process.pid), "-o", "rss="], { env: this.environment(), timeout: 10_000 });
    expect(Number(stdout.trim())).toBeGreaterThan(0);
    if (process.platform === "darwin") {
      // Inspect the binary, rather than requiring macOS task-inspection privileges in tests.
      const binary = await readFile("/usr/bin/vmmap");
      expect(binary.length).toBeGreaterThan(0);
    }
  }

  async dispose() { await rm(this.root, { recursive: true, force: true }); }
}
