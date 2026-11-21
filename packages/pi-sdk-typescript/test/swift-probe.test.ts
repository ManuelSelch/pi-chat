import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { generateSwiftProbe } from "../scripts/swift-probe.js";

it("keeps the Swift feasibility probe generated from the authoritative schemas", async () => {
  const checkedIn = await readFile(new URL("../protocol/swift/GeneratedModels.swift", import.meta.url), "utf8");
  expect(await generateSwiftProbe()).toBe(checkedIn);
});
