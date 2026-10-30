# Pi Chat extension API

Pi Chat consumes a small server-side registry owned by the independent
`@manuelselch/pi-server/extensions` package. Extensions can add buttons/badges to
known UI slots, register actions, keep extension-owned state and listen to chat
lifecycle hooks. Register extension-bearing packages explicitly through Pi's
resource loading; Chat does not copy extension source into the browser. See
[package ownership](architecture.md#package-boundaries) and the
[installed contract boundary](protocol.md).

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getPiChatExtensionRegistry } from "@manuelselch/pi-server/extensions";

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

## Native Pi UI contributions

The registry below is distinct from Pi's native `ctx.ui` prompt/widget methods.
Those interactions use server-owned registries and SDK presentation state:

- Questions may occur outside a model turn. They expire after five minutes;
  losing the controller starts a 60-second grace period. Minimize/reopen is
  browser-only and does not pause either timer or submit an answer.
- Rich prompt bodies reuse safe lazy Markdown/code/math rendering without raw
  HTML or remote images. Question choices can require explicit Continue;
  ordinary literal menus remain immediate. Draft/selection/minimized state is
  browser-owned, not an extension history store.
- Widgets carry ANSI-styled plain string lines. Markdown is literal; HTTP(S)
  OSC 8 links are supported with safe new-tab attributes. Formatting does not
  imply arbitrary terminal-control support or client-side code execution.
- Pi runtime theme colors are produced server-side. Browser remembered shell
  appearance does not reinterpret an extension's literal RGB/ANSI strings.

See [presentation ownership](architecture.md#runtime-prompts-widgets-and-themes),
[user interactions](usage.md#extension-prompts-and-widgets) and
[browser contracts](../test/e2e/prompt-presentation.spec.ts).

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
