import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import Ajv2020 from "ajv/dist/2020.js";
import { v2SchemaSources, generateV2Schemas } from "../scripts/v2-contract-schemas.js";
import { domainExamples, invalidExamples } from "./v2-fixture-examples.js";
type Sample = { name: string; schema: keyof typeof v2SchemaSources; input: unknown };
const read = (file: string): Sample[] => JSON.parse(readFileSync(new URL(`../protocol/fixtures/v2/${file}.json`, import.meta.url), "utf8"));

const schemas = generateV2Schemas(); const ajv = new Ajv2020.default({ strict: false });
const validators = Object.fromEntries(Object.entries(schemas).map(([name, schema]) => [name, ajv.compile(schema)]));
it("keeps domain and malformed fixtures generated from their checked-in source", () => {
  expect(read("domain-valid")).toEqual(domainExamples); expect(read("invalid")).toEqual(invalidExamples);
});
it.each(read("domain-valid"))("accepts shared v2 domain fixture $name in Zod and JSON Schema", ({ schema, input }) => {
  expect(v2SchemaSources[schema].safeParse(input).success).toBe(true); expect(validators[schema]!(input)).toBe(true);
});
it.each(read("invalid"))("rejects shared malformed v2 fixture $name in Zod and JSON Schema", ({ schema, input }) => {
  expect(v2SchemaSources[schema].safeParse(input).success).toBe(false); expect(validators[schema]!(input)).toBe(false);
});
