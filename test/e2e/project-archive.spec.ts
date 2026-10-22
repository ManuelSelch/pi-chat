import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

let app: PiChatBrowserDriver;

test.beforeEach(async ({ page }) => {
  app = await PiChatBrowserDriver.start(page);
});

test.afterEach(async () => {
  await app.dispose();
});

test("hides archived sessions by default and persists opting back into Archived after reload", async () => {
  await app.Settings.Open();
  await app.Settings.ShouldHideArchivedSessions(true);
  await app.Settings.Close();
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
  await app.Projects.ShouldHideArchivedSection();
  await app.Projects.Close();

  await app.Settings.Open();
  await app.Settings.SetHideArchivedSessions(false);
  await app.Settings.Close();
  await app.Projects.Open();
  await app.Projects.ShowArchivedSessions();
  await app.Projects.ShouldShowArchivedSession("Archive this conversation");
  await app.Projects.ShouldShowActiveSession("Keep this conversation");
  await app.Projects.Close();
  await app.Tabs.ShouldHaveCount(1);
  await app.Chat.ShouldShowAssistantReply("Still open");

  await app.Browser.Reload();
  await app.Settings.Open();
  await app.Settings.ShouldHideArchivedSessions(false);
  await app.Settings.Close();

  await app.Projects.Open();
  await app.Projects.ShouldNotShowSession("Archive this conversation");
  await app.Projects.ShowArchivedSessions();
  await app.Projects.ShouldShowArchivedSession("Archive this conversation");
  await app.Projects.ShouldShowActiveSession("Keep this conversation");
  await app.Projects.Close();

  await app.Settings.Open();
  await app.Settings.SetHideArchivedSessions(true);
  await app.Settings.Close();
  await app.Projects.Open();
  await app.Projects.ShouldHideArchivedSection();
  await app.Projects.ShouldNotShowSession("Archive this conversation");
  await app.Projects.ShouldShowActiveSession("Keep this conversation");
});
