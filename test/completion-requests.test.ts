import { describe, expect, it, vi } from "vitest";
import { CompletionRequests } from "../src/web/app/connection/completion-requests.js";

describe("completion requests", () => {
  it("correlates replies and leaves folder replies alone", async () => {
    const requests = new CompletionRequests();
    const pending = requests.request({ version: 1, type: "completeCommandArguments", sessionId: "s", requestId: "c1", commandName: "deploy", argumentPrefix: "st" }, vi.fn());
    expect(requests.receive({ version: 1, type: "sessionOpened", requestId: "c1", sessionId: "s" })).toBe(false);
    requests.receive({ version: 1, type: "commandArgumentCompletions", sessionId: "s", requestId: "other", items: [] });
    requests.receive({ version: 1, type: "commandArgumentCompletions", sessionId: "s", requestId: "c1", items: [{ value: "staging", label: "Staging" }] });
    await expect(pending).resolves.toEqual([{ value: "staging", label: "Staging" }]);
  });
  it("rejects errors and cancels on abort or disconnect", async () => {
    const requests = new CompletionRequests();
    const command = { version: 1 as const, type: "completeCommandArguments" as const, sessionId: "s", requestId: "c1", commandName: "deploy", argumentPrefix: "" };
    const failed = requests.request(command, vi.fn());
    requests.receive({ version: 1, type: "commandArgumentCompletions", sessionId: "s", requestId: "c1", items: [], error: "Unavailable" });
    await expect(failed).rejects.toThrow("Unavailable");
    const abort = new AbortController();
    const cancelled = requests.request(command, vi.fn(), abort.signal);
    abort.abort();
    await expect(cancelled).rejects.toThrow("cancelled");
    const disconnected = requests.request(command, vi.fn());
    requests.disconnect();
    await expect(disconnected).rejects.toThrow("Connection lost");
  });
});
