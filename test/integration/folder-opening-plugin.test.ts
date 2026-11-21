import { afterEach, beforeEach, test } from "vitest";
import { FolderOpeningPluginDriver } from "../infra/folder-opening-plugin-driver.js";

let app: FolderOpeningPluginDriver;
beforeEach(() => { app = new FolderOpeningPluginDriver(); });
afterEach(async () => { await app.dispose(); });

test("folder plugin browses real server folders without creating a session", async () => {
  await app.start();

  await app.shouldBrowseWithoutCreatingSession();
});

test("folder plugin preserves safe actionable navigation failures", async () => {
  await app.start();

  await app.shouldPreserveActionableFailures();
});

test("folder plugin RPC still requires an explicit allowlist", async () => {
  await app.start(false);

  await app.shouldRequireExplicitExposure();
});
