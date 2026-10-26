// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConfirmOptions } from "../../../../../../src/web/ui/confirm/ConfirmDialog.js";
import { useServerSettings } from "../../../../../../src/web/settings/server/app/use-server-settings.js";

const page = { protocol: "https:", host: "pi.example", search: "" };
const preference = { endpoint: "wss://pi.example/ws", override: "", hasStoredOverride: false };
afterEach(cleanup);
function setup(options: { stored?: boolean; confirm?: boolean; error?: string } = {}) {
  const confirm = vi.fn(async (_options: ConfirmOptions) => options.confirm ?? true);
  const persist = vi.fn(() => options.error);
  const reload = vi.fn();
  const hook = renderHook(() => useServerSettings({
    preference: options.stored ? { ...preference, override: preference.endpoint, hasStoredOverride: true } : preference,
    page, confirm, persist, reload,
  }));
  return { hook, confirm, persist, reload };
}
describe("server settings workflow", () => {
  it("keeps edits local until confirmed then persists before reloading", async () => {
    const { hook, confirm, persist, reload } = setup();
    expect(hook.result.current.canSave).toBe(false);
    act(() => hook.result.current.edit("  wss://pi.example/ws?profile=work  "));
    expect(persist).not.toHaveBeenCalled();
    await act(() => hook.result.current.save());
    expect(confirm.mock.calls[0]![0].body).toContain("unsent drafts");
    expect(persist).toHaveBeenCalledWith("wss://pi.example/ws?profile=work");
    expect(reload).toHaveBeenCalledOnce();
    expect(persist.mock.invocationCallOrder[0]).toBeLessThan(reload.mock.invocationCallOrder[0]!);
  });
  it("cancellation changes neither persistence nor connection", async () => {
    const { hook, persist, reload } = setup({ confirm: false });
    act(() => hook.result.current.edit("wss://pi.example/other"));
    await act(() => hook.result.current.save());
    expect(persist).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
  it("invalid input cannot prompt, save or reload", async () => {
    const { hook, confirm, persist, reload } = setup();
    act(() => hook.result.current.edit("http://invalid"));
    expect(hook.result.current.canSave).toBe(false);
    expect(hook.result.current.validation).toBeTruthy();
    await act(() => hook.result.current.save());
    expect(confirm).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
  it("shows storage failure without reloading", async () => {
    const { hook, reload } = setup({ error: "Could not save" });
    act(() => hook.result.current.edit("wss://pi.example/ws"));
    await act(() => hook.result.current.save());
    expect(hook.result.current.error).toBe("Could not save");
    expect(reload).not.toHaveBeenCalled();
  });
  it("reset persists the default even when the draft is invalid", async () => {
    const { hook, persist, reload } = setup({ stored: true });
    act(() => hook.result.current.edit("invalid"));
    await act(() => hook.result.current.reset());
    expect(persist).toHaveBeenCalledWith("");
    expect(reload).toHaveBeenCalledOnce();
  });
  it("blank input removes an existing override on save", async () => {
    const { hook, persist } = setup({ stored: true });
    act(() => hook.result.current.edit(""));
    await act(() => hook.result.current.save());
    expect(persist).toHaveBeenCalledWith("");
  });
});
