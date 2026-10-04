import assert from "node:assert/strict";
import { atHome } from "../../../src/web/app/state/app-state.js";
import { check, type DriverContext } from "./driver-context.js";

export class BrowserDriver {
  constructor(private readonly context: DriverContext) {}

  async Reconnect(): Promise<void> {
    const previousSession = this.context.client.appState.activeSessionId;
    await this.context.reconnect();
    check(this.context, "Browser.Reconnect", () => assert.equal(this.context.client.appState.activeSessionId, previousSession, "Reconnect changed the active conversation"));
  }

  ShouldBeAtHome(): void {
    this.ShouldBeUsable();
    check(this.context, "Browser.ShouldBeAtHome", () => assert(atHome(this.context.client.appState), "Expected the home screen"));
  }

  ShouldBeUsable(): void {
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
