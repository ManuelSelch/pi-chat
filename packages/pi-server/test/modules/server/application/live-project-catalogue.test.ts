import { expect, it, vi } from "vitest";
import { ChatApplicationService } from "../../../../src/application/chat-application-service.js";
import { ProjectSessionService } from "../../../../src/projects/project-session-service.js";
import { FakeRuntimeAdapter } from "../../../infra/fake-runtime-adapter.js";

it("discovers directories for every open runtime and removes closed directories", async () => {
  const first = new FakeRuntimeAdapter("first");
  const second = new FakeRuntimeAdapter("second");
  const firstSnapshot = { ...first.snapshot(), projectPath: "/trees/first" };
  const secondSnapshot = { ...second.snapshot(), projectPath: "/trees/second" };
  vi.spyOn(first, "snapshot").mockReturnValue(firstSnapshot);
  vi.spyOn(second, "snapshot").mockReturnValue(secondSnapshot);
  const projects = new ProjectSessionService();
  const catalogue = vi.spyOn(projects, "catalogue").mockResolvedValue({ projects: [] });
  const chat = new ChatApplicationService(first, {
    openSession: async () => second, newSession: async () => second, continueProject: async () => second,
  }, projects);
  try {
    await chat.openSession("/sessions/second.jsonl");

    await chat.currentCatalogue();

    expect(catalogue).toHaveBeenLastCalledWith(undefined, { projectPaths: ["/trees/first", "/trees/second"] });

    await chat.closeTab("second");
    await chat.currentCatalogue({ metadataOnly: true });

    expect(catalogue).toHaveBeenLastCalledWith(undefined, { metadataOnly: true, projectPaths: ["/trees/first"] });
  } finally { await chat.dispose(); }
});
