// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { VersionsPanel } from "../../../../src/web/settings/versions/ui/VersionsPanel.js";
import { useServerVersion } from "../../../../src/web/settings/versions/app/use-server-version.js";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("renders the three approved rows without explanatory text", () => {
  render(<MantineProvider><VersionsPanel chat="dev" sdk="0.2.0" server={null} /></MantineProvider>);
  for (const label of ["Versions", "Pi Chat", "Pi Server", "Pi SDK", "dev", "0.2.0", "Unavailable"])
    expect(screen.getByText(label, { exact: true })).toBeTruthy();
  expect(screen.queryByText(/identify this frontend/)).toBeNull();
});

it("fetches only while settings is open and connected, then clears on disconnect", async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ server: "0.2.0" }) });
  vi.stubGlobal("fetch", fetcher);
  const { result, rerender } = renderHook(({ connected, opened }) => useServerVersion("wss://pi.example/ws?token=abc", connected, opened), { initialProps: { connected: true, opened: false } });
  expect(fetcher).not.toHaveBeenCalled();
  rerender({ connected: true, opened: true });
  await waitFor(() => expect(result.current).toBe("0.2.0"));
  expect(fetcher.mock.calls[0]![0].toString()).toBe("https://pi.example/api/pi-chat/version?token=abc");
  rerender({ connected: false, opened: true });
  expect(result.current).toBeNull();
});

it("does not reuse another endpoint's version or accept late responses", async () => {
  let finish!: (value: unknown) => void;
  vi.stubGlobal("fetch", vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue({ ok: true, json: async () => ({ server: "0.3.0" }) }));
  const { result, rerender } = renderHook(({ endpoint }) => useServerVersion(endpoint, true, true), { initialProps: { endpoint: "ws://old.example/ws" } });
  rerender({ endpoint: "ws://new.example/ws" });
  await waitFor(() => expect(result.current).toBe("0.3.0"));
  await act(async () => { finish({ ok: true, json: async () => ({ server: "0.1.0" }) }); });
  expect(result.current).toBe("0.3.0");
});

it.each([new Error("offline"), { ok: false }, { ok: true, json: async () => ({ server: 12 }) }])("shows unavailable for failed or invalid runtime metadata", async response => {
  const fetcher = vi.fn();
  if (response instanceof Error) fetcher.mockRejectedValue(response);
  else fetcher.mockResolvedValue(response);
  vi.stubGlobal("fetch", fetcher);
  const { result } = renderHook(() => useServerVersion("ws://pi.example/ws", true, true));
  await act(async () => {});
  expect(result.current).toBeNull();
});
