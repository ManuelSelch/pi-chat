// Run with: npx tsx scripts/profile-session-open.ts [cwd] [existing-session.jsonl]
// Uses real local settings/extensions; no model prompts. Timings are inclusive.
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { AgentSession, DefaultResourceLoader, ExtensionRunner, ModelRuntime, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import { PiRuntimeAdapter } from "../src/server/runtime/pi/pi-runtime-adapter.js";
import { ProjectSessionService } from "../src/server/projects/project-session-service.js";
import { ChatApplicationService } from "../src/server/application/chat-application-service.js";
import { PiSessionStore, readLatestSessionNameInfo } from "../src/server/projects/pi-session-store.js";
import { WorktreeDiscovery } from "../src/server/projects/worktree-discovery.js";

const rows: { stage: string; ms: number }[] = [];
function wrap(target: any, method: string, label: string) {
  const original = target[method];
  if (typeof original !== "function") throw new Error(`Missing profiling target: ${label}`);
  target[method] = function (...args: any[]) {
    const start = performance.now();
    const record = () => rows.push({ stage: label, ms: performance.now() - start });
    try {
      const result = original.apply(this, args);
      if (result && typeof result.then === "function") return result.finally(record);
      record();
      return result;
    } catch (error) { record(); throw error; }
  };
}
for (const method of ["create", "open"]) wrap(SessionManager, method, `SessionManager.${method}`);
wrap(ModelRuntime, "create", "ModelRuntime.create");
for (const method of ["refresh", "getAvailable", "refreshProviderAvailability"]) wrap(ModelRuntime.prototype, method, `ModelRuntime.${method}`);
for (const method of ["reload", "loadFinalExtensionSet", "loadExtensionPaths"]) wrap(DefaultResourceLoader.prototype, method, `ResourceLoader.${method}`);
wrap(SettingsManager.prototype, "reload", "SettingsManager.reload");
wrap(AgentSession.prototype, "bindExtensions", "AgentSession.bindExtensions");
wrap(ExtensionRunner.prototype, "emit", "ExtensionRunner.emit");
for (const method of ["startExtensions", "refreshModels", "snapshot"]) wrap(PiRuntimeAdapter.prototype, method, `Adapter.${method}`);
wrap(ProjectSessionService.prototype, "catalogue", "Catalogue.refresh");
wrap(PiSessionStore.prototype, "listAll", "Catalogue.listAll");
wrap(WorktreeDiscovery.prototype, "forDirectory", "Catalogue.gitWorktrees");
wrap(ChatApplicationService.prototype, "prepareSnapshot", "App.prepareSnapshot");

const cwd = resolve(process.argv[2] ?? process.cwd());
const selected = process.argv[3] ?? (await SessionManager.listAll()).filter(s => resolve(s.cwd) === cwd).sort((a, b) => b.messageCount - a.messageCount)[0]?.path;
for (const kind of ["new", ...(selected ? ["existing"] : [])]) {
  for (let run = 1; run <= 3; run++) {
    rows.length = 0;
    const start = performance.now();
    const app = new ChatApplicationService(undefined, {
      newSession: PiRuntimeAdapter.newSession,
      openSession: PiRuntimeAdapter.openSession,
      continueProject: PiRuntimeAdapter.create,
    });
    try {
      const sessionId = kind === "new" ? await app.newSession(cwd) : await app.openSession(selected!);
      const ready = performance.now() - start;
      const capture = await app.prepareSnapshot(sessionId);
      const snapshot = capture()!;
      const encodeStart = performance.now();
      const bytes = Buffer.byteLength(JSON.stringify(snapshot));
      rows.push({ stage: "Snapshot.JSON.stringify", ms: performance.now() - encodeStart });
      const firstSnapshotMs = performance.now() - start;
      app.tabs();
      // Match the transport: sendCatalogue follows the first snapshot and tabs.
      await app.currentCatalogue();
      console.log(JSON.stringify({ kind, run, messages: snapshot.messages.length, snapshotBytes: bytes, adapterReadyMs: ready, firstSnapshotMs, totalMs: performance.now() - start, stages: rows }, null, 2));
    } finally { await app.dispose(); }
  }
}
// Isolate the additional sequential JSONL pass used only for title provenance.
for (let run = 1; run <= 3; run++) {
  const sessions = await new PiSessionStore().listAll();
  const start = performance.now();
  for (const session of sessions) await readLatestSessionNameInfo(session.path);
  console.log(JSON.stringify({ kind: "catalogue-name-scan", run, sessions: sessions.length, ms: performance.now() - start }));
}
