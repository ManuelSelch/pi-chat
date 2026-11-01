import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

let app: PiChatBrowserDriver;
test.beforeEach(async ({ page }) => { app = await PiChatBrowserDriver.start(page, { inboxEnabled: false }); });
test.afterEach(async () => { await app.dispose(); });

test("searches the existing /model popup and toggles scope with Tab without editing the shortlist", async () => {
  await app.tabs.create({ modelPicker: true, responses: [] });
  await app.chat.sendPrompt("/model ");
  await app.prompts.shouldHaveModelScope("Scoped");
  await app.prompts.shouldOfferModels(["scope-test-alpha"]);
  await app.prompts.filterModels("scope-test-beta");
  await app.prompts.shouldOfferModels([]);

  await app.prompts.toggleModelScope();
  await app.prompts.shouldHaveModelScope("All models", "scope-test-beta");
  await app.prompts.shouldOfferModels(["scope-test-beta"]);
  await app.prompts.toggleModelScope();
  await app.prompts.shouldHaveModelScope("Scoped", "scope-test-beta");
  await app.prompts.shouldOfferModels([]);
  await app.prompts.toggleModelScope();
  await app.prompts.chooseFilteredModel();
  await app.prompts.shouldUseModel("scope-test-beta");

  await app.chat.sendPrompt("/model ");
  await app.prompts.shouldHaveModelScope("Scoped");
  await app.prompts.shouldOfferModels(["scope-test-alpha"]);
  await app.prompts.cancelModels();
  await app.prompts.shouldUseModel("scope-test-beta");
});
