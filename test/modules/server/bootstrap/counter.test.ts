import { expect, test, vi } from "vitest";
import { createPiServer } from "@manuelselch/pi-server";
import counterPlugin from "../../../fixtures/plugins/counter/index.js";
import * as counterHost from "../../../fixtures/plugins/counter/host.js";

test("the counter fixture activates on server creation and is disposed on close", async () => {
  const setup = vi.spyOn(counterHost, "setup");
  try {
    const server = await createPiServer({ plugins: [counterPlugin] });
    try {
      expect(setup).toHaveBeenCalledTimes(1);
      expect(setup.mock.calls[0]![0].signal.aborted).toBe(false);
      expect(server.httpServer.listening).toBe(false);
    } finally {
      await server.close();
    }

    expect(setup.mock.calls[0]![0].signal.aborted).toBe(true);
    await server.close();
    expect(setup).toHaveBeenCalledTimes(1);
  } finally {
    setup.mockRestore();
  }
});
