import { expect, test } from "vitest";
import { createPluginRuntime } from "@manuelselch/pi-server/plugins";
import counterPlugin from "../index.js";
import { counterContract } from "../contract.js";

test("declares the demo-owned host contract without a web activation entry", () => {
  expect(counterPlugin.id).toBe("test-counter");
  expect(counterPlugin.provides).toEqual([counterContract]);
  expect(counterPlugin).not.toHaveProperty("web");
  expect(counterContract.version).toBe(1);
  for (const method of Object.values(counterContract.methods)) {
    expect(method.input.parse(null)).toBeNull();
    expect(() => method.input.parse(undefined)).toThrow();
    expect(method.output.parse(0)).toBe(0);
    for (const invalid of [-1, 0.5, Infinity, null]) expect(() => method.output.parse(invalid)).toThrow();
  }
});

test("activates an isolated counter for each runtime and rejects calls after disposal", async () => {
  const first = createPluginRuntime([counterPlugin]);
  const second = createPluginRuntime([counterPlugin]);
  try {
    await Promise.all([first.start(), second.start()]);
    const counter = first.client(counterContract);

    await expect(counter.read(null)).resolves.toBe(0);
    await expect(counter.increment(null)).resolves.toBe(1);
    await expect(second.client(counterContract).read(null)).resolves.toBe(0);

    await first.dispose();

    await expect(counter.increment(null)).rejects.toThrow("not active");
    await expect(second.client(counterContract).increment(null)).resolves.toBe(1);
  } finally {
    await Promise.all([first.dispose(), second.dispose()]);
  }
});
