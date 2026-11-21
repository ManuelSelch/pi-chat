import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vitest";

// Setup runs before test modules import the SDK/application. Each test file
// gets its own real storage, even when a worker is reused for another file.
const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
const agentDir = mkdtempSync(join(tmpdir(), "pi-chat-test-agent-"));
process.env.PI_CODING_AGENT_DIR = agentDir;
afterAll(async () => {
  try { await rm(agentDir, { recursive: true, force: true }); }
  finally {
    if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
  }
});
