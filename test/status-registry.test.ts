import { describe, expect, it, vi } from "vitest";
import { StatusRegistry } from "../src/server/status-registry.js";
import { createWebUiContext } from "../src/server/web-ui-context.js";

function registry() {
  const onChange = vi.fn();
  return { statuses: new StatusRegistry(onChange), onChange };
}

describe("StatusRegistry", () => {
  /** Sorted by key, as the terminal footer sorts them. */
  it("keeps statuses apart by key, in a stable order", () => {
    const { statuses } = registry();

    statuses.set("readonly", "READONLY");
    statuses.set("branch", "main");
    statuses.set("readonly", "READONLY (strict)");

    expect(statuses.list()).toEqual([
      { key: "branch", text: "main" },
      { key: "readonly", text: "READONLY (strict)" },
    ]);
  });

  it("clears a status on undefined, per Pi's contract", () => {
    const { statuses, onChange } = registry();
    statuses.set("readonly", "READONLY");

    statuses.set("readonly", undefined);

    expect(statuses.list()).toEqual([]);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("ignores clearing something that was never set", () => {
    const { statuses, onChange } = registry();

    statuses.set("readonly", undefined);

    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not republish an unchanged status", () => {
    const { statuses, onChange } = registry();

    statuses.set("readonly", "READONLY");
    statuses.set("readonly", "READONLY");

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  /** Terminal statuses are coloured; the browser renders them as text. */
  it("strips the colour an extension wrote the label with", () => {
    const { statuses } = registry();

    statuses.set("readonly", "\u001B[33mREADONLY\u001B[0m");

    expect(statuses.list()).toEqual([{ key: "readonly", text: "READONLY" }]);
  });

  /** Colour-only text carries no label, so it is the same as no status. */
  it("treats a status with no text left as cleared", () => {
    const { statuses } = registry();
    statuses.set("readonly", "READONLY");

    statuses.set("readonly", "\u001B[33m \u001B[0m");

    expect(statuses.list()).toEqual([]);
  });

  it("drops every status when its session goes away", () => {
    const { statuses, onChange } = registry();
    statuses.set("readonly", "READONLY");

    statuses.clear();

    expect(statuses.list()).toEqual([]);
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});

describe("ctx.ui.setStatus", () => {
  /**
   * The footer label of an extension such as `/readonly` never appeared in the
   * browser because this was a no-op, the same way widgets used to be.
   */
  it("reaches the host through the web UI context", () => {
    const onStatus = vi.fn();
    const ui = createWebUiContext({
      onNotify: vi.fn(),
      onPrompt: vi.fn(async () => ({ cancelled: true as const })),
      onStatus,
    });

    ui.setStatus("readonly", ui.theme.fg("warning", "READONLY"));
    ui.setStatus("readonly", undefined);

    expect(onStatus.mock.calls).toEqual([
      ["readonly", "READONLY"],
      ["readonly", undefined],
    ]);
  });

  /**
   * `ctx.ui.theme` is the documented way to colour a status, and an absent one
   * threw a TypeError that took the whole command down with it.
   */
  it("hands out a theme that renders as plain text", () => {
    const ui = createWebUiContext({ onNotify: vi.fn(), onPrompt: vi.fn(async () => ({ cancelled: true as const })) });

    expect(ui.theme.fg("warning", "READONLY")).toBe("READONLY");
    expect(ui.theme.bold("READONLY")).toBe("READONLY");
  });
});
