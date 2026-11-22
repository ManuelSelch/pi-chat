import { expect, test, vi } from "vitest";
import { chimesPlugin, chimesUI } from "../index.js";

test("declares only a browser settings contribution without dummy commands, overlays or host RPC", () => {
  expect(chimesPlugin.id).toBe("chimes");
  expect(chimesPlugin.web()).toBe(chimesUI);
  expect(chimesPlugin).not.toHaveProperty("host");
  expect(chimesPlugin).not.toHaveProperty("provides");
  expect(chimesUI).not.toHaveProperty("commands");
  expect(chimesUI).not.toHaveProperty("Overlay");
  expect(chimesUI.contributions[0]).toMatchObject({ id: "chimes.enabled", placement: "settings.feature-toggles" });
});

test("importing the declaration does not start audio", async () => {
  const Audio = vi.fn();
  vi.stubGlobal("AudioContext", Audio);
  try {
    vi.resetModules();
    await import("../index.js");
    expect(Audio).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
});
