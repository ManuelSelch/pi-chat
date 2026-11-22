// @vitest-environment jsdom
import { afterEach, beforeEach, it } from "vitest";
import { ChimesPluginDriver } from "../../../../../testing/infra/ui/chimes-plugin-driver.js";

let app: ChimesPluginDriver;
beforeEach(() => { app = new ChimesPluginDriver(); });
afterEach(() => app.dispose());

it("contributes the existing switch to Feature Toggles and keeps playback alive after Settings closes", async () => {
  await app.mount();
  app.shouldHavePlayedChimes(0);
  await app.openSettings();
  app.shouldKeepExistingFeatureToggles();

  await app.enableChimes();
  app.shouldHavePlayedChimes(1);
  await app.closeSettings();
  await app.finishBackgroundRun();

  app.shouldHavePlayedChimes(2);
  await app.openSettings();
  app.shouldKeepEnabled();
  app.shouldHavePlayedChimes(2);
  app.unmount();
  app.shouldReleaseAudio();
});

it("disables its settings control when browser audio is unavailable", async () => {
  app.dispose();
  app = new ChimesPluginDriver(false);
  await app.mount();
  await app.openSettings();

  app.shouldDisableUnavailableAudio();
  app.shouldHavePlayedChimes(0);
});
