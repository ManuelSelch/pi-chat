import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const host = "127.0.0.1";
const root = process.cwd();
const temp = await mkdtemp(join(tmpdir(), "pi-chat-production-smoke-"));
const projectCwd = join(temp, "project");
const pidFile = join(temp, "server.pid");
const logDirectory = join(temp, "logs");
let child;

async function freePort() {
  const server = createServer();
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, host, resolveListen);
  });
  const address = server.address();
  assert(address && typeof address !== "string");
  await new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
  return address.port;
}

async function waitForHealth(port, deadline) {
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://${host}:${port}/health`);
      if (response.ok) return response;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error("Compiled production server did not become healthy within 15 seconds.");
}

async function waitForExit(process, timeoutMs) {
  if (process.exitCode !== null || process.signalCode !== null) return;
  await new Promise((resolveExit, reject) => {
    const timer = setTimeout(() => reject(new Error("Server did not stop after SIGTERM.")), timeoutMs);
    process.once("exit", (...args) => {
      clearTimeout(timer);
      resolveExit(args);
    });
  });
}

try {
  const port = await freePort();
  child = spawn(process.execPath, [join(root, "dist/server/server/index.js")], {
    cwd: root,
    env: {
      ...process.env,
      PI_CHAT_PORT: String(port),
      PI_CHAT_CWD: projectCwd,
      PI_CHAT_PID_FILE: pidFile,
      PI_CHAT_LOG_DIR: logDirectory,
    },
    stdio: "ignore",
  });
  if (!child.pid) throw new Error("Could not spawn the compiled production server.");
  const childError = new Promise((_, reject) => child.once("error", reject));
  const health = await Promise.race([waitForHealth(port, Date.now() + 15_000), childError]);
  assert.deepEqual(await health.json(), { ok: true });

  const page = await fetch(`http://${host}:${port}/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<div id="root"><\/div>/);

  const pidState = JSON.parse(await readFile(pidFile, "utf8"));
  assert.deepEqual(pidState, { pid: child.pid, port, cwd: projectCwd });

  child.kill("SIGTERM");
  await waitForExit(child, 5_000);
  assert.equal(child.exitCode, 0);
  const log = (await readFile(join(logDirectory, "pi-chat.log"), "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert(log.some((record) => record.event === "server.started" && record.fields.projectDirectory === projectCwd));

  console.log(`Production server smoke passed (pid ${child.pid}, port ${port}, health/UI/PID/log/shutdown verified).`);
} finally {
  if (child && child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    await waitForExit(child, 5_000).catch(() => child.kill("SIGKILL"));
  }
  await rm(temp, { recursive: true, force: true });
}
