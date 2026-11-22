import { rm } from "node:fs/promises";

// Removed entry points must not survive incremental builds or package packing.
await rm(new URL("../dist/", import.meta.url), { recursive: true, force: true });
