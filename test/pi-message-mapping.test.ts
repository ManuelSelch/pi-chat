import { describe, expect, it } from "vitest";
import { MessageIdentity, toChatMessage } from "../src/server/pi-runtime-adapter.js";

describe("Pi message mapping", () => {
  it("gives one message the same id live and in a later snapshot", () => {
    const identity = new MessageIdentity();
    const message = { role: "assistant", content: [{ type: "text", text: "Hello" }], timestamp: 1 };

    const live = toChatMessage(message, identity);
    const snapshot = [{ role: "user", content: "Hi", timestamp: 0 }, message]
      .map((item) => toChatMessage(item, identity))
      .filter((item) => item !== undefined);

    expect(live?.id).toBe(snapshot[1]?.id);
    expect(new Set(snapshot.map((item) => item?.id)).size).toBe(2);
  });

  it("joins text parts and ignores non-text content", () => {
    const identity = new MessageIdentity();
    const message = {
      role: "assistant",
      content: [{ type: "text", text: "Hello " }, { type: "toolCall", id: "1" }, { type: "text", text: "world" }],
    };
    expect(toChatMessage(message, identity)?.text).toBe("Hello world");
  });

  it("ignores entries that are not renderable chat messages", () => {
    const identity = new MessageIdentity();
    expect(toChatMessage({ role: "toolResult", content: [] }, identity)).toBeUndefined();
    expect(toChatMessage(undefined, identity)).toBeUndefined();
  });
});
