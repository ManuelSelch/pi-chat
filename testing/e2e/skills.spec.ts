import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

let app: PiChatBrowserDriver;
test.beforeEach(async ({ page }) => { app = await PiChatBrowserDriver.start(page, { inboxEnabled: false }); });
test.afterEach(async () => { await app?.dispose(); });

const instructions = "Review the fixture calendar and prepare a briefing.";
const fixture = { name: "browser-briefing", instructions };

for (const via of ["Enter", "Tab", "mouse"] as const) {
  test(`selects a skill with ${via} without executing, then submits a separate task`, async () => {
    await app.tabs.create({ skills: [fixture], responses: [{ prompt: "/skill:browser-briefing Today's report", reply: "Briefing complete" }] });

    await app.skills.type("/skill:browser-br");
    await app.skills.shouldOffer(fixture.name);
    await app.skills.select(fixture.name, via);
    await app.skills.shouldHaveNoInvocations();
    await app.chat.shouldNotShowMessage("Briefing complete");
    await app.skills.shouldNotRequestArguments();

    await app.skills.submitTask("Today's report");
    await app.chat.shouldShowAssistantReply("Briefing complete");
    await app.chat.shouldShowUserMessage("Today's report");
    await app.skills.shouldHaveInvocation(fixture.name);
    await app.skills.expandInvocation(fixture.name, instructions);
    await app.chat.shouldBeIdle();
    await app.skills.shouldNotRequestArguments();
  });
}

test("dismisses skill discovery, invokes without task text, and restores invocation/read cards after reload", async ({ page }) => {
  await app.tabs.create({ skills: [fixture], responses: [{ prompt: "/skill:browser-briefing", readSkill: fixture.name, reply: "Fixture skill read" }] });
  await app.skills.type("/skill:");
  await app.skills.shouldOffer(fixture.name);
  await app.skills.dismissMenu();
  await app.skills.shouldHaveDraft("/skill:");
  await app.skills.shouldHaveNoInvocations();

  await app.skills.select(fixture.name);
  await app.skills.submitTask();
  await app.chat.shouldShowAssistantReply("Fixture skill read");
  await app.skills.shouldHaveInvocation(fixture.name);
  await app.skills.shouldHaveRead(fixture.name, instructions);
  await app.chat.shouldBeIdle();
  await app.skills.reloadResources();
  await app.skills.type("/skill:");
  await app.skills.shouldOffer(fixture.name);
  await app.skills.dismissMenu();

  await app.browser.reload();
  await app.skills.shouldHaveInvocation(fixture.name);
  await page.screenshot({ path: test.info().outputPath("skill-cards-collapsed.png"), fullPage: true });
  await app.skills.shouldHaveRead(fixture.name, instructions);
  await app.skills.expandInvocation(fixture.name, instructions);
  await app.chat.shouldShowAssistantReply("Fixture skill read");
  await app.skills.shouldNotRequestArguments();
  await page.screenshot({ path: test.info().outputPath("skill-cards.png"), fullPage: true });
});

test("keeps discovery tab-specific, including after browser reload", async () => {
  const first = await app.tabs.create({ skills: [{ name: "first-skill", instructions: "First session" }], responses: [] });
  await app.skills.type("/skill:");
  await app.skills.shouldOffer("first-skill");
  await app.skills.shouldNotOffer("second-skill");

  const second = await app.tabs.create({ skills: [{ name: "second-skill", instructions: "Second session" }], responses: [] });
  await app.skills.type("/skill:");
  await app.skills.shouldOffer("second-skill");
  await app.skills.shouldNotOffer("first-skill");

  await app.tabs.switchTo(first);
  await app.skills.shouldOffer("first-skill");
  await app.skills.shouldNotOffer("second-skill");
  await app.browser.reload();
  await app.skills.type("/skill:");
  await app.skills.shouldOffer("first-skill");
  await app.skills.shouldNotOffer("second-skill");
  await app.tabs.switchTo(second);
  await app.skills.type("/skill:");
  await app.skills.shouldOffer("second-skill");
  await app.skills.shouldNotOffer("first-skill");
});

test("allows manual invocation when skill discovery is disabled", async () => {
  await app.tabs.create({ skills: [fixture], enableSkillCommands: false, responses: [{ prompt: "/skill:browser-briefing Manual report", reply: "Manual invocation complete" }] });
  await app.skills.type("/skill:");
  await app.skills.shouldNotOffer(fixture.name);

  await app.chat.sendPrompt("/skill:browser-briefing Manual report");
  await app.chat.shouldShowAssistantReply("Manual invocation complete");
  await app.chat.shouldShowUserMessage("Manual report");
  await app.skills.shouldHaveInvocation(fixture.name);
  await app.skills.shouldNotRequestArguments();
});

test("selects and queues a skill command while streaming and restores it after reload", async () => {
  await app.tabs.create({ skills: [fixture], responses: [{ prompt: "Start working", reply: "Held response", hold: true }] });
  await app.chat.sendPrompt("Start working");
  await app.chat.shouldBeSteering();

  await app.skills.select(fixture.name);
  await app.skills.submitTask("steering task");
  await app.skills.shouldHaveQueuedInvocation(fixture.name, instructions, "steering task");
  await app.skills.shouldHaveNoInvocations();
  await app.chat.shouldBeSteering();
  await app.browser.reload();
  await app.skills.shouldHaveQueuedInvocation(fixture.name, instructions, "steering task");
  await app.chat.shouldBeSteering();
});
