import { once } from "node:events";
import { mkdtemp, mkdir, writeFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import WebSocket from "ws";
import { expect } from "vitest";
import { PiClient, createWebSocketTransport } from "@manuelselch/pi-sdk";
import { fileOpeningContract } from "@manuelselch/pi-plugin-file-opening";
import { createPiServer, type PiServer } from "../../src/index.js";
import { createFileOpeningPlugin } from "@manuelselch/pi-plugin-file-opening/host";
import { FakeRuntimeAdapter } from "../../src/testing/fake-runtime-adapter.js";
import { FileService } from "@manuelselch/pi-plugin-file-opening/host";
import { FileOpenError } from "@manuelselch/pi-plugin-file-opening/host";

class FileRuntime extends FakeRuntimeAdapter {
  constructor(id: string, private readonly directory: string) { super(id); }
  override snapshot() { return { ...super.snapshot(), projectPath: this.directory }; }
}

export class FileOpeningPluginDriver {
  private server?: PiServer;
  private client?: PiClient;
  private folder?: string;
  private sessions: string[] = [];
  private opened: string[] = [];
  private unsupported = false;

  async start(expose = true): Promise<void> {
    this.folder = await mkdtemp(join(tmpdir(), "pi-file-plugin-"));
    for (const name of ["first", "second"]) {
      await mkdir(join(this.folder, name));
      await writeFile(join(this.folder, name, "report.pdf"), "harmless fixture");
    }
    let nextId = 0;
    const runtime = async (path: string) => new FileRuntime(`file-${++nextId}`, path);
    this.server = await createPiServer({
      plugins: services => [createFileOpeningPlugin(services, new FileService({ open: async path => {
        if (this.unsupported) throw new FileOpenError("unsupported", "Opening files on the server is currently supported only on macOS.");
        this.opened.push(path);
      } }))],
      pluginRpcContracts: expose ? [fileOpeningContract] : [],
      runtimeFactory: { newSession: runtime, continueProject: runtime, openSession: runtime },
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
    for (const name of ["first", "second"])
      this.sessions.push(await this.client.createSession(join(this.folder, name)));
  }

  async shouldOpenNamedSession(index: number): Promise<void> {
    await expect(this.client!.plugin(fileOpeningContract).open({ sessionId: this.sessions[index]!, path: "report.pdf" })).resolves.toEqual({ ok: true });
    expect(this.opened.at(-1)).toBe(await realpath(join(this.folder!, index === 0 ? "first" : "second", "report.pdf")));
  }

  async shouldRejectFile(path: string, code: string): Promise<void> {
    const count = this.opened.length;
    await expect(this.client!.plugin(fileOpeningContract).open({ sessionId: this.sessions[0]!, path })).resolves.toMatchObject({ ok: false, error: { code } });
    expect(this.opened).toHaveLength(count);
  }

  async shouldRejectRawAdapterId(): Promise<void> {
    await expect(this.client!.plugin(fileOpeningContract).open({ sessionId: "file-1", path: "report.pdf" })).resolves.toMatchObject({ ok: false, error: { code: "sessionUnavailable" } });
    expect(this.opened).toEqual([]);
  }

  async shouldRejectUnavailableSession(): Promise<void> {
    await this.client!.closeSession(this.sessions[0]!);
    await this.shouldRejectFile("report.pdf", "sessionUnavailable");
  }

  async shouldRejectUnsupportedPlatform(): Promise<void> {
    this.unsupported = true;
    await this.shouldRejectFile("report.pdf", "unsupported");
  }

  async shouldRequireExplicitExposure(): Promise<void> {
    await expect(this.client!.plugin(fileOpeningContract).open({ sessionId: this.sessions[0]!, path: "report.pdf" })).rejects.toMatchObject({ code: "unsupportedOperation" });
    expect(this.opened).toEqual([]);
  }

  async dispose(): Promise<void> {
    this.client?.dispose();
    await this.server?.close();
    if (this.folder) await rm(this.folder, { recursive: true, force: true });
  }
}
