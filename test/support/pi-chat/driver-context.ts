import assert from "node:assert/strict";
import type { BrowserClient } from "./browser-client.js";
import type { AssistantResponse } from "./test-world.js";

/** Shared infrastructure, not part of the workflow-test API. */
export interface DriverContext {
  client: BrowserClient;
  readonly projectPath: string;
  reserveSession(responses: readonly AssistantResponse[]): () => void;
  reconnect(): Promise<void>;
  remainingResponses(): number;
  nextPrompt(): string | undefined;
  releaseControlledResponse(): void;
}

export function check(context: DriverContext, operation: string, assertion: () => void): void {
  try { assertion(); }
  catch (error) {
    throw new Error(`${operation}: ${error instanceof Error ? error.message : String(error)}. ${context.client.diagnostics()}`, { cause: error });
  }
}

export function requireSession(context: DriverContext, operation: string): string {
  const id = context.client.appState.activeSessionId;
  check(context, operation, () => assert(id, "No active conversation"));
  return id;
}
