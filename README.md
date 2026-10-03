# Pi Chat

- A local browser chat for [Pi](https://github.com/earendil-works/pi)
- running on the real Pi runtime: your credentials, extensions, tools, and persistent session files.

![Pi-Chat Home](./docs/images/pi-chat-home.png)

![Pi-Chat Session](./docs/images/pi-chat-session.png)

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


## Open another folder

Choose **Open folder…** on Home or in the Projects drawer. The picker browses
folders on the **Pi Chat server**, not the device running your browser. Navigate
with folder rows, breadcrumbs, Up/Home, or enter an absolute path, `~/…`, or a
path relative to the displayed folder. Hidden folders are optional; large lists
have **Load more folders**.

**Open** or **Enter** opens a new tab with the selected folder as its working
directory. An edited path is resolved before opening; **Go** browses it without
starting a session. Any accessible existing directory works; no Git repository or previous
Pi session is required. Symlinks resolve to their canonical target. Recent projects
and explicit session resume continue to work as before.

Pi Chat assumes a trusted/local deployment. This feature exposes folders accessible
to the server process and starts an agent with existing tool permissions; it is not
a filesystem sandbox or authentication layer. Do not expose it to untrusted users.

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