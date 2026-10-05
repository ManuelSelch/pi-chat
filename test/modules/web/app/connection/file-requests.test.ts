import { afterEach, describe, expect, it, vi } from "vitest";
import { FileRequests } from "../../../../../src/web/app/connection/file-requests.js";
import type { ClientMessage, ServerMessage } from "../../../../../src/shared/protocol.js";
const command = (requestId = "file-1", path = "report.pdf", sessionId = "s1"): Extract<ClientMessage, { type: "openFile" }> => ({ version: 1, type: "openFile", requestId, path, sessionId });
const reply = (requestId = "file-1", sessionId = "s1"): ServerMessage => ({ version: 1, type: "fileOpenResult", requestId, sessionId, result: { ok: true } });
afterEach(() => vi.useRealTimers());

describe("browser file requests", () => {
  it("deduplicates same-file activations but allows unrelated files/sessions", async () => {
    const requests = new FileRequests();
    const send = vi.fn();
    const first = requests.request(command(), send);
    expect(requests.request(command("duplicate"), send)).toBe(first);
    const second = requests.request(command("file-2", "other.pdf"), send);
    const third = requests.request(command("file-3", "report.pdf", "s2"), send);
    expect(send).toHaveBeenCalledTimes(3);
    requests.receive(reply()); requests.receive(reply("file-2")); requests.receive(reply("file-3", "s2"));
    await Promise.all([first, second, third]);
  });

  it("consumes only file replies and requires matching request/session IDs", async () => {
    const requests = new FileRequests();
    const pending = requests.request(command(), vi.fn());
    expect(requests.receive({ version: 1, type: "commandArgumentCompletions", sessionId: "s1", requestId: "file-1", items: [] })).toBe(false);
    expect(requests.receive({ version: 1, type: "directoryBrowseError", requestId: "file-1", error: "Error" })).toBe(false);
    expect(requests.receive(reply("file-1", "s2"))).toBe(true);
    requests.receive({ ...reply(), result: { ok: false, error: { code: "notFound", message: "File not found on the server." } } } as ServerMessage);
    await expect(pending).rejects.toThrow("File not found on the server");
    expect(requests.receive(reply())).toBe(true);
  });

  it("times out without retry and accepts a later explicit activation", async () => {
    vi.useFakeTimers();
    const requests = new FileRequests();
    const send = vi.fn();
    const pending = requests.request(command(), send);
    const rejection = expect(pending).rejects.toThrow("may still open");
    await vi.advanceTimersByTimeAsync(10_000);
    await rejection;
    requests.receive(reply());
    const next = requests.request(command("file-2"), send);
    requests.receive(reply("file-2"));
    await next;
    expect(send).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("bounds pending count and clears all entries/timers on disconnect", async () => {
    vi.useFakeTimers();
    const requests = new FileRequests();
    const send = vi.fn();
    const pending = Array.from({ length: 32 }, (_, index) => requests.request(command(`file-${index}`, `${index}.pdf`), send));
    const rejections = pending.map((promise) => expect(promise).rejects.toMatchObject({ name: "AbortError" }));
    await expect(requests.request(command("overflow", "overflow.pdf"), send)).rejects.toThrow("Too many");
    requests.disconnect();
    await Promise.all(rejections);
    expect(send).toHaveBeenCalledTimes(32);
    expect(vi.getTimerCount()).toBe(0);
    expect(requests.receive(reply())).toBe(true);
  });

  it("cancels only closed sessions, keeping background requests owned by their original sessions", async () => {
    const requests = new FileRequests();
    const first = requests.request(command(), vi.fn());
    const second = requests.request(command("file-2", "report.pdf", "s2"), vi.fn());
    const rejected = expect(first).rejects.toMatchObject({ name: "AbortError" });
    requests.retainSessions(["s2"]);
    await rejected;
    requests.receive(reply("file-2", "s2"));
    await second;
  });

  it("cleans up synchronous send failures", async () => {
    vi.useFakeTimers();
    const requests = new FileRequests();
    await expect(requests.request(command(), () => { throw new Error("Not connected"); })).rejects.toThrow("Not connected");
    expect(vi.getTimerCount()).toBe(0);
    const next = requests.request(command("next"), vi.fn());
    requests.receive(reply("next"));
    await next;
  });
});
