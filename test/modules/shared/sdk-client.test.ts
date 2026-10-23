import { once } from "node:events";
import type { AddressInfo } from "node:net";
import WebSocket from "ws";
import { expect, it, vi } from "vitest";
import { PiClient, createWebSocketTransport, type ConnectionPhase } from "@manuelselch/pi-sdk";
import { createPiServer } from "@manuelselch/pi-server";
import { FakeRuntimeAdapter } from "../../infra/fake-runtime-adapter.js";
function phase(client: PiClient, target: ConnectionPhase): Promise<void> {
  if (client.getState().connection.phase === target) return Promise.resolve();
  return new Promise((resolve, reject) => { const timer = setTimeout(() => { unsubscribe(); reject(new Error(`Did not reach ${target}`)); }, 3000);
    const unsubscribe = client.subscribe(state => { if (state.connection.phase !== target) return; clearTimeout(timer); unsubscribe(); resolve(); }); });
}
it("uses the public v2 SDK against the actual loopback host, with admission and streaming", async () => {
  const runtime = new FakeRuntimeAdapter(); const prompt = vi.spyOn(runtime, "prompt");
  const server = createPiServer({ runtime: runtime }); server.httpServer.listen(0, "127.0.0.1"); await once(server.httpServer, "listening");
  const client = new PiClient({ endpoint: `ws://127.0.0.1:${(server.httpServer.address() as AddressInfo).port}/ws`, transport: createWebSocketTransport(url => new WebSocket(url)) });
  try {
    const ready = phase(client, "ready"); client.start(); await ready; const id = client.getState().inventory[0]!.sessionId;
    expect(id).not.toBe("fake-session"); expect(client.getSession(id)?.sessionPath).toBe("fake-session.jsonl");
    const transcript = new Promise<void>(resolve => { const stop = client.onMessage(message => { if (message.type === "event" && message.event === "message.finalized") { stop(); resolve(); } }); });
    await expect(client.prompt(id, "hello")).resolves.toMatchObject({ state: "accepted" }); await transcript; expect(prompt).toHaveBeenCalledOnce();
    const superseded = phase(client, "superseded"); const next = new PiClient({ endpoint: `ws://127.0.0.1:${(server.httpServer.address() as AddressInfo).port}/ws`, transport: createWebSocketTransport(url => new WebSocket(url)) });
    try { const nextReady = phase(next, "ready"); next.start(); await nextReady; await superseded; expect(next.getState().inventory[0]!.sessionId).toBe(id); } finally { next.dispose(); }
  } finally { client.dispose(); await server.close(); }
});
