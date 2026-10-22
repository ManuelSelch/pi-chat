import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

let app: PiChatBrowserDriver;
test.beforeEach(async ({ page }) => { app = await PiChatBrowserDriver.start(page); });
test.afterEach(async () => { await app?.dispose(); });

const instructions = "Review the fixture calendar and prepare a briefing.";
const fixture = { name: "browser-briefing", instructions };

for (const via of ["Enter", "Tab", "mouse"] as const) {
  test(`selects a skill with ${via} without executing, then submits a separate task`, async () => {
    await app.Tabs.Create({ skills: [fixture], responses: [{ prompt: "/skill:browser-briefing Today's report", reply: "Briefing complete" }] });

    await app.Skills.Type("/skill:browser-br");
    await app.Skills.ShouldOffer(fixture.name);
    await app.Skills.Select(fixture.name, via);
    await app.Skills.ShouldHaveNoInvocations();
    await app.Chat.ShouldNotShowMessage("Briefing complete");
    await app.Skills.ShouldNotRequestArguments();

    await app.Skills.SubmitTask("Today's report");
    await app.Chat.ShouldShowAssistantReply("Briefing complete");
    await app.Chat.ShouldShowUserMessage("Today's report");
    await app.Skills.ShouldHaveInvocation(fixture.name);
    await app.Skills.ExpandInvocation(fixture.name, instructions);
    await app.Chat.ShouldBeIdle();
    await app.Skills.ShouldNotRequestArguments();
  });
}

test("dismisses skill discovery, invokes without task text, and restores invocation/read cards after reload", async ({ page }) => {
  await app.Tabs.Create({ skills: [fixture], responses: [{ prompt: "/skill:browser-briefing", readSkill: fixture.name, reply: "Fixture skill read" }] });
  await app.Skills.Type("/skill:");
  await app.Skills.ShouldOffer(fixture.name);
  await app.Skills.DismissMenu();
  await app.Skills.ShouldHaveDraft("/skill:");
  await app.Skills.ShouldHaveNoInvocations();

  await app.Skills.Select(fixture.name);
  await app.Skills.SubmitTask();
  await app.Chat.ShouldShowAssistantReply("Fixture skill read");
  await app.Skills.ShouldHaveInvocation(fixture.name);
  await app.Skills.ShouldHaveRead(fixture.name, instructions);
  await app.Chat.ShouldBeIdle();
  await app.Skills.ReloadResources();
  await app.Skills.Type("/skill:");
  await app.Skills.ShouldOffer(fixture.name);
  await app.Skills.DismissMenu();

  await app.Browser.Reload();
  await app.Skills.ShouldHaveInvocation(fixture.name);
  await page.screenshot({ path: test.info().outputPath("skill-cards-collapsed.png"), fullPage: true });
  await app.Skills.ShouldHaveRead(fixture.name, instructions);
  await app.Skills.ExpandInvocation(fixture.name, instructions);
  await app.Chat.ShouldShowAssistantReply("Fixture skill read");
  await app.Skills.ShouldNotRequestArguments();
  await page.screenshot({ path: test.info().outputPath("skill-cards.png"), fullPage: true });
});

test("keeps discovery tab-specific, including after browser reload", async () => {
  const first = await app.Tabs.Create({ skills: [{ name: "first-skill", instructions: "First session" }], responses: [] });
  await app.Skills.Type("/skill:");
  await app.Skills.ShouldOffer("first-skill");
  await app.Skills.ShouldNotOffer("second-skill");

  const second = await app.Tabs.Create({ skills: [{ name: "second-skill", instructions: "Second session" }], responses: [] });
  await app.Skills.Type("/skill:");
  await app.Skills.ShouldOffer("second-skill");
  await app.Skills.ShouldNotOffer("first-skill");

  await app.Tabs.SwitchTo(first);
  await app.Skills.ShouldOffer("first-skill");
  await app.Skills.ShouldNotOffer("second-skill");
  await app.Browser.Reload();
  await app.Skills.Type("/skill:");
  await app.Skills.ShouldOffer("first-skill");
  await app.Skills.ShouldNotOffer("second-skill");
  await app.Tabs.SwitchTo(second);
  await app.Skills.Type("/skill:");
  await app.Skills.ShouldOffer("second-skill");
  await app.Skills.ShouldNotOffer("first-skill");
});

test("allows manual invocation when skill discovery is disabled", async () => {
  await app.Tabs.Create({ skills: [fixture], enableSkillCommands: false, responses: [{ prompt: "/skill:browser-briefing Manual report", reply: "Manual invocation complete" }] });
  await app.Skills.Type("/skill:");
  await app.Skills.ShouldNotOffer(fixture.name);

  await app.Chat.SendPrompt("/skill:browser-briefing Manual report");
  await app.Chat.ShouldShowAssistantReply("Manual invocation complete");
  await app.Chat.ShouldShowUserMessage("Manual report");
  await app.Skills.ShouldHaveInvocation(fixture.name);
  await app.Skills.ShouldNotRequestArguments();
});

test("selects and queues a skill command while streaming and restores it after reload", async () => {
  await app.Tabs.Create({ skills: [fixture], responses: [{ prompt: "Start working", reply: "Held response", hold: true }] });
  await app.Chat.SendPrompt("Start working");
  await app.Chat.ShouldBeSteering();

  await app.Skills.Select(fixture.name);
  await app.Skills.SubmitTask("steering task");
  await app.Skills.ShouldHaveQueuedInvocation(fixture.name, instructions, "steering task");
  await app.Skills.ShouldHaveNoInvocations();
  await app.Chat.ShouldBeSteering();
  await app.Browser.Reload();
  await app.Skills.ShouldHaveQueuedInvocation(fixture.name, instructions, "steering task");
  await app.Chat.ShouldBeSteering();
});
