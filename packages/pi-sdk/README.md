# Pi SDK — local v2 workspace

This is the future `pi-sdk` repository boundary: one npm package,
`@manuelselch/pi-sdk`, plus a root SwiftPM package/product named `PiSDK` and the
shared protocol contract. There is no separate protocol/client package. Nothing
is published.

**Current implementation: slice 5 complete.** Pi Chat's server, TypeScript SDK
and web application use the coordinated **v2-only** protocol. V1 wire schemas,
fixtures and parsing were removed; no compatibility/negotiation path remains.
The `PiClient` is UI-independent and owns transport lifecycle, atomic
initialization, typed requests/results, bounded correlation and immutable session
projections. Browser navigation, focus, notice anchors and optimistic UI remain
application-owned. Swift now provides a minimal connection/demo/streaming subset
for Pi Studio (see below). The quicktype probe remains a separate experiment;
this subset does not complete the slice-7 production SDK.

## Layout

```text
pi-sdk/
  Package.swift                   # Swift 6.2 / iOS 26.1 development baseline
  Sources/PiSDK/                  # Swift demo connection, text projection, streaming + Stop
  experiments/swift-generation/   # Internal v2 generation probe, not public API
  protocol/
    schema/v2/                    # Generated JSON Schema 2020-12 artifacts
    fixtures/v2/                  # Shared operation/event/domain and malformed samples
  typescript/
    package.json                  # @manuelselch/pi-sdk
    src/contract/models.ts        # Reusable domain schemas, independent of envelopes
    src/contract/v2.ts            # Authoritative Zod v2 wire contract
    src/client.ts                 # Lifecycle, requests and projections
    src/session-state.ts          # Sequenced per-runtime reducer
    src/requests/pending-requests.ts # Bounded correlation/cancellation
    scripts/                      # Generation and packed consumer verification
    test/                         # SDK, Zod/Ajv, fixture and drift checks
```

## Public TypeScript boundary

```ts
import { PiClient, PROTOCOL_VERSION, type Request, type Event } from "@manuelselch/pi-sdk";
import { requestSchema, serverMessageSchema } from "@manuelselch/pi-sdk/contract";

const request: Request<"message.send"> = {
  version: PROTOCOL_VERSION, type: "request", requestId: "request-1",
  method: "message.send", sessionId: "runtime-id", params: { message: "Hello" },
};
```

The root entry also exports the client, transport/platform interfaces, immutable
state types, projections and errors. The contract-only entry does not import the
client. The **only runtime dependency is Zod**; the package has no DOM, React,
Mantine, WebSocket implementation or Pi runtime dependency. Server-side extension
APIs remain separate from wire-contract concerns. Markdown-link interpretation
is application-owned.

Neutral files ship under
`@manuelselch/pi-sdk/protocol/schema/v2/Request.schema.json` and
`@manuelselch/pi-sdk/protocol/fixtures/v2/valid.json` (plus domain and malformed
fixtures).

## Build and verify

```sh
npm run build:sdk
npm run typecheck --workspace @manuelselch/pi-sdk
npm test --workspace @manuelselch/pi-sdk
npm run verify:package --workspace @manuelselch/pi-sdk
swift test --package-path packages/pi-sdk
npm test
npm run test:e2e
npm run test:production-smoke
```

`contract:generate` regenerates v2 JSON Schemas and shared fixture files from the
checked-in TypeScript schema/example sources. Schema and fixture drift tests
compare checked-in outputs; Zod and Ajv validate the same valid/malformed wire
families. Package verification packs locally and installs offline in a temporary
consumer, checks ESM/type imports and runs the SDK without sibling-source imports;
it never publishes or pushes.

The root npm lifecycle rebuilds this workspace before root tests and builds. If
you invoke server/web tooling directly after editing SDK source, run
`npm run build:sdk` first. Never run a clean SDK build concurrently with tests
importing its `dist` output.

## Swift generation outcome

The [generation probe](experiments/swift-generation/README.md) is refreshed from
v2 shared schemas/fixtures. Quicktype produces compiling Codable models and keeps
nested JSON, but flattens discriminated unions, accepts invalid null optionals and
does not apply validation/defaults. It is **not selected as an unmodified
production generator**. The minimal Swift client validates against bundled exact
copies of the authoritative JSON Schemas instead; drift and shared-fixture tests
prevent independently maintained wire definitions.

## Swift session browsing and streaming subset (Pi Studio / Pi Pocket)

Baseline: stable **Xcode 26.1.1 (17B100), Swift 6.2.1**, unchanged iOS **26.1**
Simulator target. SwiftPM uses tools version 6.2. No beta-toolchain or older-iOS
compatibility work was added.

Public API: `PiClient`, injectable `PiTransport`, `URLSessionPiTransport`,
`PiDemoConnection`, `PiConnectionState`, `PiSessionEvent`, `DemoSession`, `DemoSessionProjection`,
`DemoMessage`, `DemoRunStatus`, `PiError`.
`connectDemo(projectPath:takingControl:)` initializes v2 with no optional
capabilities, then creates exactly one isolated runtime. `takingControl: true`
must follow explicit user consent: the existing server replaces its previous
controller on initialization. Server-canonical project paths are returned. The caller
must create the server-side demo directory before using this demo convenience API.

Product clients use `PiSessionConnection`: `connect(takingControl:)` initializes
without creating/selecting a session; `catalogues()` publishes complete conflated
`PiCatalogue` values with independent project/inventory revisions. Project records
include Quick Chats, saved history paths and worktree metadata. `attachSession(sessionId:)`
fetches a current snapshot of an existing runtime; `openSession(sessionPath:)`
attaches a known runtime by saved path or opens that history through the server;
`createSession(projectPath:)` explicitly creates a session. The app owns selection
and navigation. Rejected opens do not create fallback sessions or poison the connection.
Attachment buffers bounded in-flight events and validates response identity; repeat
attachment retains observed partial text for the currently selected runtime. Exactly one
runtime is observed at a time: selecting another session replaces the projection, and the
previous runtime keeps running on the server. Selection is refused only while another
selection is in flight, so switching a tab is never blocked by an admitted run or a
pending mutation, and responses are matched by request identity rather than by arrival
order. `send(_:)` and `stop()` are bound to the runtime observed when they were issued; a
late result only settles while that same runtime is still observed.

`sessionEvents()` is part of that contract, so a workspace can observe them through the
protocol rather than a concrete client. It publishes bounded identity events for the
observed runtime:
`.closed(sessionId:)` when the server ends it, and `.replaced(previous:current:)` when an
atomic runtime replacement moves the work to a new identity. A replacement also swaps the
open-session inventory entry immediately so no consumer sees neither identity; navigation
remains application-owned.

`states()` is a conflated stream of complete connection states, not a raw event
queue. Actor ownership, bounded keyed request correlation (at most eight requests in
flight, matched by request identity), ten-second default waits,
16 MiB text-frame bounds and one attempt per client bound the lifecycle.
`projections()` similarly conflates complete SDK-owned text projections; a slow
consumer does not lose text deltas. Transcript storage is bounded to 4,096 visible
messages / 16 MiB UTF-8 text, with explicit failure on overflow.
`disconnect()` cancels local waits/receiving and closes the transport; it never
sends abort/close. Mutation timeout/disconnect/cancellation is an unknown
outcome, never an automatic retry. Construct a fresh client only for another
explicit connection. Call disconnect on app teardown; the provided app model
also disposes its connection on deinit.

Supported operations: `server.initialize`, `session.create`, `session.open`,
`session.snapshot`, catalogue/inventory events, `message.send`, `run.abort`, local disconnect. `send(_:)` permits one nonempty plain-text turn
while idle (no slash/bash commands or steering). Acceptance is not completion:
starting/running/aborting states settle from authoritative runtime lifecycle.
`stop()` retains observed text and waits for settlement after an accepted abort;
a completed abort response is an authoritative idle no-op. Missing start/stop
settlement has a bounded ten-second default deadline and an unknown-outcome
failure, never an indefinite local admission spinner or automatic retry. That
deadline belongs to the runtime it was admitted for: a stale deadline cannot fail a
session that happens to be observed later, and another session's idle snapshot does not
cancel it.

Core events are validated against the shared contract, checked for process/runtime
identity and sequence, and finalized text is upserted without duplicating drafts.
Snapshots cannot regress watermarks. Locally observed stopped text is retained
when a snapshot has no finalized answer. Thinking/tools are validated but not
rendered; they still advance sequence. Structured questions and event gaps fail
explicitly when attached (blocked background sessions can still be listed). A closed
selected runtime publishes `PiSessionEvent.closed` and returns the connection to browsing;
replacement publishes `PiSessionEvent.replaced` and transfers its projection atomically to
the new identity. **Gap recovery is not implemented in
this MVP**; it terminates rather than showing an incomplete valid-looking stream.

No dialogs, public close API, reconnect/gap recovery, optional capabilities,
auth, UI, or full Swift SDK parity is claimed. Production Swift slice 7 and
real-Pi model conversation acceptance remain incomplete.

The internal schema evaluator supports only the vocabulary emitted by the v2
exporter, not arbitrary JSON Schema documents. After regenerating the shared
contract, refresh its eight bundled artifacts from this package root:

```sh
for name in Request ServerMessage result.server.initialize result.session.create result.session.open result.session.snapshot result.message.send result.run.abort; do
  cp "protocol/schema/v2/$name.schema.json" Sources/PiSDK/Contract/
done
swift test
```

Tests check exact artifact drift, shared valid/malformed fixtures, denied
initialization/create, deadlines/unknown outcomes, duplicate connection guards,
cancellation, stale callbacks, unexpected closure and unreachable endpoints.
The macOS loopback test requires the repository's installed Node/tsx dependencies
and SDK dist (`npm install`, `npm run build:sdk` at repo root). It starts a fresh
server on an ephemeral loopback port with a fake runtime, empty history and
temporary metadata. It proves browsing without automatic creation, Quick Chats
catalogue publication, explicit creation, incremental text, disconnect and fresh-client
attachment to the retained runtime, two turns, Stop with partial retention and explicitly sends
`session.close` during cleanup before stopping its own server. It never connects
to the user's live backend or reads private conversation history.

Ordinary explicit demo connections retain server runtimes. Use Pi Chat or an
explicit v2 `session.close` request with the returned runtime ID to dispose of
those demos; closing the socket does not do so. Avoid repeated connects against
a long-lived backend without cleaning retained demos. Nothing is published.
