import { describe, expect, it, vi } from "vitest";
import { ServerPublisher } from "../../../../src/server/transport/server-publisher.js";
import type { ChatApplicationService } from "../../../../src/server/application/chat-application-service.js";

describe("steering command failures", () => {
  it("keeps the original run running when another submission is rejected", () => {
    const chat = { tabs: () => [{ sessionId: "s1", status: "running" }] } as unknown as ChatApplicationService;
    const publisher = new ServerPublisher(chat, () => undefined);
    const publish = vi.spyOn(publisher, "publish").mockImplementation(() => {});
    publisher.publishError("s1", new Error("Wait for the current run to finish."));
    expect(publish).toHaveBeenCalledWith("s1", { type: "runtimeStatus", status: "running", error: "Wait for the current run to finish." });
  });
  it("keeps blocked tool runs busy as well", () => {
    const chat = { tabs: () => [{ sessionId: "s1", status: "blocked" }] } as unknown as ChatApplicationService;
    const publisher = new ServerPublisher(chat, () => undefined);
    const publish = vi.spyOn(publisher, "publish").mockImplementation(() => {});
    publisher.publishError("s1", "Rejected");
    expect(publish).toHaveBeenCalledWith("s1", expect.objectContaining({ status: "running" }));
  });
});
