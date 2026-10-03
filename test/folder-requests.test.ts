import { describe, expect, it, vi } from "vitest";
import { FolderRequests } from "../src/web/projects/folder-requests.js";

describe("folder request correlation", () => {
  it("matches only the corresponding response, ignoring unrelated operations", async () => {
    const requests = new FolderRequests();
    const send = vi.fn();
    const pending = requests.request({ version: 1, type: "browseDirectories", path: "~", requestId: "a" }, send);
    expect(send).toHaveBeenCalledOnce();
    requests.receive({ version: 1, type: "sessionOpened", requestId: "other", sessionId: "s" });
    requests.receive({ version: 1, type: "directoryListing", requestId: "a", listing: { path: "/home", breadcrumbs: [], entries: [] } });
    await expect(pending).resolves.toMatchObject({ type: "directoryListing" });
  });
  it("rejects app-level errors and releases disconnected requests", async () => {
    const requests = new FolderRequests();
    const failed = requests.request({ version: 1, type: "newSession", requestId: "a" }, vi.fn());
    requests.receive({ version: 1, type: "sessionOpenError", requestId: "a", error: "Permission denied" });
    await expect(failed).rejects.toThrow("Permission denied");
    const pending = requests.request({ version: 1, type: "browseDirectories", requestId: "b", path: "~" }, vi.fn());
    requests.disconnect();
    await expect(pending).rejects.toThrow("Connection lost");
  });
  it("drops aborted/stale replies and allows a later request", async () => {
    const requests = new FolderRequests();
    const abort = new AbortController();
    const pending = requests.request({ version: 1, type: "browseDirectories", requestId: "old", path: "~" }, vi.fn(), abort.signal);
    abort.abort();
    await expect(pending).rejects.toThrow("cancelled");
    expect(requests.receive({ version: 1, type: "directoryBrowseError", requestId: "old", error: "late" })).toBe(true);
    const next = requests.request({ version: 1, type: "newSession", requestId: "next" }, vi.fn());
    requests.receive({ version: 1, type: "sessionOpened", requestId: "next", sessionId: "s" });
    await expect(next).resolves.toMatchObject({ sessionId: "s" });
  });
});
