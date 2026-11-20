// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CounterPanelView } from "../components/CounterPanelView.js";
import type { CounterDemoState } from "../hooks/use-counter-demo.js";

afterEach(cleanup);

function setup(state: Partial<CounterDemoState> = {}, connected = true) {
  const onIncrement = vi.fn();
  const onRead = vi.fn();
  render(<MantineProvider><CounterPanelView
    state={{ count: 0, status: "ready", busy: false, ...state }} connected={connected}
    onIncrement={onIncrement} onRead={onRead} /></MantineProvider>);
  return { onIncrement, onRead };
}

it("announces the count and exposes only read and increment", () => {
  const actions = setup({ count: 3 });
  expect(screen.getByLabelText("Count").textContent).toBe("3");
  expect(screen.getByLabelText("Count").getAttribute("aria-live")).toBe("polite");

  fireEvent.click(screen.getByRole("button", { name: "Increment" }));
  fireEvent.click(screen.getByRole("button", { name: "Read current count" }));

  expect(actions.onIncrement).toHaveBeenCalledOnce();
  expect(actions.onRead).toHaveBeenCalledOnce();
  expect(screen.queryByRole("button", { name: /reset/i })).toBeNull();
});

it("disables mutations and offers read recovery after an uncertain result", () => {
  setup({ status: "error", error: "Result unknown. Read the count before trying again." });

  expect(screen.getByRole("alert").textContent).toContain("Result unknown");
  expect((screen.getByRole("button", { name: "Increment" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Read current count" }) as HTMLButtonElement).disabled).toBe(false);
});

it("disables both controls while disconnected and preserves the last known count", () => {
  setup({ count: 4 }, false);

  expect(screen.getByText("Disconnected")).toBeTruthy();
  expect(screen.getByLabelText("Count").textContent).toBe("4");
  for (const button of screen.getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
});

it("shows unavailable without inventing a count", () => {
  setup({ status: "unavailable", count: null });

  expect(screen.getByText("Counter plugin unavailable on this server.")).toBeTruthy();
  expect(screen.getByLabelText("Count").textContent).toBe("—");
  for (const button of screen.getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
});

it("shows loading and prevents actions while reading", () => {
  setup({ status: "loading", count: null });

  expect(screen.getByLabelText("Count").textContent).toBe("…");
  for (const button of screen.getAllByRole("button")) expect((button as HTMLButtonElement).disabled).toBe(true);
});
