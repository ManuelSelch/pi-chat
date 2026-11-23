import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

let app: PiChatBrowserDriver;
let startupGate: Promise<void> | undefined;
test.beforeEach(async ({ page }) => {
  startupGate = undefined;
  app = await PiChatBrowserDriver.start(page, {
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

for (const overlay of ["settings", "sessions", "folder picker", "quick open"] as const) {
  test(`returns focus after closing ${overlay}, then accepts typing without a click`, async () => {
    await app.sessions.create({ responses: [] });
    if (overlay === "settings") {
      await app.focus.openSettings();
      await app.focus.dismissDialog("Settings");
    } else if (overlay === "sessions" || overlay === "folder picker") {
      if (overlay === "folder picker") {
        // This also exercises handover: the older drawer exits while a new modal opens.
        await app.focus.openFolderFromMenu();
        await app.focus.dismissDialog("Open server folder", "Cancel");
      } else { await app.inbox.open(); await app.inbox.close(); }
    } else {
      await app.focus.openQuickOpen();
      await app.focus.dismissQuickOpen();
    }

    await app.focus.typeWithoutRefocusing("Focus survived the exit animation");
    await app.focus.shouldHaveDraft("Focus survived the exit animation");
  });
}

test("returns focus after accepting the folder picker and creating a session", async () => {
  await app.sessions.create({ responses: [] });
  await app.focus.openFolderFromMenu();
  await app.focus.openFolderAsSession();
  await app.sessions.shouldHaveCount(2);
  await app.focus.typeWithoutRefocusing("New folder session draft");
  await app.focus.shouldHaveDraft("New folder session draft");
});

test("restores composer focus after Settings closes", async () => {
  await app.sessions.create({ responses: [] });
  await app.focus.openSettings();
  await app.focus.shouldBeInsideDialog("Settings");
  await app.focus.dismissDialog("Settings");
  await app.focus.typeWithoutRefocusing("After Settings");
  await app.focus.shouldHaveDraft("After Settings");
});

test("restores focus after the final extension prompt closes", async () => {
  await app.sessions.create({ responses: [] });
  await app.chat.sendPrompt("/focus-question ");
  await app.focus.shouldBeInsideDialog("Focus question");
  await app.focus.answerPrompt("Focus question", "Answer");
  await app.focus.waitForPromptToClose("Focus question");
  await app.focus.typeWithoutRefocusing("After the final question");
  await app.focus.shouldHaveDraft("After the final question");
});

test("keeps consecutive extension prompts focused before restoring the composer", async () => {
  await app.sessions.create({ responses: [] });
  await app.chat.sendPrompt("/focus-handover ");
  await app.focus.shouldBeInsideDialog("First focus question");
  await app.focus.answerPrompt("First focus question", "First answer");
  await app.focus.shouldBeInsideDialog("Second focus question");
  await app.focus.answerPrompt("Second focus question", "Second answer");
  await app.focus.waitForPromptToClose("Second focus question");
  await app.focus.typeWithoutRefocusing("After both questions");
  await app.focus.shouldHaveDraft("After both questions");
});

test("closing a running view keeps background work and allows explicit selection", async () => {
  const remaining = await app.sessions.create({ responses: [] });
  const running = await app.sessions.create({ responses: [{ prompt: "Start working", reply: "Held response", hold: true }] });
  await app.chat.sendPrompt("Start working");
  await app.chat.shouldBeSteering();
  await app.sessions.close(running);

  await app.home.shouldBeVisible();
  await app.sessions.shouldHaveCount(2);

  await app.sessions.switchTo(remaining);
  await app.focus.typeWithoutRefocusing("Remaining conversation draft");
  await app.focus.shouldHaveDraft("Remaining conversation draft");
});

test("returns Home without stopping the last running session", async () => {
  const tab = await app.sessions.create({ responses: [{ prompt: "Start working", reply: "Held response", hold: true }] });
  await app.chat.sendPrompt("Start working");
  await app.chat.shouldBeSteering();
  await app.sessions.close(tab);
  await app.home.shouldBeVisible();
});

test("disables input during controlled slow startup, then focuses the ready composer", async () => {
  let release!: () => void;
  startupGate = new Promise<void>(resolve => { release = resolve; });
  const creating = app.sessions.create({ responses: [] });
  try {
    await app.focus.shouldBeLoading();
    await app.focus.tryTypingWhileLoading("Too early");
  } finally {
    release();
    await creating;
  }
  await app.focus.typeWithoutRefocusing("Ready after slow startup");
  await app.focus.shouldHaveDraft("Ready after slow startup");
});

test("focuses ready sessions and preserves drafts while switching sessions", async () => {
  const first = await app.sessions.create({ responses: [] });
  await app.focus.typeWithoutRefocusing("First draft");
  const second = await app.sessions.create({ responses: [] });
  await app.focus.typeWithoutRefocusing("Second draft");
  await app.sessions.switchTo(first);
  await app.focus.shouldBeOnComposer();
  await app.focus.shouldHaveDraft("First draft");
  await app.sessions.switchTo(second);
  await app.focus.shouldBeOnComposer();
  await app.focus.shouldHaveDraft("Second draft");
  await app.focus.shouldAllowTabAwayFromComposer();
});
