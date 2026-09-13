import { resolve } from "node:path";
import { PiRuntimeAdapter } from "./pi-runtime-adapter.js";
import { createPiChatServer } from "./server.js";

const host = "127.0.0.1";
const port = Number(process.env.PI_CHAT_PORT ?? 8788);
const cwd = resolve(process.env.PI_CHAT_CWD ?? process.cwd());
const runtime = await PiRuntimeAdapter.create(cwd);
const server = createPiChatServer(runtime, resolve("dist/web"));

server.httpServer.listen(port, host, () => {
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
