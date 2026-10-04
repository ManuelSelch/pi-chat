import { spawn } from "node:child_process";

export interface RestartPlan {
  command: string;
  args: string[];
  cwd: string;
}

/**
 * The command that reproduces this server process.
 *
 * Re-executing argv keeps the successor identical to whatever started it, so
 * the restart does not have to know about npm scripts or wrapper processes.
 *
 * execArgv is essential and easy to miss: it carries the tsx loader flags that
 * let node run TypeScript at all. Without them the successor is asked to run a
 * .ts file under bare node and dies before it can bind the port.
 */
export function successorPlan(argv = process.argv, cwd = process.cwd(), execArgv = process.execArgv): RestartPlan {
  const [execPath, ...args] = argv;
  return { command: execPath ?? process.execPath, args: [...execArgv, ...args], cwd };
}

/**
 * The shell that brings the successor up once this process is gone.
 *
 * A restart cannot simply spawn a replacement: the port is still bound until
 * the old process exits, so the successor would die with EADDRINUSE. The
 * waiter polls the old pid and only then execs, which also means a crash
 * during shutdown still leaves a server running.
 */
export function waiterScript(pid: number): string {
  return `while kill -0 ${pid} 2>/dev/null; do sleep 0.2; done; exec "$@"`;
}

export interface RestartService {
  /** Undefined once the successor is queued; a message when it cannot be. */
  restart(): Promise<string | undefined>;
}

/**
 * Restarting is only safe when nothing else is supervising this process. Under
 * `tsx watch` the watcher would start its own replacement as soon as this one
 * exits, and the two would fight over the port.
 */
export function createRestartService(options: {
  plan?: RestartPlan;
  pid?: number;
  shutdown: () => void;
  build?: () => Promise<string | undefined>;
  spawnDetached?: (command: string, args: string[], cwd: string) => void;
}): RestartService {
  const plan = options.plan ?? successorPlan();
  const pid = options.pid ?? process.pid;
  const spawnDetached = options.spawnDetached ?? defaultSpawn;
  const build = options.build ?? (() => runBuild(plan.cwd));

  return {
    async restart() {
      // Build before touching the running server: a broken build must leave the
      // current one serving rather than take the UI down.
      const failure = await build();
      if (failure) return failure;

      spawnDetached("/bin/sh", ["-c", waiterScript(pid), "sh", plan.command, ...plan.args], plan.cwd);
      // Shutting down after the waiter exists means the port is released with a
      // successor already queued, so the gap is one process start.
      options.shutdown();
      return undefined;
    },
  };
}

/**
 * Rebuilds the client the server serves from dist/web.
 *
 * Only the exit code decides: `vite build` writes its chunk-size advice to
 * stderr on a perfectly good build.
 */
function runBuild(cwd: string): Promise<string | undefined> {
  return new Promise((done) => {
    const child = spawn("npm", ["run", "build"], { cwd, stdio: ["ignore", "pipe", "pipe"] });
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

function defaultSpawn(command: string, args: string[], cwd: string): void {
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    // Detached with no stdio: the successor must outlive this process, and
    // there is no terminal to inherit once the browser triggered the restart.
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}
