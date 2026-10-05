import { resolve } from "node:path";
import { AddressInfo } from "node:net";
import type { Page } from "@playwright/test";
import { createPiChatServer, type PiChatServer } from "../../../src/server/bootstrap/server.js";
import { TestWorld } from "../pi-chat/test-world.js";
import { PiChatBrowserDriver } from "./pi-chat-browser-driver.js";

export interface PiChatE2EFixture {
  driver: PiChatBrowserDriver;
}

export async function startPiChatE2E(page: Page): Promise<PiChatE2EFixture> {
  const world = new TestWorld();
  const initial = await world.create([
    { prompt: "Hello", reply: "Hello from the visible Pi Chat app." },
  ]);
  const server = createPiChatServer(initial, resolve("dist/web"), world.factory);

  try {
    await new Promise<void>((resolveListen, reject) => {
      server.httpServer.once("error", reject);
      server.httpServer.listen(0, "127.0.0.1", () => {
        server.httpServer.off("error", reject);
        resolveListen();
      });
    });

    const port = (server.httpServer.address() as AddressInfo).port;
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
    const driver = new PiChatBrowserDriver(page, async () => {
      await server.close();
      await world.dispose();
    });
    await driver.WaitUntilReady();
    return { driver };
  } catch (error) {
    await server.close().catch(() => undefined);
    await world.dispose().catch(() => undefined);
    throw error;
  }
}

export async function stopPiChatE2E(fixture: PiChatE2EFixture): Promise<void> {
  await fixture.driver.dispose();
}
