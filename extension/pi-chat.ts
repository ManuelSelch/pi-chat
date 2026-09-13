/**
 * Pi Chat extension
 *
 * Adds /pi-chat-start, /pi-chat-stop, and /pi-chat to run the local web UI
 * from a Pi terminal session.
 *
 * The server is spawned detached and its pid is written to a file, so it
 * survives a Pi restart and can still be stopped afterwards.
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  return resolve(dirname(fileURLToPath(import.meta.url)), "..");
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

async function isHealthy(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: AbortSignal.timeout(1_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForHealth(port: number, deadline: number): Promise<boolean> {
  while (Date.now() < deadline) {
    if (await isHealthy(port)) return true;
    await new Promise((done) => setTimeout(done, 400));
  }
  return false;
}

function parseArgs(args: string): { port: number; cwd?: string } {
  const tokens = args.trim().split(/\s+/).filter(Boolean);
  let port = Number(process.env.PI_CHAT_PORT ?? DEFAULT_PORT);
  let cwd: string | undefined;
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]!;
    if ((token === "--port" || token === "-p") && tokens[index + 1]) port = Number(tokens[++index]);
    else if (token === "--cwd" && tokens[index + 1]) cwd = resolve(tokens[++index]!);
    else if (/^\d+$/.test(token)) port = Number(token);
  }
  return { port, ...(cwd ? { cwd } : {}) };
}

export default function piChatExtension(pi: ExtensionAPI): void {
  pi.registerCommand("pi-chat-start", {
    description: "Start the Pi Chat web UI (/pi-chat-start [--port N] [--cwd PATH])",
    handler: async (args, ctx) => {
      const { port, cwd } = parseArgs(args);
      const home = projectHome();
      const projectCwd = cwd ?? ctx.cwd;

      if (!existsSync(join(home, "package.json"))) {
        ctx.ui.notify(`Pi Chat not found at ${home}. Set PI_CHAT_HOME to its folder.`, "error");
        return;
      }

      const running = readPidFile();
      if (running && (await isHealthy(running.port))) {
        ctx.ui.notify(`Pi Chat already runs on http://127.0.0.1:${running.port} (pid ${running.pid})`, "warning");
        return;
      }
      if (await isHealthy(port)) {
        ctx.ui.notify(`Port ${port} is already serving something. Use --port to pick another.`, "error");
        return;
      }

      // The server serves the built client from dist/web, so a fresh checkout
      // needs one build before it can answer anything but the API.
      if (!existsSync(join(home, "dist/web/index.html"))) {
        ctx.ui.notify("Building the Pi Chat client…", "info");
        const build = await pi.exec("npm", ["run", "build"], { cwd: home });
        if (build.exitCode !== 0) {
          ctx.ui.notify(`Pi Chat build failed: ${build.stderr.trim().split("\n").at(-1) ?? "unknown error"}`, "error");
          return;
        }
      }

      const child = spawn("npm", ["start"], {
        cwd: home,
        env: { ...process.env, PI_CHAT_PORT: String(port), PI_CHAT_CWD: projectCwd },
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
      ctx.ui.notify(
        ready
          ? `Pi Chat is running: http://127.0.0.1:${port} (project ${projectCwd})`
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

      try {
        // The npm wrapper spawns the real server, so the whole process group
        // has to go; killing only the pid would orphan the listener.
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
      rmSync(PID_FILE, { force: true });
      ctx.ui.notify(
        stopped ? `Pi Chat stopped (was pid ${running.pid}).` : `Pi Chat on port ${running.port} did not stop.`,
        stopped ? "info" : "error",
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
      ctx.ui.notify("Pi Chat: stopped. Start it with /pi-chat-start.", "info");
    },
  });
}
