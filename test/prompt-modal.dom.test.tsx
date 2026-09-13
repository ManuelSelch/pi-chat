// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { UiPrompt } from "../src/shared/protocol.js";
import { PromptModal } from "../src/web/prompts/PromptModal.js";

afterEach(cleanup);

function show(prompt: UiPrompt | undefined) {
  const onRespond = vi.fn();
  render(
    <MantineProvider>
      <PromptModal prompt={prompt} onRespond={onRespond} />
    </MantineProvider>,
  );
  return onRespond;
}

describe("PromptModal", () => {
  it("shows nothing when no extension is waiting", () => {
    show(undefined);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("confirms with a boolean", () => {
    const onRespond = show({ id: "p1", kind: "confirm", title: "Delete?", message: "Cannot be undone" });

    expect(screen.getByText("Cannot be undone")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(onRespond).toHaveBeenCalledWith("p1", { cancelled: false, value: true });
  });

  it("returns the selected option, defaulting to the first", () => {
    const onRespond = show({ id: "p2", kind: "select", title: "Pick", options: ["allow", "deny"] });

    fireEvent.click(screen.getByRole("radio", { name: "deny" }));
    fireEvent.click(screen.getByRole("button", { name: "OK" }));

    expect(onRespond).toHaveBeenCalledWith("p2", { cancelled: false, value: "deny" });
  });

  it("submits typed input on Enter", () => {
    const onRespond = show({ id: "p3", kind: "input", title: "Name" });
    const field = screen.getByRole("textbox");

    fireEvent.change(field, { target: { value: "notes" } });
    fireEvent.keyDown(field, { key: "Enter" });

    expect(onRespond).toHaveBeenCalledWith("p3", { cancelled: false, value: "notes" });
  });

  it("keeps plain Enter as a newline in the editor and submits on meta+Enter", () => {
    const onRespond = show({ id: "p4", kind: "editor", title: "Edit", prefill: "hello" });
    const field = screen.getByRole("textbox");

    fireEvent.keyDown(field, { key: "Enter" });
    expect(onRespond).not.toHaveBeenCalled();

    fireEvent.keyDown(field, { key: "Enter", metaKey: true });
    expect(onRespond).toHaveBeenCalledWith("p4", { cancelled: false, value: "hello" });
  });

  it("cancels explicitly so the blocked extension is released", () => {
    const onRespond = show({ id: "p5", kind: "input", title: "Name" });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onRespond).toHaveBeenCalledWith("p5", { cancelled: true });
  });
});
