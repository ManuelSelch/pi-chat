import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { createRestartService } from "./bootstrap/restart-service.js";
import { createPiChatServer } from "./bootstrap/server.js";
import { createFileLogger } from "./logging/file-logger.js";

const host = "127.0.0.1";
const port = Number(process.env.PI_CHAT_PORT ?? 8788);
const cwd = resolve(process.env.PI_CHAT_CWD ?? process.cwd());

// `npm run dev` already reloads itself, and its watcher would start a second
// server the moment this one exits, so restarting is offered only without one.
const isDevelopment = process.env.PI_CHAT_DEV === "1";
const logger = createFileLogger();
const restart = isDevelopment ? undefined : createRestartService({ shutdown: () => void shutdown() });
const server = createPiChatServer(undefined, isDevelopment ? undefined : resolve("dist/web"), undefined, restart, undefined, undefined, logger);

server.httpServer.listen(port, host, () => {
  // Restarting from the browser replaces this process, so the pid the slash
  // commands stop has to be rewritten by whoever is actually listening.
  const pidFile = process.env.PI_CHAT_PID_FILE;
  if (pidFile) writeFileSync(pidFile, JSON.stringify({ pid: process.pid, port, cwd }));
  console.log(`Pi Chat server: http://${host}:${port}`);
  console.log(`Pi project: ${cwd}`);
  console.log(`Pi Chat log: ${resolve(process.env.PI_CHAT_LOG_DIR ?? `${homedir()}/.pi/agent/logs`, "pi-chat.log")}`);
  logger.info("server.started", { host, port, projectDirectory: cwd });
});

let shuttingDown = false;
async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  await server.close();
  await logger.close();
  process.exit(0);
}

server.httpServer.on("error", (error) => logger.error("server.error", { message: error.message }));
process.on("uncaughtException", (error) => {
  logger.error("process.uncaught_exception", { message: error.message, stack: error.stack?.slice(0, 2048) });
  console.error(error);
});
process.on("unhandledRejection", (reason) => {
  logger.error("process.unhandled_rejection", { message: reason instanceof Error ? reason.message : String(reason).slice(0, 512) });
});

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
