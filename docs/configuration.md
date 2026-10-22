# Configuration and troubleshooting

## Server lifecycle

Installing with `pi install git:github.com/ManuelSelch/pi-chat` clones the repo
into `~/.pi/agent/git/pi-chat` and registers these Pi commands:

- `/pi-chat-start`: start the server.
- `/pi-chat-stop`: stop the server.
- `/pi-chat`: show status.

`/pi-chat-start` builds the production web UI and backend on each new start, then
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
