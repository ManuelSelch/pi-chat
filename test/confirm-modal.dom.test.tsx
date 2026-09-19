// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmModal, type Confirmation } from "../src/web/app/ConfirmModal.js";

afterEach(cleanup);

function show(confirmation: Confirmation | undefined) {
  const onClose = vi.fn();
  const run = confirmation?.run ?? vi.fn();
  render(
    <MantineProvider>
      <ConfirmModal confirmation={confirmation ? { ...confirmation, run } : undefined} onClose={onClose} />
    </MantineProvider>,
  );
  return { onClose, run };
}

describe("ConfirmModal", () => {
  it("confirms the pending action on Enter", () => {
    const { onClose, run } = show({ title: "Restart server?", body: "Restart now", confirmLabel: "Restart", run: vi.fn() });

    fireEvent.keyDown(window, { key: "Enter" });

    expect(run).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("cancels without running the action", () => {
    const { onClose, run } = show({ title: "Delete session?", body: "Move to trash", confirmLabel: "Delete", run: vi.fn() });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(run).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps Escape wired to close without confirming", () => {
    const { onClose, run } = show({ title: "Delete session?", body: "Move to trash", confirmLabel: "Delete", run: vi.fn() });

    fireEvent.keyDown(document.body, { key: "Escape" });

    expect(run).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not confirm when no confirmation is open", () => {
    const { onClose, run } = show(undefined);

    fireEvent.keyDown(window, { key: "Enter" });

    expect(run).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
