import { once } from "node:events";
import { mkdtemp, mkdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import WebSocket from "ws";
import { expect } from "vitest";
import { PiClient, createWebSocketTransport } from "@manuelselch/pi-sdk";
import { folderOpeningContract } from "@manuelselch/pi-plugin-folder-opening";
import { createPiServer, type PiServer } from "../../src/index.js";
import { createFolderOpeningPlugin } from "@manuelselch/pi-plugin-folder-opening/host";

export class FolderOpeningPluginDriver {
  private server?: PiServer;
  private client?: PiClient;
  private folder?: string;

  async start(expose = true): Promise<void> {
    this.folder = await mkdtemp(join(tmpdir(), "pi-folder-plugin-"));
    await Promise.all(["visible", ".hidden"].map(name => mkdir(join(this.folder!, name))));
    this.folder = await realpath(this.folder);
    this.server = await createPiServer({
      plugins: [createFolderOpeningPlugin()],
      pluginRpcContracts: expose ? [folderOpeningContract] : [],
      catalogue: { homeDirectory: null, lister: { listAll: async () => [] } },
    });
    this.server.httpServer.listen(0, "127.0.0.1");
    await once(this.server.httpServer, "listening");
    this.client = new PiClient({
      endpoint: `ws://127.0.0.1:${(this.server.httpServer.address() as AddressInfo).port}/ws`,
      transport: createWebSocketTransport(url => new WebSocket(url)),
    });
    this.client.start();
    await expect.poll(() => this.client!.getState().connection.phase).toBe("ready");
  }

  async shouldBrowseWithoutCreatingSession(): Promise<void> {
    const folders = this.client!.plugin(folderOpeningContract);
    await expect(folders.browse({ path: this.folder! })).resolves.toMatchObject({
      ok: true, listing: { path: this.folder, entries: [{ name: "visible" }] },
    });
    const hidden = await folders.browse({ path: this.folder!, showHidden: true });
    expect(hidden.ok && hidden.listing.entries.map(entry => entry.name)).toEqual([".hidden", "visible"]);
    await expect(folders.browse({ path: "visible", basePath: this.folder! })).resolves.toMatchObject({
      ok: true, listing: { path: join(this.folder!, "visible"), parentPath: this.folder, entries: [] },
    });
    expect(this.client!.getState().inventory).toEqual([]);
  }

  async shouldPreserveActionableFailures(): Promise<void> {
    const folders = this.client!.plugin(folderOpeningContract);
    await expect(folders.browse({ path: join(this.folder!, "missing") })).resolves.toMatchObject({
      ok: false, error: { code: "notFound", message: "Folder not found. It may have moved or been deleted." },
    });
    await expect(folders.browse({ path: this.folder!, cursor: "removed" })).resolves.toMatchObject({
      ok: false, error: { code: "listingChanged", message: "Folder listing changed. Refresh to continue." },
    });
  }

  async shouldRequireExplicitExposure(): Promise<void> {
    await expect(this.client!.plugin(folderOpeningContract).browse({ path: this.folder! })).rejects.toMatchObject({ code: "unsupportedOperation" });
  }

  async dispose(): Promise<void> {
    this.client?.dispose();
    await this.server?.close();
    if (this.folder) await rm(this.folder, { recursive: true, force: true });
  }
}
