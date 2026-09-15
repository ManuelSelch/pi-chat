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
| `session.status` | Status area of the session header, before the run status |
| `session.header.right` | Right side of the active session header, near status/settings |
| `composer.right` | Right side of the message input area, near Send/Stop |
| `composer.below` | Under the message input, for notices such as read-only mode |
| `settings.section` | An "Extensions" card in the settings drawer, for switches an extension owns |

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
| `visibleTo` | no | `(ctx) => boolean`, resolved per viewer. A button that returns `false` is left out of that connection's snapshot. |

`visibleTo` is for controls only some participants may use. `action.authorize`
still has to refuse the action — the browser can send `runExtensionAction` for
any id — but hiding the button means a read-only guest is not offered a control
that answers with an error:

```ts
chat.registerButton({
  id: "multiuser.permission",
  slot: "session.header.right",
  label: guestsMayWrite ? "Block guest prompts" : "Allow guest prompts",
  actionId: "multiuser.toggleGuestWrite",
  visibleTo: ({ connectionId }) => roleOf(connectionId) === "owner",
});
```

The predicate runs on the server and is stripped from the snapshot, so it never
reaches the browser. Labels are not resolved per viewer: re-register the same
id to change one.

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
  connectionId?: string;
  sessionId: string;
  notify(message: string, level?: "info" | "warning" | "error"): void;
  /** Dialog surface of the session this action ran from; absent on the home screen. */
  ui?: ExtensionUIContext;
}
```

`ctx.ui` is the surface of the session whose button was pressed. Ask through it
rather than through a context captured elsewhere: every session has its own, and
a held one posts into another session's modal list, or into a closed session's.

### Badge

Badges are read-only status text. They can be registered as a function so each
viewer sees its own value, for example its own role in a shared session.

```ts
chat.registerBadge(({ connectionId }) => ({
  id: "multiuser.role",
  slot: "session.status",
  label: isGuest(connectionId) ? "Guest (read-only)" : "Owner",
  tone: isGuest(connectionId) ? "red" : "green",
}));
```

`tone` is one of `neutral` (default), `green`, `yellow`, or `red`.

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

State can also be a function, which is how a shared session tells each browser
about itself rather than about everyone:

```ts
chat.setExtensionState("multiuser", ({ connectionId }) => ({
  role: roleOf(connectionId),
}));
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

The browser forwards the page's query string to `/ws`, so `?invite=demo` on the
page reaches `connection.authorize` unchanged.

Returning `{ allow: false, reason }` here closes the socket with that reason, so
this is also where an unrecognised token is turned away.

## Named invite links

`ctx.ui.input` is a browser modal in Pi Chat, so an extension can ask the owner
a question and mint a link from the answer. Keep the name server-side and let
the link carry only the token:

```ts
const invites = new Map<string, { name: string }>();

chat.registerAction({
  id: "demo.invite",
  title: "Create an invite link",
  run: async (ctx) => {
    const name = (await ctx.ui?.input("Name for this guest", "e.g. Anna"))?.trim();
    if (!name) return;                     // cancelled dialog, not an error
    const token = randomUUID();
    invites.set(token, { name });
    ctx.notify(`Invite link for ${name}: ${origin}/?invite=${token}`);
  },
});

chat.use("connection.authorize", ({ connectionId, request }) => {
  const token = request?.query.invite;
  if (!token) return;                      // no link: treat as owner
  const invite = invites.get(token);
  if (!invite) return { allow: false, reason: "This invite link is not valid." };
  participants.set(connectionId, { role: "guest", label: invite.name });
});
```

Three things this shape gets right, and which a name-in-the-URL version does
not:

- **The name is not a claim.** A query parameter is editable by whoever holds
  the link, so `?name=...` would let a guest label itself anything, including
  another participant's name. Storing it against the token means the label is
  what the owner typed.
- **An unknown token is denied, never downgraded.** If the lookup falls through
  to the no-token branch, a typo'd link is treated as "no link" and lands in the
  owner path — the failure mode grants *more* access than the link carried.
  Deny before any role is assigned.
- **Unknown connections fail closed.** Resolving a role should default to the
  lesser one once sharing is on. Every real browser passes `connection.authorize`
  before it can act, so an id that is not in the participant map is an anomaly.

Dialogs are session state and reach every connected browser, so gate who may
answer them — otherwise a read-only guest can answer the owner's naming prompt,
or a tool call's permission gate:

```ts
chat.use("dialog.authorize", ({ connectionId }) =>
  mayWrite(connectionId) ? { allow: true } : { allow: false, reason: "Read-only guest." },
);
```

## Read-only guests

Authorization middleware is what makes a connection read-only. Deny the write
paths and leave the rest alone:

```ts
chat.use("prompt.authorize", ({ connectionId }) =>
  isGuest(connectionId) ? { allow: false, reason: "Read-only guest." } : { allow: true },
);
chat.use("abort.authorize", ...);
chat.use("action.authorize", ...);
```

A denied command is reported to that browser as a run error; snapshots and
events keep flowing, so the guest still watches the session live.

See [pi-chat-multiuser](https://github.com/ManuelSelch/pi-chat-multiuser) for a
working policy with named invite links and an owner-only toggle that grants or
revokes guest prompts at runtime. That extension is
off by default: loading it changes nothing until its `settings.section` button
is used, which is the pattern for an extension that widens who may reach a
session. Switching off again calls `chat.unregisterButton(id)` to take its
run-time controls back out of the snapshot.

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

## Sessions and extension lifetime

Pi loads extensions once **per open session**, so opening a second tab runs the
same extension factory again against the one global Pi Chat registry. Anything
kept in the factory's closure is therefore per session and starts over, while
the registry it publishes into is shared.

Sharing itself is server-wide, not per session: an invite link authorizes a
WebSocket connection in `connection.authorize` before any session is in play,
the tab list is shared, and every open session's snapshot is sent to every
authorized connection. A guest is a guest of the server, and a role means the
same thing in every tab.

Two consequences for an extension that owns state such as roles or invites:

```ts
// State that must survive the next session's load of this extension.
const state = chat.store("multiuser", () => ({ enabled: false, guests: new Map() }));

// An owner makes a re-registration replace its predecessor. Without it the
// first load's handler stays, and since authorization stops at the first
// denial, that stale handler keeps vetoing.
chat.use("prompt.authorize", handler, { owner: "multiuser" });
chat.on("connection.close", handler, { owner: "multiuser" });
chat.registerBadge(badge, { owner: "multiuser" });
```

Buttons, actions, and extension state are already keyed by their own id, so they
are overwritten rather than duplicated. Registrations without an `owner` stay
additive, which is what two different extensions adding the same hook need.

## Design rules

1. **Keep core generic.** Feature-specific code belongs in extensions.
2. **Use semantic slots.** Prefer `composer.right` over layout-dependent names like `footer.buttonRow.afterSend`.
3. **Run behavior server-side.** The browser renders metadata and sends action ids.
4. **Snapshot owns UI state.** Anything that must survive reload/reconnect should be included in the authoritative snapshot or have an explicit merge rule.
5. **Prefix ids.** Use ids like `multiplayer.invite` or `memory.context` to avoid collisions.
6. **Own your registrations.** Pass `{ owner }` and keep state in `chat.store`, so a second session's load of the extension replaces rather than fights its predecessor.

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

Buttons should be able to open small forms or send structured input. `ctx.ui`
covers the one-question case already; a schema would avoid a modal that every
connected browser sees, and would let an action be parameterised per click.

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

Query-parameter tokens cover invite links today (see above). Routes would add
landing pages for them, plus small extension APIs.

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
- `registerAction`: create/revoke invite (implemented in the demo)
- `registerRoute`: accept invite link
- `connection.authorize`: validate invite token (implemented in the demo)
- `prompt.authorize`: block viewers from sending prompts
- extension snapshot state: participants and current role
