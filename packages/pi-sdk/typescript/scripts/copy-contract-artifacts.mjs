import { cp, rm } from "node:fs/promises";

for (const directory of ["schema", "fixtures"]) {
  const destination = new URL(`../dist/protocol/${directory}/`, import.meta.url);
  await rm(destination, { recursive: true, force: true });
  await cp(new URL(`../../protocol/${directory}/`, import.meta.url), destination, { recursive: true });
}
