import { afterEach, expect, it } from "vitest";
import { createPiChatServer, type PiChatServer } from "../../../src/server/bootstrap/server.js";
import { BrowserClient } from "../../infra/pi-chat/browser-client.js";

let server: PiChatServer | undefined;
let client: BrowserClient | undefined;
afterEach(async () => {
  try { await client?.close(); }
  finally { await server?.close(); client = undefined; server = undefined; }
});

async function connect() {
  const unsupported = async (): Promise<never> => { throw new Error("Not supported in the client test"); };
  server = createPiChatServer(undefined, undefined, {
    continueProject: unsupported, openSession: unsupported, newSession: unsupported,
  });
  await new Promise<void>(resolve => server!.httpServer.listen(0, "127.0.0.1", resolve));
  client = new BrowserClient(server, 1000);
  await client.wait("Client.Connect", "initial tab list", () => client!.appState.tabsKnown);
  return client;
}

it("bounds event waits and includes the operation, predicate, and browser state", async () => {
  const browser = await connect();
  await expect(browser.wait("Chat.WaitUntilIdle", "an intentionally missing event", () => false)).rejects.toThrow(
    /Chat.WaitUntilIdle: timed out waiting for an intentionally missing event.*activeSessionId.*recentMessages/,
  );
});

it("observes a fresh server rejection for an unknown conversation", async () => {
  const browser = await connect();
  const after = browser.mark();
  await expect(browser.sdk.prompt("missing", "Hello")).rejects.toMatchObject({ code: "sessionNotFound", outcome: "rejected" });
  await browser.waitForMessage("Chat.SendPrompt", "session rejection", after, m =>
    m.type === "response" && !m.ok && m.error.code === "sessionNotFound");
});

it("rejects outstanding waits when disposed", async () => {
  const browser = await connect();
  const result = expect(browser.wait("Chat.WaitUntilIdle", "idle", () => false)).rejects.toThrow(/Client disposed/);
  await browser.close();
  await result;
});
