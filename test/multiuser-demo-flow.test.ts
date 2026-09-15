import type { AddressInfo } from "node:net";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import piChatMultiuserDemoExtension from "../examples/pi-chat-multiuser-demo-extension.js";
import { PROTOCOL_VERSION, serverMessageSchema, type ServerMessage } from "../src/shared/protocol.js";
import { getPiChatExtensionRegistry, resetPiChatExtensionRegistryForTests } from "../src/server/extension-registry.js";
import { FakeRuntimeAdapter } from "../src/server/runtime-adapter.js";
import { createPiChatServer, type PiChatServer } from "../src/server/server.js";

function receiveOfType(socket: WebSocket, type: ServerMessage["type"]): Promise<ServerMessage> {
  return new Promise((resolve) => {
    const onMessage = (data: Buffer) => {
      const parsed = serverMessageSchema.safeParse(JSON.parse(data.toString()));
      if (!parsed.success || parsed.data.type !== type) return;
      socket.off("message", onMessage);
      resolve(parsed.data);
    };
    socket.on("message", onMessage);
  });
}

async function connect(url: string): Promise<WebSocket> {
  const socket = new WebSocket(url);
  await new Promise<void>((resolve, reject) => {
    socket.once("open", () => resolve());
    socket.once("error", reject);
  });
  return socket;
}

/** The exact sequence a user performs: enable, invite, then grant write access. */
describe("multi-user demo end to end", () => {
  let server: PiChatServer | undefined;
  const sockets: WebSocket[] = [];

  afterEach(async () => {
    for (const socket of sockets) socket.close();
    sockets.length = 0;
    if (server) await server.close();
    resetPiChatExtensionRegistryForTests();
  });

  it("lets the owner enable the demo, keep a guest read-only, then grant write access", async () => {
    const extensions = getPiChatExtensionRegistry();
    piChatMultiuserDemoExtension({} as ExtensionAPI);
    server = createPiChatServer(new FakeRuntimeAdapter(), undefined, undefined, undefined, extensions);
    await new Promise<void>((resolve) => server!.httpServer.listen(0, "127.0.0.1", resolve));
    const port = (server.httpServer.address() as AddressInfo).port;

    const owner = await connect(`ws://127.0.0.1:${port}/ws`);
    sockets.push(owner);

    // 1. Owner turns the demo on from Settings.
    const enabled = receiveOfType(owner, "notification");
    owner.send(JSON.stringify({
      version: PROTOCOL_VERSION, sessionId: "fake-session",
      type: "runExtensionAction", actionId: "multiuser-demo.toggleEnabled",
    }));
    expect(await enabled).toMatchObject({ message: expect.stringContaining("enabled") });
    expect(extensions.connectionMode()).toBe("multi-connection");

    // 2. The guest opens the invite link and must not displace the owner.
    const ownerClosed = new Promise<number>((resolve) => owner.once("close", (code) => resolve(code)));
    const guest = await connect(`ws://127.0.0.1:${port}/ws?invite=demo`);
    sockets.push(guest);
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(owner.readyState).toBe(WebSocket.OPEN);
    void ownerClosed;

    // 3. A read-only guest is refused.
    const refused = receiveOfType(guest, "protocolError");
    guest.send(JSON.stringify({ version: PROTOCOL_VERSION, sessionId: "fake-session", type: "prompt", message: "Hi" }));
    expect(await refused).toMatchObject({ error: expect.stringContaining("read-only guest") });

    // 4. Owner grants guest write access. The owner's own control has to show
    //    what it did: a toast that scrolls away is not a state indicator.
    const granted = receiveOfType(owner, "notification");
    const ownerSnapshot = receiveOfType(owner, "snapshot");
    owner.send(JSON.stringify({
      version: PROTOCOL_VERSION, sessionId: "fake-session",
      type: "runExtensionAction", actionId: "multiuser-demo.toggleGuestWrite",
    }));
    expect(await granted).toMatchObject({ message: expect.stringContaining("send prompts") });
    const guestControl = ((await ownerSnapshot) as { extensions: { buttons: { id: string; label: string }[] } })
      .extensions.buttons.find((button) => button.id === "multiuser-demo.permission.header");
    expect(guestControl?.label).toBe("Block guest prompts");

    // 5. The same guest prompt now goes through.
    const answered = receiveOfType(guest, "messageFinal");
    guest.send(JSON.stringify({ version: PROTOCOL_VERSION, sessionId: "fake-session", type: "prompt", message: "Hi" }));
    expect(await answered).toMatchObject({ type: "messageFinal" });
  });
});
