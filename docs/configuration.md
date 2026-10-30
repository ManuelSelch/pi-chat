# Configuration and troubleshooting

## Server lifecycle

Installing with `pi install git:github.com/ManuelSelch/pi-chat` clones the repo
into `~/.pi/agent/git/pi-chat` and registers these Pi commands:

- `/pi-chat start [--port N] [--cwd PATH] [--no-open]`: start the server.
- `/pi-chat stop`: stop the managed server.
- `/pi-chat restart`: rebuild and restart the managed server without taking browser control.
- `/pi-chat`: show status.

The old `/pi-chat-start` and `/pi-chat-stop` commands are removed. Subcommands
support argument completion. Restart keeps the server's port, project and environment;
it does not open a new browser tab. Build failure keeps the old server running.
The command waits up to 120 seconds for a healthy successor; if not confirmed,
check the server logs and status before retrying. Restart does not automatically
retry or terminate a slow build. Manually launched/development servers cannot be
restarted by this command. A server predating restart-signal support must be
stopped and started once with the new commands before command restart is available.
The separate Settings restart control remains available; session action menus no
longer offer Restart server.

`/pi-chat start` builds the production web UI and backend on each new start, then
runs the compiled backend with Node. Generated `dist/` artifacts are local and
are not committed. See [Development](development.md) for the watch-mode workflow.

## npm-backed operations

Browser-triggered rebuilds, README capture and SDK package verification use the
npm CLI installed alongside the running Node executable on macOS/Linux. Standard
Homebrew and Node/npm distributions may use a sibling `npm` symlink. Missing or
unsupported layouts fail clearly rather than searching `PATH` or trusting
`npm_execpath`; a failed restart build leaves the current server running. Install
npm alongside the Node installation used to launch Pi Chat to resolve this error.
The installation, repository and downstream build-tool environment must remain trusted.

## Environment variables

| Variable | Meaning |
| --- | --- |
| `PI_CHAT_HOST` | Address to bind to (default `127.0.0.1`; opt in to `0.0.0.0` for all IPv4 interfaces) |
| `PI_CHAT_PORT` | Port to listen on (default `8788`) |
| `PI_CHAT_CWD` | Pi project directory for new sessions |
| `PI_CHAT_MODEL` | Model override for this server |
| `PI_CHAT_HOME` | Path to this checkout, when the extension is not inside it |
| `PI_CHAT_LOG_DIR` | Server log directory (default `~/.pi/agent/logs`) |
| `PI_CHAT_LOG_MAX_BYTES` | Maximum size of the active log (default 5 MiB) |
| `PI_CHAT_LOG_RETAINED_FILES` | Number of rotated log files to retain (default `3`) |

## Backend endpoint

Settings → **Backend server** lets you enter a complete WebSocket URL, such as
`wss://pi.home.example/ws`. Leave the field blank to use this page's server.
**Save and reload** persists the selection and reloads the page;
**Reset to default** removes the override and reloads. Both ask for confirmation:
unsent drafts in all application tabs are discarded, but server sessions keep
running. Commands are not replayed.

The override is stored under `pi-chat:serverEndpoint` in localStorage for this
browser profile and UI origin. It survives browser restarts, but is not shared
with another device, browser profile or site. If browser storage cannot be
written, Settings reports the failure without changing the connection. Invalid
saved URLs are ignored at startup with a warning in Settings; reset clears them.

Without an override, the URL is derived from the page's host/port, `/ws`, and page
query string, using `ws` for HTTP or `wss` for HTTPS. An explicit override is used
as entered (trimmed); the page query is not appended. HTTPS pages require `wss`.
URL credentials and fragments are rejected. Avoid putting secrets in the URL:
storage is not a credential vault. The current-endpoint display redacts query
strings; the editable field contains the full saved URL.

This setting does **not** bypass pi-server's existing browser-origin protection.
The supported deployment serves Pi Chat and the backend through the same
browser-facing host/port, including behind a reverse proxy and VPN. A different
host/port may be rejected. To use another server's bundled Pi Chat, open that
server's own page URL instead. No trusted-origin allowlist is added. Proxy
WebSocket upgrades correctly, retain VPN/proxy authentication, and keep the
backend private.

An unreachable or rejected saved endpoint does not automatically fall back to
another server. Open Settings even while disconnected and correct the address or
use **Reset to default**.

## Pi themes

Pi Chat uses the active runtime's Pi theme for the shell, controls, dialogs,
status colors, messages and diff colors. Extension widgets use the same runtime's
Pi colors; literal RGB and already-rendered ANSI strings are preserved.

For the original Pi Chat palette, use the bundled [Classic light and dark
themes](../themes/README.md). That guide covers installation, terminal appearance
pairs and the limits of matching the original browser colors.

- Put a complete custom Pi theme in `~/.pi/agent/themes/my-theme.json` (or a
  project theme resource allowed by Pi's existing trust/resource rules).
  Start from a valid Pi theme, not a partial Mantine palette.
- Select it with `"theme": "my-theme"` in Pi's effective settings, for example
  `~/.pi/agent/settings.json`. Set the theme file's `appearance` to `light`
  or `dark`; Chat follows it rather than browser appearance.
- Use concrete colors for every Pi token, including text. Avoid empty/default
  terminal colors for headless use. Pi variables and its supported color formats
  work. Optional Pi `export.pageBg`, `export.cardBg`, and `export.infoBg`
  set exact interface surfaces; otherwise Pi's export derivation supplies them.
- Missing, invalid, unavailable, system or terminal-dependent themes use Pi's
  deterministic dark fallback and emit a server diagnostic. Fixed light/dark
  pairs select their dark member.

**Lifetime and limits:** themes resolve when a runtime is created or replaced,
not on `/reload`. To apply edited theme files, close the runtime and open/create
it again; opening an already-running runtime returns its existing cached palette.
Tab changes use each runtime's cached palette, including inside portalled dialogs.
Ordinary snapshots, explicit reload and same-server reconnect preserve the cache;
close or server-instance changes clear it.

Separately, Pi Chat remembers the last selected runtime's resolved palette in
browser-local storage (`pi-chat:lastTheme`). Home, settings and dialogs keep this
appearance after all sessions close, and browser refresh restores it. A selected
runtime's palette takes precedence and updates the remembered appearance;
background sessions do not. This does not restore SDK cache entries or recolor
extension widgets. Remembered colors may remain stale until a selected runtime
supplies its actual palette. Storage is per browser origin, not per server process.

Initialization still carries no palette. A new client with no valid remembered
palette uses Mantine's auto-scheme defaults until a successful open/create
response. Invalid or unavailable storage is ignored; if writes fail, appearance
is retained in memory until the page closes. There are no hidden recovery
requests, theme selector, watcher or browser-to-terminal synchronization.
Syntax highlighting retains its existing light/dark palettes. Theme data is
required in open/create responses; older responses without it are rejected,
not silently accepted.

## Private network access

After building, opt in to listening on all IPv4 interfaces:

```sh
PI_CHAT_HOST=0.0.0.0 PI_CHAT_PORT=8788 npm start
```

Open `http://<VM-private-IP>:8788` from a VPN-connected device. The same port
serves the web UI and WebSocket. The server has no application authentication;
restrict access with a firewall to trusted VPN clients and never expose it
publicly. For authenticated HTTPS/WSS, use a reverse proxy and keep the backend
loopback/private so clients cannot bypass proxy authentication.

## Troubleshooting WebSocket connections

Pi Chat writes structured server logs to `~/.pi/agent/logs/pi-chat.log`. The active
file is limited to 5 MiB, with three rotated files retained alongside it.

Follow new events with:

```sh
tail -f ~/.pi/agent/logs/pi-chat.log
```

Browser WebSocket close codes, reasons, and clean/unclean status are also printed
in the browser Developer Console with the `[pi-chat] websocket.close` prefix.

Logs include connection lifecycle metadata and redacted runtime error messages,
not chat frames, prompts, model output, or tool content. Use the logging
environment variables above to change the log location, size, and retention.
