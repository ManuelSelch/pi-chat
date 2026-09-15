import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getPiChatExtensionRegistry } from "../src/server/extension-registry.js";

/**
 * Minimal multi-user demo without invite tokens.
 *
 * The demo is off by default: loading the extension must not silently open a
 * single-user session to every browser that can reach the port. Settings has a
 * button that switches it on, and until then Pi Chat behaves exactly as if the
 * extension were not loaded.
 *
 * Once enabled, Pi Chat is in multi-connection mode, so several browsers can
 * watch and drive the same session. A browser that arrives with `?invite=...`
 * is a guest; everyone else is an owner.
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
  let enabled = false;
  let guestsMayWrite = false;

  // While disabled every browser is an owner, so nothing is restricted and the
  // enable button below stays usable.
  const roleOf = (connectionId?: string): Role => (enabled ? participants.get(connectionId ?? "")?.role ?? "owner" : "owner");
  const guestCount = (): number => [...participants.values()].filter((item) => item.role === "guest").length;

  function publishState(): void {
    chat.setExtensionState("multiuser-demo", ({ connectionId }) => ({
      enabled,
      role: roleOf(connectionId),
      guestsMayWrite,
      connectionCount: participants.size,
      participants: [...participants.entries()].map(([id, participant]) => ({ id, ...participant })),
    }));
  }

  /**
   * Buttons are a flat registry keyed by id, so re-registering the same ids is
   * how the visible controls follow the on/off state.
   */
  function publishButtons(): void {
    chat.registerButton({
      id: "multiuser-demo.enable.settings",
      slot: "settings.section",
      label: enabled ? "Disable multi-user demo" : "Enable multi-user demo",
      actionId: "multiuser-demo.toggleEnabled",
    });
    if (!enabled) {
      chat.unregisterButton("multiuser-demo.status.header");
      chat.unregisterButton("multiuser-demo.permission.header");
      return;
    }
    chat.registerButton({
      id: "multiuser-demo.status.header",
      slot: "session.header.right",
      label: "Users",
      actionId: "multiuser-demo.status",
    });
    // Named after what pressing it does, like the enable button above. A fixed
    // "Guest access" label left the owner with nothing but a toast to tell the
    // two states apart, so the toggle looked like it had done nothing.
    chat.registerButton({
      id: "multiuser-demo.permission.header",
      slot: "session.header.right",
      label: guestsMayWrite ? "Block guest prompts" : "Allow guest prompts",
      actionId: "multiuser-demo.toggleGuestWrite",
    });
  }

  publishState();
  publishButtons();

  // Each browser is told about its own role, not about everyone's, so the badge
  // has to be resolved per connection rather than registered once.
  chat.registerBadge(({ connectionId }) => {
    if (!enabled) return undefined;
    if (roleOf(connectionId) === "owner") return { id: "multiuser-demo.role", slot: "session.status", label: "Owner", tone: "green" };
    return {
      id: "multiuser-demo.role",
      slot: "session.status",
      label: guestsMayWrite ? "Guest" : "Guest (read-only)",
      tone: guestsMayWrite ? "yellow" : "red",
    };
  });

  chat.registerAction({
    id: "multiuser-demo.toggleEnabled",
    title: "Enable or disable the multi-user demo",
    run: (ctx) => {
      if (roleOf(ctx.connectionId) !== "owner") throw new Error("Only the owner can turn the multi-user demo off.");
      enabled = !enabled;
      if (enabled) {
        chat.setConnectionMode("multi-connection");
        // Connections that were already open predate the demo, so they are owners.
        for (const [id, participant] of participants) participants.set(id, { ...participant, role: "owner" });
      } else {
        // Back to a single controller, and guest write access does not survive
        // a round trip through the off state.
        chat.setConnectionMode("single-controller");
        guestsMayWrite = false;
      }
      publishButtons();
      publishState();
      ctx.notify(enabled ? "Multi-user demo enabled: other browsers can join this session." : "Multi-user demo disabled.");
    },
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
      publishButtons();
      publishState();
      ctx.notify(`Guests may now ${guestsMayWrite ? "send prompts" : "only watch"}.`);
    },
  });

  chat.use("connection.authorize", ({ connectionId, request }) => {
    const invite = enabled ? request?.query.invite : undefined;
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
