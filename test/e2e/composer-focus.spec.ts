import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

let app: PiChatBrowserDriver;
let startupGate: Promise<void> | undefined;
test.beforeEach(async ({ page }) => {
  startupGate = undefined;
  app = await PiChatBrowserDriver.start(page, {
    inboxEnabled: false,
    // Expose the real Settings confirmation without ever restarting a test process.
    restart: { restart: async () => { throw new Error("The cancelled restart must not execute"); } },
    extensions: [async pi => {
      await startupGate;
      pi.registerCommand("focus-question", {
        handler: async (_, ctx) => { await ctx.ui.input("Focus question"); },
      });
      pi.registerCommand("focus-handover", {
        handler: async (_, ctx) => {
          await ctx.ui.input("First focus question");
          await ctx.ui.input("Second focus question");
        },
      });
    }],
  });
});
test.afterEach(async () => { await app?.dispose(); });

for (const overlay of ["settings", "projects", "folder picker", "quick open"] as const) {
  test(`returns focus after closing ${overlay}, then accepts typing without a click`, async () => {
    await app.Tabs.Create({ responses: [] });
    if (overlay === "settings") {
      await app.Focus.OpenSettingsFromHeader();
      await app.Focus.DismissDialog("Settings");
    } else if (overlay === "projects" || overlay === "folder picker") {
      await app.Projects.Open();
      if (overlay === "folder picker") {
        // This also exercises handover: the older drawer exits while a new modal opens.
        await app.Focus.OpenFolderFromProjects();
        await app.Focus.DismissDialog("Open server folder", "Cancel");
      } else await app.Projects.Close();
    } else {
      await app.Focus.OpenQuickOpen();
      await app.Focus.DismissQuickOpen();
    }

    await app.Focus.TypeWithoutRefocusing("Focus survived the exit animation");
    await app.Focus.ShouldHaveDraft("Focus survived the exit animation");
  });
}

test("returns focus after accepting the folder picker and creating a session", async () => {
  await app.Tabs.Create({ responses: [] });
  await app.Projects.Open();
  await app.Focus.OpenFolderFromProjects();
  await app.Focus.OpenFolderAsSession();
  await app.Tabs.ShouldHaveCount(2);
  await app.Focus.TypeWithoutRefocusing("New folder session draft");
  await app.Focus.ShouldHaveDraft("New folder session draft");
});

test("keeps focus in a nested confirmation, then restores only after Settings closes", async () => {
  await app.Tabs.Create({ responses: [] });
  await app.Focus.OpenSettingsFromHeader();
  await app.Focus.OpenNestedRestartConfirmation();
  await app.Focus.DismissDialog("Restart server?", "Cancel");
  await app.Focus.ShouldBeInsideDialog("Settings");
  await app.Focus.DismissDialog("Settings");
  await app.Focus.TypeWithoutRefocusing("After nested confirmation");
  await app.Focus.ShouldHaveDraft("After nested confirmation");
});

test("restores focus after the final extension prompt closes", async () => {
  await app.Tabs.Create({ responses: [] });
  await app.Chat.SendPrompt("/focus-question ");
  await app.Focus.ShouldBeInsideDialog("Focus question");
  await app.Focus.AnswerPrompt("Focus question", "Answer");
  await app.Focus.WaitForPromptToClose("Focus question");
  await app.Focus.TypeWithoutRefocusing("After the final question");
  await app.Focus.ShouldHaveDraft("After the final question");
});

test("keeps consecutive extension prompts focused before restoring the composer", async () => {
  await app.Tabs.Create({ responses: [] });
  await app.Chat.SendPrompt("/focus-handover ");
  await app.Focus.ShouldBeInsideDialog("First focus question");
  await app.Focus.AnswerPrompt("First focus question", "First answer");
  await app.Focus.ShouldBeInsideDialog("Second focus question");
  await app.Focus.AnswerPrompt("Second focus question", "Second answer");
  await app.Focus.WaitForPromptToClose("Second focus question");
  await app.Focus.TypeWithoutRefocusing("After both questions");
  await app.Focus.ShouldHaveDraft("After both questions");
});

for (const cancel of ["Escape", "Keep open"] as const) {
  test(`restores steering focus after cancelling close with ${cancel}`, async () => {
    const tab = await app.Tabs.Create({ responses: [{ prompt: "Start working", reply: "Held response", hold: true }] });
    await app.Chat.SendPrompt("Start working");
    await app.Chat.ShouldBeSteering();
    await app.Tabs.RequestClose(tab);
    await app.Focus.ShouldBeInsideDialog("Close running session?");
    await app.Focus.DismissDialog("Close running session?", cancel);
    await app.Chat.ShouldBeSteering();
    await app.Focus.TypeWithoutRefocusing("Keep this run open");
    await app.Focus.ShouldHaveDraft("Keep this run open");
  });
}

test("returns Home after closing a running session and focuses the remaining conversation on explicit selection", async () => {
  const remaining = await app.Tabs.Create({ responses: [] });
  const running = await app.Tabs.Create({ responses: [{ prompt: "Start working", reply: "Held response", hold: true }] });
  await app.Chat.SendPrompt("Start working");
  await app.Chat.ShouldBeSteering();
  await app.Tabs.RequestClose(running);
  await app.Focus.ShouldBeInsideDialog("Close running session?");
  await app.Focus.AcceptCloseRunningSession();

  await app.Home.ShouldBeVisible();
  await app.Tabs.ShouldHaveCount(1);

  await app.Tabs.SwitchTo(remaining);
  await app.Focus.TypeWithoutRefocusing("Remaining conversation draft");
  await app.Focus.ShouldHaveDraft("Remaining conversation draft");
});

test("returns Home after accepting close of the last running session", async () => {
  const tab = await app.Tabs.Create({ responses: [{ prompt: "Start working", reply: "Held response", hold: true }] });
  await app.Chat.SendPrompt("Start working");
  await app.Chat.ShouldBeSteering();
  await app.Tabs.RequestClose(tab);
  await app.Focus.ShouldBeInsideDialog("Close running session?");
  await app.Focus.AcceptCloseRunningSession();
  await app.Home.ShouldBeVisible();
});

test("disables input during controlled slow startup, then focuses the ready composer", async () => {
  let release!: () => void;
  startupGate = new Promise<void>(resolve => { release = resolve; });
  const creating = app.Tabs.Create({ responses: [] });
  try {
    await app.Focus.ShouldBeLoading();
    await app.Focus.TryTypingWhileLoading("Too early");
  } finally {
    release();
    await creating;
  }
  await app.Focus.TypeWithoutRefocusing("Ready after slow startup");
  await app.Focus.ShouldHaveDraft("Ready after slow startup");
});

test("focuses ready sessions and preserves drafts while switching tabs", async () => {
  const first = await app.Tabs.Create({ responses: [] });
  await app.Focus.TypeWithoutRefocusing("First draft");
  const second = await app.Tabs.Create({ responses: [] });
  await app.Focus.TypeWithoutRefocusing("Second draft");
  await app.Tabs.SwitchTo(first);
  await app.Focus.ShouldBeOnComposer();
  await app.Focus.ShouldHaveDraft("First draft");
  await app.Tabs.SwitchTo(second);
  await app.Focus.ShouldBeOnComposer();
  await app.Focus.ShouldHaveDraft("Second draft");
  await app.Focus.ShouldAllowTabAwayFromComposer();
});
