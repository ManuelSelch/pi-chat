import { expect, expectTypeOf, test } from "vitest";
import { createPluginRuntime } from "@manuelselch/pi-server/plugins";
import counterPlugin from "../../../fixtures/plugins/counter/index.js";
import { counterContract } from "../../../fixtures/plugins/counter/contract.js";

test("counter starts at zero and increments through a typed public client", async () => {
  const runtime = createPluginRuntime([counterPlugin]);
  try {
    await runtime.start();
    const counter = runtime.client(counterContract);

    expectTypeOf(counter.read).parameter(0).toEqualTypeOf<null>();
    expectTypeOf(counter.increment).parameter(0).toEqualTypeOf<null>();
    expectTypeOf(counter.read).returns.resolves.toEqualTypeOf<number>();
    expectTypeOf(counter.increment).returns.resolves.toEqualTypeOf<number>();
    await expect(counter.read(null)).resolves.toBe(0);
    await expect(counter.increment(null)).resolves.toBe(1);
    await expect(counter.read(null)).resolves.toBe(1);
    await expect(counter.increment(null)).resolves.toBe(2);
  } finally {
    await runtime.dispose();
  }
});

test("the same plugin gives each runtime an independent counter", async () => {
  const first = createPluginRuntime([counterPlugin]);
  const second = createPluginRuntime([counterPlugin]);
  try {
    await first.start();
    await expect(first.client(counterContract).increment(null)).resolves.toBe(1);

    await second.start();
    const counter = second.client(counterContract);

    await expect(counter.read(null)).resolves.toBe(0);
    await expect(counter.increment(null)).resolves.toBe(1);
    await expect(first.client(counterContract).read(null)).resolves.toBe(1);

    await first.dispose();

    await expect(counter.increment(null)).resolves.toBe(2);
  } finally {
    await Promise.all([first.dispose(), second.dispose()]);
  }
});

test("counter calls reject after disposal, including an existing client", async () => {
  const runtime = createPluginRuntime([counterPlugin]);
  try {
    await runtime.start();
    const counter = runtime.client(counterContract);
    await expect(counter.read(null)).resolves.toBe(0);

    await runtime.dispose();

    await expect(counter.read(null)).rejects.toThrow("not active");
    await expect(counter.increment(null)).rejects.toThrow("not active");
    await expect(runtime.client(counterContract).read(null)).rejects.toThrow("not active");
  } finally {
    await runtime.dispose();
  }
});

test("counter contract rejects non-null input without changing state", async () => {
  const runtime = createPluginRuntime([counterPlugin]);
  try {
    await runtime.start();
    const counter = runtime.client(counterContract);

    // @ts-expect-error Untyped callers must also respect the null input contract.
    await expect(counter.increment(1)).rejects.toThrow();
    // @ts-expect-error Read has the same null-only input contract.
    await expect(counter.read({})).rejects.toThrow();
    await expect(counter.read(null)).resolves.toBe(0);
  } finally {
    await runtime.dispose();
  }
});

test.each([-1, 0.5, NaN, Infinity, "0", null])("counter contract rejects invalid output %s", value => {
  for (const method of Object.values(counterContract.methods)) {
    expect(() => method.output.parse(value)).toThrow();
  }
});
