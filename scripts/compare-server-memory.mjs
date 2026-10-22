import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { rssKilobytes, physicalPeakMegabytes } from "./server-memory/metrics.mjs";

const root = process.cwd();
const holdMs = Number(process.env.PI_CHAT_MEMORY_HOLD_MS ?? 10_000);
const temp = await mkdtemp(join(tmpdir(), "pi-chat-memory-compare-"));

async function freePort() {
  const server = createServer();
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  assert(address && typeof address !== "string");
  await new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
  return address.port;
}

async function sample(label, command, args, port) {
  const pidFile = join(temp, `${label}.pid`);
  const logDirectory = join(temp, `${label}-logs`);
  const child = spawn(command, args, {
    cwd: root,
    env: {
      ...process.env,
      PI_CHAT_PORT: String(port),
      PI_CHAT_CWD: root,
      PI_CHAT_PID_FILE: pidFile,
      PI_CHAT_LOG_DIR: logDirectory,
    },
    stdio: "ignore",
    detached: true,
  });
  if (!child.pid) throw new Error(`${label}: process did not spawn`);

  try {
    let pidState;
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/health`);
        if (response.ok) {
          pidState = JSON.parse(await readFile(pidFile, "utf8"));
          break;
        }
      } catch {
        // Wait for startup.
      }
      if (child.exitCode !== null) throw new Error(`${label}: exited with ${child.exitCode}`);
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
    }
    assert(pidState && pidState.port === port && pidState.cwd === root, `${label}: did not report its running server`);
    const serverPid = pidState.pid;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, holdMs));

    const physicalPeakMiB = physicalPeakMegabytes(serverPid);
    const record = {
      label,
      pid: serverPid,
      rssMiB: Number((rssKilobytes(serverPid) / 1024).toFixed(1)),
      ...(physicalPeakMiB === undefined ? {} : { physicalPeakMiB: Number(physicalPeakMiB.toFixed(1)) }),
    };
    console.log(JSON.stringify(record));
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      try { process.kill(-child.pid, "SIGTERM"); } catch { child.kill("SIGTERM"); }
      await new Promise((resolveExit) => child.once("exit", resolveExit));
    }
  }
}

try {
  const port = await freePort();
  await sample("tsx", join(root, "node_modules/.bin/tsx"), ["src/server/index.ts"], port);
  await sample("compiled-node", process.execPath, [join(root, "dist/server/server/index.js")], port);
  console.log(JSON.stringify({ node: process.version, executable: process.execPath, holdMs, openSessions: 0 }));
} finally {
  await rm(temp, { recursive: true, force: true });
}
