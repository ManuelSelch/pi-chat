import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

let app: PiChatBrowserDriver;
test.beforeEach(async ({ page }) => {
  app = await PiChatBrowserDriver.start(page, { projectName: "sidebar-project" });
});
test.afterEach(async () => { await app?.dispose(); });

for (const width of [1680, 1024, 1280]) {
  test(`keeps the session usable beside Projects at ${width}px`, async () => {
    await app.Browser.SetViewport(width);
    const reply = Array.from({ length: 50 }, (_, i) => `Paragraph ${i + 1}: the session remains usable with Projects open.`).join("\n\n");
    await app.Tabs.Create({ responses: [{ prompt: "Keep projects open", reply }] });
    await app.Widgets.named("status").show("Still working");
    await app.Projects.RememberChatBounds();

    await app.Projects.Open();

    await app.Projects.ShouldBeSidebar();
    await app.Projects.ShouldNotOverlapWorkspace();
    if (width === 1680) await app.Projects.ShouldKeepChatBounds();
    await app.Widgets.shouldUseLayout(width === 1680 ? "docked" : "composer");
    await app.Focus.TypeWithoutRefocusing("Keep projects open");
    await app.Focus.SubmitDraft();
    await app.Chat.ShouldShowAssistantReply(reply);
    await app.Chat.ShouldBeIdle();
    await app.Projects.ShouldBeSidebar();
    await app.Projects.ShouldAllowTranscriptScroll();
    await app.Projects.SelectSession("Keep projects open");
    await app.Focus.ShouldBeOnComposer();

    await app.Projects.CreateSession();

    await app.Tabs.ShouldHaveCount(2);
    await app.Projects.ShouldBeSidebar();
    await app.Focus.TypeWithoutRefocusing("New session draft");
    await app.Projects.SelectSession("Keep projects open");
    await app.Projects.ShouldBeSidebar();
    await app.Focus.ShouldHaveDraft("");
    await app.Projects.Close();
    await app.Focus.TypeWithoutRefocusing("After closing Projects");
  });
}

test("keeps phone navigation modal and open through session selection and creation", async () => {
  await app.Browser.SetViewport(390, 844);
  await app.Tabs.Create({ responses: [{ prompt: "Phone conversation", reply: "Phone reply" }] });
  await app.Chat.SendPrompt("Phone conversation");
  await app.Chat.ShouldShowAssistantReply("Phone reply");

  await app.Projects.Open();
  await app.Projects.ShouldBeDrawer();
  await app.Projects.SelectSession("Phone conversation");
  await app.Projects.ShouldBeDrawer();
  await app.Projects.CreateSession();
  await app.Tabs.ShouldHaveCount(2);
  await app.Projects.ShouldBeDrawer();

  await app.Focus.DismissDialog("Projects");

  await app.Focus.TypeWithoutRefocusing("Phone draft");
});

test("transfers focus and keeps one navigation surface when resizing", async () => {
  await app.Browser.SetViewport(1024);
  await app.Tabs.Create({ responses: [] });
  await app.Focus.TypeWithoutRefocusing("Preserved draft");
  await app.Projects.Open();
  await app.Projects.ShouldBeSidebar();

  await app.Browser.SetViewport(390, 844);
  await app.Projects.ShouldBeDrawer();
  await app.Browser.SetViewport(1680);
  await app.Projects.ShouldBeSidebar();
  await app.Projects.ShouldKeepFocusInSidebar();
  await app.Focus.ShouldHaveDraft("Preserved draft");

  await app.Projects.Close();

  await app.Focus.ShouldBeOnComposer();
  await app.Focus.ShouldHaveDraft("Preserved draft");
});
