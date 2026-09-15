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
  const connections = new Map<string, { role: "owner" | "guest"; label: string; invite?: string }>();

  function publishState(): void {
    chat.setExtensionState("multiuser-demo", {
      connectionCount: connections.size,
      participants: [...connections.entries()].map(([id, info]) => ({ id, ...info })),
    });
  }

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
      const participants = [...connections.values()].map((item) => `${item.label} (${item.role})`).join(", ") || "none";
      ctx.notify(`Multi-user demo: ${count} connected browser${count === 1 ? "" : "s"}. Participants: ${participants}. Try /?invite=demo on another browser to mark it as a guest.`);
    },
  });

  chat.use("connection.authorize", ({ connectionId, request }) => {
    const invite = request?.query.invite;
    connections.set(connectionId, {
      role: invite ? "guest" : "owner",
      label: invite ? `Guest ${connections.size + 1}` : `Owner ${connections.size + 1}`,
      ...(invite ? { invite } : {}),
    });
    publishState();
  });

  chat.on("connection.open", ({ connectionId }) => {
    console.log(`[pi-chat-multiuser-demo] connected ${connectionId}; total=${connections.size}`);
  });

  chat.on("connection.close", ({ connectionId }) => {
    connections.delete(connectionId);
    publishState();
    console.log(`[pi-chat-multiuser-demo] disconnected ${connectionId}; total=${connections.size}`);
  });

  chat.on("message.final", (event) => {
    console.log(`[pi-chat-multiuser-demo] broadcast finalized ${event.message.role} message ${event.message.id} in ${event.sessionId}`);
  });
}
