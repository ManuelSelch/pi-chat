import { beforeEach, expect, test, vi } from "vitest";
import { SDKError, type PiClient } from "@manuelselch/pi-sdk";
import { fileOpeningContract } from "../../contract.js";
import { createFileOpeningActions } from "../index.js";

let resolveOpen: (result: { ok: true }) => void;
let open: ReturnType<typeof vi.fn>;
let unsubscribe: ReturnType<typeof vi.fn>;
let notify: (state: { connection: { phase: string }; sessions: Record<string, object> }) => void;
let client: PiClient;

beforeEach(() => {
  open = vi.fn(() => new Promise<{ ok: true }>(resolve => { resolveOpen = resolve; }));
  unsubscribe = vi.fn();
  client = {
    getSession: vi.fn(() => ({})),
    subscribe: vi.fn(listener => { notify = listener; return unsubscribe; }),
    plugin: vi.fn(() => ({ open })),
  } as unknown as PiClient;
});

test("coalesces identical clicks, uses explicit runtime identity and releases completed waits", async () => {
  const actions = createFileOpeningActions(invoke => invoke(client));

  const first = actions.openFile("runtime", "report.pdf");
  const repeated = actions.openFile("runtime", "report.pdf");

  expect(repeated).toBe(first);
  expect(open).toHaveBeenCalledExactlyOnceWith({ sessionId: "runtime", path: "report.pdf" });
  expect(client.plugin).toHaveBeenCalledExactlyOnceWith(fileOpeningContract);
  resolveOpen({ ok: true });
  await first;
  expect(unsubscribe).toHaveBeenCalledOnce();

  const next = actions.openFile("runtime", "report.pdf");
  expect(open).toHaveBeenCalledTimes(2);
  resolveOpen({ ok: true });
  await next;
});

test("maps structured host failures to rejected UI waits without retry", async () => {
  open.mockResolvedValue({ ok: false, error: { code: "notFound", message: "File not found on the server." } });
  const actions = createFileOpeningActions(invoke => invoke(client));

  await expect(actions.openFile("runtime", "missing.pdf")).rejects.toMatchObject({ code: "notFound", outcome: "rejected" });
  expect(open).toHaveBeenCalledOnce();
  expect(unsubscribe).toHaveBeenCalledOnce();
});

test("ends the local wait on confirmed runtime removal without replaying the OS effect", async () => {
  const actions = createFileOpeningActions(invoke => invoke(client));
  const pending = actions.openFile("runtime", "report.pdf");

  notify({ connection: { phase: "ready" }, sessions: {} });

  await expect(pending).rejects.toMatchObject({ code: "cancelled", outcome: "unknown" });
  expect(unsubscribe).toHaveBeenCalledOnce();
  resolveOpen({ ok: true });
  await Promise.resolve();
  expect(open).toHaveBeenCalledOnce();
});

test("ignores non-authoritative disconnected inventory and lets SDK rejection settle the wait", async () => {
  const failure = new SDKError("disconnected", "Disconnected", "unknown");
  open.mockRejectedValue(failure);
  const actions = createFileOpeningActions(invoke => invoke(client));
  const pending = actions.openFile("runtime", "report.pdf");

  notify({ connection: { phase: "reconnecting" }, sessions: {} });

  await expect(pending).rejects.toBe(failure);
  expect(open).toHaveBeenCalledOnce();
  expect(unsubscribe).toHaveBeenCalledOnce();
});

test("does not reuse another client's pending wait after reconnect", async () => {
  let current = client;
  const actions = createFileOpeningActions(invoke => invoke(current));
  const first = actions.openFile("runtime", "report.pdf");
  const completeFirst = resolveOpen;
  current = { ...client } as PiClient;

  const second = actions.openFile("runtime", "report.pdf");

  expect(second).not.toBe(first);
  expect(open).toHaveBeenCalledTimes(2);
  completeFirst({ ok: true });
  resolveOpen({ ok: true });
  await Promise.all([first, second]);
  expect(unsubscribe).toHaveBeenCalledTimes(2);
});
