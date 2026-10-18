import { mkdir, writeFile } from "node:fs/promises";
import { generateV2Schemas } from "./v2-contract-schemas.js";
import { validExamples, domainExamples, invalidExamples } from "../test/v2-fixture-examples.js";

const root = new URL("../../protocol/", import.meta.url);
await mkdir(new URL("schema/v2/", root), { recursive: true });
await mkdir(new URL("fixtures/v2/", root), { recursive: true });
for (const [name, schema] of Object.entries(generateV2Schemas())) {
  await writeFile(new URL(`schema/v2/${name}.schema.json`, root), `${JSON.stringify(schema, null, 2)}\n`);
}
await writeFile(new URL("fixtures/v2/valid.json", root), `${JSON.stringify(validExamples(), null, 2)}\n`);
await writeFile(new URL("fixtures/v2/domain-valid.json", root), `${JSON.stringify(domainExamples, null, 2)}\n`);
await writeFile(new URL("fixtures/v2/invalid.json", root), `${JSON.stringify(invalidExamples, null, 2)}\n`);
