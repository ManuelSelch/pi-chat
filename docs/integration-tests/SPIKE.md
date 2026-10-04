# Harness compatibility spike

Verified against the commit-pinned GitHub ManuelSelch fork and Pi 0.85.1. This is a
standalone spike, not the final `PiChatDriver` API or part of the default suite.

## Reproduce

From this Pi Chat checkout:

```sh
npm ci
npm run test:spike
```

The dev dependency is pinned to:

```text
git+https://github.com/ManuelSelch/pi-test-harness.git#7ade82c6c7de2ae85f69df1c442a515b63c6dadc
```

No local harness checkout or tarball is required. Git and network access to GitHub
are needed for installation. The fork's `prepare` lifecycle builds its exported
JavaScript when npm installs it from Git; do not disable install scripts. The
explicit Pi AI/agent-core dev dependencies pin the harness peers to 0.85.1 rather
than allowing npm to select an incompatible newer release.

## Verified

- Isolated real Pi `AgentSession` with scripted model responses (no API calls).
- Real `AgentSessionRuntime` and `PiRuntimeAdapter`, not a fake runtime.
- Real Pi Chat server on an ephemeral loopback port.
- Schema-validated WebSocket snapshots, prompt, assistant final message, and idle.
- Complete ordered user/assistant transcript and fully consumed playbook.
- Reconnect snapshot restores that transcript.
- Cleanup of sockets, server, runtime, and harness temporary directory.
- Event-driven bounded waits without polling or sleeps.

Latest checks: harness 69 tests passed; Pi Chat 401 tests passed; Pi Chat build
passed. The dependency graph is now declared in package.json/package-lock.json.

## Implementation seams

`TestSession.prepare(...turns)` installs the playbook and tool interception without
submitting prompts. Existing `run()` delegates preparation, submits prompts, and
retains its automatic consumption assertion. Host-driven callers check
`playbook.remaining` themselves.

`PiRuntimeAdapter.fromRuntime(runtime)` attaches to an already-initialized runtime
and takes ownership of disposal. It does not emit another extension startup event.
The harness already initializes the session. `AgentSessionRuntime` uses that
session's model runtime, settings, and resource loader; its replacement factory
explicitly throws because replacement is outside this spike.

## Not yet verified

Tabs/new sessions/runtime replacement, tools driven through Pi Chat, extension UI
integration, abort/recovery, persisted session reopening, browser React rendering,
and the final domain driver are not covered here. The spike restores one live
session's transcript by reconnecting, not by restarting the application.
