import { describe, expect, it, vi } from "vitest";
import { ServerPublisher } from "../../../../src/server/transport/server-publisher.js";
import type { ChatApplicationService } from "../../../../src/server/application/chat-application-service.js";

describe("runtime error logging", () => {
  it("logs redacted provider notification and operation errors", () => {
    const chat = { tabs: () => [{ sessionId: "s1", status: "running" }] } as unknown as ChatApplicationService;
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), flush: vi.fn(), close: vi.fn() };
    const publisher = new ServerPublisher(chat, () => undefined, logger);
    publisher.publish("s1", { type: "notification", level: "error", message: "exceeded request buffer limit while retrying upstream https://provider.test?token=secret" });
    publisher.publishError("s1", new Error("api_key=secret123"));
    publisher.publish("s1", { type: "runtimeStatus", status: "idle", error: "fetch failed" });
    expect(logger.error).toHaveBeenNthCalledWith(1, "runtime.notification_error", {
      message: "exceeded request buffer limit while retrying upstream [URL]",
    });
    expect(logger.error).toHaveBeenNthCalledWith(2, "runtime.operation_error", {
      errorName: "Error", message: "api_key=[REDACTED]",
    });
    expect(logger.error).toHaveBeenNthCalledWith(3, "runtime.turn_error", {
      message: "api_key=[REDACTED]", status: "running",
    });
    expect(logger.error).toHaveBeenNthCalledWith(4, "runtime.turn_error", {
      message: "fetch failed", status: "idle",
    });
  });
});

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
