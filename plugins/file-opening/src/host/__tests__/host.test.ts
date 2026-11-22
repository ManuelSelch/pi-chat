import { afterEach, beforeEach, expect, test, vi, type MockInstance } from "vitest";
import type { RemoteContractImplementation } from "@manuelselch/pi-sdk/plugins";
import { fileOpeningContract } from "../../contract.js";
import { createFileOpeningPlugin, FileService } from "../index.js";

let getSession: ReturnType<typeof vi.fn<(sessionId: string) => Promise<{ projectPath: string }>>>;
let provider: RemoteContractImplementation<typeof fileOpeningContract>;
let open: MockInstance<FileService["open"]>;

beforeEach(async () => {
  getSession = vi.fn().mockResolvedValue({ projectPath: "/named-project" });
  open = vi.spyOn(FileService.prototype, "open").mockResolvedValue({ ok: true });
  const plugin = createFileOpeningPlugin({ getSession });
  const entry = await plugin.host!();
  await entry.setup({
    signal: new AbortController().signal,
    onCleanup: vi.fn(),
    provide: vi.fn((_contract, implementation) => { provider = implementation; }),
  });
});
afterEach(() => vi.restoreAllMocks());

test("host setup does not access sessions or open files", () => {
  expect(getSession).not.toHaveBeenCalled();
  expect(open).not.toHaveBeenCalled();
});

test("the plugin's default service opens relative to the explicitly named session", async () => {
  await expect(provider.open({ sessionId: "named", path: "report.pdf" })).resolves.toEqual({ ok: true });

  expect(getSession).toHaveBeenCalledExactlyOnceWith("named");
  expect(open).toHaveBeenCalledExactlyOnceWith("/named-project", "report.pdf");
});

test("session lookup failures are classified inside the plugin without filesystem access", async () => {
  getSession.mockRejectedValue(new Error("private details"));

  await expect(provider.open({ sessionId: "unavailable", path: "report.pdf" })).resolves.toEqual({
    ok: false, error: { code: "sessionUnavailable", message: "This session is no longer available on the server." },
  });
  expect(open).not.toHaveBeenCalled();
});

test("file validation failures retain their safe structured results", async () => {
  const failure = { ok: false as const, error: { code: "notFound" as const, message: "File not found on the server." } };
  open.mockResolvedValue(failure);

  await expect(provider.open({ sessionId: "named", path: "missing.pdf" })).resolves.toEqual(failure);
});
