import { rm } from "node:fs/promises";
// Removed wire implementations must not survive incremental tsc output in packs.
await rm(new URL("../dist/", import.meta.url), { recursive: true, force: true });
