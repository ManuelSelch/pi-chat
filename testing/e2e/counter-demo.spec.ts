import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

for (const inboxEnabled of [true, false]) {
  test.describe(`counter demo (sidebar=${inboxEnabled})`, () => {
    let app: PiChatBrowserDriver;
    test.beforeEach(async ({ page }) => {
      app = await PiChatBrowserDriver.start(page, { inboxEnabled });
    });
    test.afterEach(async () => { await app.dispose(); });

    test("reads and increments on the existing connection without creating a session", async () => {
      await app.counter.open();
      await app.counter.shouldHaveCount(0);

      await app.counter.increment();

      await app.counter.shouldHaveCount(1);
      await app.counter.read();
      await app.counter.shouldHaveCount(1);
      await app.counter.close();
      await app.counter.open();
      await app.counter.shouldHaveCount(1);
      await app.counter.shouldUseOneConnectionWithoutSessions();

      await app.inbox.reload(inboxEnabled);
      await app.counter.open();

      await app.counter.shouldHaveCount(1);
    });

    test("keeps the server counter when switching from Home to a session", async () => {
      await app.counter.open();
      await app.counter.shouldHaveCount(0);
      await app.counter.increment();
      await app.counter.shouldHaveCount(1);
      await app.counter.close();

      if (inboxEnabled) await app.inbox.create({ responses: [] });
      else await app.tabs.create({ responses: [] });
      await app.counter.open();

      await app.counter.shouldHaveCount(1);
    });

    test("fits a narrow viewport without changing the counter", async () => {
      await app.browser.setViewport(390);
      if (inboxEnabled) await app.inbox.close();
      await app.counter.open();

      await app.counter.shouldHaveCount(0);
      await app.counter.shouldFitViewport();
      await app.counter.increment();
      await app.counter.shouldHaveCount(1);
    });
  });
}

test.describe("counter on a server without the demo plugin", () => {
  let app: PiChatBrowserDriver;
  test.beforeEach(async ({ page }) => {
    app = await PiChatBrowserDriver.start(page, { counterDemo: false });
  });
  test.afterEach(async () => { await app.dispose(); });

  test("shows unavailable instead of inventing local state", async () => {
    await app.counter.open();

    await app.counter.shouldBeUnavailable();
  });
});
