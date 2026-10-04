# Pi Chat

- A local browser chat for [Pi](https://github.com/earendil-works/pi)
- running on the real Pi runtime: your credentials, extensions, tools, and persistent session files.

![Pi-Chat Home](./docs/images/pi-chat-home.png)
![Pi-Chat Session](./docs/images/pi-chat-session.png)
![Pi-Chat Session](./docs/images/pi-chat-latex.png)
![Pi-Chat Session](./docs/images/pi-chat-commands.png)
![Pi-Chat Session](./docs/images/pi-chat-session-light.png)

## Features

- streaming assistant text, tool cards, Markdown + KaTeX
- multiple tabs over persistent Pi sessions, with project/session browsing
- server folder picker to start sessions in folders without previous Pi history
- slash commands, a command palette, and quick-open
- extension UI support: `notify`, dialogs, `setWidget` panels, `setStatus` footer labels, and experimental web extension slots/actions/hooks

## Install

```bash
pi install git:github.com/ManuelSelch/pi-chat
```

That clones the repo into `~/.pi/agent/git/pi-chat` and registers the extension,
which adds three commands to any Pi session:
- `/pi-chat-start`: start pi-chat server
- `/pi-chat-stop`: stop pi-chat server
- `/pi-chat`: show status

## Keyboard shortcuts

| Shortcut | Effect |
| --- | --- |
| `⌘⇧O` / `Ctrl+Shift+O` | Quick-open: type a session or project name |
| `⌘O` / `Ctrl+O` | Same, in browsers that hand the key over (not Safari) |
| `⌘K` / `Ctrl+K` | Session actions (new, rename, delete, close tab) plus every Pi slash command |
| `Esc` | Stop the current run; an open dialog or menu closes first |
| `Ctrl+C` | Clear the composer, unless text is selected so Copy still works |



## Server organization

`src/server/index.ts` remains the process entry point. Server code is grouped by ownership:

- `bootstrap/`: HTTP server composition and process restart
- `application/`: chat coordination and open-session registry
- `transport/`: WebSocket connections and protocol handling
- `runtime/contracts.ts`: runtime adapter, factory, event and snapshot contracts; `runtime/pi/` contains the Pi adapter, browser UI bridge and SDK cache workaround
- `projects/`: session catalogue and directory browsing
- `extensions/`: web extension registry; `extensions/ui/` contains prompt, widget and status registries

The test fake lives in `test/support/fake-runtime-adapter.ts`, separate from production contracts. Runtime implementation extraction is deferred.
The old `src/server/extension-registry.ts` import remains a deprecated compatibility re-export of `extensions/extension-registry.ts`.

## Environment variables

| Variable | Meaning |
| --- | --- |
| `PI_CHAT_PORT` | Port to listen on (default `8788`) |
| `PI_CHAT_CWD` | Pi project directory for new sessions |
| `PI_CHAT_MODEL` | Model override for this server |
| `PI_CHAT_HOME` | Path to this checkout, when the extension is not inside it |