import { describe, expect, it } from "vitest";
import * as legacy from "../src/server/extension-registry.js";
import * as canonical from "../src/server/extensions/extension-registry.js";

describe("extension registry import compatibility", () => {
  it("re-exports the same functions and shares the process-wide registry", () => {
    expect(legacy.createPiChatExtensionRegistry).toBe(canonical.createPiChatExtensionRegistry);
    expect(legacy.getPiChatExtensionRegistry).toBe(canonical.getPiChatExtensionRegistry);
    expect(legacy.resetPiChatExtensionRegistryForTests).toBe(canonical.resetPiChatExtensionRegistryForTests);

    canonical.resetPiChatExtensionRegistryForTests();
    try {
      expect(legacy.getPiChatExtensionRegistry()).toBe(canonical.getPiChatExtensionRegistry());
      legacy.getPiChatExtensionRegistry().registerButton({
        id: "compat.button", slot: "composer.right", label: "Compatibility", actionId: "compat.action",
      });
      expect(canonical.getPiChatExtensionRegistry().snapshot().buttons).toHaveLength(1);
    } finally {
      canonical.resetPiChatExtensionRegistryForTests();
    }
  });
});
