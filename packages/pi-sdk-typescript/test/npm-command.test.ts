import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveNpmCli } from "../scripts/npm-command.js";

let root: string;
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), "pi-npm-command-")); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

async function installation(options: { external?: boolean; cliPath?: string; directory?: boolean } = {}) {
  const node = join(root, "node/bin/node");
  const packageRoot = join(root, options.external ? "shared/npm" : "node/lib/node_modules/npm");
  const cli = join(packageRoot, options.cliPath ?? "bin/npm-cli.js");
  const manifest = join(packageRoot, "package.json");
  await mkdir(dirname(node), { recursive: true });
  await mkdir(dirname(cli), { recursive: true });
  if (options.directory) await mkdir(cli);
  else await writeFile(cli, "// Installed npm CLI fixture; never executed.");
  await writeFile(manifest, JSON.stringify({ name: "npm", bin: { npm: "bin/npm-cli.js" } }));
  await symlink(cli, join(dirname(node), "npm"));
  return { node, cli, manifest };
}

function expectResolutionFailure(node: string, message: string | RegExp) {
  let caught: unknown;
  try { resolveNpmCli(node); } catch (error) { caught = error; }
  expect(caught).toBeInstanceOf(Error);
  const error = caught as Error;
  expect(error.message).toContain(`Cannot resolve installed npm CLI beside ${node}.`);
  expect(error.message).toContain("PATH and npm_execpath fallback are disabled.");
  expect(error.cause).toBeInstanceOf(Error);
  expect((error.cause as Error).message).toMatch(message);
  return error;
}

describe("resolveNpmCli", () => {
  it.each([false, true])("resolves canonical installed npm symlinks (external: %s)", async (external) => {
    const { node, cli } = await installation({ external });
    expect(resolveNpmCli(node)).toBe(await realpath(cli));
  });

  it("defaults to the running Node installation", async () => {
    expect(resolveNpmCli()).toBe(await realpath(join(dirname(process.execPath), "npm")));
  });

  it("rejects a relative Node path with the original validation cause", () => {
    expectResolutionFailure("node", "Node executable must be absolute");
  });

  it("fails closed when the sibling npm entry is missing", async () => {
    const { node } = await installation();
    await rm(join(dirname(node), "npm"));
    expectResolutionFailure(node, /ENOENT/);
  });

  it.each([
    { cliPath: "bin/other.js" },
    { cliPath: "other/npm-cli.js" },
    { directory: true },
  ])("rejects an invalid CLI layout: %j", async (options) => {
    const { node } = await installation(options);
    expectResolutionFailure(node, "Expected a regular bin/npm-cli.js file");
  });

  it("preserves filesystem errors for missing package metadata", async () => {
    const { node, manifest } = await installation();
    await rm(manifest);
    expectResolutionFailure(node, /ENOENT/);
  });

  it("preserves the syntax error for malformed package metadata", async () => {
    const { node, manifest } = await installation();
    await writeFile(manifest, "invalid json");
    expect(expectResolutionFailure(node, /JSON/).cause).toBeInstanceOf(SyntaxError);
  });

  it.each([
    null,
    {},
    { name: "not-npm", bin: { npm: "bin/npm-cli.js" } },
    { name: "npm" },
    { name: "npm", bin: null },
    { name: "npm", bin: {} },
    { name: "npm", bin: { npm: "other.js" } },
  ])("rejects mismatching package metadata: %j", async (metadata) => {
    const { node, manifest } = await installation();
    await writeFile(manifest, JSON.stringify(metadata));
    expectResolutionFailure(node, "Installed npm package metadata does not match its CLI");
  });
});
