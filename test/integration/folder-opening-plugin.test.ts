import { afterEach, beforeEach, test } from "vitest";
import { FolderOpeningPluginDriver } from "../infra/folder-opening-plugin-driver.js";

let folderOpening: FolderOpeningPluginDriver;
beforeEach(() => { folderOpening = new FolderOpeningPluginDriver(); });
afterEach(async () => { await folderOpening.dispose(); });

test("folder plugin browses real server folders without creating a session", async () => {
  await folderOpening.start();

  await folderOpening.shouldBrowseWithoutCreatingSession();
});

test("folder plugin preserves safe actionable navigation failures", async () => {
  await folderOpening.start();

  await folderOpening.shouldPreserveActionableFailures();
});

test("folder plugin RPC still requires an explicit allowlist", async () => {
  await folderOpening.start(false);

  await folderOpening.shouldRequireExplicitExposure();
});
