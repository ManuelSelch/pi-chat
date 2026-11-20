import { expect, test, vi } from "vitest";
import { createFileOpeningPlugin } from "../../../../src/plugins/file-opening/index.js";
import { createPluginRuntime } from "../../../../src/plugins/runtime.js";
import { fileOpeningContract } from "@manuelselch/pi-sdk/plugins/file-opening";

test("provides file opening through the injected server action", async () => {
  const open = vi.fn().mockResolvedValue({ ok: true });
  const runtime = createPluginRuntime([createFileOpeningPlugin({ open })]);
  await runtime.start();
  try {
    await expect(runtime.client(fileOpeningContract).open({ sessionId: "first", path: "../report.pdf" })).resolves.toEqual({ ok: true });
    expect(open).toHaveBeenCalledExactlyOnceWith("first", "../report.pdf");
  } finally { await runtime.dispose(); }
});

test("preserves structured file failures and validates inputs before side effects", async () => {
  const failure = { ok: false, error: { code: "notFound", message: "File not found on the server." } };
  const open = vi.fn().mockResolvedValue(failure);
  const runtime = createPluginRuntime([createFileOpeningPlugin({ open })]);
  await runtime.start();
  try {
    await expect(runtime.client(fileOpeningContract).open({ sessionId: "missing", path: "report.pdf" })).resolves.toEqual(failure);
    await expect(runtime.client(fileOpeningContract).open({ sessionId: "", path: "report.pdf" })).rejects.toThrow();
    expect(open).toHaveBeenCalledTimes(1);
  } finally { await runtime.dispose(); }
});
