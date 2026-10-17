import type { Event, Method } from "../src/contract/v2.js";

const settings = { model: "p/m", availableModels: ["p/m"], thinkingLevel: "off", availableThinkingLevels: ["off"] };
const presentation = { revision: 0, widgets: [], footer: [], extensions: { buttons: [], badges: [], state: { demo: { value: [null, true, 1, "text"] } } } };
const summary = { sessionId: "runtime", title: "Example", projectPath: "/p", projectName: "p", status: "idle" };
const snapshot = { sessionId: "runtime", throughSequence: 0, projectPath: "/p", messages: [], runtime: { status: "idle" }, steeringMessages: [], settings, commands: [], prompts: [], presentation };
const inventory = { revision: 0, sessions: [summary] };
const projects = { revision: 0, catalogue: { projects: [] } };
const completed = { state: "completed" };
const accepted = { state: "accepted", operationId: "operation" };
const opened = { summary, snapshot };
export const operationExamples: Record<Method, { params: object; result: object; sessionId?: string }> = {
  "server.initialize": { params: { client: { name: "test", version: "1.0" }, capabilities: ["presentation"] }, result: { protocolVersion: 2, serverVersion: "0.0.0", serverInstanceId: "server", connectionId: "connection", capabilities: ["presentation"], inventory, projects, snapshots: [snapshot] } },
  "server.ping": { params: {}, result: completed },
  "server.restart": { params: {}, result: accepted },
  "session.create": { params: { projectPath: "/p" }, result: opened },
  "session.open": { params: { sessionPath: "/p/history.jsonl" }, result: opened },
  "session.list": { params: {}, result: inventory },
  "session.snapshot": { sessionId: "runtime", params: {}, result: snapshot },
  "session.close": { sessionId: "runtime", params: {}, result: completed },
  "session.compact": { sessionId: "runtime", params: {}, result: accepted },
  "session.reload": { sessionId: "runtime", params: {}, result: accepted },
  "session.archive": { params: { path: "/p/history.jsonl", archived: true }, result: completed },
  "project.list": { params: {}, result: projects },
  "project.pin": { params: { path: "/p", pinned: true }, result: completed },
  "project.remove": { params: { path: "/p" }, result: completed },
  "message.send": { sessionId: "runtime", params: { message: "Hello" }, result: accepted },
  "run.abort": { sessionId: "runtime", params: {}, result: accepted },
  "prompt.answer": { sessionId: "runtime", params: { promptId: "prompt", result: { cancelled: false, value: true } }, result: completed },
  "model.select": { sessionId: "runtime", params: { model: "p/m" }, result: settings },
  "thinking.level": { sessionId: "runtime", params: { level: "off" }, result: settings },
  "extension.run": { sessionId: "runtime", params: { actionId: "demo.action" }, result: accepted },
  "directory.browse": { params: { path: "/p" }, result: { path: "/p", breadcrumbs: [], entries: [] } },
  "command.complete": { sessionId: "runtime", params: { commandName: "demo", argumentPrefix: "st" }, result: { items: [{ value: "staging", label: "Staging" }] } },
  "file.open": { sessionId: "runtime", params: { path: "./report.pdf" }, result: completed },
};
const eventData: Record<Event["event"], object> = {
  "session.snapshot": snapshot,
  "runtime.status": { status: "idle" },
  "session.closed": { reason: "requested" },
  "session.list.changed": inventory,
  "session.replaced": { previousSessionId: "old", snapshot },
  "server.stopping": { reason: "restart" },
  "message.delta": { runId: "run", delta: "Hello" },
  "message.thinking.delta": { runId: "run", delta: "Thinking" },
  "message.finalized": { runId: "run", message: { id: "assistant", role: "assistant", text: "Hello" } },
  "tool.updated": { runId: "run", tool: { toolCallId: "tool", name: "bash", status: "success", outputText: "done" } },
  "steering.queue.changed": { messages: ["same", "same"] },
  "settings.changed": settings,
  "operation.finished": { operationId: "operation", requestId: "request", outcome: "completed" },
  "notification.created": { level: "info", message: "Notice" },
  "prompt.list.changed": { prompts: [{ id: "prompt", title: "Continue?", kind: "confirm", message: "Run?" }] },
  "presentation.changed": presentation,
  "project.list.changed": projects,
};
const globalEvents = new Set(["session.list.changed", "session.replaced", "server.stopping", "project.list.changed"]);
const unsequenced = new Set(["session.snapshot", "presentation.changed"]);
export function validExamples() {
  return {
    operations: Object.entries(operationExamples).map(([method, value], index) => ({
      method: method as Method,
      request: { version: 2, type: "request", requestId: `request-${index}`, method, params: value.params, ...(value.sessionId ? { sessionId: value.sessionId } : {}) },
      response: { version: 2, type: "response", requestId: `request-${index}`, ok: true, result: value.result },
      rejection: { version: 2, type: "response", requestId: `request-${index}`, ok: false, error: { code: "operationFailed", message: "Rejected", details: { retry: false } } },
    })),
    events: Object.entries(eventData).map(([event, data]) => ({ version: 2, type: "event", serverInstanceId: "server", event,
      ...(globalEvents.has(event) ? {} : { sessionId: "runtime", ...(unsequenced.has(event) ? {} : { sequence: 1 }) }), data })),
    protocolError: { version: 2, type: "protocolError", serverInstanceId: "server", error: { code: "unsupportedVersion", message: "Only v2 is supported" } },
  };
}
