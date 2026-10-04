# Pi Chat extension API

Pi Chat exposes a small server-side registry for local Pi extensions. The API is intentionally simple: extensions can add buttons/badges to known UI slots, register actions for those buttons, keep small extension-owned state, and listen to chat lifecycle hooks.

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getPiChatExtensionRegistry } from "../src/server/extensions/extension-registry.js";

export default function demo(_pi: ExtensionAPI): void {
  const chat = getPiChatExtensionRegistry();

  chat.registerButton({
    id: "demo.composer.button",
    slot: "composer.right",
    label: "Demo",
    actionId: "demo.sayHello",
  });

  chat.registerAction({
    id: "demo.sayHello",
    title: "Say hello",
    run: (ctx) => ctx.notify(`Hello from ${ctx.sessionId}`),
  });

  chat.on("message.final", (event) => {
    console.log(`[demo] finalized ${event.message.role} message ${event.message.id}`);
  });
}
```

## Slots

Supported slots:

- `session.header.right`
- `session.status`
- `composer.right`
- `composer.below`
- `settings.section`

## Buttons

```ts
chat.registerButton({
  id: "demo.header.button",
  slot: "session.header.right",
  label: "Demo",
  icon: "✨",
  actionId: "demo.sayHello",
});

chat.unregisterButton("demo.header.button");
```

## Badges

```ts
chat.registerBadge({
  id: "demo.status",
  slot: "session.status",
  label: "Demo",
  tone: "green",
});
```

Badge tones are `neutral`, `green`, `yellow`, and `red`. If omitted, the server sends `neutral`.

## Actions

```ts
chat.registerAction({
  id: "demo.ask",
  title: "Ask",
  async run(ctx) {
    const answer = await ctx.ui?.input("Demo", "Your value");
    ctx.notify(`Answer: ${answer ?? "none"}`);
  },
});
```

Action context:

- `sessionId`
- `notify(message, level?)`
- `ui?` for session-bound dialogs; absent on the home screen

## Extension state

State is included in each snapshot under `snapshot.extensions.state`.

```ts
chat.setExtensionState("demo", { enabled: true });
chat.clearExtensionState("demo");
```

For state that should survive extension reloads within the same server process, use `store`:

```ts
const state = chat.store("demo", () => ({ enabled: false }));
state.enabled = true;
chat.setExtensionState("demo", state);
```

## Hooks

Supported hooks:

- `message.final`
- `session.snapshot`

```ts
chat.on("session.snapshot", ({ sessionId }) => {
  console.log(`snapshot for ${sessionId}`);
});
```

## Owned registrations

Pi may load the same extension more than once when multiple sessions are opened. Pass an `owner` for registrations that should replace the previous registration from the same extension instead of stacking.

```ts
chat.on("message.final", handler, { owner: "demo" });
chat.registerBadge({ id: "demo.status", slot: "session.status", label: "Demo" }, { owner: "demo" });
```
