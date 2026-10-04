// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog, type ConfirmOptions } from "../src/web/ui/confirm/ConfirmDialog.js";

afterEach(cleanup);

function show(options: ConfirmOptions | undefined) {
  const onResolve = vi.fn();
  render(
    <MantineProvider>
      <ConfirmDialog options={options} onResolve={onResolve} />
    </MantineProvider>,
  );
  return { onResolve };
}

describe("ConfirmDialog", () => {
  it("confirms the pending action on Enter", () => {
    const { onResolve } = show({ title: "Restart server?", body: "Restart now", confirmLabel: "Restart" });

    fireEvent.keyDown(window, { key: "Enter" });

    expect(onResolve).toHaveBeenCalledWith(true);
  });

  it("cancels without confirming", () => {
    const { onResolve } = show({ title: "Delete session?", body: "Move to trash", confirmLabel: "Delete" });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onResolve).toHaveBeenCalledWith(false);
  });

  it("keeps Escape wired to cancel", () => {
    const { onResolve } = show({ title: "Delete session?", body: "Move to trash", confirmLabel: "Delete" });

    fireEvent.keyDown(document.body, { key: "Escape" });

    expect(onResolve).toHaveBeenCalledWith(false);
  });

  it("does not confirm when no dialog is open", () => {
    const { onResolve } = show(undefined);

    fireEvent.keyDown(window, { key: "Enter" });

    expect(onResolve).not.toHaveBeenCalled();
  });
});
