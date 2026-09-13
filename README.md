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

The Pi project defaults to this repository. To use another working directory:

```bash
PI_CHAT_CWD="$HOME/Documents/U_Uni" npm run dev
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
