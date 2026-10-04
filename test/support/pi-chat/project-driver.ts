import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { DirectoryListing } from "../../../src/shared/directories.js";
import { PROTOCOL_VERSION, type ServerMessage } from "../../../src/shared/protocol.js";
import { check, type DriverContext } from "./driver-context.js";

/** Server-folder workflows exposed using product vocabulary. */
export class ProjectDriver {
  constructor(private readonly context: DriverContext) {}

  async Browse(path = this.context.projectPath): Promise<DirectoryListing> {
    const { client } = this.context;
    const requestId = randomUUID();
    const after = client.mark();
    client.send({ version: PROTOCOL_VERSION, type: "browseDirectories", path, requestId });
    const reply = await client.waitForMessage("Projects.Browse", "directory browse result", after, message =>
      (message.type === "directoryListing" || message.type === "directoryBrowseError") && message.requestId === requestId) as Extract<ServerMessage, { type: "directoryListing" | "directoryBrowseError" }>;
    if (reply.type === "directoryBrowseError") {
      throw new Error(`Projects.Browse: ${reply.error}. ${client.diagnostics()}`);
    }
    return reply.listing;
  }

  async Open(path = this.context.projectPath): Promise<void> {
    const { client } = this.context;
    let release!: () => void;
    check(this.context, "Projects.Open", () => { release = this.context.reserveSession([]); });
    try {
      const requestId = randomUUID();
      const after = client.mark();
      client.send({ version: PROTOCOL_VERSION, type: "newSession", path, requestId });
      const reply = await client.waitForMessage("Projects.Open", "project opening result", after, message =>
        (message.type === "sessionOpened" || message.type === "sessionOpenError") && message.requestId === requestId) as Extract<ServerMessage, { type: "sessionOpened" | "sessionOpenError" }>;
      if (reply.type === "sessionOpenError") {
        throw new Error(`Projects.Open: ${reply.error}. ${client.diagnostics()}`);
      }
      const sessionId = reply.sessionId;
      await client.waitForMessage("Projects.Open", "opened project tab", after, message =>
        message.type === "tabs" && message.activeSessionId === sessionId && message.tabs.some(tab => tab.sessionId === sessionId));
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
