import { it } from "vitest";
import { WidgetTransportDriver } from "../infra/widget-transport-driver.js";

it("preserves themed widgets through initial state, color-only updates, snapshots, reconnect and clearing", async () => {
  const app = await WidgetTransportDriver.start();
  try {
    await app.shouldPreserveStyledWidget();
    app.show("error");
    await app.shouldPreserveStyledWidget();
    await app.shouldPreserveSnapshot();
    await app.reconnect();
    await app.shouldPreserveStyledWidget();
    app.clear();
    await app.shouldHaveNoWidgets();
  } finally { await app.dispose(); }
});
