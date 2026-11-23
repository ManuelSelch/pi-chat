// @vitest-environment jsdom
import { afterEach, beforeEach, it } from "vitest";
import { FolderPluginDriver } from "../../../../../testing/infra/ui/folder-plugin-driver.js";

let app: FolderPluginDriver;
beforeEach(async () => {
  app = new FolderPluginDriver();
  await app.mount();
});
afterEach(() => app.dispose());

it("opens the contributed picker from menus and navigates only after successful creation", async () => {
  await app.openPicker();
  app.shouldBrowseThroughPlugin();
  await app.showFolder();

  app.startSession();
  await app.rejectCreation();
  app.shouldKeepPickerError();

  app.startSession();
  await app.completeCreation();
  app.shouldShowSession();
});

it("keeps its dialog open across reconnect and browses through the replacement connection", async () => {
  await app.openPicker();
  await app.showFolder();

  await app.reconnect();

  app.shouldBrowseThroughPlugin("/server/work");
  await app.showFolder();
  await app.cancelPicker();
  app.shouldNotCreateSession();
});

it("cancels a pending browse without starting a session", async () => {
  await app.openPicker();
  app.shouldBrowseThroughPlugin();

  await app.cancelPicker();

  app.shouldNotCreateSession();
});
