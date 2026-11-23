# Native Pi UI contributions

- Pi extensions use native `ctx.ui` prompts, widgets and status text. Pi Chat does not expose a separate slot, button, badge, action or global extension-state registry.
- Questions may occur outside a model turn. The server owns their lifecycle; minimizing/reopening is browser-only and does not submit an answer.
- Rich prompt bodies use safe lazy Markdown/code/math rendering without raw HTML or remote images. Choices can require explicit Continue; ordinary literal menus remain immediate. Drafts, selections and minimized state belong to the browser.
- Widgets carry ANSI-styled plain string lines. Markdown is literal; HTTP(S) OSC 8 links use safe new-tab attributes. Formatting does not permit arbitrary terminal controls or client-side code execution.
- Native `ctx.ui.setStatus` entries remain in the runtime footer alongside session details.
- Pi runtime theme colors are produced server-side. The application theme does not reinterpret literal RGB/ANSI strings.
- Built-in browser contributions use the separate [plugin system](../../../docs/plugins.md).

See [presentation ownership](../../../docs/architecture-details.md#runtime-prompts-widgets-and-themes), [user interactions](usage.md#extension-prompts-and-widgets) and [browser contracts](../testing/e2e/prompt-presentation.spec.ts).
