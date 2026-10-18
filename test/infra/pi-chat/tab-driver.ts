import assert from "node:assert/strict";
import { check, requireSession, type DriverContext } from "./driver-context.js";
import type { AssistantResponse } from "./test-world.js";

const handleBrand = Symbol("PiChatTab");
/** Opaque product handle; tests never need a session id or a socket. */
export interface TabHandle { readonly [handleBrand]: true }
export interface CreateTabOptions { responses?: readonly AssistantResponse[] }
export interface OpenTabOptions { responses?: readonly AssistantResponse[] }

export class TabDriver {
  private readonly ids = new WeakMap<TabHandle, string>();
  private readonly handles = new Map<string, TabHandle>();
  private changing = false;

  constructor(private readonly context: DriverContext) {}

  private handle(id: string): TabHandle {
    let handle = this.handles.get(id);
    if (!handle) {
      handle = Object.freeze({ [handleBrand]: true as const });
      this.ids.set(handle, id);
      this.handles.set(id, handle);
    }
    return handle;
  }

  private id(tab: TabHandle, operation: string): string {
    const id = this.ids.get(tab);
    check(this.context, operation, () => {
      assert(id, "Tab belongs to another application or is not a valid tab handle");
      assert(this.context.client.appState.tabs.some(tab => tab.sessionId === id), "Tab is already closed");
    });
    return id!;
  }

  private async change<T>(operation: string, work: () => Promise<T>): Promise<T> {
    check(this.context, operation, () => assert(!this.changing, "Await the previous tab operation before starting another"));
    this.changing = true;
    try { return await work(); }
    catch (error) { throw new Error(`${operation}: ${error instanceof Error ? error.message : String(error)}. ${this.context.client.diagnostics()}`, { cause: error }); }
    finally { this.changing = false; }
  }

  async Create(options: CreateTabOptions = {}): Promise<TabHandle> {
    return this.change("Tabs.Create", async () => {
      const { client } = this.context;
      let release!: () => void;
      check(this.context, "Tabs.Create", () => { release = this.context.reserveSession(options.responses ?? []); });
      try {
        const id = await client.create(this.context.projectPath);
        await client.ready("Tabs.Create");
        return this.handle(id);
      } finally { release(); }
    });
  }

  Active(): TabHandle {
    return this.handle(requireSession(this.context, "Tabs.Active"));
  }

  SessionPath(tab: TabHandle = this.Active()): string {
    const id = this.id(tab, "Tabs.SessionPath");
    const path = this.context.client.appState.sessions[id]?.sessionPath;
    check(this.context, "Tabs.SessionPath", () => assert(path, "Session has not been persisted yet"));
    return path!;
  }

  async Open(sessionPath: string, options: OpenTabOptions = {}): Promise<TabHandle> {
    return this.change("Tabs.Open", async () => {
      const { client } = this.context;
      let release!: () => void;
      check(this.context, "Tabs.Open", () => { release = this.context.reserveSession(options.responses ?? []); });
      try {
        const id = await client.open(sessionPath);
        assert(id, "Opened session did not become active");
        await client.ready("Tabs.Open");
        return this.handle(id);
      } finally {
        release();
      }
    });
  }

  async SwitchTo(tab: TabHandle): Promise<void> {
    return this.change("Tabs.SwitchTo", async () => {
      const id = this.id(tab, "Tabs.SwitchTo");
      const { client } = this.context;
      client.focus(id);
      await client.ready("Tabs.SwitchTo");
    });
  }

  async Close(tab: TabHandle): Promise<void> {
    return this.change("Tabs.Close", async () => {
      const id = this.id(tab, "Tabs.Close");
      const { client } = this.context;
      await client.sdk.closeSession(id);
      await client.ready("Tabs.Close");
    });
  }

  ShouldBeActive(tab: TabHandle): void {
    const id = this.id(tab, "Tabs.ShouldBeActive");
    check(this.context, "Tabs.ShouldBeActive", () => assert.equal(this.context.client.appState.activeSessionId, id));
  }

  ShouldContain(tabs: readonly TabHandle[]): void {
    for (const tab of tabs) this.id(tab, "Tabs.ShouldContain");
  }

  ShouldHaveCount(count: number): void {
    check(this.context, "Tabs.ShouldHaveCount", () => assert.equal(this.context.client.appState.tabs.length, count));
  }
}
