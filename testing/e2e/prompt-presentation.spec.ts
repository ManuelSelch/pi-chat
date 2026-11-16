import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";
import { PromptExtensionFixture } from "../infra/pi-chat/fixtures/prompt-extension-fixture.js";

for (const width of [1280, 390]) {
  test(`rich prompts preserve evidence while reading and switching tabs (${width}px)`, async ({ page }) => {
    const fixture = new PromptExtensionFixture();
    const app = await PiChatBrowserDriver.start(page, { inboxEnabled: false, extensions: [fixture.extension] });
    try {
      await app.browser.setViewport(width);
      const other = await app.tabs.create({ responses: [] });
      const learning = await app.tabs.create({ responses: [] });
      await app.chat.sendPrompt("/prompt-checks ");
      await app.prompts.shouldShowRichQuestion("Check 1");
      await app.prompts.choose("Check 1", "8");
      await app.prompts.minimize("Check 1");
      fixture.shouldHaveAnswers([]);
      await app.prompts.shouldFitViewport();
      await app.tabs.switchTo(other);
      await app.tabs.switchTo(learning);
      await app.prompts.reopen("Check 1");
      await app.prompts.shouldHaveChoice("Check 1", "8");
      await app.prompts.continue("Check 1");
      await app.prompts.explain("Reasoning 1", "Two multiplied three times.\nπ");
      await app.prompts.minimize("Reasoning 1");
      await app.prompts.reopen("Reasoning 1");
      await app.prompts.shouldHaveReasoning("Reasoning 1", "Two multiplied three times.\nπ");
      await app.prompts.submitReasoning("Reasoning 1");
      await app.prompts.shouldShowRichQuestion("Check 2");
      await app.prompts.minimize("Check 2");
      await app.prompts.readFeedback(1);
      fixture.shouldHaveAnswers([{ selected: "8", reasoning: "Two multiplied three times.\nπ" }]);
      await app.prompts.reopen("Check 2");
      await app.prompts.choose("Check 2", "I don't know");
      await app.prompts.continue("Check 2");
      await app.prompts.explain("Reasoning 2", "");
      await app.prompts.submitReasoning("Reasoning 2");
      await app.waitUntilReady();
      fixture.shouldHaveAnswers([{ selected: "8", reasoning: "Two multiplied three times.\nπ" }, { selected: "I don't know", reasoning: "" }]);
      await app.chat.sendPrompt("/prompt-literal ");
      await app.prompts.shouldShowLiteralMenu();
    } finally { await app.dispose(); }
  });
}


test("explicit Stop releases a minimized native prompt without submitting evidence", async ({ page }) => {
  const fixture = new PromptExtensionFixture();
  const app = await PiChatBrowserDriver.start(page, { inboxEnabled: false, extensions: [fixture.extension] });
  try {
    await app.tabs.create({ responses: [] });
    await app.chat.sendPrompt("/prompt-checks ");
    await app.prompts.shouldShowRichQuestion("Check 1");
    await app.prompts.minimize("Check 1");
    await app.prompts.stop();
    await app.waitUntilReady();
    fixture.shouldHaveAnswers([]);
  } finally { await app.dispose(); }
});
