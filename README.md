# Pi Chat

- A local browser chat for [Pi](https://github.com/earendil-works/pi)
- running on the real Pi runtime: your credentials, extensions, tools, and persistent session files.

## Features

- streaming assistant text, tool cards, Markdown + KaTeX
- multiple tabs over persistent Pi sessions, with project/session browsing
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


## Extension API

Pi Chat has an experimental modular web-extension API for local trusted extensions.
External extensions can currently add declarative buttons to stable UI slots,
handle those clicks with server-side actions, and observe a small set of
lifecycle hooks.

See [docs/extension-api.md](docs/extension-api.md).

## Keyboard shortcuts

| Shortcut | Effect |
| --- | --- |
| `⌘⇧O` / `Ctrl+Shift+O` | Quick-open: type a session or project name |
| `⌘O` / `Ctrl+O` | Same, in browsers that hand the key over (not Safari) |
| `⌘K` / `Ctrl+K` | Session actions (new, rename, delete, close tab) plus every Pi slash command |
| `Esc` | Stop the current run; an open dialog or menu closes first |
| `Ctrl+C` | Clear the composer, unless text is selected so Copy still works |



## Environment variables

| Variable | Meaning |
| --- | --- |
| `PI_CHAT_PORT` | Port to listen on (default `8788`) |
| `PI_CHAT_CWD` | Pi project directory for new sessions |
| `PI_CHAT_MODEL` | Model override for this server |
| `PI_CHAT_HOME` | Path to this checkout, when the extension is not inside it |