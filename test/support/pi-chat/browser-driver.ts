import assert from "node:assert/strict";
import { check, type DriverContext } from "./driver-context.js";

export class BrowserDriver {
  constructor(private readonly context: DriverContext) {}

  async Reconnect(): Promise<void> {
    const previousSession = this.context.client.appState.activeSessionId;
    await this.context.reconnect();
    check(this.context, "Browser.Reconnect", () => assert.equal(this.context.client.appState.activeSessionId, previousSession, "Reconnect changed the active conversation"));
  }

  ShouldBeUsable(): void {
    check(this.context, "Browser.ShouldBeUsable", () => {
      const { appState, chat } = this.context.client;
      assert.equal(appState.connection, "open");
      assert(appState.tabsKnown && appState.activeSessionId, "No active conversation");
      assert.equal(chat.sessionId, appState.activeSessionId);
      assert.equal(appState.error, undefined);
    });
  }
}
