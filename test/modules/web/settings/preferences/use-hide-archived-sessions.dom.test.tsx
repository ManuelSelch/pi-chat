// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HIDE_ARCHIVED_SESSIONS_STORAGE_KEY, useHideArchivedSessions } from "../../../../../src/web/settings/preferences/use-hide-archived-sessions.js";

afterEach(() => { cleanup(); localStorage.clear(); });

describe("archived-session visibility preference", () => {
  it("defaults to hiding archived sessions", () => {
    const { result } = renderHook(() => useHideArchivedSessions());
    expect(result.current.hide).toBe(true);
  });

  it("persists opting out across remounts", async () => {
    const first = renderHook(() => useHideArchivedSessions());
    act(() => first.result.current.setHide(false));
    await waitFor(() => expect(localStorage.getItem(HIDE_ARCHIVED_SESSIONS_STORAGE_KEY)).toBe("false"));
    first.unmount();
    const second = renderHook(() => useHideArchivedSessions());
    expect(second.result.current.hide).toBe(false);
  });

  it("synchronizes Settings and Projects consumers immediately", async () => {
    const settings = renderHook(() => useHideArchivedSessions());
    const projects = renderHook(() => useHideArchivedSessions());
    act(() => settings.result.current.setHide(false));
    await waitFor(() => expect(projects.result.current.hide).toBe(false));
    act(() => settings.result.current.setHide(true));
    await waitFor(() => expect(projects.result.current.hide).toBe(true));
  });
});
