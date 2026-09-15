# Pi Chat extension API

Pi Chat exposes a small experimental web-extension API for local trusted Pi extensions.

The goal is to let external extensions add web UI and behavior without putting feature-specific code into Pi Chat core. The first supported surfaces are:

- **slots**: stable places in the UI where extensions can add buttons
- **actions**: server-side handlers invoked by those buttons
- **hooks**: lifecycle events extensions can observe

This API is intentionally declarative. Extensions describe UI metadata; Pi Chat renders it with its own React components.

## Status

Experimental. The current API is a minimal demo surface, not yet a published package boundary.

Current implementation:

```txt
src/server/extension-registry.ts
```

Demo extension:

```txt
examples/pi-chat-demo-extension.ts
```

Global shim used during local development:

```txt
~/.pi/agent/extensions/pi-chat-demo.ts
```

## Basic usage

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getPiChatExtensionRegistry } from "../git/pi-chat/src/server/extension-registry.js";

export default function myExtension(_pi: ExtensionAPI): void {
  const chat = getPiChatExtensionRegistry();

  chat.registerButton({
    id: "my-extension.hello.button",
    slot: "composer.right",
    label: "Hello",
    actionId: "my-extension.hello",
  });

  chat.registerAction({
    id: "my-extension.hello",
    title: "Say hello",
    run: (ctx) => {
      ctx.notify(`Hello from ${ctx.sessionId}`);
    },
  });

  chat.on("message.final", (event) => {
    console.log("Final message", event.message.id);
  });
}
```

## Slots

A slot is a stable semantic location in the Pi Chat UI.

Supported slots:

| Slot | Meaning |
| --- | --- |
| `session.header.right` | Right side of the active session header, near status/settings |
| `composer.right` | Right side of the message input area, near Send/Stop |
| `settings.section` | Reserved for future settings UI; not rendered yet |

`composer` means the bottom message input area where the user writes the next prompt.

### Button

```ts
chat.registerButton({
  id: "demo.composer.button",
  slot: "composer.right",
  label: "Demo",
  actionId: "demo.sayHello",
});
```

Fields:

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Stable unique button id. Use reverse-DNS or extension-prefixed ids. |
| `slot` | yes | Where the button should appear. |
| `label` | yes | Visible button text. |
| `icon` | no | Reserved for future icon support. |
| `actionId` | yes | Server action to run when clicked. |

## Actions

Actions run on the Pi Chat server, not in the browser.

```ts
chat.registerAction({
  id: "demo.sayHello",
  title: "Say hello",
  run: async (ctx) => {
    ctx.notify("Demo action clicked");
  },
});
```

Current action context:

```ts
interface PiChatActionContext {
  sessionId: string;
  notify(message: string, level?: "info" | "warning" | "error"): void;
}
```

## Extension state

Extensions can publish JSON-serializable state into authoritative snapshots.
This state is namespaced by extension id.

```ts
chat.setExtensionState("multiuser", {
  participants: [
    { id: "connection-1", role: "owner" },
    { id: "connection-2", role: "guest" },
  ],
});

chat.clearExtensionState("multiuser");
```

Snapshot shape:

```ts
extensions: {
  buttons: PiChatButton[];
  state: Record<string, unknown>;
}
```

Use this for state that must survive reconnect/snapshot rebuilds, such as participants, invite status, current role, or sharing state.

## Connection request context

Authorization middleware receives request context when a WebSocket connects.
This enables query-token demos before a full route API exists.

```ts
chat.use("connection.authorize", ({ connectionId, request }) => {
  const invite = request?.query.invite;
  console.log(connectionId, invite, request?.remoteAddress);
});
```

Request shape:

```ts
interface PiChatConnectionRequest {
  url: string;
  query: Record<string, string>;
  headers: IncomingMessage["headers"];
  remoteAddress?: string;
}
```

The browser sends a `runExtensionAction` message. Pi Chat dispatches it to the registered server action and then refreshes the session snapshot.

## Hooks

Hooks let extensions observe Pi Chat lifecycle events.

Supported hooks:

| Hook | Fired when |
| --- | --- |
| `session.snapshot` | Pi Chat builds an authoritative session snapshot |
| `message.final` | A final message event arrives from the runtime |

Example:

```ts
chat.on("message.final", (event) => {
  console.log(`[my-extension] ${event.message.role} message finalized`);
});
```

## Design rules

1. **Keep core generic.** Feature-specific code belongs in extensions.
2. **Use semantic slots.** Prefer `composer.right` over layout-dependent names like `footer.buttonRow.afterSend`.
3. **Run behavior server-side.** The browser renders metadata and sends action ids.
4. **Snapshot owns UI state.** Anything that must survive reload/reconnect should be included in the authoritative snapshot or have an explicit merge rule.
5. **Prefix ids.** Use ids like `multiplayer.invite` or `memory.context` to avoid collisions.

## What to add next

Recommended next API additions, in order:

### 1. Settings sections

Needed for features like multi-user invite links.

```ts
chat.registerSettingsSection({
  id: "multiplayer.settings",
  title: "Sharing",
  fields: [
    { id: "enabled", type: "boolean", label: "Enable invite links" },
    { id: "defaultRole", type: "select", label: "Default role", options: ["viewer", "editor"] },
  ],
});
```

### 2. Action input schemas

Buttons should be able to open small forms or send structured input.

```ts
chat.registerAction({
  id: "multiplayer.createInvite",
  title: "Create invite link",
  inputSchema: z.object({ role: z.enum(["viewer", "editor"]) }),
  run: async (input, ctx) => {},
});
```

### 3. Connection and authorization middleware

Needed before serious multi-user support.

```ts
chat.use("connection.authorize", async (event, next) => next());
chat.use("prompt.authorize", async (event, next) => next());
chat.use("action.authorize", async (event, next) => next());
```

### 4. HTTP routes

Needed for invite links and small extension APIs.

```ts
chat.registerRoute({
  method: "GET",
  path: "/invite/:token",
  handler: async (request, ctx) => {},
});
```

### 5. Extension snapshot state

Implemented for basic namespaced state. Next step: add client rendering helpers for known state shapes such as participant badges and read-only notices.

```ts
chat.setExtensionState("multiplayer", {
  participants: [],
  currentRole: "owner",
});
```

## Multi-user extension sketch

A future multi-user extension should be possible without changing core feature code if Pi Chat adds settings, middleware, routes, and extension state.

It would likely use:

- `registerButton` in `session.header.right`: Invite
- `registerSettingsSection`: sharing config
- `registerAction`: create/revoke invite
- `registerRoute`: accept invite link
- `connection.authorize`: validate invite token
- `prompt.authorize`: block viewers from sending prompts
- extension snapshot state: participants and current role
