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

export const domainExamples: { name: string; schema: string; input: unknown }[] = [
  {
    "name": "rich user message",
    "schema": "ChatMessage",
    "input": {
      "id": "user-1",
      "role": "user",
      "text": "task",
      "skill": {
        "name": "demo",
        "location": "/example/SKILL.md",
        "content": "instructions"
      },
      "timestamp": 1700000000000
    }
  },
  {
    "name": "rich assistant message",
    "schema": "ChatMessage",
    "input": {
      "id": "assistant-1",
      "role": "assistant",
      "text": "Hello 🌍",
      "thinking": "Reasoning"
    }
  },
  {
    "name": "rich system message",
    "schema": "ChatMessage",
    "input": {
      "id": "system-1",
      "role": "system",
      "text": "Context"
    }
  },
  {
    "name": "rich tool message",
    "schema": "ChatMessage",
    "input": {
      "id": "tool:call-1",
      "role": "tool",
      "tool": {
        "toolCallId": "call-1",
        "name": "edit",
        "status": "success",
        "argsText": "{}",
        "outputText": "updated",
        "writeContent": {
          "text": "hello",
          "truncated": false
        },
        "editDiff": {
          "format": "unified",
          "text": "+hello",
          "truncated": false,
          "firstChangedLine": 1
        }
      }
    }
  },
  {
    "name": "rich bash message",
    "schema": "ChatMessage",
    "input": {
      "id": "bash-1",
      "role": "bash",
      "bash": {
        "command": "pwd",
        "output": "/example/project",
        "status": "success",
        "exitCode": 0,
        "excludeFromContext": false,
        "truncated": false,
        "fullOutputPath": "/example/output.txt"
      }
    }
  },
  {
    "name": "rich custom message",
    "schema": "ChatMessage",
    "input": {
      "id": "custom-1",
      "role": "custom",
      "customType": "demo",
      "text": "Extension output"
    }
  },
  {
    "name": "thinking enum",
    "schema": "ThinkingLevel",
    "input": "xhigh"
  },
  {
    "name": "empty extension contributions",
    "schema": "ExtensionContributions",
    "input": {
      "buttons": [],
      "badges": [],
      "state": {}
    }
  },
  {
    "name": "extension JSON values",
    "schema": "ExtensionContributions",
    "input": {
      "state": {
        "demo": {
          "nothing": null,
          "enabled": true,
          "count": 3,
          "text": "hello",
          "array": [
            false,
            1.5,
            {
              "key": "value"
            }
          ]
        }
      },
      "future": true,
      "buttons": [],
      "badges": []
    }
  },
  {
    "name": "cancel question",
    "schema": "PromptResult",
    "input": {
      "cancelled": true
    }
  },
  {
    "name": "text question answer",
    "schema": "PromptResult",
    "input": {
      "cancelled": false,
      "value": "one"
    }
  },
  {
    "name": "boolean question answer",
    "schema": "PromptResult",
    "input": {
      "cancelled": false,
      "value": false
    }
  },
  {
    "name": "required footer hints",
    "schema": "FooterItem",
    "input": {
      "key": "mode",
      "text": "Ready",
      "align": "left",
      "variant": "plain"
    }
  },
  {
    "name": "chat with omitted optional values",
    "schema": "ChatMessage",
    "input": {
      "id": "assistant-3",
      "role": "assistant",
      "text": "Hello"
    }
  },
  {
    "name": "chat additive optional field",
    "schema": "ChatMessage",
    "input": {
      "id": "user-2",
      "role": "user",
      "text": "Hello",
      "future": {
        "unknown": true
      }
    }
  }
];
export const invalidExamples: { name: string; schema: string; input: unknown }[] = [
  {
    "name": "unknown message role",
    "schema": "ChatMessage",
    "input": {
      "id": "message-1",
      "role": "future",
      "text": "x"
    }
  },
  {
    "name": "tool missing payload",
    "schema": "ChatMessage",
    "input": {
      "id": "message-1",
      "role": "tool"
    }
  },
  {
    "name": "invalid message identity",
    "schema": "ChatMessage",
    "input": {
      "id": "bad\u0000id",
      "role": "assistant",
      "text": "x"
    }
  },
  {
    "name": "null optional timestamp",
    "schema": "ChatMessage",
    "input": {
      "id": "message-1",
      "role": "assistant",
      "text": "x",
      "timestamp": null
    }
  },
  {
    "name": "unknown thinking level",
    "schema": "ThinkingLevel",
    "input": "future"
  },
  {
    "name": "non-string boolean prompt result",
    "schema": "PromptResult",
    "input": {
      "cancelled": false,
      "value": 1
    }
  },
  {
    "name": "footer null alignment",
    "schema": "FooterItem",
    "input": {
      "key": "demo",
      "text": "Demo",
      "align": null
    }
  },
  {
    "name": "v1 request",
    "schema": "Request",
    "input": {
      "version": 1,
      "type": "request",
      "requestId": "request",
      "method": "message.send",
      "sessionId": "runtime",
      "params": {
        "message": "hello"
      }
    }
  },
  {
    "name": "unknown method",
    "schema": "Request",
    "input": {
      "version": 2,
      "type": "request",
      "requestId": "request",
      "method": "future.method",
      "sessionId": "runtime",
      "params": {
        "message": "hello"
      }
    }
  },
  {
    "name": "blank prompt",
    "schema": "Request",
    "input": {
      "version": 2,
      "type": "request",
      "requestId": "request",
      "method": "message.send",
      "sessionId": "runtime",
      "params": {
        "message": "   "
      }
    }
  },
  {
    "name": "missing session",
    "schema": "Request",
    "input": {
      "version": 2,
      "type": "request",
      "requestId": "request",
      "method": "message.send",
      "params": {
        "message": "hello"
      }
    }
  },
  {
    "name": "invalid id",
    "schema": "Request",
    "input": {
      "version": 2,
      "type": "request",
      "requestId": "bad\u0000id",
      "method": "message.send",
      "sessionId": "runtime",
      "params": {
        "message": "hello"
      }
    }
  },
  {
    "name": "untyped failure",
    "schema": "Response",
    "input": {
      "version": 2,
      "type": "response",
      "requestId": "r",
      "ok": false,
      "error": "failure"
    }
  },
  {
    "name": "unknown required event",
    "schema": "Event",
    "input": {
      "version": 2,
      "type": "event",
      "serverInstanceId": "s",
      "event": "future.required",
      "data": {}
    }
  }
];
