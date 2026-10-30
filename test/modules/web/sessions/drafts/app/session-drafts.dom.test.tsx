// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { SessionDraftProvider, useSessionDrafts } from "../../../../../../src/web/sessions/drafts/app/SessionDraftProvider.js";

afterEach(cleanup);
it("keeps unsaved drafts when paths arrive and restores them under a reopened runtime identity", () => {
  const { result, rerender } = renderHook(({ id, path }) => useSessionDrafts(id, path), { wrapper: SessionDraftProvider, initialProps: { id: "old", path: undefined as string | undefined } });

  act(() => result.current.setInput("Keep this draft"));
  rerender({ id: "old", path: "/saved.jsonl" });
  expect(result.current.input).toBe("Keep this draft");
  rerender({ id: "other", path: "/other.jsonl" });
  expect(result.current.input).toBe("");
  rerender({ id: "new", path: "/saved.jsonl" });
  expect(result.current.input).toBe("Keep this draft");

  act(() => result.current.setInput(""));
  rerender({ id: "old", path: "/saved.jsonl" });
  expect(result.current.input).toBe("");
});
