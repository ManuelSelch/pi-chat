// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { InboxNotice } from "../../../../../../../src/web/sessions/inbox/ui/components/InboxNotice.js";

afterEach(cleanup);

it("renders nothing when there is no error", () => {
  render(<MantineProvider><InboxNotice error={undefined} onDismiss={vi.fn()} /></MantineProvider>);

  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
});

it("preserves dismissible errors without an archive notice or Undo action", () => {
  const onDismiss = vi.fn();
  render(<MantineProvider><InboxNotice error="Archive failed" onDismiss={onDismiss} /></MantineProvider>);

  expect(screen.getByRole("alert").textContent).toContain("Archive failed");
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.queryByRole("button", { name: "Undo archive" })).toBeNull();

  fireEvent.click(screen.getByRole("button"));

  expect(onDismiss).toHaveBeenCalledOnce();
});
