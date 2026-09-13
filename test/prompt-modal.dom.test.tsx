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

  it("returns the clicked option", () => {
    const onRespond = show({ id: "p2", kind: "select", title: "Pick", options: ["allow", "deny"] });

    fireEvent.click(screen.getByRole("option", { name: "deny" }));

    expect(onRespond).toHaveBeenCalledWith("p2", { cancelled: false, value: "deny" });
  });

  it("moves through options with the arrow keys and chooses with Enter", () => {
    const onRespond = show({ id: "p2b", kind: "select", title: "Pick", options: ["allow", "deny", "ask"] });
    const list = screen.getByRole("listbox");

    expect(screen.getByRole("option", { name: "allow" }).getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(list, { key: "ArrowDown" });
    fireEvent.keyDown(list, { key: "ArrowDown" });
    expect(screen.getByRole("option", { name: "ask" }).getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(list, { key: "Enter" });
    expect(onRespond).toHaveBeenCalledWith("p2b", { cancelled: false, value: "ask" });
  });

  it("wraps around at the ends of the option list", () => {
    const onRespond = show({ id: "p2c", kind: "select", title: "Pick", options: ["allow", "deny"] });
    const list = screen.getByRole("listbox");

    fireEvent.keyDown(list, { key: "ArrowUp" });
    fireEvent.keyDown(list, { key: "Enter" });

    expect(onRespond).toHaveBeenCalledWith("p2c", { cancelled: false, value: "deny" });
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
