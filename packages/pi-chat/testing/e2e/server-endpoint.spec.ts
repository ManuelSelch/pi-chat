import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

let app: PiChatBrowserDriver;
test.beforeEach(async ({ page }) => { app = await PiChatBrowserDriver.start(page, { inboxEnabled: false }); });
test.afterEach(async () => { await app?.dispose(); });

test("saves the explicit endpoint, restores after reload, and resets to the page server", async () => {
  await app.settings.open();
  await app.settings.shouldUseDefaultEndpoint();
  await app.settings.editEndpoint("page");
  await app.settings.requestSaveEndpoint();
  await app.settings.cancelEndpointChange();
  await app.settings.shouldKeepUnsavedEndpoint();
  await app.settings.requestSaveEndpoint();
  await app.settings.confirmEndpointChange();
  await app.settings.open();
  await app.settings.shouldUseRememberedEndpoint();
  await app.settings.resetEndpoint();
  await app.settings.open();
  await app.settings.shouldUseDefaultEndpoint();
});

test("storage failure leaves the current connection and preference unchanged", async () => {
  await app.settings.open();
  await app.settings.denyEndpointStorage();
  await app.settings.editEndpoint("page");
  await app.settings.requestSaveEndpoint();
  await app.settings.confirmFailedEndpointSave();
});

test("a failed endpoint clears stale UI but leaves server runtimes alive and reset accessible", async () => {
  await app.tabs.create({ responses: [] });
  await app.chat.editDraft("Unsent text must not be replayed");
  await app.settings.open();
  await app.settings.editEndpoint("unreachable");
  await app.settings.requestSaveEndpoint();
  await app.settings.confirmEndpointChange();
  await app.settings.open();
  await app.settings.shouldShowEndpointFailure();
  await app.tabs.shouldHaveCount(0);
  await app.settings.resetEndpoint();
  await app.tabs.shouldHaveCount(1);
  await app.chat.shouldHaveDraft("");
  await app.chat.shouldNotShowMessage("Unsent text must not be replayed");
  await app.settings.open();
  await app.settings.shouldUseDefaultEndpoint();
});

test("another host remains rejected by the existing server origin policy and can be reset", async () => {
  await app.settings.open();
  await app.settings.editEndpoint("other-host");
  await app.settings.requestSaveEndpoint();
  await app.settings.confirmEndpointChange();
  await app.settings.open();
  await app.settings.shouldRejectOtherHost();
  await app.settings.resetEndpoint();
  await app.settings.open();
  await app.settings.shouldUseDefaultEndpoint();
});
