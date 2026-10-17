import { mkdir, writeFile } from "node:fs/promises";
import { generateContractSchemas } from "./contract-schemas.js";

const directory = new URL("../../protocol/schema/v1/", import.meta.url);
await mkdir(directory, { recursive: true });
for (const [name, schema] of Object.entries(generateContractSchemas())) {
  await writeFile(new URL(`${name}.schema.json`, directory), `${JSON.stringify(schema, null, 2)}\n`);
}
