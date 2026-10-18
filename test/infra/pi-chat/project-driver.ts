import assert from "node:assert/strict";
import type { DirectoryListing } from "../../../src/shared/directories.js";
import { check, type DriverContext } from "./driver-context.js";

/** Server-folder workflows exposed using product vocabulary. */
export class ProjectDriver {
  constructor(private readonly context: DriverContext) {}

  async Browse(path = this.context.projectPath): Promise<DirectoryListing> {
    const { client } = this.context;
    return client.sdk.browseDirectories({ path });
  }

  async Open(path = this.context.projectPath): Promise<void> {
    const { client } = this.context;
    let release!: () => void;
    check(this.context, "Projects.Open", () => { release = this.context.reserveSession([]); });
    try {
      await client.create(path);
      await client.ready("Projects.Open");
    } finally {
      release();
    }
  }

  ShouldRemainAtHome(): void {
    check(this.context, "Projects.ShouldRemainAtHome", () => {
      assert.equal(this.context.client.appState.activeSessionId, "");
      assert.equal(this.context.client.appState.tabs.length, 0);
    });
  }

  ShouldBeOpen(path = this.context.projectPath): void {
    check(this.context, "Projects.ShouldBeOpen", () => {
      const active = this.context.client.appState.activeSessionId;
      assert(active, "Expected an open project session");
      assert.equal(this.context.client.appState.sessions[active]?.projectPath, path);
    });
  }
}
