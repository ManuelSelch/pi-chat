import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

let app: PiChatBrowserDriver;
test.beforeEach(async ({ page }) => {
  app = await PiChatBrowserDriver.start(page, { inboxEnabled: false, projectName: "sidebar-project" });
});
test.afterEach(async () => { await app?.dispose(); });

for (const width of [1680, 1024, 1280]) {
  test(`keeps the session usable beside Projects at ${width}px`, async () => {
    await app.browser.setViewport(width);
    const reply = Array.from({ length: 50 }, (_, i) => `Paragraph ${i + 1}: the session remains usable with Projects open.`).join("\n\n");
    await app.tabs.create({ responses: [{ prompt: "Keep projects open", reply }] });
    await app.widgets.named("status").show("Still working");
    await app.projects.rememberChatBounds();

    await app.projects.open();

    await app.projects.shouldBeSidebar();
    await app.projects.shouldNotOverlapWorkspace();
    if (width === 1680) await app.projects.shouldKeepChatBounds();
    await app.widgets.shouldUseLayout(width === 1680 ? "docked" : "composer");
    await app.focus.typeWithoutRefocusing("Keep projects open");
    await app.focus.submitDraft();
    await app.chat.shouldShowAssistantReply(reply);
    await app.chat.shouldBeIdle();
    await app.projects.shouldBeSidebar();
    await app.projects.shouldAllowTranscriptScroll();
    await app.projects.selectSession("Keep projects open");
    await app.focus.shouldBeOnComposer();

    await app.projects.createSession();

    await app.tabs.shouldHaveCount(2);
    await app.projects.shouldBeSidebar();
    await app.focus.typeWithoutRefocusing("New session draft");
    await app.projects.selectSession("Keep projects open");
    await app.projects.shouldBeSidebar();
    await app.focus.shouldHaveDraft("");
    await app.projects.close();
    await app.focus.typeWithoutRefocusing("After closing Projects");
  });
}

test("keeps phone navigation modal and open through session selection and creation", async () => {
  await app.browser.setViewport(390, 844);
  await app.tabs.create({ responses: [{ prompt: "Phone conversation", reply: "Phone reply" }] });
  await app.chat.sendPrompt("Phone conversation");
  await app.chat.shouldShowAssistantReply("Phone reply");

  await app.projects.open();
  await app.projects.shouldBeDrawer();
  await app.projects.selectSession("Phone conversation");
  await app.projects.shouldBeDrawer();
  await app.projects.createSession();
  await app.tabs.shouldHaveCount(2);
  await app.projects.shouldBeDrawer();

  await app.focus.dismissDialog("Projects");

  await app.focus.typeWithoutRefocusing("Phone draft");
});

test("transfers focus and keeps one navigation surface when resizing", async () => {
  await app.browser.setViewport(1024);
  await app.tabs.create({ responses: [] });
  await app.focus.typeWithoutRefocusing("Preserved draft");
  await app.projects.open();
  await app.projects.shouldBeSidebar();

  await app.browser.setViewport(390, 844);
  await app.projects.shouldBeDrawer();
  await app.browser.setViewport(1680);
  await app.projects.shouldBeSidebar();
  await app.projects.shouldKeepFocusInSidebar();
  await app.focus.shouldHaveDraft("Preserved draft");

  await app.projects.close();

  await app.focus.shouldBeOnComposer();
  await app.focus.shouldHaveDraft("Preserved draft");
});
