import { basename, join, relative } from "node:path";
import { tmpdir } from "node:os";
import { expect, it } from "vitest";
import { getAgentDir, SessionManager } from "@earendil-works/pi-coding-agent";
import { ProjectMetadataStore } from "../../src/server/projects/project-metadata-store.js";

it("redirects default SDK and project metadata paths before test imports", () => {
  const agentDir = getAgentDir();
  expect(basename(agentDir)).toMatch(/^pi-chat-test-agent-/);
  expect(relative(tmpdir(), agentDir)).not.toMatch(/^\.\./);
  expect(agentDir).toBe(process.env.PI_CODING_AGENT_DIR);
  expect(new ProjectMetadataStore().path).toBe(join(agentDir, "pi-chat", "projects.json"));
});

it("starts with an empty user catalogue and project metadata", async () => {
  expect(basename(getAgentDir())).toMatch(/^pi-chat-test-agent-/);
  expect(await SessionManager.listAll()).toEqual([]);
  expect(await new ProjectMetadataStore().read()).toEqual({
    version: 1, pins: [], archives: [], removedProjects: [],
  });
});
