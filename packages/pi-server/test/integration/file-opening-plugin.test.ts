import { afterEach, beforeEach, test } from "vitest";
import { FileOpeningPluginDriver } from "../infra/file-opening-plugin-driver.js";

let app: FileOpeningPluginDriver;
beforeEach(() => { app = new FileOpeningPluginDriver(); });
afterEach(async () => { await app.dispose(); });

test("file plugin RPC resolves paths against the explicitly named session", async () => {
  await app.start();

  await app.shouldRejectRawAdapterId();
  await app.shouldOpenNamedSession(1);
  await app.shouldOpenNamedSession(0);
});

test("file plugin preserves missing-file, directory and unavailable-session failures", async () => {
  await app.start();

  await app.shouldRejectFile("missing.pdf", "notFound");
  await app.shouldRejectFile(".", "notFile");
  await app.shouldRejectUnavailableSession();
});

test("file plugin preserves unsupported-platform failures", async () => {
  await app.start();

  await app.shouldRejectUnsupportedPlatform();
});

test("activating the file plugin does not expose it without an allowlist", async () => {
  await app.start(false);

  await app.shouldRequireExplicitExposure();
});
