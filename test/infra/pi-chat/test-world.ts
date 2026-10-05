import assert from "node:assert/strict";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AgentSessionRuntime, type ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { createAssistantMessageEventStream, type AssistantMessage } from "@earendil-works/pi-ai";
import { createTestSession, says, when, type TestSession } from "@marcfargas/pi-test-harness";
import type { RuntimeAdapterFactory } from "../../../src/server/runtime/contracts.js";
import { PiRuntimeAdapter } from "../../../src/server/runtime/pi/pi-runtime-adapter.js";

export interface AssistantResponse {
  prompt: string;
  reply: string;
  /** Keep the model result pending until the test explicitly releases it. */
  hold?: boolean;
}

interface OwnedSession {
  harness: TestSession;
  responses: readonly AssistantResponse[];
  adapter: PiRuntimeAdapter;
}

/** Only model responses are mocked; every created adapter hosts a real Pi session. */
export class TestWorld {
  readonly projectPath = realpathSync(mkdtempSync(join(tmpdir(), "pi-chat-driver-")));
  private readonly sessions = new Map<string, OwnedSession>();
  private readonly controlledResponses = new Map<string, () => void>();
  private readonly creating = new Set<Promise<PiRuntimeAdapter>>();
  private reservation?: { responses: readonly AssistantResponse[]; started: boolean };
  private disposed = false;
  private disposal?: Promise<void>;
  private readonly extensions: readonly ExtensionFactory[];

  constructor(extensions: readonly ExtensionFactory[] = []) {
    this.extensions = [...extensions];
  }

  readonly factory: RuntimeAdapterFactory = {
    newSession: async path => {
      assert(!this.disposed, "Test world is disposed");
      assert.equal(realpathSync(path), this.projectPath, "Only the isolated test project may be opened");
      const reservation = this.reservation;
      assert(reservation, "No response script reserved for session creation");
      assert(!reservation.started, "Session creation is already in progress");
      reservation.started = true;
      // Keep the reservation held until the browser has seen success/failure.
      return this.create(reservation.responses);
    },
    continueProject: async () => { throw new Error("Continuing a persisted project is not supported by this driver yet"); },
    openSession: async () => { throw new Error("Reopening persisted sessions is not supported by this driver yet"); },
  };

  reserveSession(responses: readonly AssistantResponse[]): () => void {
    assert(!this.disposed, "Test world is disposed");
    assert(!this.reservation, "Await Tabs.Create before creating another tab");
    const reservation = { responses: responses.map(response => ({ ...response })), started: false };
    this.reservation = reservation;
    return () => { if (this.reservation === reservation) this.reservation = undefined; };
  }

  create(responses: readonly AssistantResponse[]): Promise<PiRuntimeAdapter> {
    assert(!this.disposed, "Test world is disposed");
    const task = this.build(responses.map(response => ({ ...response })));
    this.creating.add(task);
    // Use both callbacks to avoid an unhandled rejected cleanup promise.
    void task.then(() => this.creating.delete(task), () => this.creating.delete(task));
    return task;
  }

  private async build(responses: readonly AssistantResponse[]): Promise<PiRuntimeAdapter> {
    const harness = await createTestSession({ cwd: this.projectPath, extensionFactories: [...this.extensions] });
    let runtime: AgentSessionRuntime | undefined;
    try {
      assert(!this.disposed, "Test world was disposed during session creation");
      harness.prepare(...responses.map(({ prompt, reply }) => when(prompt, [says(reply)])));
      const session = harness.session;
      runtime = new AgentSessionRuntime(session, {
        cwd: harness.cwd, agentDir: harness.cwd,
        modelRuntime: session.modelRuntime,
        settingsManager: session.settingsManager,
        resourceLoader: session.resourceLoader,
        diagnostics: [],
      }, async () => { throw new Error("Runtime replacement is not supported by this driver yet"); });
      const agent = session.agent as {
        streamFunction: (...args: unknown[]) => { result: () => Promise<AssistantMessage> };
      };
      const playbookStream = agent.streamFunction;
      agent.streamFunction = (...args) => {
        const stream = playbookStream(...args);
        const response = responses[harness.playbook.consumed - 1];
        if (!response?.hold) return stream;

        const controlled = createAssistantMessageEventStream();
        let result: AssistantMessage | undefined;
        let released = false;
        let aborted = false;
        const finish = () => {
          if ((!released && !aborted) || !result) return;
          controlled.push(aborted
            ? {
              type: "error",
              reason: "aborted",
              error: { ...result, content: [], stopReason: "aborted" },
            }
            : { type: "done", reason: "stop", message: result });
          this.controlledResponses.set(session.sessionId, () => {});
        };
        void stream.result().then(message => {
          result = message;
          finish();
        });
        const signal = (args[2] as { signal?: AbortSignal } | undefined)?.signal;
        signal?.addEventListener("abort", () => {
          aborted = true;
          finish();
        }, { once: true });
        this.controlledResponses.set(session.sessionId, () => {
          released = true;
          finish();
        });
        return controlled;
      };

      const adapter = PiRuntimeAdapter.fromRuntime(runtime);
      const originalDispose = adapter.dispose.bind(adapter);
      let disposal: Promise<void> | undefined;
      // The server disposes closed tabs; the world also owns cleanup of partial
      // or unregistered sessions. Give both paths the same idempotent disposal.
      adapter.dispose = () => disposal ??= (async () => {
        try { await originalDispose(); }
        finally {
          this.controlledResponses.delete(session.sessionId);
          harness.dispose();
        }
      })();
      this.sessions.set(session.sessionId, { harness, responses, adapter });
      return adapter;
    } catch (error) {
      try { await runtime?.dispose(); }
      finally { harness.dispose(); }
      throw error;
    }
  }

  private session(id: string): OwnedSession {
    const session = this.sessions.get(id);
    assert(session, `No test session for active conversation ${id}`);
    return session;
  }

  remainingResponses(id: string): number { return this.session(id).harness.playbook.remaining; }
  releaseControlledResponse(id: string): void { this.controlledResponses.get(id)?.(); }
  nextPrompt(id: string): string | undefined {
    const { responses, harness } = this.session(id);
    return responses[harness.playbook.consumed]?.prompt.trim();
  }

  dispose(): Promise<void> {
    this.disposal ??= (async () => {
      this.disposed = true;
      // A timed-out create can still be loading. Finish its cleanup before
      // removing the project directory, then release every remaining adapter.
      await Promise.allSettled([...this.creating]);
      const results = await Promise.allSettled([...this.sessions.values()].map(session => session.adapter.dispose()));
      rmSync(this.projectPath, { recursive: true, force: true });
      const failures = results.flatMap(result => result.status === "rejected" ? [result.reason] : []);
      if (failures.length) throw new AggregateError(failures, "Test world cleanup failed");
    })();
    return this.disposal;
  }
}
