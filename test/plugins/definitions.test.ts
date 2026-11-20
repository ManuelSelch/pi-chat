import { expect, expectTypeOf, test, vi } from "vitest";
import { filePathSchema, fileOpenResultSchema } from "../../src/protocol/index.js";
import { definePlugin, defineRemoteContract, type RemoteContractClient } from "../../src/plugins/index.js";

const defineFiles = () => defineRemoteContract({
  id: "files.opening",
  version: 1,
  methods: { open: { input: filePathSchema, output: fileOpenResultSchema } },
});

test("infers remote method input and output from schemas", () => {
  const contract = defineFiles();

  expectTypeOf<RemoteContractClient<typeof contract>["open"]>().parameter(0).toEqualTypeOf<string>();
  expectTypeOf<RemoteContractClient<typeof contract>["open"]>().returns.resolves.toEqualTypeOf<ReturnType<typeof fileOpenResultSchema.parse>>();
  expect(contract.methods.open.input.parse("readme.md")).toBe("readme.md");
});

test.each(["", "has spaces", ".files", "files..open", "files/"])("rejects invalid contract identity %j", (id) => {
  expect(() => defineRemoteContract({ ...defineFiles(), id })).toThrow("Invalid contract id");
});

test.each([0, -1, 1.5, NaN, Infinity])("rejects invalid contract version %j", (version) => {
  expect(() => defineRemoteContract({ ...defineFiles(), version })).toThrow("positive safe integer");
});

test("rejects a contract without methods", () => {
  expect(() => defineRemoteContract({ id: "files", version: 1, methods: {} })).toThrow("at least one method");
});

test("rejects malformed method schemas", () => {
  const invalid = { input: {}, output: fileOpenResultSchema };

  // @ts-expect-error Runtime validation also protects JavaScript callers.
  expect(() => defineRemoteContract({ id: "files", version: 1, methods: { open: invalid } })).toThrow("parse");
});

test("copies and freezes declaration structure without freezing caller schemas", () => {
  const methods = { open: { input: filePathSchema, output: fileOpenResultSchema } };
  const contract = defineRemoteContract({ id: "files", version: 1, methods });

  expect(contract.methods).not.toBe(methods);
  expect(contract.methods.open).not.toBe(methods.open);
  expect(Object.isFrozen(contract)).toBe(true);
  expect(Object.isFrozen(contract.methods.open)).toBe(true);
  expect(Object.isFrozen(methods)).toBe(false);
});

test("defines a plugin without loading its entries", () => {
  const host = vi.fn(async () => ({ setup() {} }));
  const contract = defineFiles();
  const plugin = definePlugin({ id: "files", provides: [contract], host });

  expect(plugin.id).toBe("files");
  expect(plugin.provides[0]).toBe(contract);
  expect(host).not.toHaveBeenCalled();
  expect(Object.isFrozen(plugin)).toBe(true);
  expect(Object.isFrozen(plugin.provides)).toBe(true);
});

test("allows web-only plugins and contracts required from another plugin", () => {
  const plugin = definePlugin({ id: "viewer", requires: [defineFiles()], web: async () => ({ setup() {} }) });

  expect(plugin.requires[0]?.id).toBe("files.opening");
});

test("rejects plugins with no entries or invalid identities", () => {
  expect(() => definePlugin({ id: "files" })).toThrow("at least one entry");
  expect(() => definePlugin({ id: "bad id", host: async () => ({ setup() {} }) })).toThrow("Invalid plugin id");
});

test("rejects provided contracts outside the plugin namespace", () => {
  expect(() => definePlugin({ id: "viewer", provides: [defineFiles()], web: async () => ({ setup() {} }) })).toThrow("namespace");
});

test("rejects duplicate contract declarations", () => {
  const contract = defineFiles();

  expect(() => definePlugin({ id: "files", provides: [contract, contract], host: async () => ({ setup() {} }) })).toThrow("Duplicate");
});
