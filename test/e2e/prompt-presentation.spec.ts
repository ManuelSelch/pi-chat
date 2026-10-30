import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";
import { PromptExtensionFixture } from "../infra/pi-chat/fixtures/prompt-extension-fixture.js";

for (const width of [1280, 390]) {
  test(`rich prompts preserve evidence while reading and switching tabs (${width}px)`, async ({ page }) => {
    const fixture = new PromptExtensionFixture();
    const app = await PiChatBrowserDriver.start(page, { inboxEnabled: false, extensions: [fixture.extension] });
    try {
      await app.Browser.SetViewport(width);
      const other = await app.Tabs.Create({ responses: [] });
      const learning = await app.Tabs.Create({ responses: [] });
      await app.Chat.SendPrompt("/prompt-checks ");
      await app.Prompts.ShouldShowRichQuestion("Check 1");
      await app.Prompts.Choose("Check 1", "8");
      await app.Prompts.Minimize("Check 1");
      fixture.ShouldHaveAnswers([]);
      await app.Prompts.ShouldFitViewport();
      await app.Tabs.SwitchTo(other);
      await app.Tabs.SwitchTo(learning);
      await app.Prompts.Reopen("Check 1");
      await app.Prompts.ShouldHaveChoice("Check 1", "8");
      await app.Prompts.Continue("Check 1");
      await app.Prompts.Explain("Reasoning 1", "Two multiplied three times.\nπ");
      await app.Prompts.Minimize("Reasoning 1");
      await app.Prompts.Reopen("Reasoning 1");
      await app.Prompts.ShouldHaveReasoning("Reasoning 1", "Two multiplied three times.\nπ");
      await app.Prompts.SubmitReasoning("Reasoning 1");
      await app.Prompts.ShouldShowRichQuestion("Check 2");
      await app.Prompts.Minimize("Check 2");
      await app.Prompts.ReadFeedback(1);
      fixture.ShouldHaveAnswers([{ selected: "8", reasoning: "Two multiplied three times.\nπ" }]);
      await app.Prompts.Reopen("Check 2");
      await app.Prompts.Choose("Check 2", "I don't know");
      await app.Prompts.Continue("Check 2");
      await app.Prompts.Explain("Reasoning 2", "");
      await app.Prompts.SubmitReasoning("Reasoning 2");
      await app.WaitUntilReady();
      fixture.ShouldHaveAnswers([{ selected: "8", reasoning: "Two multiplied three times.\nπ" }, { selected: "I don't know", reasoning: "" }]);
      await app.Chat.SendPrompt("/prompt-literal ");
      await app.Prompts.ShouldShowLiteralMenu();
    } finally { await app.dispose(); }
  });
}


test("explicit Stop releases a minimized native prompt without submitting evidence", async ({ page }) => {
  const fixture = new PromptExtensionFixture();
  const app = await PiChatBrowserDriver.start(page, { inboxEnabled: false, extensions: [fixture.extension] });
  try {
    await app.Tabs.Create({ responses: [] });
    await app.Chat.SendPrompt("/prompt-checks ");
    await app.Prompts.ShouldShowRichQuestion("Check 1");
    await app.Prompts.Minimize("Check 1");
    await app.Prompts.Stop();
    await app.WaitUntilReady();
    fixture.ShouldHaveAnswers([]);
  } finally { await app.dispose(); }
});
