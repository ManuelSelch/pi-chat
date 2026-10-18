import { mkdir, writeFile } from "node:fs/promises";
import { generateSwiftProbe } from "./swift-probe.js";

const directory = new URL("../../experiments/swift-generation/Sources/", import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL("GeneratedModels.swift", directory), await generateSwiftProbe());
