import { describe, expect, it, vi } from "vitest";
import { eventSchema, type Event } from "@manuelselch/pi-sdk/protocol";
import { ServerPublisher } from "../../../../src/server/transport/server-publisher.js";
import { ChatApplicationService } from "../../../../src/server/application/chat-application-service.js";
import { FakeRuntimeAdapter } from "../../../infra/fake-runtime-adapter.js";

function setup() {
  const chat = new ChatApplicationService(new FakeRuntimeAdapter("s1"), { continueProject: vi.fn(), openSession: vi.fn(), newSession: vi.fn() });
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), flush: vi.fn(), close: vi.fn() };
  const events: Event[] = [];
  const publisher = new ServerPublisher(chat, event => events.push(eventSchema.parse(event)), logger);
  return { chat, publisher, events, logger };
}
describe("v2 operation failure publication", () => {
  it("settles a failed steering submission without changing the existing run status", async () => {
    const { chat, publisher, events } = setup();
    publisher.publish("s1", { type: "runtimeStatus", status: "running" });
    publisher.operation(publisher.wireId("s1"), "op", "request", "failed", { code: "busy", message: "Wait for the current run." });
    expect(events.filter(event => event.event === "runtime.status")).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({ event: "operation.finished", data: { outcome: "failed", operationId: "op", requestId: "request" } });
    await chat.dispose();
  });
  it("logs provider notifications, runtime errors and operation failures with redaction", async () => {
    const { chat, publisher, logger } = setup();
    publisher.publish("s1", { type: "notification", level: "error", message: "upstream https://provider.test?token=secret" });
    publisher.operation(publisher.wireId("s1"), "op", "request", "failed", { code: "failure", message: "api_key=secret123" });
    publisher.publish("s1", { type: "runtimeStatus", status: "idle", error: "fetch failed" });
    expect(logger.error).toHaveBeenNthCalledWith(1, "runtime.notification_error", { message: "upstream [URL]" });
    expect(logger.error).toHaveBeenNthCalledWith(2, "runtime.operation_error", { message: "api_key=[REDACTED]" });
    expect(logger.error).toHaveBeenNthCalledWith(3, "runtime.turn_error", { message: "fetch failed", status: "idle" });
    await chat.dispose();
  });
});
