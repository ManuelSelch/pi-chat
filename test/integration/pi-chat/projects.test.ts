import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PiChatDriver } from "../../support/pi-chat/pi-chat-driver.js";

const apps: PiChatDriver[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map(app => app.dispose()));
});

describe("Pi Chat project workflows", () => {
  it("browses the isolated server folder", async () => {
    const app = await PiChatDriver.start({ startAtHome: true });
    apps.push(app);

    const listing = await app.Projects.Browse();

    expect(listing.path).toMatch(/pi-chat-driver-/);
    expect(listing.entries).toEqual([]);
    app.Projects.ShouldRemainAtHome();
  });

  it("opens a valid folder from home through the Projects driver", async () => {
    const app = await PiChatDriver.start({ startAtHome: true });
    apps.push(app);

    await app.Projects.Open();

    app.Projects.ShouldBeOpen();
    app.Tabs.ShouldHaveCount(1);
    app.Browser.ShouldBeUsable();
  });

  it("reports an invalid folder without leaving home", async () => {
    const app = await PiChatDriver.start({ startAtHome: true });
    apps.push(app);

    await expect(app.Projects.Browse("/definitely/missing/pi-chat-project")).rejects.toThrow(/not found|no such file/i);
    await expect(app.Projects.Open("/definitely/missing/pi-chat-project")).rejects.toThrow(/not found|no such file/i);
    app.Projects.ShouldRemainAtHome();
  });

  it("does not change the active project when a second folder cannot be opened", async () => {
    const app = await PiChatDriver.start();
    apps.push(app);
    await expect(app.Projects.Open("/definitely/missing/pi-chat-project")).rejects.toThrow();

    app.Projects.ShouldBeOpen();
    app.Tabs.ShouldHaveCount(1);
  });
});

