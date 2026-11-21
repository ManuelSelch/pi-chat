import { readFileSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join } from "node:path";

/**
 * Uses the trusted running Node installation, never PATH or npm_execpath.
 * Layout checks are not an authenticity check or a sandbox against same-user writes.
 */
export function resolveNpmCli(nodeExecutable = process.execPath): string {
  try {
    if (!isAbsolute(nodeExecutable)) throw new Error("Node executable must be absolute");
    const cli = realpathSync(join(dirname(nodeExecutable), "npm"));
    if (basename(cli) !== "npm-cli.js" || basename(dirname(cli)) !== "bin" || !statSync(cli).isFile()) {
      throw new Error("Expected a regular bin/npm-cli.js file");
    }
    const manifest = JSON.parse(readFileSync(join(dirname(cli), "../package.json"), "utf8"));
    if (manifest?.name !== "npm" || manifest.bin?.npm !== "bin/npm-cli.js") {
      throw new Error("Installed npm package metadata does not match its CLI");
    }
    return cli;
  } catch (cause) {
    throw new Error(`Cannot resolve installed npm CLI beside ${nodeExecutable}. Install npm alongside the running Node executable; PATH and npm_execpath fallback are disabled.`, { cause });
  }
}
