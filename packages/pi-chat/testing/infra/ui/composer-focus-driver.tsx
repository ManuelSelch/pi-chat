import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect } from "vitest";
import { App } from "../../../src/web/app/App.js";
import { finishUiTransitions } from "./finish-ui-transitions.js";

/** Real App/Mantine focus boundary; the caller supplies its mocked controller. */
export class ComposerFocusDriver {
  mount() { render(<MantineProvider><App /></MantineProvider>); }

  async openSettings() {
    const settings = screen.getByRole("button", { name: "Settings" });
    settings.focus();
    fireEvent.click(settings);
    await finishUiTransitions();
  }

  async dismissSettings() {
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape", code: "Escape", bubbles: true });
    await finishUiTransitions();
  }

  shouldKeepFocusInSettings() {
    expect(screen.getByRole("dialog", { name: "Settings" }).contains(document.activeElement)).toBe(true);
  }

  shouldFocusComposer() {
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Message Pi" }));
  }
}
