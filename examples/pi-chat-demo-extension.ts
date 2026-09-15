import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getPiChatExtensionRegistry } from "../src/server/extension-registry.js";

/**
 * Minimal Pi Chat modular-UI demo extension.
 *
 * Load this together with Pi Chat during local development, then open Pi Chat.
 * It proves three extension surfaces:
 * - slot UI: a Demo button in the composer and session header
 * - server action: clicking the button sends a browser notification
 * - lifecycle hook: finalized assistant messages are observed outside core
 */
export default function piChatDemoExtension(_pi: ExtensionAPI): void {
  const chat = getPiChatExtensionRegistry();

  chat.registerButton({
    id: "demo.composer.button",
    slot: "composer.right",
    label: "Demo",
    actionId: "demo.sayHello",
  });

  chat.registerButton({
    id: "demo.header.button",
    slot: "session.header.right",
    label: "Demo",
    actionId: "demo.sayHello",
  });

  chat.registerAction({
    id: "demo.sayHello",
    title: "Say hello",
    run: (ctx) => ctx.notify(`Demo action clicked in ${ctx.sessionId}`),
  });

  chat.on("message.final", (event) => {
    console.log(`[pi-chat-demo] finalized ${event.message.role} message ${event.message.id} in ${event.sessionId}`);
  });
}
