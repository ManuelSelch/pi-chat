import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import Ajv2020 from "ajv/dist/2020.js";
import { clientMessageSchema, serverMessageSchema } from "../src/contract/index.js";
import { contractSchemaSources, generateContractSchemas } from "../scripts/contract-schemas.js";

const protocol = new URL("../../protocol/", import.meta.url);
type Sample = { name: string; schema: keyof typeof contractSchemaSources; input: unknown; output?: unknown };
const load = (file: string): Sample[] => JSON.parse(readFileSync(new URL(`fixtures/v1/${file}`, protocol), "utf8"));
const valid = load("valid.json");
const invalid = load("invalid.json");
const schemas = generateContractSchemas();
const ajv = new Ajv2020.default({ strict: false });
const validators = Object.fromEntries(Object.entries(schemas).map(([name, schema]) => [name, ajv.compile(schema)]));

describe("language-neutral v1 contract", () => {
  it("keeps every checked-in schema current", () => {
    expect(readdirSync(new URL("schema/v1/", protocol)).sort()).toEqual(Object.keys(schemas).map((name) => `${name}.schema.json`).sort());
    for (const [name, schema] of Object.entries(schemas)) {
      expect(JSON.parse(readFileSync(new URL(`schema/v1/${name}.schema.json`, protocol), "utf8"))).toEqual(schema);
    }
  });

  it.each(valid)("accepts $name in Zod and JSON Schema", ({ schema, input, output }) => {
    const result = contractSchemaSources[schema].parse(input);
    expect(validators[schema]!(input), JSON.stringify(validators[schema]!.errors)).toBe(true);
    if (output !== undefined) expect(result).toEqual(output);
  });

  it.each(invalid)("rejects $name in Zod and JSON Schema", ({ schema, input }) => {
    expect(contractSchemaSources[schema].safeParse(input).success).toBe(false);
    expect(validators[schema]!(input)).toBe(false);
  });

  it("covers all 19 client variants and 21 server variants", () => {
    const signature = (value: { type: unknown; featureId?: unknown }) => `${value.type}:${value.featureId ?? ""}`;
    const clients = valid.filter((sample) => sample.schema === "ClientMessage").map((sample) => signature(clientMessageSchema.parse(sample.input)));
    const servers = valid.filter((sample) => sample.schema === "ServerMessage").map((sample) => serverMessageSchema.parse(sample.input).type);
    expect(new Set(clients).size).toBe(19);
    expect(new Set(servers).size).toBe(21);
    for (const option of clientMessageSchema.options) {
      const shape = option.shape;
      expect(clients).toContain(signature({ type: shape.type.value, featureId: "featureId" in shape ? shape.featureId.value : undefined }));
    }
    expect(new Set(servers)).toEqual(new Set(serverMessageSchema.options.map((option) => option.shape.type.value)));
  });
});
