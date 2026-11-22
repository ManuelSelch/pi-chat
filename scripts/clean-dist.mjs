import { rm } from "node:fs/promises";
import { resolve } from "node:path";

// npm runs package scripts from the owning workspace, not this script directory.
await rm(resolve("dist"), { recursive: true, force: true });
