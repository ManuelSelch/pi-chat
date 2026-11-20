// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SDKError } from "@manuelselch/pi-sdk";
import { useCounterDemo } from "../hooks/use-counter-demo.js";

let read: ReturnType<typeof vi.fn<() => Promise<number>>>;
let increment: ReturnType<typeof vi.fn<() => Promise<number>>>;
beforeEach(() => {
  read = vi.fn(async () => 0);
  increment = vi.fn(async () => 1);
});
afterEach(cleanup);

function setup(opened = true, connected = true) {
  return renderHook(({ opened, connected, serverInstanceId }) => useCounterDemo({
    opened, connected, serverInstanceId, read, increment,
  }), { initialProps: { opened, connected, serverInstanceId: "server" } });
}

it("only reads when opened and connected, then displays the server's count", async () => {
  const hook = setup(false);
  expect(read).not.toHaveBeenCalled();

  hook.rerender({ opened: true, connected: false, serverInstanceId: "server" });
  expect(read).not.toHaveBeenCalled();

  hook.rerender({ opened: true, connected: true, serverInstanceId: "server" });
  await waitFor(() => expect(hook.result.current.view).toMatchObject({ count: 0, status: "ready" }));
});

it("increments through the action and never changes the count optimistically", async () => {
  let finish!: (value: number) => void;
  increment.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const hook = setup();
  await waitFor(() => expect(hook.result.current.view.status).toBe("ready"));

  act(() => { void hook.result.current.increment(); void hook.result.current.increment(); });

  expect(increment).toHaveBeenCalledTimes(1);
  expect(hook.result.current.view).toMatchObject({ count: 0, busy: true });

  await act(async () => { finish(1); });
  expect(hook.result.current.view).toMatchObject({ count: 1, status: "ready", busy: false });
});

it("requires an explicit read after an uncertain increment and never retries the mutation", async () => {
  increment.mockRejectedValue(new SDKError("timeout", "Lost response", "unknown"));
  const hook = setup();
  await waitFor(() => expect(hook.result.current.view.status).toBe("ready"));

  await act(async () => { await hook.result.current.increment(); });
  expect(hook.result.current.view).toMatchObject({ count: 0, status: "error", error: "Result unknown. Read the count before trying again." });

  await act(async () => { await hook.result.current.increment(); });
  expect(increment).toHaveBeenCalledTimes(1);

  read.mockResolvedValue(1);
  await act(async () => { await hook.result.current.read(); });
  expect(hook.result.current.view).toMatchObject({ count: 1, status: "ready" });
});

it("discards late results after disconnect and re-reads on reconnect", async () => {
  let finish!: (value: number) => void;
  increment.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const hook = setup();
  await waitFor(() => expect(hook.result.current.view.status).toBe("ready"));
  act(() => { void hook.result.current.increment(); });

  hook.rerender({ opened: true, connected: false, serverInstanceId: "server" });
  await act(async () => { finish(1); });
  expect(hook.result.current.view.count).toBe(0);

  read.mockResolvedValue(2);
  hook.rerender({ opened: true, connected: true, serverInstanceId: "server" });

  await waitFor(() => expect(hook.result.current.view).toMatchObject({ count: 2, status: "ready" }));
  expect(increment).toHaveBeenCalledTimes(1);
});

it("reopening reads server state rather than resetting it", async () => {
  const hook = setup();
  await waitFor(() => expect(hook.result.current.view.status).toBe("ready"));

  hook.rerender({ opened: false, connected: true, serverInstanceId: "server" });
  read.mockResolvedValue(4);
  hook.rerender({ opened: true, connected: true, serverInstanceId: "server" });

  await waitFor(() => expect(hook.result.current.view.count).toBe(4));
  expect(increment).not.toHaveBeenCalled();
});

it("treats a missing RPC capability or contract as unavailable", async () => {
  read.mockRejectedValue(new SDKError("unsupportedOperation", "Not exposed", "notSent"));
  const hook = setup();

  await waitFor(() => expect(hook.result.current.view.status).toBe("unavailable"));
  await act(async () => { await hook.result.current.increment(); });
  expect(increment).not.toHaveBeenCalled();
});

it("re-reads when the server instance changes and ignores the prior read", async () => {
  let finish!: (value: number) => void;
  read.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  const hook = setup();

  read.mockResolvedValue(0);
  hook.rerender({ opened: true, connected: true, serverInstanceId: "replacement" });
  await waitFor(() => expect(hook.result.current.view.count).toBe(0));
  await act(async () => { finish(8); });

  expect(hook.result.current.view.count).toBe(0);
});
