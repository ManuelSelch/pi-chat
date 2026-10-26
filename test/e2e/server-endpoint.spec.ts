import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

let app: PiChatBrowserDriver;
test.beforeEach(async ({ page }) => { app = await PiChatBrowserDriver.start(page); });
test.afterEach(async () => { await app?.dispose(); });

test("saves the explicit endpoint, restores after reload, and resets to the page server", async () => {
  await app.Settings.Open();
  await app.Settings.shouldUseDefaultEndpoint();
  await app.Settings.editEndpoint("page");
  await app.Settings.requestSaveEndpoint();
  await app.Settings.cancelEndpointChange();
  await app.Settings.shouldKeepUnsavedEndpoint();
  await app.Settings.requestSaveEndpoint();
  await app.Settings.confirmEndpointChange();
  await app.Settings.Open();
  await app.Settings.shouldUseRememberedEndpoint();
  await app.Settings.resetEndpoint();
  await app.Settings.Open();
  await app.Settings.shouldUseDefaultEndpoint();
});

test("storage failure leaves the current connection and preference unchanged", async () => {
  await app.Settings.Open();
  await app.Settings.denyEndpointStorage();
  await app.Settings.editEndpoint("page");
  await app.Settings.requestSaveEndpoint();
  await app.Settings.confirmFailedEndpointSave();
});

test("a failed endpoint clears stale UI but leaves server runtimes alive and reset accessible", async () => {
  await app.Tabs.Create({ responses: [] });
  await app.Chat.editDraft("Unsent text must not be replayed");
  await app.Settings.Open();
  await app.Settings.editEndpoint("unreachable");
  await app.Settings.requestSaveEndpoint();
  await app.Settings.confirmEndpointChange();
  await app.Settings.Open();
  await app.Settings.shouldShowEndpointFailure();
  await app.Tabs.ShouldHaveCount(0);
  await app.Settings.resetEndpoint();
  await app.Tabs.ShouldHaveCount(1);
  await app.Chat.shouldHaveDraft("");
  await app.Chat.ShouldNotShowMessage("Unsent text must not be replayed");
  await app.Settings.Open();
  await app.Settings.shouldUseDefaultEndpoint();
});

test("another host remains rejected by the existing server origin policy and can be reset", async () => {
  await app.Settings.Open();
  await app.Settings.editEndpoint("other-host");
  await app.Settings.requestSaveEndpoint();
  await app.Settings.confirmEndpointChange();
  await app.Settings.Open();
  await app.Settings.shouldRejectOtherHost();
  await app.Settings.resetEndpoint();
  await app.Settings.Open();
  await app.Settings.shouldUseDefaultEndpoint();
});
