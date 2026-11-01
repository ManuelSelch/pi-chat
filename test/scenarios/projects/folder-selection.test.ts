import { afterEach, describe, expect, it } from "vitest";
import { PiChatDriver } from "../../infra/pi-chat/pi-chat-driver.js";

const apps: PiChatDriver[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map(app => app.dispose()));
});

describe("Pi Chat project workflows", () => {
  it("browses the isolated server folder", async () => {
    const app = await PiChatDriver.start({ startAtHome: true });
    apps.push(app);

    const listing = await app.projects.browse();

    expect(listing.path).toMatch(/pi-chat-driver-/);
    expect(listing.entries).toEqual([]);
    app.projects.shouldRemainAtHome();
  });

  it("opens a valid folder from home through the Projects driver", async () => {
    const app = await PiChatDriver.start({ startAtHome: true });
    apps.push(app);

    await app.projects.open();

    app.projects.shouldBeOpen();
    app.tabs.shouldHaveCount(1);
    app.browser.shouldBeUsable();
  });

  it("reports an invalid folder without leaving home", async () => {
    const app = await PiChatDriver.start({ startAtHome: true });
    apps.push(app);

    await expect(
      app.projects.browse("/definitely/missing/pi-chat-project"),
    ).rejects.toThrow(/not found|no such file/i);

    await expect(
      app.projects.open("/definitely/missing/pi-chat-project"),
    ).rejects.toThrow(/not found|no such file/i);

    app.projects.shouldRemainAtHome();
  });

  it("does not change the active project when a second folder cannot be opened", async () => {
    const app = await PiChatDriver.start();
    apps.push(app);

    await expect(
      app.projects.open("/definitely/missing/pi-chat-project"),
    ).rejects.toThrow();

    app.projects.shouldBeOpen();
    app.tabs.shouldHaveCount(1);
  });
});
