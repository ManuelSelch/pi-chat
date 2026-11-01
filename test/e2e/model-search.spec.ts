import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

let app: PiChatBrowserDriver;
test.beforeEach(async ({ page }) => { app = await PiChatBrowserDriver.start(page, { inboxEnabled: false }); });
test.afterEach(async () => { await app.dispose(); });

test("searches the existing /model popup and toggles scope with Tab without editing the shortlist", async () => {
  await app.Tabs.Create({ modelPicker: true, responses: [] });
  await app.Chat.SendPrompt("/model ");
  await app.Prompts.ShouldHaveModelScope("Scoped");
  await app.Prompts.ShouldOfferModels(["scope-test-alpha"]);
  await app.Prompts.FilterModels("scope-test-beta");
  await app.Prompts.ShouldOfferModels([]);

  await app.Prompts.ToggleModelScope();
  await app.Prompts.ShouldHaveModelScope("All models", "scope-test-beta");
  await app.Prompts.ShouldOfferModels(["scope-test-beta"]);
  await app.Prompts.ToggleModelScope();
  await app.Prompts.ShouldHaveModelScope("Scoped", "scope-test-beta");
  await app.Prompts.ShouldOfferModels([]);
  await app.Prompts.ToggleModelScope();
  await app.Prompts.ChooseFilteredModel();
  await app.Prompts.ShouldUseModel("scope-test-beta");

  await app.Chat.SendPrompt("/model ");
  await app.Prompts.ShouldHaveModelScope("Scoped");
  await app.Prompts.ShouldOfferModels(["scope-test-alpha"]);
  await app.Prompts.CancelModels();
  await app.Prompts.ShouldUseModel("scope-test-beta");
});
