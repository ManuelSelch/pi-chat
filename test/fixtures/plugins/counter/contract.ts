import { defineRemoteContract } from "@manuelselch/pi-sdk/plugins";
import { z } from "zod";

export const counterContract = defineRemoteContract({
  id: "test-counter",
  version: 1,
  methods: {
    read: { input: z.null(), output: z.number().int().nonnegative() },
    increment: { input: z.null(), output: z.number().int().nonnegative() },
  },
});
