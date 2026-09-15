import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getPiChatExtensionRegistry } from "../src/server/extension-registry.js";

/**
 * Minimal multi-user demo without invite tokens.
 *
 * Pi Chat is switched into multi-connection mode, so several browsers can watch
 * and drive the same session. A browser that arrives with `?invite=...` is a
 * guest; everyone else is an owner.
 *
 * Guests are read-only by default: that is the safe default for a link someone
 * else opened. The owner can hand over write access at runtime, and revoking it
 * again takes effect on the guest's next attempt.
 */
type Role = "owner" | "guest";

interface Participant {
  role: Role;
  label: string;
  invite?: string;
}

export default function piChatMultiuserDemoExtension(_pi: ExtensionAPI): void {
  const chat = getPiChatExtensionRegistry();
  const participants = new Map<string, Participant>();
  let guestsMayWrite = false;

  chat.setConnectionMode("multi-connection");

  const roleOf = (connectionId?: string): Role => participants.get(connectionId ?? "")?.role ?? "owner";
  const guestCount = (): number => [...participants.values()].filter((item) => item.role === "guest").length;

  function publishState(): void {
    chat.setExtensionState("multiuser-demo", ({ connectionId }) => ({
      role: roleOf(connectionId),
      guestsMayWrite,
      connectionCount: participants.size,
      participants: [...participants.entries()].map(([id, participant]) => ({ id, ...participant })),
    }));
  }

  publishState();

  // Each browser is told about its own role, not about everyone's, so the badge
  // has to be resolved per connection rather than registered once.
  chat.registerBadge(({ connectionId }) => {
    if (roleOf(connectionId) === "owner") return { id: "multiuser-demo.role", slot: "session.status", label: "Owner", tone: "green" };
    return {
      id: "multiuser-demo.role",
      slot: "session.status",
      label: guestsMayWrite ? "Guest" : "Guest (read-only)",
      tone: guestsMayWrite ? "yellow" : "red",
    };
  });

  chat.registerButton({
    id: "multiuser-demo.status.header",
    slot: "session.header.right",
    label: "Users",
    actionId: "multiuser-demo.status",
  });

  chat.registerButton({
    id: "multiuser-demo.permission.header",
    slot: "session.header.right",
    label: "Guest access",
    actionId: "multiuser-demo.toggleGuestWrite",
  });

  chat.registerAction({
    id: "multiuser-demo.status",
    title: "Show connected users",
    run: (ctx) => {
      const listed = [...participants.values()].map((item) => `${item.label} (${item.role})`).join(", ") || "none";
      ctx.notify(
        `Multi-user demo: ${participants.size} connected, ${guestCount()} guest(s). ` +
          `Guests may ${guestsMayWrite ? "send prompts" : "only watch"}. Participants: ${listed}.`,
      );
    },
  });

  chat.registerAction({
    id: "multiuser-demo.toggleGuestWrite",
    title: "Allow or block guest prompts",
    run: (ctx) => {
      // Only the owner may change the policy, otherwise a guest could simply
      // grant itself write access with the same button.
      if (roleOf(ctx.connectionId) !== "owner") throw new Error("Only the owner can change guest access.");
      guestsMayWrite = !guestsMayWrite;
      publishState();
      ctx.notify(`Guests may now ${guestsMayWrite ? "send prompts" : "only watch"}.`);
    },
  });

  chat.use("connection.authorize", ({ connectionId, request }) => {
    const invite = request?.query.invite;
    participants.set(connectionId, {
      role: invite ? "guest" : "owner",
      label: invite ? `Guest ${guestCount() + 1}` : `Owner ${participants.size - guestCount() + 1}`,
      ...(invite ? { invite } : {}),
    });
    publishState();
  });

  chat.use("prompt.authorize", ({ connectionId }) => {
    if (roleOf(connectionId) === "owner" || guestsMayWrite) return { allow: true };
    return { allow: false, reason: "This browser joined as a read-only guest. Ask the owner to allow guest prompts." };
  });

  chat.use("abort.authorize", ({ connectionId }) => {
    if (roleOf(connectionId) === "owner" || guestsMayWrite) return { allow: true };
    return { allow: false, reason: "Read-only guests cannot stop a run." };
  });

  chat.use("action.authorize", ({ connectionId, actionId }) => {
    if (roleOf(connectionId) === "owner") return { allow: true };
    // Reading the participant list is harmless; everything else changes state
    // the guest does not own, including the app-level restart.
    if (actionId === "multiuser-demo.status") return { allow: true };
    return { allow: false, reason: "Read-only guests cannot change this session." };
  });

  chat.on("connection.close", ({ connectionId }) => {
    participants.delete(connectionId);
    publishState();
  });
}
