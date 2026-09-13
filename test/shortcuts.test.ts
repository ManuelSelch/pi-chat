import { describe, expect, it } from "vitest";
import { clearInputIntent, escapeIntent } from "../src/web/app/shortcuts.js";

describe("escape", () => {
  it("stops a running agent", () => {
    expect(escapeIntent({ overlayOpen: false, menuOpen: false, busy: true })).toBe("abort");
  });

  it("does nothing when nothing is running", () => {
    expect(escapeIntent({ overlayOpen: false, menuOpen: false, busy: false })).toBe("ignore");
  });

  it("leaves an open overlay to close itself", () => {
    // Otherwise closing a dialog would also abort the run behind it.
    expect(escapeIntent({ overlayOpen: true, menuOpen: false, busy: true })).toBe("ignore");
  });

  it("leaves the command menu to dismiss itself", () => {
    expect(escapeIntent({ overlayOpen: false, menuOpen: true, busy: true })).toBe("ignore");
  });
});

describe("ctrl+c", () => {
  it("clears a composer with text in it", () => {
    expect(clearInputIntent({ hasSelection: false, input: "half typed" })).toBe("clear");
  });

  it("stays out of the way when text is selected, so Copy still works", () => {
    expect(clearInputIntent({ hasSelection: true, input: "half typed" })).toBe("ignore");
  });

  it("does nothing when the composer is already empty", () => {
    expect(clearInputIntent({ hasSelection: false, input: "" })).toBe("ignore");
  });
});
