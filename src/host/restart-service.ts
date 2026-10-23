import { spawn } from "node:child_process";
import { createRestartService as createServerRestartService, type RestartOptions, type RestartService } from "@manuelselch/pi-server";
import { resolveNpmCli } from "../shared/node/npm-command.js";

/** Chat rebuilds its assets before generic server re-execution. */
export function createRestartService(options: RestartOptions): RestartService {
  return createServerRestartService({ ...options, build: options.build ?? (() => runBuild(options.plan?.cwd ?? process.cwd())) });
}

/**
 * Rebuilds the client the server serves from dist/web.
 *
 * Only the exit code decides: `vite build` writes its chunk-size advice to
 * stderr on a perfectly good build.
 */
function runBuild(cwd: string): Promise<string | undefined> {
  let npmCli: string;
  try { npmCli = resolveNpmCli(); }
  catch (error) { return Promise.resolve(`could not run npm run build: ${error instanceof Error ? error.message : String(error)}`); }
  return new Promise((done) => {
    const child = spawn(process.execPath, [npmCli, "run", "build"], { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += String(chunk); });
    child.stderr.on("data", (chunk) => { output += String(chunk); });
    child.on("error", (error) => done(`could not run npm run build: ${error.message}`));
    child.on("close", (code) => {
      if (code === 0) return done(undefined);
      const detail = output.trim().split("\n").filter((line) => line.trim() !== "").at(-1);
      done(detail ?? `npm run build exited with ${code}`);
    });
  });
}

