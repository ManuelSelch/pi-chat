import { test } from "@playwright/test";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

let app: PiChatBrowserDriver;

test.beforeEach(async ({ page }) => {
  app = await PiChatBrowserDriver.start(page);
});

test.afterEach(async () => {
  await app.dispose();
});

test("archives a visible session and keeps it under Archived after reload", async () => {
  const target = await app.Tabs.Create({ responses: [{ prompt: "Archive this conversation", reply: "Ready to archive" }] });
  await app.Chat.SendPrompt("Archive this conversation");
  await app.Chat.ShouldShowAssistantReply("Ready to archive");
  await app.Chat.ShouldBeIdle();

  await app.Tabs.Create({ responses: [{ prompt: "Keep this conversation", reply: "Still open" }] });
  await app.Chat.SendPrompt("Keep this conversation");
  await app.Chat.ShouldShowAssistantReply("Still open");
  await app.Chat.ShouldBeIdle();
  await app.Tabs.SwitchTo(target);

  await app.Projects.Open();
  await app.Projects.ShouldShowActiveSession("Archive this conversation");
  await app.Projects.Archive("Archive this conversation");
  await app.Projects.ShouldNotShowSession("Archive this conversation");
  await app.Projects.ShowArchivedSessions();
  await app.Projects.ShouldShowArchivedSession("Archive this conversation");
  await app.Projects.ShouldShowActiveSession("Keep this conversation");
  await app.Projects.Close();
  await app.Tabs.ShouldHaveCount(1);
  await app.Chat.ShouldShowAssistantReply("Still open");

  await app.Browser.Reload();

  await app.Projects.Open();
  await app.Projects.ShouldNotShowSession("Archive this conversation");
  await app.Projects.ShowArchivedSessions();
  await app.Projects.ShouldShowArchivedSession("Archive this conversation");
  await app.Projects.ShouldShowActiveSession("Keep this conversation");
});
