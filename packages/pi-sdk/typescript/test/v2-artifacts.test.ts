import { readFile } from "node:fs/promises";
import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { requestSchema, serverMessageSchema, operationSchemas, parseResponse } from "../src/protocol/v2.js";
import { generateV2Schemas } from "../scripts/v2-contract-schemas.js";
import { validExamples } from "./v2-fixture-examples.js";

const root = new URL("../../protocol/", import.meta.url);
const schemas = generateV2Schemas();
const ajv = new Ajv2020({ strict: false, allErrors: true });
const compiled = Object.fromEntries(Object.entries(schemas).map(([name, schema]) => [name, ajv.compile(schema)]));
const examples = validExamples();

describe("shared v2 contract artifacts", () => {
  it("checks generated schemas and fixtures for drift", async () => {
    for (const [name, schema] of Object.entries(schemas)) expect(JSON.parse(await readFile(new URL(`schema/v2/${name}.schema.json`, root), "utf8"))).toEqual(schema);
    expect(JSON.parse(await readFile(new URL("fixtures/v2/valid.json", root), "utf8"))).toEqual(examples);
  });

  it.each(examples.operations)("validates $method inputs, typed results and structured errors with Zod and JSON Schema", ({ method, request, response, rejection }) => {
    expect(requestSchema.safeParse(request).success).toBe(true);
    expect(compiled.Request!(request)).toBe(true);
    for (const input of [response, rejection]) {
      expect(parseResponse(method, input).ok).toBe(input.ok);
      expect(serverMessageSchema.safeParse(input).success).toBe(true);
      expect(compiled.ServerMessage!(input)).toBe(true);
    }
    const resultSchema = operationSchemas[method].result;
    expect(resultSchema.safeParse(response.result).success).toBe(true);
    expect(compiled[`result.${method}`]!(response.result)).toBe(true);
    for (const result of [null, {}, { state: "unknown" }]) {
      expect(resultSchema.safeParse(result).success).toBe(false);
      expect(compiled[`result.${method}`]!(result)).toBe(false);
    }
    for (const invalid of [{ ...request, version: 1 }, { ...request, params: null }, { ...request, requestId: "" }]) {
      expect(requestSchema.safeParse(invalid).success).toBe(false);
      expect(compiled.Request!(invalid)).toBe(false);
    }
  });

  it.each(examples.events)("validates $event and rejects missing required data", (event) => {
    expect(serverMessageSchema.safeParse(event).success).toBe(true);
    expect(compiled.ServerMessage!(event)).toBe(true);
    for (const input of [{ ...event, data: {} }, { ...event, data: null }, { ...event, serverInstanceId: "" }]) {
      expect(serverMessageSchema.safeParse(input).success).toBe(false);
      expect(compiled.ServerMessage!(input)).toBe(false);
    }
  });

  it("keeps additive optional fields and unselected future capabilities forward compatible", () => {
    const init = examples.operations.find((operation) => operation.method === "server.initialize")!.request;
    const parsed = requestSchema.parse({ ...init, future: {}, params: { ...init.params, capabilities: ["future.optional"], future: true } });
    expect(parsed.method === "server.initialize" && parsed.params.capabilities).toEqual(["future.optional"]);
    const response = { ...examples.protocolError, future: { x: true } };
    expect(serverMessageSchema.safeParse(response).success).toBe(true);
    expect(compiled.ServerMessage!(response)).toBe(true);
  });
});
