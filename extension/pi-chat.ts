/**
 * Pi Chat extension
 *
 * Adds /pi-chat-start, /pi-chat-stop, /pi-chat-restart, and /pi-chat to run the local web UI
 * from a Pi terminal session.
 *
 * The server is spawned detached and its pid is written to a file, so it
 * survives a Pi restart and can still be stopped afterwards.
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

const DEFAULT_PORT = 8788;
const PID_FILE = join(tmpdir(), "pi-chat-server.pid");
const START_TIMEOUT_MS = 60_000;

/** The repo this extension file lives in, unless overridden. */
function projectHome(): string {
  const configured = process.env.PI_CHAT_HOME?.trim();
  if (configured) return resolve(configured);
  // Installing this as a symlink in ~/.pi/agent/extensions is the normal case,
  // and the loader reports the link's path, so the link has to be followed to
  // find the repository it actually lives in.
  const self = fileURLToPath(import.meta.url);
  const real = (() => {
    try {
      return realpathSync(self);
    } catch {
      return self;
    }
  })();
  return resolve(dirname(real), "..");
}

interface Running {
  pid: number;
  port: number;
  cwd: string;
}

function readPidFile(): Running | undefined {
  if (!existsSync(PID_FILE)) return undefined;
  try {
    const running = JSON.parse(readFileSync(PID_FILE, "utf8")) as Running;
    // A stale file outlives a crashed server, so the pid must be probed.
    process.kill(running.pid, 0);
    return running;
  } catch {
    rmSync(PID_FILE, { force: true });
    return undefined;
  }
}

/**
 * `free` means nothing listens, `other` means the port belongs to a different
 * program. Telling those apart matters: a Pi Chat started by hand with
 * `npm run dev` is not an error, it is the thing the command wanted to start.
 */
type PortState = "free" | "pi-chat" | "other";

async function probePort(port: number): Promise<PortState> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: AbortSignal.timeout(1_500),
    });
    if (!response.ok) return "other";
    const body = (await response.json().catch(() => undefined)) as { ok?: boolean } | undefined;
    return body?.ok === true ? "pi-chat" : "other";
  } catch (error) {
    // Only a refused connection proves the port is unused; a timeout or reset
    // means something is listening but not answering /health.
    const code = (error as { cause?: { code?: string } })?.cause?.code;
    return code === "ECONNREFUSED" ? "free" : "other";
  }
}

async function isHealthy(port: number): Promise<boolean> {
  return (await probePort(port)) === "pi-chat";
}

async function waitForHealth(port: number, deadline: number): Promise<boolean> {
  while (Date.now() < deadline) {
    if (await isHealthy(port)) return true;
    await new Promise((done) => setTimeout(done, 400));
  }
  return false;
}

/**
 * Builds the client, returning a message when it failed and nothing when it
 * worked.
 *
 * Only the exit code decides. `vite build` writes its chunk-size advice to
 * stderr on a perfectly good build, so treating stderr as failure reports
 * "build failed: - Adjust chunk size limit..." on every run. Note the field is
 * `code`, not `exitCode`: reading the wrong one yields undefined, and
 * `undefined !== 0` makes every build look broken.
 */
export async function build(pi: Pick<ExtensionAPI, "exec">, home: string): Promise<string | undefined> {
  const result = await pi.exec("npm", ["run", "build"], { cwd: home });
  if (result.code === 0) return undefined;
  const output = `${result.stderr}\n${result.stdout}`.trim();
  const detail = output.split("\n").filter((line) => line.trim() !== "").at(-1);
  return detail ?? `npm run build exited with ${result.code}`;
}

async function stopRunningServer(running: Running): Promise<boolean> {
  try {
    // The npm wrapper spawns the real server, so the whole process group has to
    // go; killing only the pid would orphan the listener.
    process.kill(-running.pid, "SIGTERM");
  } catch {
    try {
      process.kill(running.pid, "SIGTERM");
    } catch {
      // Already gone.
    }
  }

  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline && (await isHealthy(running.port))) {
    await new Promise((done) => setTimeout(done, 200));
  }
  const stopped = !(await isHealthy(running.port));
  if (stopped) rmSync(PID_FILE, { force: true });
  return stopped;
}

/** Opens the default browser without blocking the command. */
function openBrowser(url: string): void {
  const [command, args] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : ["xdg-open", [url]];
  const child = spawn(command, args as string[], { stdio: "ignore", detached: true });
  child.unref();
  // A missing opener must not fail the command; the URL is always reported too.
  child.on("error", () => {});
}

function parseArgs(args: string): { port: number; cwd?: string; open: boolean; portExplicit: boolean } {
  const tokens = args.trim().split(/\s+/).filter(Boolean);
  let port = Number(process.env.PI_CHAT_PORT ?? DEFAULT_PORT);
  let portExplicit = false;
  let cwd: string | undefined;
  let open = true;
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]!;
    if ((token === "--port" || token === "-p") && tokens[index + 1]) {
      port = Number(tokens[++index]);
      portExplicit = true;
    } else if (token === "--cwd" && tokens[index + 1]) cwd = resolve(tokens[++index]!);
    else if (token === "--no-open") open = false;
    else if (/^\d+$/.test(token)) {
      port = Number(token);
      portExplicit = true;
    }
  }
  return { port, open, portExplicit, ...(cwd ? { cwd } : {}) };
}

export default function piChatExtension(pi: ExtensionAPI): void {
  pi.registerCommand("pi-chat-start", {
    description: "Start the Pi Chat web UI and open it (/pi-chat-start [--port N] [--cwd PATH] [--no-open])",
    handler: async (args, ctx) => {
      const { port, cwd, open } = parseArgs(args);
      const home = projectHome();
      const projectCwd = cwd ?? ctx.cwd;

      if (!existsSync(join(home, "package.json"))) {
        ctx.ui.notify(
          `Pi Chat not found at ${home}. Start Pi with PI_CHAT_HOME=/path/to/pi-chat, e.g. export PI_CHAT_HOME="$HOME/.pi/agent/git/pi-chat".`,
          "error",
        );
        return;
      }

      // An already-running Pi Chat is not an error: just show it again.
      const running = readPidFile();
      if (running && (await isHealthy(running.port))) {
        if (open) openBrowser(`http://127.0.0.1:${running.port}`);
        ctx.ui.notify(
          `Pi Chat already runs on http://127.0.0.1:${running.port} (pid ${running.pid})${open ? " · opening browser" : ""}`,
          "info",
        );
        return;
      }

      const state = await probePort(port);
      if (state === "pi-chat") {
        if (open) openBrowser(`http://127.0.0.1:${port}`);
        ctx.ui.notify(
          `Pi Chat already runs on http://127.0.0.1:${port}, started outside these commands${open ? " · opening browser" : ""}. /pi-chat-stop cannot stop it.`,
          "info",
        );
        return;
      }
      if (state === "other") {
        ctx.ui.notify(`Port ${port} is used by another program. Pick another with /pi-chat-start --port N.`, "error");
        return;
      }

      // The server serves the built client from dist/web, so a fresh checkout
      // needs one build before it can answer anything but the API.
      if (!existsSync(join(home, "dist/web/index.html"))) {
        ctx.ui.notify("Building the Pi Chat client…", "info");
        const failure = await build(pi, home);
        if (failure) {
          ctx.ui.notify(`Pi Chat build failed: ${failure}`, "error");
          return;
        }
      }

      const child = spawn("npm", ["start"], {
        cwd: home,
        env: { ...process.env, PI_CHAT_PORT: String(port), PI_CHAT_CWD: projectCwd, PI_CHAT_PID_FILE: PID_FILE },
        // Detached so the UI outlives this Pi session; output is dropped
        // because there is no terminal to show it in.
        detached: true,
        stdio: "ignore",
      });
      child.unref();

      if (!child.pid) {
        ctx.ui.notify("Could not start the Pi Chat server.", "error");
        return;
      }
      writeFileSync(PID_FILE, JSON.stringify({ pid: child.pid, port, cwd: projectCwd }));

      ctx.ui.notify(`Starting Pi Chat on http://127.0.0.1:${port}…`, "info");
      const ready = await waitForHealth(port, Date.now() + START_TIMEOUT_MS);
      // Only open once the server actually answers, so the browser never lands
      // on a connection error.
      if (ready && open) openBrowser(`http://127.0.0.1:${port}`);
      ctx.ui.notify(
        ready
          ? `Pi Chat is running: http://127.0.0.1:${port} (project ${projectCwd})${open ? " · opening browser" : ""}`
          : `Pi Chat did not become healthy within ${START_TIMEOUT_MS / 1000}s. Check it with /pi-chat.`,
        ready ? "info" : "error",
      );
    },
  });

  pi.registerCommand("pi-chat-stop", {
    description: "Stop the Pi Chat web UI",
    handler: async (_args, ctx) => {
      const running = readPidFile();
      if (!running) {
        ctx.ui.notify("Pi Chat is not running.", "warning");
        return;
      }

      const stopped = await stopRunningServer(running);
      ctx.ui.notify(
        stopped ? `Pi Chat stopped (was pid ${running.pid}).` : `Pi Chat on port ${running.port} did not stop.`,
        stopped ? "info" : "error",
      );
    },
  });

  pi.registerCommand("pi-chat-restart", {
    description: "Restart the Pi Chat web UI and open it (/pi-chat-restart [--port N] [--cwd PATH] [--no-open])",
    handler: async (args, ctx) => {
      const parsed = parseArgs(args);
      const home = projectHome();
      const running = readPidFile();
      const port = parsed.portExplicit ? parsed.port : running?.port ?? parsed.port;
      const projectCwd = parsed.cwd ?? running?.cwd ?? ctx.cwd;

      if (!existsSync(join(home, "package.json"))) {
        ctx.ui.notify(
          `Pi Chat not found at ${home}. Start Pi with PI_CHAT_HOME=/path/to/pi-chat, e.g. export PI_CHAT_HOME="$HOME/.pi/agent/git/pi-chat".`,
          "error",
        );
        return;
      }

      // Build first: a broken build must never leave the UI stopped.
      ctx.ui.notify("Building the Pi Chat client…", "info");
      const failure = await build(pi, home);
      if (failure) {
        ctx.ui.notify(`Pi Chat build failed, so the running server was left alone: ${failure}`, "error");
        return;
      }

      if (running && (await isHealthy(running.port))) {
        ctx.ui.notify(`Restarting Pi Chat on http://127.0.0.1:${port}…`, "info");
        const stopped = await stopRunningServer(running);
        if (!stopped) {
          ctx.ui.notify(`Pi Chat on port ${running.port} did not stop.`, "error");
          return;
        }
      } else if ((await probePort(port)) === "pi-chat") {
        ctx.ui.notify(
          `Pi Chat is running on http://127.0.0.1:${port}, but it was started outside these commands. Stop it manually or use another port.`,
          "error",
        );
        return;
      }

      const state = await probePort(port);
      if (state !== "free") {
        ctx.ui.notify(
          state === "pi-chat"
            ? `Pi Chat is already running on http://127.0.0.1:${port}, but it is not the server just stopped.`
            : `Port ${port} is used by another program. Pick another with /pi-chat-restart --port N.`,
          "error",
        );
        return;
      }

      const child = spawn("npm", ["start"], {
        cwd: home,
        env: { ...process.env, PI_CHAT_PORT: String(port), PI_CHAT_CWD: projectCwd, PI_CHAT_PID_FILE: PID_FILE },
        detached: true,
        stdio: "ignore",
      });
      child.unref();

      if (!child.pid) {
        ctx.ui.notify("Could not restart the Pi Chat server.", "error");
        return;
      }
      writeFileSync(PID_FILE, JSON.stringify({ pid: child.pid, port, cwd: projectCwd }));

      const ready = await waitForHealth(port, Date.now() + START_TIMEOUT_MS);
      if (ready && parsed.open) openBrowser(`http://127.0.0.1:${port}`);
      ctx.ui.notify(
        ready
          ? `Pi Chat restarted: http://127.0.0.1:${port} (project ${projectCwd})${parsed.open ? " · opening browser" : ""}`
          : `Pi Chat did not become healthy within ${START_TIMEOUT_MS / 1000}s. Check it with /pi-chat.`,
        ready ? "info" : "error",
      );
    },
  });

  pi.registerCommand("pi-chat", {
    description: "Show Pi Chat web UI status",
    handler: async (_args, ctx: ExtensionCommandContext) => {
      const running = readPidFile();
      if (running && (await isHealthy(running.port))) {
        ctx.ui.notify(
          `Pi Chat: running on http://127.0.0.1:${running.port} · project ${running.cwd} · pid ${running.pid}`,
          "info",
        );
        return;
      }

      // A hand-started server is still a running Pi Chat, just not one these
      // commands own.
      const port = Number(process.env.PI_CHAT_PORT ?? DEFAULT_PORT);
      if ((await probePort(port)) === "pi-chat") {
        ctx.ui.notify(`Pi Chat: running on http://127.0.0.1:${port}, started outside these commands.`, "info");
        return;
      }
      ctx.ui.notify("Pi Chat: stopped. Start it with /pi-chat-start.", "info");
    },
  });
}
