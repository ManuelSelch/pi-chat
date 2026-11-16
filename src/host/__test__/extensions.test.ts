import { afterEach, expect, it } from "vitest";
import { getPiChatExtensionRegistry } from "@manuelselch/pi-server/extensions";
import { resetPiChatExtensionRegistryForTests } from "@manuelselch/pi-server/testing";

afterEach(resetPiChatExtensionRegistryForTests);
it("retains the process-wide extension identity through the public package", () => {
  resetPiChatExtensionRegistryForTests();
  const registry = getPiChatExtensionRegistry();
  expect(getPiChatExtensionRegistry()).toBe(registry);
  expect((globalThis as unknown as Record<symbol, unknown>)[Symbol.for("pi-chat.extension-registry")]).toBe(registry);
  registry.registerButton({ id: "compat.button", slot: "composer.right", label: "Compatibility", actionId: "compat.action" });
  expect(getPiChatExtensionRegistry().snapshot().buttons).toHaveLength(1);
  resetPiChatExtensionRegistryForTests();
  expect(getPiChatExtensionRegistry().snapshot().buttons).toEqual([]);
});
