import { expect, test, vi } from "vitest";
import { createFileOpeningPlugin } from "@manuelselch/pi-plugin-file-opening/host";
import { createPluginRuntime } from "../../../../src/plugins/runtime.js";
import { fileOpeningContract } from "@manuelselch/pi-plugin-file-opening";

test("plugin resolves the requested session and owns file opening", async () => {
  const getSession = vi.fn().mockResolvedValue({ projectPath: "/first" });
  const open = vi.fn().mockResolvedValue({ ok: true });
  const runtime = createPluginRuntime([createFileOpeningPlugin({ getSession }, { open })]);
  await runtime.start();
  try {
    await expect(runtime.client(fileOpeningContract).open({ sessionId: "first", path: "../report.pdf" })).resolves.toEqual({ ok: true });
    expect(getSession).toHaveBeenCalledExactlyOnceWith("first");
    expect(open).toHaveBeenCalledExactlyOnceWith("/first", "../report.pdf");
  } finally { await runtime.dispose(); }
});

test("preserves file failures and validates input before resolving a session", async () => {
  const failure = { ok: false, error: { code: "notFound", message: "File not found on the server." } };
  const getSession = vi.fn().mockResolvedValue({ projectPath: "/first" });
  const open = vi.fn().mockResolvedValue(failure);
  const runtime = createPluginRuntime([createFileOpeningPlugin({ getSession }, { open })]);
  await runtime.start();
  try {
    await expect(runtime.client(fileOpeningContract).open({ sessionId: "first", path: "report.pdf" })).resolves.toEqual(failure);
    await expect(runtime.client(fileOpeningContract).open({ sessionId: "", path: "report.pdf" })).rejects.toThrow();
    expect(getSession).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledTimes(1);
  } finally { await runtime.dispose(); }
});

test("classifies missing or unreadable sessions without accessing files or leaking details", async () => {
  const getSession = vi.fn().mockRejectedValue(new Error("private runtime details"));
  const open = vi.fn();
  const runtime = createPluginRuntime([createFileOpeningPlugin({ getSession }, { open })]);
  await runtime.start();
  try {
    await expect(runtime.client(fileOpeningContract).open({ sessionId: "missing", path: "report.pdf" })).resolves.toEqual({
      ok: false, error: { code: "sessionUnavailable", message: "This session is no longer available on the server." },
    });
    expect(open).not.toHaveBeenCalled();
  } finally { await runtime.dispose(); }
});
