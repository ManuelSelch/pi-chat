// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ExtensionStatus } from "../src/shared/protocol.js";
import { StatusBar } from "../src/web/chat/StatusBar.js";

afterEach(cleanup);

function show(statuses: ExtensionStatus[], status = "") {
  const { container } = render(
    <MantineProvider>
      <StatusBar statuses={statuses} status={status} />
    </MantineProvider>,
  );
  return container;
}

describe("StatusBar", () => {
  it("shows an extension's footer label beside the composer status", () => {
    show([{ key: "readonly", text: "READONLY" }], "claude-opus-5 · thinking: off");

    expect(screen.getByText("READONLY")).toBeTruthy();
    expect(screen.getByText("claude-opus-5 · thinking: off")).toBeTruthy();
  });

  it("shows a label even when the session has no status line of its own", () => {
    show([{ key: "readonly", text: "READONLY" }]);

    expect(screen.getByText("READONLY")).toBeTruthy();
  });

  it("renders nothing when there is nothing to report", () => {
    // Mantine injects its own style block, so the row itself is what to look for.
    expect(show([]).querySelector("[class*='Group-root']")).toBeNull();
  });
});
