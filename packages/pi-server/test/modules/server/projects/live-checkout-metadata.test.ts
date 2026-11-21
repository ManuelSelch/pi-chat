import { join } from "node:path";
import { tmpdir } from "node:os";
import { beforeEach, expect, it, vi } from "vitest";
import { ProjectMetadataStore } from "../../../../src/projects/project-metadata-store.js";
import { ProjectSessionService } from "../../../../src/projects/project-session-service.js";

let service: ProjectSessionService;
let listAll: ReturnType<typeof vi.fn>;
let forDirectory: ReturnType<typeof vi.fn>;
beforeEach(() => {
  listAll = vi.fn(async () => []);
  forDirectory = vi.fn(async (path: string) => ({
    repositoryPath: path === "/trees/other" ? "/repos/other" : "/repos/project",
    worktrees: [
      { path: path === "/trees/other" ? "/repos/other" : "/repos/project", branch: "main", detached: false, primary: true },
      { path, branch: "feature/setup", detached: false, primary: false },
    ],
  }));
  service = new ProjectSessionService({ listAll }, undefined, { forDirectory },
    new ProjectMetadataStore(join(tmpdir(), `live-checkouts-${crypto.randomUUID()}.json`)), null);
});

it("discovers all live checkout directories without inventing saved sessions", async () => {
  const catalogue = await service.catalogue(undefined, { projectPaths: ["/trees/fresh", "/trees/other"] });

  expect(catalogue.projects.find(project => project.path === "/trees/fresh")).toMatchObject({
    repositoryName: "project", repositoryPath: "/repos/project",
    worktree: { branch: "feature/setup", primary: false }, sessions: [], sessionCount: 0,
  });
  expect(catalogue.projects.find(project => project.path === "/trees/other")).toMatchObject({ repositoryName: "other", sessions: [] });
});

it("reuses checkout discovery for metadata mutations while a runtime remains open", async () => {
  await service.catalogue(undefined, { projectPaths: ["/trees/fresh"] });
  forDirectory.mockClear();
  listAll.mockClear();

  const catalogue = await service.catalogue(undefined, { projectPaths: ["/trees/fresh"], metadataOnly: true });

  expect(catalogue.projects.find(project => project.path === "/trees/fresh")?.repositoryName).toBe("project");
  expect(forDirectory).not.toHaveBeenCalled();
  expect(listAll).not.toHaveBeenCalled();
});

it("discovers a new live directory even when a metadata-only refresh was requested", async () => {
  await service.catalogue();

  const catalogue = await service.catalogue(undefined, { projectPaths: ["/trees/fresh"], metadataOnly: true });

  expect(catalogue.projects.find(project => project.path === "/trees/fresh")?.repositoryName).toBe("project");
});

it("drops runtime-only checkout groups after their last runtime closes", async () => {
  await service.catalogue(undefined, { projectPaths: ["/trees/fresh"] });

  const catalogue = await service.catalogue(undefined, { projectPaths: [], metadataOnly: true });

  expect(catalogue.projects).toEqual([]);
});

it("retains a live non-git folder without inventing worktree identity", async () => {
  forDirectory.mockResolvedValue(undefined);

  const catalogue = await service.catalogue(undefined, { projectPaths: ["/folders/plain"] });

  expect(catalogue.projects).toHaveLength(1);
  expect(catalogue.projects[0]).toMatchObject({ path: "/folders/plain", name: "plain", sessions: [], sessionCount: 0 });
  expect(catalogue.projects[0]?.worktree).toBeUndefined();
});
