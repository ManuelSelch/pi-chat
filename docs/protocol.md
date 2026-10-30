# Protocol integration boundary

Pi Chat consumes **wire version 2 only** through `PiClient` and
`@manuelselch/pi-sdk/protocol`. Package versions and wire versions are different.
The [TypeScript SDK](https://github.com/ManuelSelch/pi-sdk-typescript) owns the
Zod schemas, domain models, generated JSON Schemas and fixtures. Its public
`/protocol/schema/v2/` and `/protocol/fixtures/v2/` artifacts describe exact
payloads. This page explains Chat's integration, not a duplicate wire schema.
Use the [manifest/lockfile and artifact provenance](../vendor/README.md) for the
contract installed by this checkout; upstream main may be newer.

## Ownership and connection

- The server owns execution, saved history, runtime inventory, authoritative
  prompts and catalogue. The SDK owns transport, request correlation, operation
  outcomes, immutable projections, sequence recovery and reconnect.
- The browser supplies an explicit endpoint and WebSocket implementation.
  Navigation, active selection, composer drafts, Later and theme appearance
  persistence are application-owned; there is no focus/tab-selection message.
- `/ws` carries JSON text messages. `server.initialize` is the first request and
  readiness barrier. Apply its complete result before submitting operations.
  Inventory, snapshots, selected capabilities and server/connection identity are
  initialized together. Catalogue revision zero can be a cold-start placeholder;
  later discovery arrives through a catalogue update.
- A new controller replaces the old controller only after initialization.
  Superseded connections close with code `4001` and do not automatically fight
  for control. User action explicitly calls `takeControl()`.
- Origin validation still applies behind a proxy. The server and SDK do not add
  authentication/OAuth; protect the backend as described in
  [configuration](configuration.md#private-network-access).

## Identity and response meaning

`serverInstanceId` identifies a server process. `connectionId` identifies an
initialized connection. Opaque `sessionId` identifies a runtime incarnation;
`sessionPath` identifies saved server-local history. Closing/reopening or runtime
replacement can change the runtime ID. Same-runtime reconnect and in-place
resource reload retain it. Stale IDs must not be retargeted to another runtime.

Common typed operations used by Chat:

| SDK operation | Wire method | A successful response means |
|---|---|---|
| `createSession`, `openSession` | `session.create`, `session.open` | Runtime loaded/created; summary, snapshot and required concrete theme supplied |
| `closeSession` | `session.close` | Runtime teardown completed; saved history not deleted |
| `prompt` | `message.send` | Submission admitted, not assistant/model completion |
| `abort` | `run.abort` | Stop admitted, or completed no-op when idle; not runtime closure |
| `compactSession`, `reloadSession` | `session.compact`, `session.reload` | Asynchronous Pi work admitted |
| `respondToPrompt` | `prompt.answer` | Answer submission completed, with kind/options validated server-side |
| `selectModel`, `setThinkingLevel` | `model.select`, `thinking.level` | Structured settings change completed |
| `runExtensionAction` | `extension.run` | Extension work admitted |
| `completeCommandArguments` | `command.complete` | Session-bound suggestions returned; command not executed |
| `browseDirectories` | `directory.browse` | Server-local directory listing returned |
| `openFile` | `file.open` | Server OS opener accepted the file; no bytes transferred or display guarantee |
| `archiveSession` | `session.archive` | Saved-history metadata changed; persistence uncertainty must remain visible |
| `pinProject`, `removeProject` | `project.pin`, `project.remove` | Catalogue metadata changed, not filesystem deletion |
| `restartServer` | `server.restart` | Restart attempt admitted, not healthy-successor confirmation |

The generic typed `request` API also exposes inventory/catalogue/snapshot queries
and liveness checks. Optional methods require capabilities selected during
initialization. The SDK rejects unselected operations rather than inventing a
fallback.

Long-operation admission returns an `operationId`; subsequent
`operation.finished` reports settlement. Steering submission settlement is not
queue consumption or completion of the ongoing run. Errors remain structured
SDK/server errors; a command rejection must not falsely settle other active work.

## Recovery, cancellation and uncertainty

Session events have per-runtime sequences; snapshots carry `throughSequence`.
Inventory, catalogue and optional presentation updates use independent revisions.
The SDK ignores stale data, heals bounded gaps with snapshots and reconnects if
recovery fails. Initialization replaces authoritative connection state, not
browser navigation policy. Snapshots reflect Pi context, including compaction.
Finalized messages use stable IDs; incomplete stream-prefix recovery is not
promised after reconnect.

SDK failures distinguish server rejection, local `notSent` and handed-off
`unknown` outcomes. Timeout, cancellation after sending, disconnect or disposal
can mean the server still executed. Do not automatically replay mutations or
claim rollback. Reconcile state or let the user explicitly decide.
`stop()`/`dispose()` cancel local waits and detach transport, not server runtimes.
There is no offline mutation queue, replay journal or implicit heartbeat.

Open/create theme metadata is required. Snapshot, reload and initialization do
not provide replacement palettes. The SDK retains eligible same-server runtime
cache entries across reconnect, and clears them on runtime removal/replacement
or server-instance changes. Browser remembered appearance is not restored into
this cache; see [themes](configuration.md#pi-themes).

## Verification ownership

Chat's [contract integration checks](../test/modules/shared/sdk-contract.test.ts)
and [application drivers](integration-tests/DRIVERS.md) exercise the installed
public SDK/server boundary. Protocol generation, malformed-wire fixtures and
server-internal lifecycle tests belong to their owning repositories. Swift owns
its separate imported artifacts and real-server compatibility suite. A passing
Chat scenario does not establish full cross-language or native UI parity.
