import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRestartService } from "./restart-service.js";
import { createPiChatServer } from "./server.js";

const host = "127.0.0.1";
const port = Number(process.env.PI_CHAT_PORT ?? 8788);
const cwd = resolve(process.env.PI_CHAT_CWD ?? process.cwd());

// `npm run dev` already reloads itself, and its watcher would start a second
// server the moment this one exits, so restarting is offered only without one.
const restart = process.env.PI_CHAT_DEV === "1" ? undefined : createRestartService({ shutdown: () => void shutdown() });
const server = createPiChatServer(undefined, resolve("dist/web"), undefined, restart);

server.httpServer.listen(port, host, () => {
  // Restarting from the browser replaces this process, so the pid the slash
  // commands stop has to be rewritten by whoever is actually listening.
  const pidFile = process.env.PI_CHAT_PID_FILE;
  if (pidFile) writeFileSync(pidFile, JSON.stringify({ pid: process.pid, port, cwd }));
  console.log(`Pi Chat server: http://${host}:${port}`);
  console.log(`Pi project: ${cwd}`);
});

let shuttingDown = false;
async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  await server.close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
