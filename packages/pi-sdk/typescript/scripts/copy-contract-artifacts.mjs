import { cp, rm } from "node:fs/promises";

const destination = new URL("../dist/protocol/", import.meta.url);
await rm(destination, { recursive: true, force: true });
await cp(new URL("../../protocol/", import.meta.url), destination, { recursive: true });
