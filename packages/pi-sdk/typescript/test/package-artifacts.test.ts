import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("exports neutral schemas and fixtures with the SDK distribution", () => {
  const schema = JSON.parse(readFileSync(new URL(import.meta.resolve("@manuelselch/pi-sdk/protocol/schema/v1/ClientMessage.schema.json")), "utf8"));
  const samples = JSON.parse(readFileSync(new URL(import.meta.resolve("@manuelselch/pi-sdk/protocol/fixtures/v1/valid.json")), "utf8"));
  expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
  expect(samples.some((sample: { schema: string }) => sample.schema === "ClientMessage")).toBe(true);
});
