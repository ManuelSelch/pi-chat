import assert from "node:assert/strict";
import { atHome } from "../../../src/web/app/stores/app-state.js";
import { check, type DriverContext } from "./driver-context.js";

export class BrowserDriver {
  constructor(private readonly context: DriverContext) {}

  async reconnect(): Promise<void> {
    const previousSession = this.context.client.appState.activeSessionId;
    await this.context.reconnect();
    check(this.context, "Browser.Reconnect", () => assert.equal(this.context.client.appState.activeSessionId, previousSession, "Reconnect changed the active conversation"));
  }

  async openSecondBrowser(): Promise<void> {
    const previousSession = this.context.client.appState.activeSessionId;
    await this.context.openSecondBrowser();
    check(this.context, "Browser.OpenSecondBrowser", () => assert.equal(this.context.client.appState.activeSessionId, previousSession, "Opening another browser changed the active conversation"));
  }

  switchBrowser(): void { this.context.switchBrowser(); }

  shouldShowError(message: string): void {
    check(this.context, "Browser.ShouldShowError", () => assert(this.context.client.appState.error?.includes(message)));
  }

  dismissError(): void { this.context.client.dismissError(); }

  shouldBeAtHome(): void {
    this.shouldBeUsable();
    check(this.context, "Browser.ShouldBeAtHome", () => assert(atHome(this.context.client.appState), "Expected the home screen"));
  }

  shouldBeUsable(): void {
    check(this.context, "Browser.ShouldBeUsable", () => {
      const { appState, chat } = this.context.client;
      assert.equal(appState.connection, "open");
      assert(appState.tabsKnown, "Tabs have not loaded");
      if (appState.activeSessionId) assert.equal(chat.sessionId, appState.activeSessionId);
      else assert(atHome(appState), "Home screen has not loaded");
      assert.equal(appState.error, undefined);
    });
  }
}
