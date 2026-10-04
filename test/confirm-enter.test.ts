// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { shouldConfirmOnEnter } from "../src/web/ui/confirm/confirm-enter.js";

function key(target: EventTarget, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, ...init });
  Object.defineProperty(event, "target", { value: target });
  return event;
}

describe("shouldConfirmOnEnter", () => {
  it("confirms plain Enter", () => {
    expect(shouldConfirmOnEnter(key(document.body))).toBe(true);
  });

  it("respects disabled primary actions", () => {
    expect(shouldConfirmOnEnter(key(document.body), true)).toBe(false);
  });

  it("does not confirm from multiline editors", () => {
    const textarea = document.createElement("textarea");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");

    expect(shouldConfirmOnEnter(key(textarea))).toBe(false);
    expect(shouldConfirmOnEnter(key(editable))).toBe(false);
  });

  it("ignores modified Enter chords", () => {
    expect(shouldConfirmOnEnter(key(document.body, { shiftKey: true }))).toBe(false);
    expect(shouldConfirmOnEnter(key(document.body, { metaKey: true }))).toBe(false);
    expect(shouldConfirmOnEnter(key(document.body, { ctrlKey: true }))).toBe(false);
  });
});
