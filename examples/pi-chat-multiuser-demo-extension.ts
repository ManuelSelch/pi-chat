import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getPiChatExtensionRegistry } from "../src/server/extension-registry.js";

/**
 * Minimal multi-user transport demo without invites.
 *
 * It opts Pi Chat into multi-connection mode so several browser tabs or laptops
 * can stay connected to the same local server. Prompts from one connection are
 * broadcast to every connected browser by Pi Chat core.
 */
export default function piChatMultiuserDemoExtension(_pi: ExtensionAPI): void {
  const chat = getPiChatExtensionRegistry();
  const connections = new Set<string>();

  chat.setConnectionMode("multi-connection");

  chat.registerButton({
    id: "multiuser-demo.status.header",
    slot: "session.header.right",
    label: "Users",
    actionId: "multiuser-demo.status",
  });

  chat.registerButton({
    id: "multiuser-demo.status.composer",
    slot: "composer.right",
    label: "Users",
    actionId: "multiuser-demo.status",
  });

  chat.registerAction({
    id: "multiuser-demo.status",
    title: "Show connected users",
    run: (ctx) => {
      const count = connections.size;
      ctx.notify(`Multi-user demo: ${count} connected browser${count === 1 ? "" : "s"}. Open another tab or laptop to watch the same session live.`);
    },
  });

  chat.on("connection.open", ({ connectionId }) => {
    connections.add(connectionId);
    console.log(`[pi-chat-multiuser-demo] connected ${connectionId}; total=${connections.size}`);
  });

  chat.on("connection.close", ({ connectionId }) => {
    connections.delete(connectionId);
    console.log(`[pi-chat-multiuser-demo] disconnected ${connectionId}; total=${connections.size}`);
  });

  chat.on("message.final", (event) => {
    console.log(`[pi-chat-multiuser-demo] broadcast finalized ${event.message.role} message ${event.message.id} in ${event.sessionId}`);
  });
}
