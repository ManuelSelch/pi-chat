// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TRANSCRIPT_DENSITY_STORAGE_KEY, useTranscriptDensity } from "../../../../../src/web/settings/preferences/use-transcript-density.js";

afterEach(() => { cleanup(); localStorage.clear(); });

describe("transcript density preference", () => {
  it("defaults to compact", () => {
    const { result } = renderHook(() => useTranscriptDensity());
    expect(result.current.density).toBe("compact");
  });

  it("honors an explicitly stored comfortable preference", () => {
    localStorage.setItem(TRANSCRIPT_DENSITY_STORAGE_KEY, JSON.stringify("comfortable"));
    const { result } = renderHook(() => useTranscriptDensity());
    expect(result.current.density).toBe("comfortable");
  });

  it("persists opting out across remounts", async () => {
    const first = renderHook(() => useTranscriptDensity());
    act(() => first.result.current.setDensity("comfortable"));
    await waitFor(() => expect(localStorage.getItem(TRANSCRIPT_DENSITY_STORAGE_KEY)).toBe(JSON.stringify("comfortable")));
    first.unmount();
    const second = renderHook(() => useTranscriptDensity());
    expect(second.result.current.density).toBe("comfortable");
  });
});
