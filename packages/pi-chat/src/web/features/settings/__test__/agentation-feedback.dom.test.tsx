// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AgentationFeedback } from "../components/AgentationFeedback.js";
import { AGENTATION_STORAGE_KEY, useAgentation } from "../preferences/hooks/use-agentation.js";

vi.mock("agentation", () => ({ Agentation: () => <div>Agentation toolbar</div> }));

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function PreferenceControl() {
  const { enabled, setEnabled } = useAgentation();
  return <button onClick={() => setEnabled(!enabled)}>Toggle feedback</button>;
}

it("starts disabled, responds to the preference, and restores it after remount", async () => {
  const view = render(<><PreferenceControl /><AgentationFeedback /></>);

  expect(screen.queryByText("Agentation toolbar")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Toggle feedback" }));
  expect(await screen.findByText("Agentation toolbar")).toBeTruthy();
  expect(localStorage.getItem(AGENTATION_STORAGE_KEY)).toBe("true");

  view.unmount();
  render(<><PreferenceControl /><AgentationFeedback /></>);
  expect(await screen.findByText("Agentation toolbar")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Toggle feedback" }));
  expect(screen.queryByText("Agentation toolbar")).toBeNull();
  expect(localStorage.getItem(AGENTATION_STORAGE_KEY)).toBe("false");
});
