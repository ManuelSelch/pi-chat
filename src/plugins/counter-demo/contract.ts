import { defineRemoteContract } from "@manuelselch/pi-sdk/plugins";

const nullInput = {
  parse(value: unknown): null {
    if (value !== null) throw new Error("Expected null.");
    return null;
  },
};
const countOutput = {
  parse(value: unknown): number {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("Expected a nonnegative integer.");
    return value;
  },
};

/** Demo-owned contract, matching the Server's test counter; never an SDK built-in. */
export const counterContract = defineRemoteContract({
  id: "test-counter",
  version: 1,
  methods: {
    read: { input: nullInput, output: countOutput },
    increment: { input: nullInput, output: countOutput },
  },
});
