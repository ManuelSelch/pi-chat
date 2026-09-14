# Pi Chat

A minimal local browser chat powered by the existing Pi SDK, credentials, tools, and persistent sessions.

## Current demo

Slices 0 and 1 provide:

- a typed, runtime-validated WebSocket protocol;
- a fake runtime for deterministic transport tests;
- an in-process Pi `AgentSessionRuntime` adapter;
- persistent current-project sessions;
- real-time assistant text streaming;
- prompt and abort controls;
- authoritative snapshots on initial connection and page reload;
- a minimal responsive chat interface.

Markdown/KaTeX, tool cards, project/session selection, slash autocomplete, and file references are later slices.

## Run

```bash
npm install
npm run dev
```

Open <http://127.0.0.1:5173>. The server listens only on `127.0.0.1:8788`.

Vite is ready in well under a second while the Pi runtime needs a few seconds to
start, so the first WebSocket attempts are refused and `vite` logs
`ws proxy error: connect ECONNREFUSED`. That is expected on a cold start: the
browser retries with backoff, the header shows `connecting`, and the composer
enables itself as soon as the snapshot arrives. You can type during the wait.

The Pi project defaults to this repository. To use another working directory:

```bash
PI_CHAT_CWD="$HOME/Documents/U_Uni" npm run dev
```

## Starting it from a Pi terminal

`extension/pi-chat.ts` adds slash commands to Pi itself. Install it once by
linking it into the global extensions folder:

```bash
ln -sf "$PWD/extension/pi-chat.ts" ~/.pi/agent/extensions/pi-chat.ts
```

| Command | Effect |
| --- | --- |
| `/pi-chat-start [--port N] [--cwd PATH] [--no-open]` | Build if needed, serve the UI for the current Pi project, and open it in the browser |
| `/pi-chat-stop` | Stop the server |
| `/pi-chat` | Show whether it runs, on which port, for which project |

Restarting lives in the UI, under the settings gear and as the `Restart server`
action in `Cmd+K`. It rebuilds the client first and only replaces the server if
that build succeeds, so a broken build leaves the running UI alone. The page
reconnects on its own once the new server is listening. The action is hidden
under `npm run dev`, whose watcher would start a competing server.

For a changed extension a whole restart is more than the job needs: `/reload`
in the chat rebuilds only that tab's Pi runtime from its session file, so
extensions, their commands, and settings are read again while the server and
every other tab keep running. The transcript survives because it lives in the
session file. It is refused while the tab is streaming, and a session that has
not been written to disk yet has nothing to reopen. An extension that registers
its own `/reload` keeps it.

Running `/pi-chat-start` while it is already up just opens the browser again. Use
`--no-open` to skip opening it. The listening server keeps
`$TMPDIR/pi-chat-server.pid` up to date, so `/pi-chat-stop` still finds it after
a restart from the browser.

The server is spawned detached, so it keeps running when the Pi session ends and
can still be stopped from a later session. Its pid and port live in
`$TMPDIR/pi-chat-server.pid`. This mode serves the built client from `dist/web`
on a single port (default 8788), so there is no Vite dev server and no `5173`.
The repository is found by following the symlink back to this checkout, so the
link above is all that is normally needed. Override it only when the extension
is copied rather than linked:

```bash
export PI_CHAT_HOME="$HOME/.pi/agent/git/pi-chat"   # before starting pi
```

## Keyboard shortcuts

| Shortcut | Effect |
| --- | --- |
| `⌘⇧O` / `Ctrl+Shift+O` | Quick-open palette: type a session or project name |
| `⌘O` / `Ctrl+O` | Same, in browsers that hand the key over (not Safari) |
| `⌘K` / `Ctrl+K` | Session actions (new, rename, close tab) plus every Pi slash command |
| `Esc` | Stop the current run; an open dialog or the command menu closes first |
| `Ctrl+C` | Clear the composer, unless text is selected so Copy still works |

Shortcuts are context-aware: `⌘K` does nothing inside the quick-open palette, and
neither palette shortcut fires on the home screen, so neither hijacks a search
field that is already open.

## Extension UI

Pi's RPC extension-UI protocol is what an extension talks to here, so an
extension written against it works without any support code in this repo.
`ctx.ui.notify` becomes a notice in the transcript, displayable
`pi.sendMessage()` custom messages become labelled transcript entries, the
blocking dialogs (`select`, `confirm`, `input`, `editor`) become modals, and
`ctx.ui.setWidget` becomes a collapsible panel around the composer — above it or
below it, matching the terminal's `aboveEditor`/`belowEditor`. A todo overlay
therefore shows up on its own, with nothing in Pi Chat knowing what a todo is.

Your personal `~/.pi/agent/extensions/todo.ts` extension is the worked example,
and the one this was built against: it gives the model a `todo` tool, you a
`/todos` command, and both a widget above the composer listing what is still
open. Nothing in it is written for Pi Chat: the state lives in the tool result's
`details`, so Pi replays it from the session branch (surviving `/reload` and
compaction, branching with `/tree`), and the only UI calls are `notify` and
`setWidget` with plain string lines. The same file renders in the terminal.

Widgets are keyed, the whole block is re-sent on every change, and `undefined`
clears one. Terminal colour is stripped, trailing spacer rows are dropped, and
unchanged content is not republished, because a widget backed by a component
repaints far more often than it changes. Snapshots carry the current panels, so
a reconnecting browser rebuilds them.

What stays inert is the genuinely terminal-shaped surface: footers, headers,
editor components, raw terminal input, and the component-factory form of
`setWidget`, none of which have a serialized form to forward. `ctx.ui.custom()`
returns `undefined` rather than throwing, which is what Pi's own RPC mode does —
throwing aborted the extension mid-call, so a `tool_call` hook that asks for
confirmation that way failed the tool call outright instead of falling back to
its own default.

## Home screen

Closing the last tab is allowed. With no session open, Pi Chat shows a home
screen with a search box and a `New session` button. It starts quiet — matching
sessions and projects are shown only after typing. `New session` starts in your
home directory by default (`os.homedir()`, `/Users/manuelselch` here). It
survives a reload, because the server holds no open session either. The projects
drawer still works there, including `New session here`.

The palette lists the most recent sessions before anything is typed, matches a
query against both the session title and its project, marks sessions that
already have a tab, and opens a project's latest session from a project row.
The drawer behind the sidebar icon remains for managing sessions (delete, new).

`Cmd+K` also deletes the session on screen. Deleting an open session closes its
tab first, so no tab points at a file that is gone; with the last tab closed the
home screen takes over. A session that is still streaming is refused, because
the run is still writing to that file, and the action is hidden while it is
busy. Deletion moves the file to the trash, so it is recoverable.

All work while the composer has focus: `useHotkeys` ignores `INPUT`/`TEXTAREA`
by default, so it is called with an empty ignore list.

**Browser-reserved keys cannot be overridden from a page.** Safari handles its
menu shortcuts (`⌘O` = Open File…, `⌘P` = Print, `⌘L`, `⌘T`, `⌘W`, …) before the
event reaches JavaScript, so `preventDefault()` never runs. Chromium is more
permissive and does pass `⌘O` through. That is why the drawer also answers to
`⌘⇧O`, and why commands use `⌘K`, which no browser claims.

## Choosing the model

By default the session uses whatever Pi would use: a resumed session keeps the
model it was last run with, otherwise `defaultProvider`/`defaultModel` from
`~/.pi/agent/settings.json` apply. **A resumed session can therefore keep a model
you have since stopped using**, which shows up as failing turns.

`PI_CHAT_MODEL` overrides it for this server only, without touching your global
Pi settings:

```bash
PI_CHAT_MODEL=doppelclaude/claude-opus-5 npm run dev
PI_CHAT_MODEL=doppelclaude/claude-opus-5:high npm run dev   # with thinking level
```

It accepts the same spelling as the Pi CLI and is resolved against the runtime
*after* extensions load, so extension-provided providers such as `doppelclaude`
resolve correctly. An unknown name fails fast at startup.

To list the models that currently have working auth:

```bash
npx tsx scripts/list-models.ts
```

The first prompt creates a standard persistent Pi session. Existing credentials and configuration are loaded from the normal Pi agent directory.

## Verification

```bash
npm test     # protocol, chat-state reducer, message mapping, transport integration
npm run build
```

The transport tests use the fake runtime, so they cost no tokens. To re-check the
Slice 1 acceptance criteria against the real Pi runtime (this sends one real
prompt and therefore spends tokens):

```bash
npx tsx scripts/verify-slice1.ts
```

It runs a prompt in a throwaway temp project, prints the delta/final counts, then
reconnects and prints the reloaded transcript. The run creates a normal Pi session
file under `~/.pi/agent/sessions/` for that temp directory.

To check cold-start recovery through the Vite proxy while `npm run dev` is
starting (no tokens spent):

```bash
npx tsx scripts/verify-reconnect.ts
```

## Architecture

```text
React projection
      │ typed WebSocket protocol
WebSocketTransport
      │
ChatApplicationService
      │
RuntimeAdapter ── PiRuntimeAdapter ── Pi AgentSessionRuntime
               └ FakeRuntimeAdapter (tests)
```

- The server owns authoritative session state.
- A snapshot replaces browser state on every connection.
- Subsequent events use monotonic sequence numbers.
- Pi SDK event shapes do not cross the network boundary.
- Provider credentials stay server-side.
