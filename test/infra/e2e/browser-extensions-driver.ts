import { WidgetExtensionFixture, type WidgetText } from "../pi-chat/fixtures/widget-extension-fixture.js";

/** Explicit extension-side inputs; rendering assertions belong to Widgets. */
export class BrowserExtensionsDriver {
  constructor(private readonly fixture: WidgetExtensionFixture) {}

  async setWidget(key: string, content: WidgetText | readonly WidgetText[]): Promise<void> {
    this.fixture.setWidget(key, content);
  }

  async clearWidget(key: string): Promise<void> { this.fixture.clearWidget(key); }
}
