import WebSocket from "ws";
import { serverMessageSchema } from "../src/shared/protocol.js";

/**
 * Mirrors the browser hook's retry loop against the running dev server, to prove
 * a cold start recovers after the initial ECONNREFUSED through the Vite proxy.
 */
const url = process.argv[2] ?? "ws://127.0.0.1:5173/ws";
const deadline = Date.now() + 60_000;
let attempt = 0;
let retryMs = 250;

function attemptOnce(): Promise<string> {
  attempt += 1;
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.once("message", (data) => {
      const event = serverMessageSchema.parse(JSON.parse(data.toString()));
      socket.close();
      resolve(event.type === "snapshot" ? `snapshot for ${event.projectPath}` : event.type);
    });
    socket.once("error", (error) => reject(error));
  });
}

while (Date.now() < deadline) {
  try {
    const result = await attemptOnce();
    console.log(`connected on attempt ${attempt}: ${result}`);
    process.exit(0);
  } catch (error) {
    console.log(`attempt ${attempt} failed: ${(error as Error).message}; retrying in ${retryMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, retryMs));
    retryMs = Math.min(retryMs * 2, 5_000);
  }
}

console.error("never connected");
process.exit(1);
